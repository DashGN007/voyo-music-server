#!/usr/bin/env python3
"""
enrich-moment-genre-tags.py
============================
For voyo_moments with parent_track_id but no cultural_tags, looks up the
video_intelligence.primary_genre and adds matching cultural tags.

Genre → cultural_tag mapping mirrors the GENRE_TAG_MAP in useMoments.ts:
  afrobeats  → ['nigeria', 'west-africa']
  amapiano   → ['south-africa', 'mzansi']
  kizomba    → ['angola', 'lusophone-africa']
  bongo-flava → ['east-africa']
  gospel     → ['spiritual']
  rumba      → ['congo', 'central-africa']
  hiphop     → ['usa', 'diaspora']
  rnb        → ['diaspora']
  drill/grime → ['uk']

Run:
    python3 scripts/enrich-moment-genre-tags.py
    python3 scripts/enrich-moment-genre-tags.py --dry-run
"""

import json, os, sys, time, urllib.request, urllib.parse

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = ''

# primary_genre → cultural_tags to ADD (most specific first)
GENRE_TO_TAGS: dict[str, list[str]] = {
    'afrobeats':   ['nigeria', 'west-africa'],
    'afropop':     ['west-africa'],
    'amapiano':    ['south-africa', 'mzansi'],
    'kizomba':     ['angola', 'lusophone-africa'],
    'bongo-flava': ['east-africa'],
    'gospel':      ['spiritual'],
    'rumba':       ['congo', 'central-africa'],
    'soukous':     ['congo', 'central-africa'],
    'ndombolo':    ['congo', 'central-africa'],
    'makossa':     ['cameroon'],
    'bikutsi':     ['cameroon'],
    'hiphop':      ['usa', 'diaspora'],
    'rnb':         ['diaspora'],
    'drill':       ['uk'],
    'grime':       ['uk'],
    'dancehall':   ['jamaica'],
    'reggae':      ['jamaica'],
    'highlife':    ['ghana', 'west-africa'],
    'mbalax':      ['senegal', 'west-africa'],
    'gqom':        ['south-africa', 'mzansi'],
    'afrohouse':   ['south-africa'],
    'afro-house':  ['south-africa'],
    'zouk':        ['lusophone-africa'],
    'hiplife':     ['ghana', 'west-africa'],
    'gengetone':   ['kenya', 'east-africa'],
    'congolese':   ['congo', 'central-africa'],
    'trap':        ['usa', 'diaspora'],
    'soul':        ['diaspora'],
    'soca':        ['caribbean', 'diaspora'],
    'reggaeton':   ['caribbean', 'latin'],
    'funk':        ['diaspora'],
    'kwaito':      ['south-africa', 'mzansi'],
    'fuji':        ['nigeria', 'west-africa'],
    'juju':        ['nigeria', 'west-africa'],
    'afrojuju':    ['nigeria', 'west-africa'],
    'afrobeat':    ['nigeria', 'west-africa'],
    'afrofusion':  ['diaspora', 'west-africa'],
    'afrofolk':    ['west-africa'],
    'palmwine':    ['ghana', 'west-africa'],
    # Lusophone Africa
    'kuduro':      ['angola', 'lusophone-africa'],
    'semba':       ['angola', 'lusophone-africa'],
    'tarraxo':     ['angola', 'lusophone-africa'],
    # East Africa
    'benga':       ['kenya', 'east-africa'],
    'taarab':      ['east-africa', 'tanzania'],
    'singeli':     ['tanzania', 'east-africa'],
    # SA underground
    'lekompo':     ['south-africa', 'mzansi'],
    # North Africa
    'rai':         ['algeria', 'north-africa'],
    'chaabi':      ['algeria', 'north-africa'],
    'gnawa':       ['morocco', 'north-africa'],
    # Cross-regional
    'afrosoul':    ['diaspora'],
}

PAGE = 200

