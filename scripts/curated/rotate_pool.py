#!/usr/bin/env python3
"""
rotate_pool.py — daily 10% in / 10% out
========================================
Two phases, each runnable independently:

  1. EVICT — score every in_pool=true (excl. is_core), mark the bottom
     10% as archived. R2 deletion queued in catalogs/_seeds/r2_rotation_queue.json
     so the same wipe_archived_r2.py path frees disk.

  2. REFILL — pull fresh reels per lane from catalog creators until
     each lane hits its target. Calls ingest_from_catalog under the hood.

Scoring (during evict):
  score = (voyo_plays - 2*voyo_skips + 0.1*virality_score) * decay(age_in_pool_days, 14)

Anything with score in the bottom decile leaves the pool. Core rows
are exempt — they're permanent bedrock.

Usage:
    python3 rotate_pool.py                # both phases
    python3 rotate_pool.py --evict-only
    python3 rotate_pool.py --refill-only
    python3 rotate_pool.py --dry-run
    python3 rotate_pool.py --rate 0.10    # 10% rotation (default)
"""

import argparse, json, math, os, subprocess, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/home/dash/voyo-music-server')
SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'

# Per-lane in-pool targets — tuned from the strategy doc. Sum ≈ 2,500.
LANE_TARGETS = {
    'genre/afrobeats':    250,
    'genre/kizomba':      250,
    'genre/hiphop':       250,
    'genre/amapiano':     250,
    'genre/north-africa': 150,
    'genre/bongo-flava':   80,
    'genre/gospel':        80,
    'travel/nigeria':     150,
    'travel/angola':      150,
    'travel/algeria':      80,
    'travel/ghana':        80,
    'travel/senegal':      80,
    'travel/south-africa': 80,
    'travel/west-africa':  80,
    'trends/dance':       150,
    'trends/comedy':      150,
    'trends/fashion':      80,
}
TOTAL_POOL_TARGET = sum(LANE_TARGETS.values())

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

SBP = env('SUPABASE_MANAGEMENT_TOKEN')
PROJ_REF = env('VOYO_PROJECT_REF') or 'anmgyxhnyhbyxzpjhxgx'
SERVICE_KEY = env('SUPABASE_SERVICE_KEY')

def mgmt_sql(q: str) -> list:
    body = json.dumps({'query': q}).encode()
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJ_REF}/database/query',
        data=body, method='POST',
        headers={'Authorization': f'Bearer {SBP}',
                 'Content-Type': 'application/json',
                 'User-Agent': 'voyo-curated-tools/1.0'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())

# ── Phase 1: EVICT ───────────────────────────────────────────────────

def evict(rate: float, dry: bool) -> dict:
    print(f'\n=== EVICT (bottom {rate*100:.0f}%) ===')
    # In Postgres, compute the score in SQL: a single UPDATE catches
    # every eligible row in one round-trip.
    # decay = exp(-age_days / 14)
    eviction_q = f"""
        WITH scored AS (
          SELECT id,
                 (voyo_plays::float - 2 * voyo_skips::float + 0.1 * virality_score::float)
                  * EXP(-EXTRACT(EPOCH FROM (now() - COALESCE(curated_at, discovered_at))) / (14 * 86400))
                  AS score
          FROM voyo_moments
          WHERE in_pool = true AND is_core = false
        ),
        ranked AS (
          SELECT id, ntile(10) OVER (ORDER BY score ASC NULLS FIRST) AS bucket
          FROM scored
        )
        SELECT s.id, s.score
        FROM scored s JOIN ranked r ON s.id = r.id
        WHERE r.bucket = 1
        ORDER BY s.score ASC
    """
    bottom_rows = mgmt_sql(eviction_q)
    print(f'  identified {len(bottom_rows)} for eviction')
    if not bottom_rows:
        return {'evicted': 0}
    if dry:
        print('  DRY-RUN — sample (5):')
        for r in bottom_rows[:5]: print(f'    {r["id"]} score={r["score"]:.3f}')
        return {'evicted': 0, 'would_evict': len(bottom_rows)}

    ids = [r['id'] for r in bottom_rows]
    # Bulk update via IN(...). Note: if list is huge, chunk.
    CHUNK = 500
    archived = 0
    r2_keys: list[str] = []
    now = datetime.now(timezone.utc).isoformat()
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i+CHUNK]
        in_list = ','.join(f"'{uid}'" for uid in chunk)
        rows = mgmt_sql(f"""
            UPDATE voyo_moments
            SET in_pool = false,
                archived_at = '{now}'::timestamptz,
                archive_reason = 'rotation',
                embed_url = COALESCE(
                    source_url,
                    CASE source_platform
                        WHEN 'instagram' THEN 'https://www.instagram.com/p/' || source_id || '/embed'
                        WHEN 'tiktok'    THEN 'https://www.tiktok.com/embed/v2/' || source_id
                        WHEN 'youtube'   THEN 'https://www.youtube.com/embed/' || source_id
                    END
                )
            WHERE id IN ({in_list})
            RETURNING r2_video_key
        """)
        archived += len(rows)
        r2_keys.extend(r['r2_video_key'] for r in rows if r.get('r2_video_key'))

    print(f'  archived: {archived}')
    # Queue R2 deletions for wipe_archived_r2.py
    queue_path = ROOT / 'catalogs' / '_seeds' / 'r2_rotation_queue.json'
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    with open(queue_path, 'w') as f:
        json.dump({
            'queued_at': now,
            'reason': 'rotation',
            'count': len(r2_keys),
            'keys': r2_keys,
        }, f, indent=2)
    print(f'  queued {len(r2_keys)} R2 keys → {queue_path}')
    return {'evicted': archived, 'r2_keys': len(r2_keys)}

