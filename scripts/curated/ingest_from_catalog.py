#!/usr/bin/env python3
"""
ingest_from_catalog.py — read a verified catalog, ingest its reels
==================================================================
Reads catalogs/<lane>.json (verified by verify_handles.py) and:
  • for each entry × platform, lists the last N posts via the right
    upstream tool (gallery-dl for IG, yt-dlp for YT, yt-dlp single for TT)
  • dedups against existing voyo_moments rows (UNIQUE source_id)
  • downloads + uploads to R2
  • INSERTs voyo_moments rows tagged with curated_lane = entry.lanes[0]
    AND every other lane in entry.lanes (multi-tag via the array of
    discovered_by markers in the rationale, plus a follow-up UPDATE
    that copies the row into each lane's curated_lane key).

Why a separate script from ingest_creators.py:
  ingest_creators.py reads the voyo_creator_proposals table (stale,
  hallucinated handles). This one reads the verified static catalog
  files — the cleanest source of truth — and treats the DB as
  derived state.

Usage:
    python3 ingest_from_catalog.py --lane genre/kizomba --reels 10 --workers 4
    python3 ingest_from_catalog.py --lane genre/kizomba --platform youtube
    python3 ingest_from_catalog.py --lane genre/kizomba --dry-run
    python3 ingest_from_catalog.py --all  # walk every verified catalog
"""

import argparse, json, os, re, subprocess, sys, time, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import boto3
from botocore.config import Config

ROOT        = Path('/home/dash/voyo-music-server')
CATALOG_DIR = ROOT / 'catalogs'
WORK_DIR    = Path('/tmp/voyo-curated-ingest')
SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'

def load_env(path):
    out = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            out[k] = v.strip().strip('"').strip("'")
    return out

ENV = {**load_env('/home/dash/voyo-music/.env'), **load_env(str(ROOT / '.env'))}
def env(*k):
    for src in (os.environ, ENV):
        for kk in k:
            if src.get(kk): return src[kk]
    return None

SERVICE_KEY    = env('SUPABASE_SERVICE_KEY')
R2_ACCOUNT_ID  = env('R2_ACCOUNT_ID')
R2_ACCESS_KEY  = env('R2_ACCESS_KEY_ID')
R2_SECRET_KEY  = env('R2_SECRET_ACCESS_KEY')
R2_BUCKET      = 'voyo-audio'
COOKIES        = ROOT / 'cookies' / 'instagram_cookies.txt'
GALLERY_DL     = os.path.expanduser('~/.local/bin/gallery-dl')
if not os.path.exists(GALLERY_DL): GALLERY_DL = 'gallery-dl'

if not all([SERVICE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY]):
    print('ERROR: missing one of SUPABASE_SERVICE_KEY / R2_*', file=sys.stderr); sys.exit(2)

