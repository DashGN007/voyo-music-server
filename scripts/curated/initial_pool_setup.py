#!/usr/bin/env python3
"""
initial_pool_setup.py — Day-0 transition to the rotating pool.
==============================================================
Performs the one-time setup described in catalogs/_strategy.md:

  1. Identify CORE = top 7% by virality_score among rows that have
     real engagement signal (siphon-discovered with creator_username
     and view_count > 0). Mark is_core=true, in_pool=true. These are
     the bedrock — never rotates out.

  2. Extract every distinct creator_username from those siphon rows
     into catalogs/_seeds/orphan_creators.json with their dominant
     cultural_tags so the next discovery wave has a head start.

  3. Mark everyone else as archived: in_pool=false,
     archived_at=now(), archive_reason='orphan_purge', embed_url
     populated from source_url.

  4. Builds a queue file of R2 keys to delete (consumed by
     wipe_archived_r2.py — kept separate so this step is idempotent
     and reversible if we change our minds before deletion runs).

Idempotent: safe to re-run; will re-detect what's already core/archived
and only act on the new state.
"""

import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/home/dash/voyo-music-server')
SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'

# Core selection — top N% of rows that have real virality signal.
CORE_PCT = 0.07          # top 7%
CORE_MIN_VIEWS = 1_000   # require at least 1K views to be core-eligible

def load_env(p: str) -> dict:
    out = {}
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            out[k] = v.strip().strip('"').strip("'")
    return out

ENV = {**load_env('/home/dash/voyo-music/.env'), **load_env(str(ROOT / '.env'))}
SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or ENV.get('SUPABASE_SERVICE_KEY')
SBP = os.environ.get('SUPABASE_MANAGEMENT_TOKEN') or ENV.get('SUPABASE_MANAGEMENT_TOKEN')
PROJ_REF = ENV.get('VOYO_PROJECT_REF', 'anmgyxhnyhbyxzpjhxgx')
if not SERVICE_KEY:
    print('ERROR: SUPABASE_SERVICE_KEY missing'); sys.exit(2)

SB_HDR = {'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}

# ── Use Management API for fast bulk SQL ─────────────────────────────

def mgmt_sql(q: str) -> list:
    if not SBP:
        raise RuntimeError('SUPABASE_MANAGEMENT_TOKEN missing — needed for bulk SQL')
    body = json.dumps({'query': q}).encode()
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJ_REF}/database/query',
        data=body, method='POST',
        headers={
            'Authorization': f'Bearer {SBP}',
            'Content-Type':  'application/json',
            'User-Agent':    'voyo-curated-tools/1.0',
            'Accept':        'application/json',
        })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read()[:500].decode('utf-8', 'ignore')
        raise RuntimeError(f'mgmt_sql {e.code}: {body}') from e

# ── Embed URL builder ────────────────────────────────────────────────

def build_embed_url(platform: str, source_id: str, source_url: str | None) -> str | None:
    """Source-platform embed URL — used for the creator-page render
    after the R2 file is gone. Apps and the desktop site both render
    these via standard oEmbed iframe."""
    if source_url and ('instagram.com' in source_url or 'tiktok.com' in source_url
                       or 'youtube.com' in source_url or 'youtu.be' in source_url):
        return source_url
    if platform == 'instagram':
        return f'https://www.instagram.com/p/{source_id}/embed'
    if platform == 'tiktok':
        return f'https://www.tiktok.com/embed/v2/{source_id}'
    if platform == 'youtube':
        return f'https://www.youtube.com/embed/{source_id}'
    return None

# ── Step 1: identify core ────────────────────────────────────────────

def select_core() -> int:
    """Returns the count promoted to core."""
    print('\n=== Step 1: select core ===')
    print(f'Top {CORE_PCT*100:.0f}% of rows where virality_score >= {CORE_MIN_VIEWS} '
          f'and creator_username is not null')
    # Compute count first
    rows = mgmt_sql(f"""
        SELECT COUNT(*) AS n
        FROM voyo_moments
        WHERE is_active = true
          AND creator_username IS NOT NULL
          AND virality_score >= {CORE_MIN_VIEWS}
    """)
    eligible = int(rows[0]['n'])
    target = max(int(eligible * CORE_PCT), 1) if eligible else 0
    print(f'  eligible: {eligible}  target_core: {target}')
    if not target:
        return 0
    # Promote top N to core. is_core defaults false; flip top N.
    rows = mgmt_sql(f"""
        WITH ranked AS (
          SELECT id
          FROM voyo_moments
          WHERE is_active = true
            AND creator_username IS NOT NULL
            AND virality_score >= {CORE_MIN_VIEWS}
          ORDER BY virality_score DESC, voyo_plays DESC, discovered_at DESC
          LIMIT {target}
        )
        UPDATE voyo_moments m
        SET is_core = true, in_pool = true
        FROM ranked r
        WHERE m.id = r.id
        RETURNING m.id
    """)
    print(f'  promoted to core: {len(rows)}')
    return len(rows)

# ── Step 2: extract orphan-creator seeds ─────────────────────────────

