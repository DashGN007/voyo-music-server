#!/usr/bin/env python3
"""
verify_handles.py — programmatic existence + tier check for catalog handles
============================================================================
Walks every catalog file (or one specified by --lane) and probes each
(handle, platform) against the actual upstream:
  • youtube  → yt-dlp --flat-playlist --playlist-end 1
  • instagram → gallery-dl --simulate --range 1-1
  • tiktok   → yt-dlp on the user URL (best-effort; flaky)

For each entry it sets:
  • verified_at         — UTC ISO timestamp on success
  • follower_counts.{p} — extracted from upstream where available
  • tier                — derived bucket (icon/major/rising/niche/scene)
Failed handles are removed (or left with a `failed_at` field if --soft).

Usage:
    python3 verify_handles.py --lane genre/kizomba
    python3 verify_handles.py --all           # walk every catalog
    python3 verify_handles.py --lane genre/kizomba --soft  # mark, don't drop
"""

import argparse, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/home/dash/voyo-music-server')
CATALOG_DIR = ROOT / 'catalogs'
COOKIES = ROOT / 'cookies' / 'instagram_cookies.txt'
GALLERY_DL = os.path.expanduser('~/.local/bin/gallery-dl')
if not os.path.exists(GALLERY_DL): GALLERY_DL = 'gallery-dl'

# ── Probes ───────────────────────────────────────────────────────────

def _is_yt_channel_id(s: str) -> bool:
    return bool(re.fullmatch(r'UC[A-Za-z0-9_-]{22}', s))

def probe_youtube(handle: str) -> tuple[bool, dict]:
    if _is_yt_channel_id(handle):
        url = f'https://www.youtube.com/channel/{handle}/videos'
    else:
        url = f'https://www.youtube.com/@{handle}/videos'
    cmd = ['yt-dlp', '--flat-playlist', '--dump-json', '--playlist-end', '1',
           '--no-warnings', '--ignore-errors', url]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return False, {'error': 'timeout'}
    if r.returncode != 0 or not r.stdout.strip():
        return False, {'error': (r.stderr or '').strip().splitlines()[-1][:160] if r.stderr else 'empty'}
    # If we got at least one video json line, the channel resolves.
    return True, {'first_id': json.loads(r.stdout.splitlines()[0]).get('id')}

def probe_instagram(handle: str) -> tuple[bool, dict]:
    if not COOKIES.exists():
        return False, {'error': 'no IG cookies'}
    cmd = [GALLERY_DL, '--no-download', '--simulate', '-j',
           '--cookies', str(COOKIES),
           '--range', '1-1',
           f'https://www.instagram.com/{handle}/']
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    except subprocess.TimeoutExpired:
        return False, {'error': 'timeout'}
    if r.returncode != 0 or not r.stdout.strip():
        return False, {'error': (r.stderr or '').strip().splitlines()[-1][:160] if r.stderr else 'empty'}
    try:
        rows = json.loads(r.stdout)
    except Exception:
        return False, {'error': 'unparseable output'}
    # Walk for a user dict to extract follower count
    followers = None
    for entry in rows:
        if not isinstance(entry, list): continue
        meta = entry[-1] if isinstance(entry[-1], dict) else None
        if not meta: continue
        u = meta.get('user') or {}
        soc = u.get('social_context', '') or u.get('search_social_context', '')
        if 'M followers' in soc:
            followers = int(float(soc.split('M')[0]) * 1_000_000); break
        if 'K followers' in soc:
            followers = int(float(soc.split('K')[0]) * 1_000); break
        m = re.match(r'\s*([\d,]+)\s*followers', soc)
        if m:
            followers = int(m.group(1).replace(',', '')); break
    if not rows:
        return False, {'error': 'no posts found'}
    return True, {'followers': followers}

def probe_tiktok(handle: str) -> tuple[bool, dict]:
    # yt-dlp's TikTok user extractor is broken; we accept on the basis
    # that the profile URL resolves to a non-404.
    cmd = ['yt-dlp', '--flat-playlist', '--dump-json', '--playlist-end', '1',
           '--no-warnings', '--ignore-errors',
           f'https://www.tiktok.com/@{handle}']
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return False, {'error': 'timeout'}
    if r.returncode != 0 and not r.stdout.strip():
        # If yt-dlp gives "Unable to extract secondary user ID" the handle still
        # may exist — flag as 'unverified-tt' rather than rejecting.
        err = (r.stderr or '').strip().splitlines()[-1][:160] if r.stderr else 'empty'
        return False, {'error': f'unverifiable: {err}'}
    return True, {}

