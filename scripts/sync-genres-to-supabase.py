#!/usr/bin/env python3
"""
sync-genres-to-supabase.py
==========================
Reads canonized_tracks.json and PATCHes primary_genre into existing
video_intelligence rows. Groups by genre so all IDs in a batch share
the same value — no INSERT, no NOT NULL violations.

Usage:
    python3 scripts/sync-genres-to-supabase.py
    python3 scripts/sync-genres-to-supabase.py --force    # overwrite non-null rows too
    python3 scripts/sync-genres-to-supabase.py --dry-run
"""

import json, os, sys, time, urllib.request, urllib.parse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = ''  # filled from .env below

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'canonized_tracks.json')
BATCH_SIZE  = 30    # IDs per PATCH — smaller batches avoid statement timeout on large table
CONCURRENCY = 3

GENRE_MAP = {
    'afrobeats': 'afrobeats', 'afro-beats': 'afrobeats',
    'hip-hop': 'hiphop', 'hip hop': 'hiphop', 'hiphop': 'hiphop',
    'rnb': 'rnb', 'r&b': 'rnb',
    'amapiano': 'amapiano', 'afropiano': 'afropiano',
    'gospel': 'gospel', 'grime': 'grime',
    'reggae': 'reggae', 'dancehall': 'dancehall',
    'rumba': 'rumba', 'highlife': 'highlife',
    'afropop': 'afropop', 'afro-pop': 'afropop',
    'kizomba': 'kizomba', 'zouk': 'zouk',
    'bongo flava': 'bongo-flava', 'bongo_flava': 'bongo-flava',
    'mbalax': 'mbalax', 'afrohouse': 'afrohouse', 'afro house': 'afrohouse',
    'gqom': 'gqom', 'kuduro': 'kuduro', 'ndombolo': 'ndombolo',
    'bikutsi': 'bikutsi', 'coupe-decale': 'coupe-decale',
    'coupé-décalé': 'coupe-decale', 'lekompo': 'lekompo', 'singeli': 'singeli',
    'afrojuju': 'afrojuju', 'fuji': 'fuji', 'juju': 'juju',
    'makossa': 'makossa', 'soukous': 'soukous',
    # Lusophone Africa
    'semba': 'semba', 'tarraxo': 'tarraxo', 'tarraxinha': 'tarraxo',
    # East Africa
    'benga': 'benga', 'taarab': 'taarab',
    # North Africa
    'rai': 'rai', 'raï': 'rai', 'chaabi': 'chaabi', 'chaâbi': 'chaabi', 'gnawa': 'gnawa',
    # West Africa
    'palm wine': 'palmwine', 'palmwine': 'palmwine', 'palm-wine': 'palmwine',
    # Diaspora
    'afrosoul': 'afrosoul', 'afro-soul': 'afrosoul', 'afro soul': 'afrosoul',
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def load_key():
    env = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('SUPABASE_SERVICE_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('SUPABASE_SERVICE_KEY', '')

def normalise_genre(raw: str) -> str:
    return GENRE_MAP.get(raw.lower().strip(), raw.lower().strip())

# ─── PATCH a batch of IDs sharing the same genre ─────────────────────────────
# Strategy: PATCH /rest/v1/video_intelligence?youtube_id=in.(id1,id2,...)
# Body: { "primary_genre": "afrobeats" }
# → only updates rows that EXIST; rows missing from vi are silently skipped

def patch_genre_batch(ids: list[str], genre: str, force: bool) -> tuple[int, str | None]:
    id_list = ','.join(ids)
    # PostgREST IN filter: ?col=in.(v1,v2,v3)
    filter_parts = f'youtube_id=in.({id_list})'
    if not force:
        filter_parts += '&primary_genre=is.null'

    url = f'{SUPABASE_URL}/rest/v1/video_intelligence?{filter_parts}'
    payload = json.dumps({'primary_genre': genre}).encode()

    req = urllib.request.Request(
        url, data=payload,
        headers={
            'apikey':        SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal',
        },
        method='PATCH',
    )
    try:
        with urllib.request.urlopen(req, timeout=30):
            return (len(ids), None)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')[:200]
        return (0, f'HTTP {e.code}: {body}')
    except Exception as ex:
        return (0, str(ex))

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global SERVICE_KEY
    force   = '--force'   in sys.argv
    dry_run = '--dry-run' in sys.argv

    SERVICE_KEY = load_key()
    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY not found. Set env or check voyo-music/.env')
        sys.exit(1)

    print(f'Loading {DATA_FILE}...')
    with open(DATA_FILE) as f:
        raw = json.load(f)
    tracks = raw.get('tracks', raw) if isinstance(raw, dict) else raw
    print(f'  {len(tracks):,} tracks loaded')

    # Group youtube_ids by normalised genre
    genre_ids: dict[str, list[str]] = defaultdict(list)
    skipped = 0
    for t in tracks:
        yt_id = t.get('youtube_id') or t.get('id')
        genre = t.get('genre') or t.get('primary_genre')
        if not yt_id or not genre:
            skipped += 1
            continue
        genre_ids[normalise_genre(genre)].append(yt_id)

    total_ids = sum(len(v) for v in genre_ids.values())
    print(f'  {total_ids:,} with genre across {len(genre_ids)} genres | {skipped:,} skipped')
    print(f'  Genres: {", ".join(sorted(genre_ids))}')

    # Build work queue: (genre, [batch_of_ids])
    work: list[tuple[str, list[str]]] = []
    for genre, ids in genre_ids.items():
        for i in range(0, len(ids), BATCH_SIZE):
            work.append((genre, ids[i:i+BATCH_SIZE]))

    print(f'\n{len(work)} PATCH requests needed (batch={BATCH_SIZE}, concurrency={CONCURRENCY})')
    if not force:
        print('  (only updating rows where primary_genre IS NULL — pass --force to overwrite all)')

    if dry_run:
        print(f'\n[DRY RUN] First batch: genre={work[0][0]}, ids={work[0][1][:3]}...')
        print('[DRY RUN] No writes performed.')
        return

    written = 0
    errors  = 0
    t0      = time.time()

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(patch_genre_batch, ids, genre, force): (genre, ids)
                   for genre, ids in work}
        for fut in as_completed(futures):
            count, err = fut.result()
            if err:
                errors += 1
                genre, ids = futures[fut]
                print(f'\n  ✗ {genre} [{ids[0]}...]: {err}')
            else:
                written += count
            done  = written + errors * BATCH_SIZE
            pct   = min(done / total_ids * 100, 100)
            rate  = written / (time.time() - t0 + 0.001)
            print(f'  {pct:5.1f}% | {written:,} updated | {errors} errors | {rate:.0f}/s   ', end='\r')

    elapsed = time.time() - t0
    print(f'\n\n✅ Done: {written:,} rows genre-tagged in {elapsed:.1f}s ({written/elapsed:.0f}/s)')
    if errors:
        print(f'⚠  {errors} batches failed')

if __name__ == '__main__':
    main()