def extract_seeds() -> int:
    """Pull creator_username + their dominant cultural_tags into a seed file."""
    print('\n=== Step 2: extract creator seeds for next discovery wave ===')
    rows = mgmt_sql("""
        SELECT
            creator_username,
            source_platform,
            COUNT(*) AS reel_count,
            SUM(view_count) AS total_views,
            AVG(virality_score) AS avg_virality,
            ARRAY_AGG(DISTINCT unnest_tag) FILTER (WHERE unnest_tag IS NOT NULL) AS top_tags
        FROM voyo_moments,
             LATERAL unnest(cultural_tags) AS unnest_tag
        WHERE is_active = true
          AND creator_username IS NOT NULL
          AND creator_username <> ''
        GROUP BY creator_username, source_platform
        ORDER BY total_views DESC NULLS LAST
        LIMIT 5000
    """)
    seeds_dir = ROOT / 'catalogs' / '_seeds'
    seeds_dir.mkdir(parents=True, exist_ok=True)
    out = seeds_dir / 'orphan_creators.json'
    payload = {
        'extracted_at': datetime.now(timezone.utc).isoformat(),
        'count':        len(rows),
        'note':         'Distinct creator handles surfaced from existing siphon rows. Use as discovery seeds for catalogs/<lane>.json builds.',
        'creators':     [
            {
                'handle':       r['creator_username'],
                'platform':     r['source_platform'],
                'reel_count':   int(r['reel_count']),
                'total_views':  int(r['total_views'] or 0),
                'avg_virality': float(r['avg_virality'] or 0),
                'top_tags':     r['top_tags'] or [],
            } for r in rows
        ],
    }
    with open(out, 'w') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f'  wrote {len(rows)} creator seeds → {out}')
    return len(rows)

# ── Step 3: archive everyone non-core ────────────────────────────────

def archive_non_core() -> tuple[int, int]:
    """Mark non-core rows in_pool=false, archived_at=now(),
    archive_reason='orphan_purge', and populate embed_url.
    Returns (archived_n, total_kept_in_pool)."""
    print('\n=== Step 3: archive non-core (orphan_purge) ===')
    now = datetime.now(timezone.utc).isoformat()
    # Use SQL to compute embed_url server-side — much faster than per-row PATCH.
    # NEVER archive curated_lane content — those are catalog-driven and
    # belong in the pool by definition. Only archive the legacy orphan
    # set + low-engagement siphon that didn't make core.
    rows = mgmt_sql(f"""
        UPDATE voyo_moments
        SET
            in_pool        = false,
            archived_at    = '{now}'::timestamptz,
            archive_reason = 'orphan_purge',
            embed_url      = COALESCE(
                source_url,
                CASE source_platform
                    WHEN 'instagram' THEN 'https://www.instagram.com/p/' || source_id || '/embed'
                    WHEN 'tiktok'    THEN 'https://www.tiktok.com/embed/v2/' || source_id
                    WHEN 'youtube'   THEN 'https://www.youtube.com/embed/' || source_id
                END
            )
        WHERE is_active = true
          AND is_core = false
          AND curated_lane IS NULL
          AND archived_at IS NULL
        RETURNING id
    """)
    archived = len(rows)
    print(f'  archived: {archived}')
    in_pool = mgmt_sql("SELECT COUNT(*) AS n FROM voyo_moments WHERE in_pool = true")
    print(f'  remaining in_pool: {in_pool[0]["n"]}')
    return (archived, int(in_pool[0]['n']))

# ── Step 4: queue R2 deletions ──────────────────────────────────────

def queue_r2_deletions() -> int:
    """Write a JSON file of R2 keys to delete. wipe_archived_r2.py
    consumes this — kept separate so this script stays reversible
    until the deletion actually runs."""
    print('\n=== Step 4: queue R2 deletions ===')
    rows = mgmt_sql("""
        SELECT r2_video_key
        FROM voyo_moments
        WHERE archive_reason = 'orphan_purge'
          AND r2_video_key IS NOT NULL
        ORDER BY archived_at DESC
    """)
    keys = [r['r2_video_key'] for r in rows if r['r2_video_key']]
    out = ROOT / 'catalogs' / '_seeds' / 'r2_deletion_queue.json'
    with open(out, 'w') as f:
        json.dump({
            'queued_at': datetime.now(timezone.utc).isoformat(),
            'reason':    'orphan_purge',
            'count':     len(keys),
            'keys':      keys,
        }, f, indent=2)
    print(f'  queued {len(keys)} R2 keys → {out}')
    print(f'  next: python3 scripts/curated/wipe_archived_r2.py')
    return len(keys)

# ── Main ────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    print(f'Initial pool setup — {datetime.now(timezone.utc).isoformat()}')
    core = select_core()
    seeds = extract_seeds()
    archived, in_pool = archive_non_core()
    queued = queue_r2_deletions()
    print('\n=== SUMMARY ===')
    print(f'  core promoted:      {core}')
    print(f'  seeds extracted:    {seeds}')
    print(f'  rows archived:      {archived}')
    print(f'  remaining in_pool:  {in_pool}')
    print(f'  R2 keys queued:     {queued}')
    print(f'  elapsed:            {time.time()-t0:.1f}s')

if __name__ == '__main__':
    main()
