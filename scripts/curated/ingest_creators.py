#!/usr/bin/env python3
"""
ingest_creators.py — pull last N reels per approved curator + push to R2 + DB
=============================================================================
Reads voyo_creator_proposals where status='approved' for the lane, runs
yt-dlp on each profile to list the latest N reels, downloads + uploads
to R2 (zero-egress), and inserts a voyo_moments row tagged with
curated_lane = lane + curated_creator_handle = handle.

Idempotent:
  • Skips reels already in voyo_moments (UNIQUE on source_platform+source_id).
  • Skips R2 keys that already exist (HEAD before PUT).
  • Marks proposal status='ingested' on success, 'failed' on hard error.

Usage:
    python3 ingest_creators.py --lane genre/kizomba --reels 10
    python3 ingest_creators.py --lane genre/kizomba --reels 10 --workers 4
    python3 ingest_creators.py --lane genre/kizomba --dry-run
    python3 ingest_creators.py --lane genre/kizomba --resume    # only proposals still 'approved'
"""

import argparse, json, os, re, subprocess, sys, time
import urllib.request, urllib.error, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config

# ── Config ─────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
WORK_DIR     = Path('/tmp/voyo-curated-ingest')

def load_env(path: str) -> dict[str, str]:
    out = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            out[k] = v.strip().strip('"').strip("'")
    return out

ENV = {**load_env('/home/dash/voyo-music/.env'), **load_env('/home/dash/voyo-music-server/.env')}
def env(*k):
    for src in (os.environ, ENV):
        for kk in k:
            if src.get(kk): return src[kk]
    return None

SERVICE_KEY      = env('SUPABASE_SERVICE_KEY')
R2_ACCOUNT_ID    = env('R2_ACCOUNT_ID')
R2_ACCESS_KEY    = env('R2_ACCESS_KEY_ID')
R2_SECRET_KEY    = env('R2_SECRET_ACCESS_KEY')
R2_BUCKET        = 'voyo-audio'
# Fresh cookies (Dash uploaded 2026-05-06). Falls back to the older copy
# if the new one is missing.
IG_COOKIES_FILE  = next(
    (p for p in [
        '/home/dash/voyo-music-server/cookies/instagram_cookies.txt',
        '/home/dash/.zion/archive/renaissance/siphon/instagram_cookies.txt',
    ] if os.path.exists(p)),
    None,
)

if not all([SERVICE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY]):
    print('ERROR: missing one of SUPABASE_SERVICE_KEY / R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY', file=sys.stderr)
    sys.exit(2)

WORK_DIR.mkdir(parents=True, exist_ok=True)

SB_HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
}

R2 = boto3.client(
    's3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    config=Config(signature_version='s3v4', retries={'max_attempts': 3}),
)

# ── DB helpers ─────────────────────────────────────────────────────────

