#!/usr/bin/env python3
"""
import-r2-orphans-to-moments.py
================================
Imports R2 video files that exist but have no matching voyo_moments row,
creating minimal rows so the feed can serve them immediately.

Why:
  R2 has ~6,095 Instagram + 931 TikTok videos (uploaded from a previous
  archive era). Most of those numeric IDs do NOT exist as source_ids in
  the current voyo_moments table — meaning the videos exist but the
  feed has no rows pointing to them, so they never play.

What this does:
  1. List all R2 keys under moments/{instagram,tiktok}/
  2. For each, check if a voyo_moments row exists with that source_id
  3. If not, INSERT a minimal row:
       source_id        = numeric ID from the R2 filename
       source_platform  = 'instagram' / 'tiktok'
       r2_video_key     = 'moments/{platform}/{numeric}.mp4'
       title            = '' (Phase 2 enriches via yt-dlp)
       is_active        = true
       discovered_by    = 'r2-orphan-import'
       all counters     = 0
  4. Bulk INSERT in batches of 100

The new platform-aware worker route /r2/feed/{platform}/{source_id} will
then stream these directly from R2 with no Supabase roundtrip.

Phase 2 (separate script): yt-dlp --skip-download to fill creator,
title, thumbnail_url, view_count over time.

Usage:
    python3 scripts/import-r2-orphans-to-moments.py --dry-run
    python3 scripts/import-r2-orphans-to-moments.py
    python3 scripts/import-r2-orphans-to-moments.py --platform instagram
    python3 scripts/import-r2-orphans-to-moments.py --batch 50
"""

import os, sys, json, time, argparse, urllib.request, urllib.parse
from datetime import datetime, timezone
import boto3
from botocore.config import Config

# ── Config ───────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
R2_ACCOUNT_ID = '2b9fcfd8cd9aedbde62ffdd714d66a3e'
R2_ACCESS_KEY = '6124be38f957fd61f25cd62580c158f2'
R2_SECRET_KEY = 'b8b65e5d3b1c34dd1e490c5d49569957a09802baffa91a9225372f2e54b50530'
R2_BUCKET = 'voyo-audio'

# ── Supabase ─────────────────────────────────────────────────────────────

def load_key():
    env = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('SUPABASE_SERVICE_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('SUPABASE_SERVICE_KEY', '')

SERVICE_KEY = load_key()
HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}

def sb_fetch_all_source_ids(platform: str) -> set[str]:
    """Fetches every source_id for the platform in paginated batches.
    One pass instead of N point-lookups — much friendlier to a stressed DB."""
    existing: set[str] = set()
    PAGE = 1000
    offset = 0
    while True:
        params = {
            'source_platform': f'eq.{platform}',
            'select':          'source_id',
            'order':           'discovered_at.desc',
            'limit':           str(PAGE),
            'offset':          str(offset),
        }
        url = f'{SUPABASE_URL}/rest/v1/voyo_moments?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
        })
        rows = None
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    rows = json.loads(r.read())
                break
            except Exception as e:
                wait = 2 ** attempt
                print(f'  [warn] fetch source_ids offset={offset} attempt={attempt+1}: {e} — retry in {wait}s')
                time.sleep(wait)
        if rows is None:
            print(f'  [error] giving up on offset={offset} — proceeding with what we have')
            break
        if not rows:
            break
        for row in rows:
            existing.add(row['source_id'])
        if len(rows) < PAGE:
            break
        offset += PAGE
        print(f'    …loaded {len(existing)} existing source_ids so far')
    return existing

def sb_insert_moments(rows: list[dict]) -> int:
    """Bulk insert. Returns number of rows inserted (or 0 on failure)."""
    url = f'{SUPABASE_URL}/rest/v1/voyo_moments'
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode(),
        headers={
            **HEADERS,
            'Prefer': 'return=minimal,resolution=ignore-duplicates',
        },
        method='POST',
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                if r.status in (200, 201):
                    return len(rows)
                return 0
        except urllib.error.HTTPError as e:
            body = e.read()[:500].decode('utf-8', 'ignore')
            if e.code == 409:
                # duplicate primary key — ignore
                return 0
            print(f'  [insert] HTTP {e.code}: {body}')
            if attempt < 3 and e.code in (500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            return 0
        except Exception as e:
            print(f'  [insert] {e}')
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            return 0
    return 0

# ── R2 ───────────────────────────────────────────────────────────────────

def get_r2():
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
    )

