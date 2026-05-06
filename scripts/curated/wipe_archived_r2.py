#!/usr/bin/env python3
"""
wipe_archived_r2.py — delete R2 video files for archived rows
=============================================================
Reads catalogs/_seeds/r2_deletion_queue.json (produced by
initial_pool_setup.py) and deletes the listed keys from R2 in batches.

Defensive: re-checks each row's archive status in the DB before
deletion. If a row was un-archived (e.g. promoted to core or
restored), its key is skipped.

Usage:
    python3 wipe_archived_r2.py
    python3 wipe_archived_r2.py --dry-run
    python3 wipe_archived_r2.py --limit 100   # cap deletions
    python3 wipe_archived_r2.py --batch 100   # objects per delete_objects call
"""

import argparse, json, os, sys, time, urllib.parse, urllib.request
from pathlib import Path
import boto3
from botocore.config import Config

ROOT = Path('/home/dash/voyo-music-server')
QUEUE = ROOT / 'catalogs' / '_seeds' / 'r2_deletion_queue.json'
SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'

def load_env(p):
    out = {}
    if os.path.exists(p):
        for line in open(p):
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

SERVICE_KEY   = env('SUPABASE_SERVICE_KEY')
R2_ACCOUNT_ID = env('R2_ACCOUNT_ID')
R2_ACCESS_KEY = env('R2_ACCESS_KEY_ID')
R2_SECRET_KEY = env('R2_SECRET_ACCESS_KEY')
R2_BUCKET     = 'voyo-audio'
SBP           = env('SUPABASE_MANAGEMENT_TOKEN')
PROJ_REF      = env('VOYO_PROJECT_REF') or 'anmgyxhnyhbyxzpjhxgx'

if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY]):
    print('ERROR: R2 credentials missing'); sys.exit(2)

R2 = boto3.client('s3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY, aws_secret_access_key=R2_SECRET_KEY,
    config=Config(signature_version='s3v4', retries={'max_attempts': 3}))

def mgmt_sql(q: str) -> list:
    body = json.dumps({'query': q}).encode()
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJ_REF}/database/query',
        data=body, method='POST',
        headers={'Authorization': f'Bearer {SBP}',
                 'Content-Type': 'application/json',
                 'User-Agent': 'voyo-curated-tools/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def reverify_archive_status(keys: list[str]) -> set[str]:
    """Return the set of keys whose row is still archived
    (in_pool=false AND archived_at NOT NULL). Anything else gets
    skipped — if a row was un-archived since the queue was built,
    we should NOT delete its R2 file."""
    safe: set[str] = set()
    BATCH = 200
    for i in range(0, len(keys), BATCH):
        chunk = keys[i:i+BATCH]
        # in.(...) takes a comma-list; r2_video_key may contain '/' which
        # is fine, but values must be quoted via PostgREST URL syntax.
        in_list = ','.join(f'"{k}"' for k in chunk)
        params = {
            'select':       'r2_video_key',
            'in_pool':      'eq.false',
            'archived_at':  'not.is.null',
            'r2_video_key': f'in.({in_list})',
        }
        url = f'{SUPABASE_URL}/rest/v1/voyo_moments?' + urllib.parse.urlencode(params, safe=',()"')
        req = urllib.request.Request(url, headers={
            'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                rows = json.loads(r.read())
            for row in rows:
                k = row.get('r2_video_key')
                if k: safe.add(k)
        except Exception as e:
            print(f'  [reverify warn] {e}')
    return safe

def delete_batch(keys: list[str]) -> int:
    if not keys: return 0
    resp = R2.delete_objects(Bucket=R2_BUCKET, Delete={
        'Objects': [{'Key': k} for k in keys],
        'Quiet': True,
    })
    err = resp.get('Errors') or []
    if err:
        for e in err[:5]:
            print(f'  [r2 err] {e.get("Key")}: {e.get("Code")} {e.get("Message")}')
    return len(keys) - len(err)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--limit', type=int, default=0)
    p.add_argument('--batch', type=int, default=100, help='objects per delete_objects call')
    args = p.parse_args()

    if not QUEUE.exists():
        print(f'no queue at {QUEUE}'); sys.exit(0)
    payload = json.load(open(QUEUE))
    keys = payload['keys']
    if args.limit: keys = keys[:args.limit]
    print(f'Queue: {len(keys)} R2 keys', flush=True)

    print('Re-verifying archive status against current DB…', flush=True)
    safe = reverify_archive_status(keys)
    skipped = [k for k in keys if k not in safe]
    keys = [k for k in keys if k in safe]
    print(f'  re-verified safe: {len(keys)}  skipped (un-archived since queue): {len(skipped)}')

    if args.dry_run:
        print(f'\nDRY-RUN — would delete {len(keys)} R2 keys')
        for k in keys[:5]: print(f'  {k}')
        return

    deleted = 0
    failed = 0
    t0 = time.time()
    for i in range(0, len(keys), args.batch):
        chunk = keys[i:i+args.batch]
        try:
            n = delete_batch(chunk)
            deleted += n
            failed += (len(chunk) - n)
        except Exception as e:
            print(f'  [batch error] {e}')
            failed += len(chunk)
        if (i // args.batch) % 10 == 0:
            elapsed = time.time() - t0
            rate = deleted / elapsed if elapsed > 0 else 0
            print(f'  [{i+len(chunk):5}/{len(keys)}] deleted={deleted} failed={failed} ({rate:.0f}/s)', flush=True)

    elapsed = time.time() - t0
    print(f'\n=== Done in {elapsed:.0f}s ===')
    print(f'  deleted: {deleted}')
    print(f'  failed:  {failed}')
    print(f'  R2 storage freed: ~{deleted * 7:.0f}MB (rough estimate at 7MB/video)')

    # Move the queue file to a 'consumed' archive so re-running doesn't redo work
    consumed = QUEUE.with_suffix('.json.consumed')
    QUEUE.replace(consumed)
    print(f'  queue moved → {consumed.name}')

if __name__ == '__main__':
    main()