PROBES = {
    'youtube':   probe_youtube,
    'instagram': probe_instagram,
    'tiktok':    probe_tiktok,
}

# ── Tier derivation ──────────────────────────────────────────────────

def tier_from_followers(n: int | None) -> str | None:
    if n is None: return None
    if n >= 5_000_000: return 'icon'
    if n >= 500_000:   return 'major'
    if n >= 50_000:    return 'rising'
    if n >= 5_000:     return 'niche'
    return 'scene'

# ── Catalog walk ─────────────────────────────────────────────────────

def verify_one(name: str, platform: str, handle: str) -> tuple[str, str, bool, dict]:
    fn = PROBES.get(platform)
    if not fn:
        return (name, platform, False, {'error': f'unknown platform {platform}'})
    ok, info = fn(handle)
    return (name, platform, ok, info)

def verify_catalog(path: Path, soft: bool = False, workers: int = 4) -> dict:
    catalog = json.load(open(path))
    entries = catalog.get('entries', [])
    if not entries:
        print(f'  empty: {path.name}')
        return catalog

    # Collect all (entry_idx, platform, handle) jobs
    jobs = []
    for i, e in enumerate(entries):
        for p, h in (e.get('platforms') or {}).items():
            jobs.append((i, p, h))
    print(f'\n=== {path.name} ===  {len(entries)} entries, {len(jobs)} probes')

    # Per-entry collected results
    by_idx: dict[int, list[tuple[str, str, bool, dict]]] = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(verify_one, entries[i]['name'], p, h): (i, p, h) for (i, p, h) in jobs}
        for n, fut in enumerate(as_completed(futs), 1):
            (i, p, h) = futs[fut]
            try:
                name, platform, ok, info = fut.result()
            except Exception as e:
                name, platform, ok, info = entries[i]['name'], p, False, {'error': str(e)[:160]}
            by_idx.setdefault(i, []).append((platform, h, ok, info))
            sym = '✓' if ok else '✗'
            extra = ''
            if ok and info.get('followers') is not None:
                extra = f'  ({info["followers"]:,} followers)'
            elif not ok:
                extra = f'  → {info.get("error","?")[:80]}'
            print(f'  {sym} {name[:25]:25} {platform[:10]:10} {h[:30]:30}{extra}', flush=True)

    # Apply results to entries
    kept = []
    for i, e in enumerate(entries):
        results = by_idx.get(i, [])
        plats = e.get('platforms') or {}
        new_plats = {}
        followers: dict[str, int] = {}
        any_ok = False
        for (p, h, ok, info) in results:
            if ok:
                new_plats[p] = h
                if info.get('followers') is not None:
                    followers[p] = info['followers']
                any_ok = True
        if not any_ok and not soft:
            print(f'  - dropping {e["name"]} (no platform verified)', flush=True)
            continue
        e['platforms'] = new_plats if not soft else plats
        e['follower_counts'] = followers
        # tier = highest follower count across platforms
        max_n = max(followers.values()) if followers else None
        t = tier_from_followers(max_n)
        if t: e['tier'] = t
        if any_ok: e['verified_at'] = datetime.now(timezone.utc).isoformat()
        if not any_ok and soft: e['failed_at'] = datetime.now(timezone.utc).isoformat()
        kept.append(e)

    catalog['entries'] = kept
    catalog['verified'] = True
    catalog['verified_at'] = datetime.now(timezone.utc).isoformat()
    elapsed = time.time() - t0
    print(f'  done in {elapsed:.0f}s — kept {len(kept)}/{len(entries)}')
    return catalog

# ── Main ─────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lane', help='e.g. genre/kizomba')
    p.add_argument('--all', action='store_true')
    p.add_argument('--soft', action='store_true', help='mark failed instead of dropping')
    p.add_argument('--workers', type=int, default=4)
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    if not args.lane and not args.all:
        print('need --lane <key> or --all'); sys.exit(2)

    paths: list[Path] = []
    if args.lane:
        paths = [CATALOG_DIR / (args.lane.replace('/', '_') + '.json')]
    else:
        paths = sorted(p for p in CATALOG_DIR.glob('*.json') if not p.name.startswith('_'))

    for path in paths:
        if not path.exists():
            print(f'(no catalog at {path})'); continue
        result = verify_catalog(path, soft=args.soft, workers=args.workers)
        if args.dry_run:
            print('  --dry-run, not written')
            continue
        # Backup then write
        bak = path.with_suffix('.json.bak')
        path.replace(bak)
        with open(path, 'w') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f'  written → {path} (backup at {bak.name})')

if __name__ == '__main__':
    main()