# ── Phase 2: REFILL ──────────────────────────────────────────────────

def refill(dry: bool, max_lanes: int = 0) -> dict:
    print(f'\n=== REFILL ===')
    rows = mgmt_sql(f"""
        SELECT curated_lane, COUNT(*) AS in_pool_n
        FROM voyo_moments
        WHERE in_pool = true AND curated_lane IS NOT NULL
        GROUP BY curated_lane
    """)
    current = {r['curated_lane']: int(r['in_pool_n']) for r in rows}

    print(f'{"lane":<22} {"current":>8} {"target":>8} {"deficit":>8}')
    print('-' * 50)
    deficits = []
    for lane, target in LANE_TARGETS.items():
        cur = current.get(lane, 0)
        deficit = target - cur
        flag = '⚠' if deficit > 0 else ' '
        print(f'{lane:<22} {cur:>8} {target:>8} {deficit:>8} {flag}')
        if deficit > 0:
            deficits.append((lane, deficit))

    if not deficits:
        print('  pool is full.'); return {'refilled': 0}
    if dry:
        print('\nDRY-RUN — would call ingest_from_catalog per lane.'); return {}

    ingest_script = ROOT / 'scripts' / 'curated' / 'ingest_from_catalog.py'
    catalog_dir = ROOT / 'catalogs'
    refilled = 0
    for lane, deficit in deficits[:max_lanes or len(deficits)]:
        cat_path = catalog_dir / (lane.replace('/', '_') + '.json')
        if not cat_path.exists():
            print(f'  - {lane}: no catalog yet, skipping'); continue
        # Per-lane reels-per-creator: distribute deficit across catalog entries.
        # Each creator contributes at most 3 reels per rotation cycle.
        catalog = json.load(open(cat_path))
        n_creators = len(catalog.get('entries', []))
        if not n_creators: continue
        reels_each = max(1, min(3, math.ceil(deficit / n_creators)))
        print(f'\n  → {lane}: deficit {deficit}, {n_creators} creators, ~{reels_each} reels each')
        cmd = ['python3', str(ingest_script),
               '--lane', lane, '--reels', str(reels_each), '--workers', '3']
        try:
            subprocess.run(cmd, check=False, timeout=2400)
        except subprocess.TimeoutExpired:
            print(f'    [timeout for {lane}]')
        refilled += 1
    return {'refilled_lanes': refilled}

# ── Main ────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--rate', type=float, default=0.10)
    p.add_argument('--evict-only', action='store_true')
    p.add_argument('--refill-only', action='store_true')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--max-lanes', type=int, default=0, help='cap lanes processed during refill')
    args = p.parse_args()

    if not SBP:
        print('ERROR: SUPABASE_MANAGEMENT_TOKEN missing'); sys.exit(2)

    print(f'Pool rotation — {datetime.now(timezone.utc).isoformat()}')
    print(f'Total pool target: {TOTAL_POOL_TARGET} videos')

    summary = {}
    if not args.refill_only:
        summary['evict'] = evict(args.rate, args.dry_run)
    if not args.evict_only:
        summary['refill'] = refill(args.dry_run, args.max_lanes)

    print(f'\n=== ROTATION SUMMARY ===\n{json.dumps(summary, indent=2)}')

if __name__ == '__main__':
    main()