def load_key():
    env = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('SUPABASE_SERVICE_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('SUPABASE_SERVICE_KEY', '')

def sb_get(path: str, params: dict = None) -> list | None:
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None

def sb_patch(table: str, params: dict, body: dict) -> bool:
    url = f'{SUPABASE_URL}/rest/v1/{table}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url,
        data=json.dumps(body).encode(),
        headers={
            'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        }, method='PATCH')
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True
    except Exception as e:
        return False

def main():
    global SERVICE_KEY
    dry_run = '--dry-run' in sys.argv
    SERVICE_KEY = load_key()
    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY not found'); sys.exit(1)

    print('Fetching moments with parent_track_id but no cultural_tags...')
    # Get moments where parent_track_id is set but cultural_tags is null/empty
    moments = []
    offset = 0
    while True:
        batch = sb_get('voyo_moments', {
            'select': 'id,parent_track_id,cultural_tags',
            'parent_track_id': 'not.is.null',
            'cultural_tags': 'is.null',
            'order': 'created_at.asc',
            'limit': str(PAGE),
            'offset': str(offset),
        })
        if not batch:
            break
        moments.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    # Also get moments with empty array cultural_tags (using raw URL to avoid double-encoding)
    offset2 = 0
    while True:
        raw_url = (f'{SUPABASE_URL}/rest/v1/voyo_moments'
                   f'?select=id,parent_track_id,cultural_tags'
                   f'&parent_track_id=not.is.null'
                   f'&cultural_tags=eq.%7B%7D'
                   f'&order=created_at.asc'
                   f'&limit={PAGE}&offset={offset2}')
        req = urllib.request.Request(raw_url, headers={
            'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
        })
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                batch = json.loads(r.read()) or []
        except Exception:
            break
        if not batch:
            break
        moments.extend(batch)
        if len(batch) < PAGE:
            break
        offset2 += PAGE

    print(f'  {len(moments)} moments need cultural_tags enrichment')
    if not moments:
        print('Nothing to do.')
        return

    # Batch-fetch primary_genre for all parent_track_ids
    track_ids = list({m['parent_track_id'] for m in moments})
    print(f'  Looking up genres for {len(track_ids)} unique tracks...')

    genre_map: dict[str, str] = {}
    CHUNK = 50
    for i in range(0, len(track_ids), CHUNK):
        chunk = track_ids[i:i+CHUNK]
        id_list = ','.join(chunk)
        rows = sb_get('video_intelligence', {
            'select': 'youtube_id,primary_genre',
            'youtube_id': f'in.({id_list})',
            'primary_genre': 'not.is.null',
        })
        if rows:
            for row in rows:
                if row.get('primary_genre'):
                    genre_map[row['youtube_id']] = row['primary_genre']
        print(f'  {min(i+CHUNK,len(track_ids))}/{len(track_ids)} tracks looked up', end='\r')

    print(f'\n  Found genres for {len(genre_map)}/{len(track_ids)} tracks')

    enriched = 0
    skipped  = 0
    for m in moments:
        track_id = m['parent_track_id']
        genre = genre_map.get(track_id)
        if not genre:
            skipped += 1
            continue

        new_tags = GENRE_TO_TAGS.get(genre, [])
        if not new_tags:
            skipped += 1
            continue

        if dry_run:
            print(f'  [DRY] {m["id"][:8]} genre={genre} → tags={new_tags}')
            enriched += 1  # count would-be enrichments
        else:
            ok = sb_patch('voyo_moments',
                {'id': f'eq.{m["id"]}'},
                {'cultural_tags': new_tags},
            )
            if ok:
                enriched += 1
            else:
                skipped += 1
            pct = (enriched + skipped) / len(moments) * 100
            print(f'  {pct:5.1f}% | {enriched} enriched | {skipped} skipped', end='\r')

    if dry_run:
        print(f'\n[DRY RUN] Would enrich {enriched} moments. No writes.')
    else:
        print(f'\n\n✅ Done — {enriched}/{len(moments)} moments enriched with cultural_tags')
        print(f'   Skipped: {skipped} (no genre data or no tag mapping)')

if __name__ == '__main__':
    main()