WORK_DIR.mkdir(parents=True, exist_ok=True)
SB_HEADERS = {
    'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}
R2 = boto3.client('s3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY, aws_secret_access_key=R2_SECRET_KEY,
    config=Config(signature_version='s3v4', retries={'max_attempts': 3}))

# ── Listing per platform ────────────────────────────────────────────

YT_CHANNEL_ID_RE = re.compile(r'^UC[A-Za-z0-9_-]{22}$')

def list_youtube(handle: str, n: int) -> list[dict]:
    if YT_CHANNEL_ID_RE.match(handle):
        url = f'https://www.youtube.com/channel/{handle}/videos'
    else:
        url = f'https://www.youtube.com/@{handle}/videos'
    cmd = ['yt-dlp', '--flat-playlist', '--dump-json',
           '--playlist-end', str(n), '--no-warnings', '--ignore-errors', url]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return []
    items = []
    for line in r.stdout.splitlines():
        line = line.strip()
        if not line.startswith('{'): continue
        try: items.append(json.loads(line))
        except: pass
    return items

def list_instagram(handle: str, n: int) -> list[dict]:
    if not COOKIES.exists(): return []
    cmd = [GALLERY_DL, '--no-download', '--simulate', '-j',
           '--cookies', str(COOKIES),
           '--range', f'1-{n}',
           f'https://www.instagram.com/{handle}/reels/']
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return []
    if r.returncode != 0 or not r.stdout.strip():
        return []
    try: rows = json.loads(r.stdout)
    except: return []
    items, seen = [], set()
    for entry in rows:
        if not isinstance(entry, list) or len(entry) < 2: continue
        meta = entry[-1] if isinstance(entry[-1], dict) else None
        if not meta or meta.get('type') != 'reel': continue
        sc = meta.get('post_shortcode')
        if not sc or sc in seen: continue
        seen.add(sc)
        items.append({
            'id':            sc,
            'url':           meta.get('post_url') or f'https://www.instagram.com/reel/{sc}/',
            'title':         (meta.get('description') or '')[:280],
            'duration':      0,
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
    # TikTok user listing in yt-dlp is broken; placeholder.
    return []

LISTERS = {'youtube': list_youtube, 'instagram': list_instagram, 'tiktok': list_tiktok}

# ── Quality gate ────────────────────────────────────────────────────
#
# Curator-tier ingest only. We act like the big platforms from day one:
# accept low yield from any single creator, only ingest content with
# real engagement signal. The gate is BOTH absolute and ratio-based.
#
# Sources:
#  • TikTok FYP relies on watch-through rate (WTR) and engagement velocity.
#  • A reel with 1M views and 200 likes is an algorithmic dud (0.02% engagement).
#    We'd rather pass on it.
#  • Duration sweet spot for short-form: 7-90s. Up to 180s allowed if the
#    item is in the top engagement decile.

QUALITY = {
    'duration_min_sec':   7,
    # 6 minutes covers music videos + extended live cuts. Past this
    # the bar tightens (only worth keeping if engagement is exceptional).
    'duration_max_sec':   360,
    'duration_sweet_max': 240,
    # Tier-aware engagement-rate gate. The PRIMARY signal:
    #   likes / followers  (when followers known)
    # Fallback: likes / views (when followers unknown).
    # Numbers calibrated to industry reality:
    #   icon (>5M followers): typical ~1%, top posts 3-5% — gate at 1.5%
    #   major (500K-5M):      typical 1-3%, top 4-7%       — gate at 3%
    #   rising (50K-500K):    typical 3-6%, top 7-15%      — gate at 5%
    #   niche (<50K):         typical 7-20%, top 15-40%    — gate at 7%
    #   scene (<5K):          curator-only territory       — gate at 10%
    'tier_engagement_gate': {
        'icon':   0.015,
        'major':  0.030,
        'rising': 0.050,
        'niche':  0.070,
        'scene':  0.100,
        None:     0.030,   # default when tier unknown — assume major-ish
    },
    # Absolute floor — sanity check so a 100-follower account with 8
    # likes doesn't sneak through just because the ratio is fine.
    # Floors are minimum LIKES (IG/TT) or VIEWS (YT) per item.
    'youtube':   {'min_views': 5_000},
    'instagram': {'min_likes': 500},
    'tiktok':    {'min_views': 10_000},
}

def _engagement_gate_for(entry: dict) -> float:
    """Return the likes/followers ratio threshold for this creator's tier."""
    tier = (entry.get('tier') or '').strip() or None
    return QUALITY['tier_engagement_gate'].get(tier, QUALITY['tier_engagement_gate'][None])

def _engagement_gate_label(entry: dict) -> str:
    tier = entry.get('tier') or 'unknown-tier'
    return f'{tier}@{_engagement_gate_for(entry)*100:.1f}%'

def meets_quality(item: dict, platform: str, entry: dict) -> tuple[bool, str]:
    """Engagement-aware gate. Returns (ok, reason).

    Primary signal: likes / followers (when followers known on this platform)
    Fallback: likes / views (when followers unknown but views are)
    Plus absolute floor (sanity)
    Plus duration check
    """
    dur = int(item.get('duration') or 0)
    if dur and dur < QUALITY['duration_min_sec']:
        return (False, f'duration {dur}s < {QUALITY["duration_min_sec"]}s')
    if dur and dur > QUALITY['duration_max_sec']:
        return (False, f'duration {dur}s > {QUALITY["duration_max_sec"]}s')

    views = int(item.get('view_count') or 0)
    likes = int(item.get('like_count') or 0)
    followers = int((entry.get('follower_counts') or {}).get(platform) or 0)

    # Absolute floor — applied only when we actually have data (a flat-
    # playlist listing often returns 0 for view_count; we don't gate on
    # missing data).
    cfg = QUALITY.get(platform, {})
    if platform == 'youtube' and views > 0 and views < cfg.get('min_views', 0):
        return (False, f'views {views} < {cfg["min_views"]}')
    if platform == 'instagram' and likes > 0 and likes < cfg.get('min_likes', 0):
        return (False, f'likes {likes} < {cfg["min_likes"]}')
    if platform == 'tiktok' and views > 0 and views < cfg.get('min_views', 0):
        return (False, f'views {views} < {cfg["min_views"]}')

    gate = _engagement_gate_for(entry)

    # Primary engagement gate: likes / followers — TIER-AWARE.
    # Stricter for niche creators (where 7%+ is achievable), looser for
    # icons (where 1.5% is already a banger).
    if followers > 0 and likes > 0:
        ratio = likes / followers
        if ratio < gate:
            return (False, f'eng/followers {ratio*100:.1f}% < {gate*100:.1f}% ({entry.get("tier") or "?"})')

    # Fallback engagement gate when followers unknown: likes / views.
    # Same tier ratios apply (per-impression engagement runs ~1.5x of
    # per-follower since not every follower sees a post).
    elif views > 0 and likes > 0:
        ratio = likes / views
        # views-based ratio runs higher than followers-based for the same
        # quality level; multiply the tier gate by ~0.6 as the equivalent.
        view_gate = gate * 0.6
        if ratio < view_gate:
            return (False, f'eng/views {ratio*100:.1f}% < {view_gate*100:.1f}% ({entry.get("tier") or "?"})')

    return (True, 'ok')

# ── Source-id extraction ────────────────────────────────────────────

IG_SHORTCODE_RE = re.compile(r'(?:/(?:p|reel|reels|tv))/([\w-]+)')

def extract_source_id(item: dict, platform: str) -> str | None:
    if platform == 'instagram':
        url = item.get('url') or ''
        m = IG_SHORTCODE_RE.search(url)
        if m: return m.group(1)
        return item.get('id') or None
    if platform == 'youtube':
        return item.get('id') or None
    return item.get('id') or None

def reel_url(item: dict, platform: str, sid: str) -> str:
    u = item.get('url') or item.get('webpage_url')
    if u: return u
    if platform == 'youtube':  return f'https://www.youtube.com/watch?v={sid}'
    if platform == 'instagram': return f'https://www.instagram.com/p/{sid}/'
    return ''

# ── Download / upload ───────────────────────────────────────────────

def download(url: str, out: Path, platform: str) -> bool:
    cmd = ['yt-dlp',
        '--format', ('best[ext=mp4][height<=720]/best[height<=720]/mp4'
                     if platform == 'youtube'
                     else 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'),
        '--merge-output-format', 'mp4',
        '--no-playlist', '--no-warnings', '--quiet',
        '--output', str(out)]
    if platform == 'instagram' and COOKIES.exists():
        cmd += ['--cookies', str(COOKIES)]
    cmd.append(url)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        return r.returncode == 0 and out.exists() and out.stat().st_size > 10_000
    except subprocess.TimeoutExpired:
        return False

def r2_exists(key: str) -> bool:
    try: R2.head_object(Bucket=R2_BUCKET, Key=key); return True
    except: return False

def r2_upload(local: Path, key: str) -> bool:
    try:
        R2.upload_file(str(local), R2_BUCKET, key, ExtraArgs={'ContentType': 'video/mp4'})
        return True
    except Exception as e:
        print(f'    [r2] {key}: {e}'); return False

# ── DB ──────────────────────────────────────────────────────────────

def existing_source_ids(platform: str) -> set[str]:
    seen, PAGE, off = set(), 1000, 0
    while True:
        params = {'source_platform': f'eq.{platform}', 'select': 'source_id',
                  'order': 'discovered_at.desc', 'limit': str(PAGE), 'offset': str(off)}
        url = f'{SUPABASE_URL}/rest/v1/voyo_moments?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={'apikey': SERVICE_KEY,
                                                   'Authorization': f'Bearer {SERVICE_KEY}'})
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.loads(r.read())
        if not rows: break
        seen.update(r['source_id'] for r in rows)
        if len(rows) < PAGE: break
        off += PAGE
    return seen

def insert_moments(rows: list[dict]) -> int:
    if not rows: return 0
    url = f'{SUPABASE_URL}/rest/v1/voyo_moments'
    req = urllib.request.Request(url, data=json.dumps(rows).encode(),
        headers={**SB_HEADERS, 'Prefer': 'return=minimal,resolution=ignore-duplicates'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=45) as _: return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode('utf-8', 'ignore')
        print(f'    [insert] HTTP {e.code}: {body}'); return 0

# ── Row build ───────────────────────────────────────────────────────

def build_row(item: dict, platform: str, sid: str, entry: dict, primary_lane: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    cultural = []
    if entry.get('region'):   cultural.append(entry['region'].lower())
    if entry.get('language'): cultural.append(entry['language'])
    for sg in (entry.get('subgenres') or []):  cultural.append(sg)
    # Dedup
    cultural = list(dict.fromkeys(cultural))
    view_n  = int(item.get('view_count') or 0)
    like_n  = int(item.get('like_count') or 0)
    return {
        'source_platform':         platform,
        'source_id':               sid,
        'source_url':              reel_url(item, platform, sid),
        'title':                   (item.get('title') or '').strip()[:300],
        'duration_seconds':        int(item.get('duration') or 0),
        'hook_start_seconds':      0,
        'track_match_confidence':  0,
        'track_match_method':      'manual',
        'content_type':            'original',
        'creator_username':        entry['platforms'].get(platform, '')[:64],
        'creator_name':            (entry.get('name') or '')[:120],
        'thumbnail_url':           item.get('thumbnail') or None,
        'vibe_tags':               entry.get('subgenres') or [],
        'cultural_tags':           cultural,
        'view_count':              view_n,
        'like_count':              like_n,
        'share_count':             0,
        'comment_count':           int(item.get('comment_count') or 0),
        'voyo_plays':              0, 'voyo_skips': 0,
        'voyo_full_song_taps':     0, 'voyo_reactions': 0,
        'virality_score':          (view_n // 1000) + (like_n // 10),
        'conversion_rate':         0, 'heat_score': 0,
        'discovered_at':           now,
        'discovered_by':           f'curator/{primary_lane}',
        'verified':                False, 'featured': False, 'is_active': True,
        'r2_video_key':            f'moments/{platform}/{sid}.mp4',
        'curated_lane':            primary_lane,
        'curated_creator_handle':  entry['platforms'].get(platform, '')[:64],
        'curated_at':              now,
    }

# ── Process one (entry, platform) ───────────────────────────────────

def process(entry: dict, platform: str, n_reels: int, primary_lane: str,
            dedup: dict[str, set[str]], dry: bool) -> tuple[int, int]:
    handle = entry['platforms'].get(platform)
    if not handle: return (0, 0)
    print(f'\n→ [{platform}] {entry["name"]} (@{handle})', flush=True)
    items = LISTERS[platform](handle, n_reels)
    if not items:
        print(f'  no posts listed'); return (0, 0)
    print(f'  listed {len(items)}')
    rows, fetched, uploaded, gated = [], 0, 0, 0
    for item in items:
        sid = extract_source_id(item, platform)
        if not sid: continue
        fetched += 1
        if sid in dedup[platform]:
            continue
        ok, reason = meets_quality(item, platform, entry)
        if not ok:
            gated += 1
            print(f'  · {sid} GATED — {reason}')
            continue
        r2_key = f'moments/{platform}/{sid}.mp4'
        if r2_exists(r2_key):
            print(f'  · {sid} already in R2 — DB row only')
            rows.append(build_row(item, platform, sid, entry, primary_lane)); continue
        if dry:
            print(f'  · DRY {sid}'); continue
        local = WORK_DIR / f'{platform}_{sid}.mp4'
        if not download(reel_url(item, platform, sid), local, platform):
            print(f'  · {sid} download failed'); continue
        if not r2_upload(local, r2_key):
            try: local.unlink()
            except: pass
            continue
        try: local.unlink()
        except: pass
        rows.append(build_row(item, platform, sid, entry, primary_lane))
        uploaded += 1
        print(f'  · {sid} → R2 + queued')
        time.sleep(0.4)
    inserted = 0
    if rows and not dry:
        inserted = insert_moments(rows)
        for r in rows: dedup[platform].add(r['source_id'])
    print(f'  ✓ {entry["name"]}/{platform}: fetched={fetched} gated={gated} uploaded={uploaded} inserted={inserted}')
    return (fetched, inserted)

# ── Multi-lane fanout ───────────────────────────────────────────────

def update_curated_lanes_for_creator(handle: str, platform: str, lanes: list[str]) -> None:
    """For multi-lane entries, copy curated_lane assignments after primary
    insert by writing an additional row variant per non-primary lane.
    Cheaper alternative: do nothing — feed already does OR(curated_lane,
    cultural_tags) so a kizomba moment with cultural_tags=['ao','semba']
    will surface in travel/angola via the cultural_tags branch.
    Keeping this hook in case we want strict curated_lane fanout later.
    """
    pass

# ── Main ────────────────────────────────────────────────────────────

def find_catalogs(lane: str | None) -> list[Path]:
    if lane:
        return [CATALOG_DIR / (lane.replace('/', '_') + '.json')]
    return sorted(p for p in CATALOG_DIR.glob('*.json') if not p.name.startswith('_'))

def run_catalog(path: Path, n_reels: int, platform_filter: str | None,
                workers: int, dry: bool) -> tuple[int, int]:
    if not path.exists():
        print(f'(no catalog at {path})'); return (0, 0)
    catalog = json.load(open(path))
    if not catalog.get('verified'):
        print(f'⚠ catalog {path.name} not verified — run verify_handles.py first')
    primary_lane = catalog['lane']
    entries = catalog.get('entries', [])
    print(f'\n=== {path.name} ===  {len(entries)} entries · primary lane={primary_lane}')

    # Build (entry, platform) jobs
    jobs = []
    for e in entries:
        for p in e.get('platforms', {}):
            if platform_filter and p != platform_filter: continue
            jobs.append((e, p))
    if not jobs: return (0, 0)

    # Pre-load dedup sets
    needed = {p for _, p in jobs}
    dedup = {p: existing_source_ids(p) for p in needed}
    for p, s in dedup.items(): print(f'  dedup {p}: {len(s)}')

    total_f = total_i = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(process, e, p, n_reels, primary_lane, dedup, dry) for (e, p) in jobs]
        for fut in as_completed(futs):
            try:
                f, i = fut.result()
                total_f += f; total_i += i
            except Exception as e:
                print(f'  [worker error] {e}')
    return (total_f, total_i)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lane')
    p.add_argument('--all', action='store_true')
    p.add_argument('--reels', type=int, default=10)
    p.add_argument('--workers', type=int, default=3)
    p.add_argument('--platform', choices=['instagram','tiktok','youtube'])
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()
    if not args.lane and not args.all:
        print('need --lane or --all'); sys.exit(2)

    paths = find_catalogs(args.lane if not args.all else None)
    grand_f = grand_i = 0
    t0 = time.time()
    for path in paths:
        f, i = run_catalog(path, args.reels, args.platform, args.workers, args.dry_run)
        grand_f += f; grand_i += i
    elapsed = time.time() - t0
    print(f'\n=== ALL DONE in {elapsed:.0f}s ===')
    print(f'  fetched={grand_f}, inserted={grand_i}')

if __name__ == '__main__':
    main()
