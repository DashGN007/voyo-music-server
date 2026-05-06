#!/usr/bin/env python3
"""
verify-r2-presence.py
=====================
Probes the worker R2 route for every active voyo_moments row.
For rows whose R2 file is missing (HTTP 404), flips is_active=false
so the feed stops surfacing broken videos.

Why:
  Siphon ingest set r2_video_key on ~6,788 rows but only ~10% of
  the corresponding R2 files actually exist. The feed was showing
  these rows alongside playable ones, giving a "stuck on one video"
  experience because most cards failed to load.

Usage:
    python3 scripts/verify-r2-presence.py --dry-run
    python3 scripts/verify-r2-presence.py
    python3 scripts/verify-r2-presence.py --discovered-by siphon
    python3 scripts/verify-r2-presence.py --workers 60
"""

import os, sys, json, time, argparse, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
WORKER_URL   = 'https://voyo-edge.dash-webtv.workers.dev'

def load_key():
    env = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('SUPABASE_SERVICE_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('SUPABASE_SERVICE_KEY', '')

SERVICE_KEY = load_key()
SB_HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}

def fetch_active_rows(filter_discovered_by: str | None) -> list[dict]:
    rows = []
    PAGE = 1000
    offset = 0
    while True:
        params = {
            'is_active':       'eq.true',
            'r2_video_key':    'not.is.null',
            'select':          'id,source_platform,source_id,discovered_by',
            'order':           'discovered_at.desc',
            'limit':           str(PAGE),
            'offset':          str(offset),
        }
        if filter_discovered_by:
            params['discovered_by'] = f'eq.{filter_discovered_by}'
        url = f'{SUPABASE_URL}/rest/v1/voyo_moments?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.loads(r.read())
        if not page: break
        rows.extend(page)
        if len(page) < PAGE: break
        offset += PAGE
        print(f'  …loaded {len(rows)} rows', flush=True)
    return rows

def probe_one(row: dict) -> tuple[dict, int]:
    """HEAD-equivalent (range 0-1023). Returns (row, status_code)."""
    url = f"{WORKER_URL}/r2/feed/{row['source_platform']}/{row['source_id']}"
    req = urllib.request.Request(url, method='GET', headers={
        'Range': 'bytes=0-1023',
        'User-Agent': 'voyo-r2-verifier/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return row, r.status
    except urllib.error.HTTPError as e:
        return row, e.code
    except Exception:
        return row, 0  # treat network errors as "unknown" — don't deactivate

def deactivate_batch(ids: list[str]) -> bool:
    """PATCH is_active=false where id in (…). Returns True on success."""
    if not ids: return True
    # PostgREST accepts in.(uuid1,uuid2,…) — chunk to keep URL <8KB
    CHUNK = 50
    ok = True
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i+CHUNK]
        url = f'{SUPABASE_URL}/rest/v1/voyo_moments?id=in.({",".join(chunk)})'
        req = urllib.request.Request(
            url,
            data=json.dumps({'is_active': False}).encode(),
            headers={**SB_HEADERS, 'Prefer': 'return=minimal'},
            method='PATCH',
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    if r.status in (200, 204): break
                    print(f'    [warn] PATCH HTTP {r.status}', flush=True)
            except Exception as e:
                if attempt < 2:
                    time.sleep(2 ** attempt); continue
                print(f'    [error] PATCH failed: {e}', flush=True)
                ok = False
        time.sleep(0.2)
    return ok

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--workers', type=int, default=50)
    p.add_argument('--discovered-by', help='filter to one source (e.g. siphon)')
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY missing'); sys.exit(1)

    print(f'Loading active rows (discovered_by={args.discovered_by or "ALL"})…', flush=True)
    rows = fetch_active_rows(args.discovered_by)
    print(f'Got {len(rows)} rows. Probing with {args.workers} workers…\n', flush=True)

    missing = []
    ok_count = bad_count = unk_count = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(probe_one, r) for r in rows]
        for i, f in enumerate(as_completed(futs), 1):
            row, code = f.result()
            if code in (200, 206):
                ok_count += 1
            elif code == 404:
                bad_count += 1
                missing.append(row['id'])
            else:
                unk_count += 1
            if i % 200 == 0 or i == len(rows):
                elapsed = time.time() - t0
                rate = i / elapsed if elapsed > 0 else 0
                print(f'  [{i:5}/{len(rows)}] OK={ok_count}  404={bad_count}  unk={unk_count}  ({rate:.0f}/s)', flush=True)

    print(f'\n=== Probe done ===', flush=True)
    print(f'  OK (playable):   {ok_count}', flush=True)
    print(f'  404 (missing):   {bad_count}', flush=True)
    print(f'  Unknown (skip):  {unk_count}', flush=True)

    if not missing:
        print('\nNothing to deactivate. Done.', flush=True)
        return

    if args.dry_run:
        print(f'\n[DRY-RUN] would deactivate {len(missing)} rows.', flush=True)
        for mid in missing[:5]:
            print(f'    {mid}')
        return

    print(f'\nDeactivating {len(missing)} rows where R2 file is missing…', flush=True)
    deactivate_batch(missing)
    print(f'Done. Feed will now only show playable moments.', flush=True)

if __name__ == '__main__':
    main()