def fetch_approved_creators(lane: str, platform: str | None = None) -> list[dict]:
    params = {
        'lane':     f'eq.{lane}',
        'status':   'eq.approved',
        'select':   'id,handle,platform,confidence,language,region',
        'order':    'confidence.desc',
    }
    if platform:
        params['platform'] = f'eq.{platform}'
    url = f'{SUPABASE_URL}/rest/v1/voyo_creator_proposals?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def patch_proposal(prop_id: str, **fields) -> None:
    url = f'{SUPABASE_URL}/rest/v1/voyo_creator_proposals?id=eq.{prop_id}'
    req = urllib.request.Request(
        url, data=json.dumps(fields).encode(),
        headers={**SB_HEADERS, 'Prefer': 'return=minimal'},
        method='PATCH',
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as _: pass
    except Exception as e:
        print(f'    [warn] patch_proposal({prop_id}): {e}')

def existing_source_ids_for_platform(platform: str) -> set[str]:
    """Pull all known source_ids on this platform — used for dedup."""
    seen: set[str] = set()
    PAGE = 1000; offset = 0
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
            'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.loads(r.read())
        if not rows: break
        for row in rows: seen.add(row['source_id'])
        if len(rows) < PAGE: break
        offset += PAGE
    return seen

def insert_moments(rows: list[dict]) -> int:
    if not rows: return 0
    url = f'{SUPABASE_URL}/rest/v1/voyo_moments'
    req = urllib.request.Request(
        url, data=json.dumps(rows).encode(),
        headers={**SB_HEADERS, 'Prefer': 'return=minimal,resolution=ignore-duplicates'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as _:
            return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode('utf-8', 'ignore')
        print(f'    [insert moments] HTTP {e.code}: {body}')
        return 0

# ── R2 helpers ─────────────────────────────────────────────────────────

def r2_exists(key: str) -> bool:
    try:
        R2.head_object(Bucket=R2_BUCKET, Key=key)
        return True
    except Exception:
        return False

def r2_upload(local: Path, key: str) -> bool:
    try:
        R2.upload_file(str(local), R2_BUCKET, key, ExtraArgs={'ContentType': 'video/mp4'})
        return True
    except Exception as e:
        print(f'    [r2 upload] {key}: {e}')
        return False

# ── yt-dlp ────────────────────────────────────────────────────────────

def list_youtube(handle: str, n: int) -> list[dict]:
    """yt-dlp on a YouTube channel — works perfectly. Pulls /videos by default.
    Most music artists also have /shorts; we'll grab from /videos and let the
    feed filter by duration if needed."""
    url = f'https://www.youtube.com/@{handle}/videos'
    cmd = [
        'yt-dlp', '--flat-playlist', '--dump-json',
        '--playlist-end', str(n),
        '--no-warnings', '--ignore-errors', url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return []
    items = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or not line.startswith('{'): continue
        try:
            items.append(json.loads(line))
        except Exception:
            pass
    if not items and result.returncode != 0:
        err = (result.stderr or '').strip().splitlines()
        first_err = err[-1] if err else 'no stderr'
        print(f'    [yt-list] youtube/{handle}: rc={result.returncode} | {first_err[:160]}')
    return items

# Module-level instaloader context — built once per run, reused per call.
_il = None
def _instaloader():
    global _il
    if _il is not None: return _il
    if not IG_COOKIES_FILE:
        return None
    try:
        import instaloader, http.cookiejar
        L = instaloader.Instaloader(quiet=True,
            download_videos=False, download_pictures=False,
            download_video_thumbnails=False, save_metadata=False)
        cj = http.cookiejar.MozillaCookieJar(IG_COOKIES_FILE)
        cj.load(ignore_discard=True, ignore_expires=True)
        L.context._session.cookies.update({c.name: c.value for c in cj if 'instagram' in c.domain})
        _il = L
        return L
    except Exception as e:
        print(f'    [instaloader] init failed: {e}')
        return None

GALLERY_DL = os.path.expanduser('~/.local/bin/gallery-dl')
if not os.path.exists(GALLERY_DL):
    GALLERY_DL = 'gallery-dl'

def list_instagram(handle: str, n: int, min_followers: int = 500) -> list[dict]:
    """Use gallery-dl to list recent reels with metadata. Works with the
    fresh cookies; yt-dlp's IG profile extractor is broken, instaloader's
    GraphQL fallback is rate-limited.
    Returns yt-dlp-shaped dicts so the rest of the pipeline doesn't care."""
    if not IG_COOKIES_FILE: return []
    cmd = [
        GALLERY_DL, '--no-download', '--simulate', '-j',
        '--cookies', IG_COOKIES_FILE,
        '--range', f'1-{n}',
        f'https://www.instagram.com/{handle}/reels/',
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        print(f'    [gallery-dl] {handle}: timeout')
        return []
    if result.returncode != 0 or not result.stdout.strip():
        err = (result.stderr or '').strip().splitlines()
        first_err = err[-1] if err else 'no stderr'
        print(f'    [gallery-dl] {handle}: rc={result.returncode} | {first_err[:160]}')
        return []
    try:
        rows = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    items = []
    seen_sc: set[str] = set()
    for entry in rows:
        # Each entry is [level, url_or_dict, metadata_dict]. Level 2 is
        # post-level (one per reel); we lift the metadata from those.
        # Level 3 entries are the individual media files (1 per video) —
        # dedup by shortcode below catches the repeat.
        if not isinstance(entry, list) or len(entry) < 2: continue
        meta = entry[-1] if isinstance(entry[-1], dict) else None
        if not meta or meta.get('type') != 'reel': continue
        # Followers gate via embedded user object
        followers = 0
        try:
            soc = meta.get('user', {}).get('social_context', '')
            if 'M followers' in soc:
                followers = int(float(soc.split('M')[0]) * 1_000_000)
            elif 'K followers' in soc:
                followers = int(float(soc.split('K')[0]) * 1_000)
            elif 'followers' in soc:
                followers = int(soc.split()[0].replace(',',''))
        except Exception:
            pass
        if followers and followers < min_followers:
            print(f'    [gallery-dl] {handle}: only ~{followers} followers — squatter, skip')
            return []
        sc = meta.get('post_shortcode')
        if not sc or sc in seen_sc: continue
        seen_sc.add(sc)
        items.append({
            'id':            sc,
            'url':           meta.get('post_url') or f'https://www.instagram.com/reel/{sc}/',
            'title':         (meta.get('description') or '')[:280],
            'duration':      0,  # gallery-dl doesn't give duration up front
            'view_count':    int(meta.get('view_count') or 0),
            'like_count':    int(meta.get('likes') or 0),
            'comment_count': int(meta.get('comments') or 0),
            'thumbnail':     meta.get('display_url'),
            'uploader':      meta.get('fullname') or meta.get('username') or handle,
            'channel':       meta.get('fullname') or handle,
        })
        if len(items) >= n: break
    return items

def list_tiktok(handle: str, n: int) -> list[dict]:
    """yt-dlp's TikTok user extractor still fails; placeholder for now.
    Single-video URLs work — this slot fills in once we wire pyktok."""
    return []

def list_recent_reels(platform: str, handle: str, n: int) -> list[dict]:
    if platform == 'youtube':
        return list_youtube(handle, n)
    if platform == 'instagram':
        return list_instagram(handle, n)
    if platform == 'tiktok':
        return list_tiktok(handle, n)
    return []

def download_reel(reel_url: str, out_path: Path, platform: str) -> bool:
    cmd = [
        'yt-dlp',
        # YouTube benefits from explicit format selection capping at 720p so
        # we don't pull 4K masters that would balloon R2 storage.
        '--format', ('best[ext=mp4][height<=720]/best[height<=720]/mp4'
                     if platform == 'youtube'
                     else 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'),
        '--merge-output-format', 'mp4',
        '--no-playlist', '--no-warnings', '--quiet',
        '--output', str(out_path),
    ]
    if platform == 'instagram' and IG_COOKIES_FILE:
        cmd += ['--cookies', IG_COOKIES_FILE]
    cmd.append(reel_url)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        if result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 10_000:
            return True
        return False
    except subprocess.TimeoutExpired:
        return False

# ── Source-id extraction ──────────────────────────────────────────────

IG_SHORTCODE_RE = re.compile(r'(?:/(?:p|reel|reels|tv))/([\w-]+)')
TT_VIDEO_RE     = re.compile(r'/video/(\d+)')

def extract_source_id(item: dict, platform: str) -> str | None:
    """yt-dlp's metadata layout differs by platform — pull the canonical id."""
    sid = item.get('id') or ''
    if platform == 'instagram':
        url = item.get('url') or item.get('webpage_url') or ''
        m = IG_SHORTCODE_RE.search(url)
        if m: return m.group(1)
        if sid and not sid.isdigit(): return sid
        return sid or None
    if platform == 'tiktok':
        url = item.get('url') or item.get('webpage_url') or ''
        m = TT_VIDEO_RE.search(url)
        if m: return m.group(1)
        return sid or None
    if platform == 'youtube':
        # YT video IDs are 11 chars; yt-dlp returns them in `id`.
        return sid or None
    return sid or None

def reel_url(item: dict, platform: str, source_id: str) -> str:
    url = item.get('url') or item.get('webpage_url')
    if url: return url
    if platform == 'instagram':
        return f'https://www.instagram.com/p/{source_id}/'
    if platform == 'tiktok':
        return f'https://www.tiktok.com/@x/video/{source_id}'
    if platform == 'youtube':
        return f'https://www.youtube.com/watch?v={source_id}'
    return ''

# ── Per-creator processing ────────────────────────────────────────────

def build_moment_row(item: dict, platform: str, source_id: str, handle: str,
                     lane: str, language: str | None, region: str | None) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    title    = (item.get('title') or '').strip()[:300]
    duration = item.get('duration') or 0
    view_n   = item.get('view_count') or 0
    like_n   = item.get('like_count') or 0
    src_url  = reel_url(item, platform, source_id)
    cultural = []
    if language: cultural.append(language)
    if region: cultural.append(region.lower())
    return {
        'source_platform':         platform,
        'source_id':               source_id,
        'source_url':              src_url,
        'title':                   title,
        'duration_seconds':        int(duration or 0),
        'hook_start_seconds':      0,
        'track_match_confidence':  0,
        'track_match_method':      'manual',
        'content_type':            'original',
        'creator_username':        handle,
        'creator_name':            (item.get('uploader') or item.get('channel') or handle)[:120],
        'thumbnail_url':           item.get('thumbnail') or None,
        'vibe_tags':               [],
        'cultural_tags':           cultural,
        'view_count':              int(view_n or 0),
        'like_count':              int(like_n or 0),
        'share_count':             0,
        'comment_count':           int(item.get('comment_count') or 0),
        'voyo_plays':              0,
        'voyo_skips':              0,
        'voyo_full_song_taps':     0,
        'voyo_reactions':          0,
        'virality_score':          int((view_n or 0) // 1000 + (like_n or 0) // 10),
        'conversion_rate':         0,
        'heat_score':              0,
        'discovered_at':           now,
        'discovered_by':           f'curator/{lane}',
        'verified':                False,
        'featured':                False,
        'is_active':               True,
        'r2_video_key':            f'moments/{platform}/{source_id}.mp4',
        'curated_lane':            lane,
        'curated_creator_handle':  handle,
        'curated_at':              now,
    }

def process_creator(prop: dict, lane: str, n: int, dedup_set: set[str], dry: bool) -> tuple[int, int, str | None]:
    """Returns (fetched, inserted, error_or_None)."""
    platform, handle = prop['platform'], prop['handle']
    print(f'\n→ [{platform}] {handle}  (conf={prop["confidence"]})', flush=True)
    items = list_recent_reels(platform, handle, n)
    if not items:
        return (0, 0, 'no reels listed (private/blocked/empty)')
    print(f'  listed {len(items)} reels')
    rows = []
    fetched = 0; uploaded = 0
    for item in items:
        sid = extract_source_id(item, platform)
        if not sid:
            continue
        fetched += 1
        if sid in dedup_set:
            print(f'  · {sid} already in DB — skip')
            continue
        r2_key = f'moments/{platform}/{sid}.mp4'
        if r2_exists(r2_key):
            print(f'  · {sid} already in R2 — DB row only')
            rows.append(build_moment_row(item, platform, sid, handle, lane, prop.get('language'), prop.get('region')))
            continue
        if dry:
            print(f'  · DRY {sid} → would download + upload')
            continue
        # Download
        local = WORK_DIR / f'{platform}_{sid}.mp4'
        url = reel_url(item, platform, sid)
        if not download_reel(url, local, platform):
            print(f'  · {sid} download failed')
            continue
        if not r2_upload(local, r2_key):
            try: local.unlink()
            except: pass
            continue
        try: local.unlink()
        except: pass
        rows.append(build_moment_row(item, platform, sid, handle, lane, prop.get('language'), prop.get('region')))
        uploaded += 1
        print(f'  · {sid} → R2 + queued for DB')
        # Quick courtesy delay
        time.sleep(0.5)
    inserted = 0
    if rows and not dry:
        inserted = insert_moments(rows)
        # Update dedup set so concurrent workers don't re-fetch
        for r in rows: dedup_set.add(r['source_id'])
    print(f'  ✓ {handle}: fetched={fetched}, uploaded={uploaded}, inserted={inserted}')
    return (fetched, inserted, None)

# ── Main ──────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lane', required=True)
    p.add_argument('--reels', type=int, default=10, help='per-creator reel cap')
    p.add_argument('--workers', type=int, default=2, help='parallel creators (be kind to IG/TT)')
    p.add_argument('--limit', type=int, default=0, help='cap creators processed (0=all)')
    p.add_argument('--platform', choices=['instagram','tiktok','youtube'], help='filter to one platform')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--resume', action='store_true', help='only proposals still status=approved (skip ingested)')
    args = p.parse_args()

    if not subprocess.run(['which', 'yt-dlp'], capture_output=True).stdout.strip():
        print('ERROR: yt-dlp not in PATH'); sys.exit(2)

    creators = fetch_approved_creators(args.lane, platform=args.platform)
    if args.limit:
        creators = creators[:args.limit]
    print(f'Processing {len(creators)} approved creators on lane="{args.lane}"', flush=True)
    print(f'  ({args.reels} reels each, {args.workers} parallel workers)', flush=True)

    print('Loading existing source_ids for dedup…', flush=True)
    needed_platforms = {c['platform'] for c in creators}
    dedup: dict[str, set[str]] = {}
    for plat in needed_platforms:
        s = existing_source_ids_for_platform(plat)
        dedup[plat] = s
        print(f'  {plat}: {len(s)}', flush=True)

    total_fetched = total_inserted = ok = bad = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {
            ex.submit(process_creator, c, args.lane, args.reels, dedup[c['platform']], args.dry_run): c
            for c in creators
        }
        for fut in as_completed(futs):
            c = futs[fut]
            try:
                fetched, inserted, err = fut.result()
                total_fetched += fetched
                total_inserted += inserted
                if err:
                    bad += 1
                    if not args.dry_run:
                        patch_proposal(c['id'], status='failed', reels_fetched=fetched,
                                       reels_inserted=inserted, ingest_error=err[:280])
                else:
                    ok += 1
                    if not args.dry_run:
                        patch_proposal(c['id'], status='ingested', reels_fetched=fetched,
                                       reels_inserted=inserted, ingested_at=datetime.now(timezone.utc).isoformat())
            except Exception as e:
                bad += 1
                if not args.dry_run:
                    patch_proposal(c['id'], status='failed', ingest_error=str(e)[:280])

    elapsed = time.time() - t0
    print(f'\n=== Done in {elapsed:.0f}s ===')
    print(f'  Creators: {ok} ok / {bad} failed / {len(creators)} total')
    print(f'  Reels:    fetched={total_fetched}, inserted={total_inserted}')

if __name__ == '__main__':
    main()
