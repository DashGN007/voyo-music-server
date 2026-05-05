#!/usr/bin/env python3
"""
download-moments-to-r2.py
=========================
Downloads moment videos from Instagram/TikTok via yt-dlp and uploads them
to Cloudflare R2. This populates the r2_video_key files so the VOYO edge
worker can stream them directly without platform embed iframes.

Prerequisites:
    pip install yt-dlp boto3 requests
    yt-dlp must be installed and in PATH

Usage:
    python3 scripts/download-moments-to-r2.py              # all platforms
    python3 scripts/download-moments-to-r2.py --platform instagram
    python3 scripts/download-moments-to-r2.py --platform tiktok
    python3 scripts/download-moments-to-r2.py --limit 50   # batch size
    python3 scripts/download-moments-to-r2.py --dry-run    # log only

The script:
  1. Queries Supabase for active moments whose r2_video_key does not exist in R2
  2. Downloads each video to /tmp/voyo_moments/ using yt-dlp
  3. Uploads to R2 at the r2_video_key path
  4. On success, does NOT modify the DB (key was already set correctly)
"""

import os
import sys
import time
import json
import shutil
import argparse
import subprocess
import tempfile
from pathlib import Path

import requests
import boto3
from botocore.config import Config

# ── Config ────────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SUPABASE_KEY = os.environ.get(
    'SUPABASE_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubWd5eGhueWhieXh6cGpoeGd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk3MTc0MCwiZXhwIjoyMDgxNTQ3NzQwfQ.R01xDTxUs9oOirsiJIHXE_cLujY49rU8oJmTNhB_dQY'
)

R2_ACCOUNT_ID = '2b9fcfd8cd9aedbde62ffdd714d66a3e'
R2_ACCESS_KEY = '82679709fb4e9f7e77f1b159991c9551'
R2_SECRET_KEY = '306f3d28d29500228a67c8cf70cebe03bba3c765fee173aacb26614276e7bb52'
R2_BUCKET = 'voyo-audio'

EDGE_WORKER = 'https://voyo-edge.dash-webtv.workers.dev'
DOWNLOAD_DIR = Path('/tmp/voyo_moments')

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

# ── R2 client ─────────────────────────────────────────────────────────────

def get_r2():
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
    )

def r2_exists(r2, key: str) -> bool:
    try:
        r2.head_object(Bucket=R2_BUCKET, Key=key)
        return True
    except Exception:
        return False

def r2_upload(r2, local_path: Path, key: str) -> bool:
    try:
        r2.upload_file(
            str(local_path),
            R2_BUCKET,
            key,
            ExtraArgs={
                'ContentType': 'video/mp4',
                'CacheControl': 'public, max-age=31536000',
            }
        )
        return True
    except Exception as e:
        print(f'  [r2] Upload failed: {e}')
        return False

# ── Supabase helpers ──────────────────────────────────────────────────────

def fetch_moments(platform: str | None, limit: int) -> list[dict]:
    params = 'is_active=eq.true&r2_video_key=not.is.null'
    if platform:
        params += f'&source_platform=eq.{platform}'
    url = f'{SUPABASE_URL}/rest/v1/voyo_moments?{params}&select=id,source_id,source_platform,r2_video_key,source_url&limit={limit}'
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()

# ── yt-dlp download ───────────────────────────────────────────────────────

def download_video(source_url: str, out_path: Path) -> bool:
    """Download video using yt-dlp. Returns True on success."""
    cmd = [
        'yt-dlp',
        '--format', 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--no-warnings',
        '--quiet',
        '--output', str(out_path),
        source_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 10_000:
            return True
        print(f'  [yt-dlp] failed (rc={result.returncode}): {result.stderr[:200]}')
        return False
    except subprocess.TimeoutExpired:
        print('  [yt-dlp] timeout')
        return False
    except Exception as e:
        print(f'  [yt-dlp] error: {e}')
        return False

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Download moment videos to R2')
    parser.add_argument('--platform', choices=['instagram', 'tiktok'], help='Filter by platform')
    parser.add_argument('--limit', type=int, default=100, help='Max moments to process')
    parser.add_argument('--dry-run', action='store_true', help='Log only, no downloads or uploads')
    args = parser.parse_args()

    # Check yt-dlp is available
    if not shutil.which('yt-dlp'):
        print('ERROR: yt-dlp not found. Install with: pip install yt-dlp')
        sys.exit(1)

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    print(f'Fetching moments (platform={args.platform or "all"}, limit={args.limit})...')
    moments = fetch_moments(args.platform, args.limit * 3)  # fetch more to skip already-uploaded
    print(f'Found {len(moments)} moments with r2_video_key set')

    r2 = get_r2()
    processed = done = skipped = failed = 0

    for m in moments:
        if processed >= args.limit:
            break

        source_id = m['source_id']
        r2_key = m['r2_video_key']
        source_url = m.get('source_url', '')
        platform = m['source_platform']

        if not source_url:
            print(f'  [{platform}] {source_id}: no source_url, skip')
            skipped += 1
            continue

        # Skip if already in R2
        if r2_exists(r2, r2_key):
            skipped += 1
            continue

        processed += 1
        print(f'[{processed}] {platform}/{source_id}')

        if args.dry_run:
            print(f'  DRY-RUN: would download {source_url} → {r2_key}')
            continue

        out_file = DOWNLOAD_DIR / f'{source_id}.mp4'
        try:
            # Download
            if not download_video(source_url, out_file):
                failed += 1
                continue

            size_mb = out_file.stat().st_size / (1024 * 1024)
            print(f'  Downloaded {size_mb:.1f}MB → uploading to r2/{r2_key}')

            # Upload
            if r2_upload(r2, out_file, r2_key):
                print(f'  ✓ {r2_key}')
                done += 1
            else:
                failed += 1
        finally:
            if out_file.exists():
                out_file.unlink()

        time.sleep(1)  # be gentle on platform CDNs

    print(f'\nDone. Uploaded={done} Skipped={skipped} Failed={failed}')

if __name__ == '__main__':
    main()