def list_r2_ids(r2, platform: str) -> list[str]:
    prefix = f'moments/{platform}/'
    ids = []
    for page in r2.get_paginator('list_objects_v2').paginate(Bucket=R2_BUCKET, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            if not key.endswith('.mp4'):
                continue
            sid = key[len(prefix):-len('.mp4')]
            if sid:
                ids.append(sid)
    return ids

# ── Instagram numeric → shortcode (for source_url construction) ─────────

ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

def numeric_to_shortcode(n: str) -> str | None:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return None
    code = ''
    while n > 0:
        code = ALPHABET[n % 64] + code
        n //= 64
    return code or ALPHABET[0]

# ── Row construction ────────────────────────────────────────────────────

def build_row(source_id: str, platform: str) -> dict:
    """Build a minimal voyo_moments row for an orphan R2 file."""
    now = datetime.now(timezone.utc).isoformat()
    r2_key = f'moments/{platform}/{source_id}.mp4'

    if platform == 'instagram':
        shortcode = numeric_to_shortcode(source_id)
        source_url = f'https://www.instagram.com/p/{shortcode}/' if shortcode else None
    elif platform == 'tiktok':
        # TikTok URLs need a username we don't have — leave NULL.
        source_url = None
    else:
        source_url = None

    row = {
        'source_platform':         platform,
        'source_id':               source_id,
        'source_url':              source_url,
        'title':                   '',
        'duration_seconds':        0,
        'hook_start_seconds':      0,
        'track_match_confidence':  0,
        'track_match_method':      'manual',
        'content_type':            'original',
        'vibe_tags':               [],
        'cultural_tags':           [],
        'view_count':              0,
        'like_count':              0,
        'share_count':             0,
        'comment_count':           0,
        'voyo_plays':              0,
        'voyo_skips':              0,
        'voyo_full_song_taps':     0,
        'voyo_reactions':          0,
        'virality_score':          0,
        'conversion_rate':         0,
        'heat_score':              0,
        'discovered_at':           now,
        'discovered_by':           'r2-orphan-import',
        'verified':                False,
        'featured':                False,
        'is_active':               True,
        'r2_video_key':            r2_key,
    }
    return row

# ── Main ────────────────────────────────────────────────────────────────

def process_platform(r2, platform: str, batch_size: int, dry_run: bool):
    print(f'\n=== {platform} ===', flush=True)
    print(f'Listing R2 keys for moments/{platform}/...', flush=True)
    r2_ids = list_r2_ids(r2, platform)
    print(f'  R2 has {len(r2_ids)} {platform} files', flush=True)

    if not r2_ids:
        return 0, 0

    # Skip pre-fetch dedup. The voyo_moments table has UNIQUE(source_platform,
    # source_id), so we use Prefer: resolution=ignore-duplicates on the INSERT
    # — duplicates are silently dropped server-side. Much friendlier to a
    # stressed DB than paginating through thousands of rows just to dedupe.

    if dry_run:
        print(f'  DRY-RUN: would insert up to {len(r2_ids)} rows (existing dups skipped). Sample:', flush=True)
        for sid in r2_ids[:5]:
            row = build_row(sid, platform)
            print(f'    {sid}  →  source_url={row["source_url"]}  r2_key={row["r2_video_key"]}', flush=True)
        return len(r2_ids), 0

    inserted_batches = 0
    failed_batches = 0
    total_batches = (len(r2_ids) + batch_size - 1) // batch_size
    for i in range(0, len(r2_ids), batch_size):
        chunk = r2_ids[i:i+batch_size]
        rows = [build_row(sid, platform) for sid in chunk]
        n = sb_insert_moments(rows)
        batch_idx = i // batch_size + 1
        if n > 0:
            inserted_batches += 1
            done_pct = (i + len(chunk)) / len(r2_ids) * 100
            print(f'  [{done_pct:5.1f}%] batch {batch_idx}/{total_batches}: posted {len(chunk)} rows', flush=True)
        else:
            failed_batches += 1
            print(f'  [batch {batch_idx}/{total_batches}] FAILED — will need re-run', flush=True)
        time.sleep(0.3)  # gentle on Supabase

    print(f'  Done. Posted batches: {inserted_batches}/{total_batches} | Failed: {failed_batches}', flush=True)
    return len(r2_ids), inserted_batches

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=['instagram', 'tiktok', 'all'], default='all')
    parser.add_argument('--batch', type=int, default=100, help='rows per insert call')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY not found in /home/dash/voyo-music/.env or env var')
        sys.exit(1)

    r2 = get_r2()

    platforms = ['instagram', 'tiktok'] if args.platform == 'all' else [args.platform]

    total_r2 = total_posted = 0
    for p in platforms:
        r2_n, posted = process_platform(r2, p, args.batch, args.dry_run)
        total_r2 += r2_n
        total_posted += posted

    print(f'\n=== Summary ===', flush=True)
    print(f'  R2 files scanned:    {total_r2}', flush=True)
    print(f'  Batches posted:      {total_posted}', flush=True)
    if not args.dry_run and total_posted > 0:
        print(f'\nServer-side ignore-duplicates dedup against UNIQUE(source_platform,source_id).', flush=True)
        print(f'New rows are LIVE — feed picks them up on next refresh.', flush=True)
        print(f'Phase 2: enrich title/creator/thumbnail via yt-dlp metadata pass.', flush=True)

if __name__ == '__main__':
    main()
