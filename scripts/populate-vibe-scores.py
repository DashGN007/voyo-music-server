#!/usr/bin/env python3
"""
Populate flat vibe columns from primary_genre.
Cursor-based chunking avoids statement_timeout on large genres.
"""

import os, sys, json, time, requests, urllib.parse

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SERVICE_KEY:
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    with open(env_path) as f:
        for line in f:
            if line.startswith('SUPABASE_SERVICE_KEY='):
                SERVICE_KEY = line.split('=', 1)[1].strip()
                break

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
}

GENRE_VIBES: dict[str, dict] = {
    # High energy
    'afrobeats':    dict(vibe_afro_heat=85, vibe_party_mode=80, vibe_chill_vibes=20, vibe_late_night=45, vibe_workout=60, heat_score=85),
    'afrohouse':    dict(vibe_afro_heat=80, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=60, vibe_workout=70, heat_score=80),
    'gqom':         dict(vibe_afro_heat=82, vibe_party_mode=85, vibe_chill_vibes=10, vibe_late_night=70, vibe_workout=75, heat_score=82),
    'ndombolo':     dict(vibe_afro_heat=78, vibe_party_mode=82, vibe_chill_vibes=15, vibe_late_night=55, vibe_workout=65, heat_score=78),
    'soukous':      dict(vibe_afro_heat=74, vibe_party_mode=72, vibe_chill_vibes=25, vibe_late_night=48, vibe_workout=62, heat_score=72),
    'congolese':    dict(vibe_afro_heat=70, vibe_party_mode=68, vibe_chill_vibes=30, vibe_late_night=50, vibe_workout=58, heat_score=68),
    'bikutsi':      dict(vibe_afro_heat=72, vibe_party_mode=72, vibe_chill_vibes=22, vibe_late_night=50, vibe_workout=62, heat_score=70),
    'makossa':      dict(vibe_afro_heat=68, vibe_party_mode=68, vibe_chill_vibes=30, vibe_late_night=48, vibe_workout=58, heat_score=66),
    'mbalax':       dict(vibe_afro_heat=74, vibe_party_mode=74, vibe_chill_vibes=22, vibe_late_night=45, vibe_workout=62, heat_score=72),
    'dancehall':    dict(vibe_afro_heat=74, vibe_party_mode=80, vibe_chill_vibes=18, vibe_late_night=65, vibe_workout=72, heat_score=76),
    'afrobeat':     dict(vibe_afro_heat=80, vibe_party_mode=70, vibe_chill_vibes=25, vibe_late_night=45, vibe_workout=58, heat_score=78),
    'gengetone':    dict(vibe_afro_heat=72, vibe_party_mode=76, vibe_chill_vibes=25, vibe_late_night=58, vibe_workout=68, heat_score=70),
    'soca':         dict(vibe_afro_heat=75, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=55, vibe_workout=65, heat_score=74),
    'reggaeton':    dict(vibe_afro_heat=45, vibe_party_mode=80, vibe_chill_vibes=20, vibe_late_night=62, vibe_workout=70, heat_score=68),
    'grime':        dict(vibe_afro_heat=65, vibe_party_mode=72, vibe_chill_vibes=20, vibe_late_night=60, vibe_workout=72, heat_score=68),
    # Mid energy
    'amapiano':     dict(vibe_afro_heat=72, vibe_party_mode=76, vibe_chill_vibes=32, vibe_late_night=62, vibe_workout=65, heat_score=72),
    'afropop':      dict(vibe_afro_heat=62, vibe_party_mode=64, vibe_chill_vibes=38, vibe_late_night=42, vibe_workout=54, heat_score=62),
    'bongo-flava':  dict(vibe_afro_heat=70, vibe_party_mode=68, vibe_chill_vibes=32, vibe_late_night=45, vibe_workout=56, heat_score=68),
    'rumba':        dict(vibe_afro_heat=68, vibe_party_mode=65, vibe_chill_vibes=30, vibe_late_night=52, vibe_workout=50, heat_score=65),
    'highlife':     dict(vibe_afro_heat=66, vibe_party_mode=72, vibe_chill_vibes=38, vibe_late_night=45, vibe_workout=56, heat_score=64),
    'hiplife':      dict(vibe_afro_heat=68, vibe_party_mode=70, vibe_chill_vibes=30, vibe_late_night=45, vibe_workout=58, heat_score=66),
    'kwaito':       dict(vibe_afro_heat=72, vibe_party_mode=72, vibe_chill_vibes=40, vibe_late_night=60, vibe_workout=60, heat_score=68),
    'hiphop':       dict(vibe_afro_heat=62, vibe_party_mode=72, vibe_chill_vibes=28, vibe_late_night=55, vibe_workout=72, heat_score=65),
    'trap':         dict(vibe_afro_heat=66, vibe_party_mode=74, vibe_chill_vibes=22, vibe_late_night=62, vibe_workout=74, heat_score=68),
    'drill':        dict(vibe_afro_heat=68, vibe_party_mode=76, vibe_chill_vibes=18, vibe_late_night=62, vibe_workout=78, heat_score=70),
    'pop':          dict(vibe_afro_heat=50, vibe_party_mode=62, vibe_chill_vibes=45, vibe_late_night=48, vibe_workout=55, heat_score=52),
    # Chill/late night (isChillSong: chill>55 AND afro_heat<40)
    'kizomba':      dict(vibe_afro_heat=35, vibe_party_mode=30, vibe_chill_vibes=78, vibe_late_night=82, vibe_workout=18, heat_score=30),
    'zouk':         dict(vibe_afro_heat=32, vibe_party_mode=32, vibe_chill_vibes=76, vibe_late_night=80, vibe_workout=18, heat_score=28),
    'rnb':          dict(vibe_afro_heat=42, vibe_party_mode=45, vibe_chill_vibes=68, vibe_late_night=68, vibe_workout=32, heat_score=42),
    'soul':         dict(vibe_afro_heat=35, vibe_party_mode=38, vibe_chill_vibes=72, vibe_late_night=65, vibe_workout=28, heat_score=35),
    'gospel':       dict(vibe_afro_heat=28, vibe_party_mode=22, vibe_chill_vibes=64, vibe_late_night=30, vibe_workout=38, heat_score=22),
    'jazz':         dict(vibe_afro_heat=22, vibe_party_mode=28, vibe_chill_vibes=78, vibe_late_night=72, vibe_workout=22, heat_score=22),
    'afrofolk':     dict(vibe_afro_heat=38, vibe_party_mode=32, vibe_chill_vibes=65, vibe_late_night=58, vibe_workout=28, heat_score=35),
    'fuji':         dict(vibe_afro_heat=65, vibe_party_mode=65, vibe_chill_vibes=35, vibe_late_night=48, vibe_workout=52, heat_score=62),
    'afrojuju':     dict(vibe_afro_heat=62, vibe_party_mode=60, vibe_chill_vibes=40, vibe_late_night=45, vibe_workout=45, heat_score=58),
    'afrofusion':   dict(vibe_afro_heat=65, vibe_party_mode=62, vibe_chill_vibes=42, vibe_late_night=48, vibe_workout=50, heat_score=62),
    'funk':         dict(vibe_afro_heat=68, vibe_party_mode=78, vibe_chill_vibes=30, vibe_late_night=55, vibe_workout=65, heat_score=68),
    'reggae':       dict(vibe_afro_heat=45, vibe_party_mode=52, vibe_chill_vibes=60, vibe_late_night=55, vibe_workout=40, heat_score=45),
    # Non-African genres (from enrichment)
    'electronic':   dict(vibe_afro_heat=45, vibe_party_mode=68, vibe_chill_vibes=35, vibe_late_night=65, vibe_workout=60, heat_score=60),
    'rock':         dict(vibe_afro_heat=20, vibe_party_mode=50, vibe_chill_vibes=48, vibe_late_night=45, vibe_workout=42, heat_score=42),
    'classical':    dict(vibe_afro_heat=10, vibe_party_mode=12, vibe_chill_vibes=82, vibe_late_night=60, vibe_workout=12, heat_score=12),
    # Hyphen aliases (same as their canonical forms)
    'afro-house':   dict(vibe_afro_heat=80, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=60, vibe_workout=70, heat_score=80),
    'bongo-flava':  dict(vibe_afro_heat=70, vibe_party_mode=68, vibe_chill_vibes=32, vibe_late_night=45, vibe_workout=56, heat_score=68),
    # Fallback
    'other':        dict(vibe_afro_heat=55, vibe_party_mode=55, vibe_chill_vibes=45, vibe_late_night=50, vibe_workout=50, heat_score=50),
}

CHUNK = 500  # rows per PATCH — stays well under statement_timeout


def fetch_ids_chunk(genre: str, after_id: str = '') -> list[str]:
    """Fetch a page of youtube_ids for a genre (cursor-based)."""
    g_enc = urllib.parse.quote(genre)
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?primary_genre=eq.{g_enc}'
           f'&select=youtube_id'
           f'&order=youtube_id.asc'
           f'&limit={CHUNK}')
    if after_id:
        url += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
    resp = requests.get(url, headers=HEADERS, timeout=20)
    return [r['youtube_id'] for r in resp.json()]


def fetch_null_ids_chunk(after_id: str = '') -> list[str]:
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?primary_genre=is.null'
           f'&select=youtube_id'
           f'&order=youtube_id.asc'
           f'&limit={CHUNK}')
    if after_id:
        url += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
    resp = requests.get(url, headers=HEADERS, timeout=20)
    return [r['youtube_id'] for r in resp.json()]


def patch_ids(ids: list[str], vibes: dict, vibe_scores_json: dict) -> int:
    """PATCH a specific list of youtube_ids using IN filter."""
    id_list = ','.join(urllib.parse.quote(i) for i in ids)
    url = f'{SUPABASE_URL}/rest/v1/video_intelligence?youtube_id=in.({id_list})'
    body = {**vibes, 'vibe_scores': vibe_scores_json}
    resp = requests.patch(url, headers=HEADERS, json=body, timeout=30)
    return resp.status_code


def process_genre(genre: str, vibes: dict) -> int:
    vibe_scores_json = {
        'afro_heat':  vibes['vibe_afro_heat'],
        'party':      vibes['vibe_party_mode'],
        'chill':      vibes['vibe_chill_vibes'],
        'late_night': vibes['vibe_late_night'],
        'workout':    vibes['vibe_workout'],
    }
    total = 0
    after_id = ''
    while True:
        ids = fetch_ids_chunk(genre, after_id)
        if not ids:
            break
        status = patch_ids(ids, vibes, vibe_scores_json)
        if status not in (200, 204):
            print(f'    chunk error: {status}')
        total += len(ids)
        after_id = ids[-1]
        sys.stdout.write('.')
        sys.stdout.flush()
        time.sleep(0.2)
    return total


def process_null(vibes: dict) -> int:
    vibe_scores_json = {
        'afro_heat':  vibes['vibe_afro_heat'],
        'party':      vibes['vibe_party_mode'],
        'chill':      vibes['vibe_chill_vibes'],
        'late_night': vibes['vibe_late_night'],
        'workout':    vibes['vibe_workout'],
    }
    total = 0
    after_id = ''
    while True:
        ids = fetch_null_ids_chunk(after_id)
        if not ids:
            break
        status = patch_ids(ids, vibes, vibe_scores_json)
        if status not in (200, 204):
            print(f'    chunk error: {status}')
        total += len(ids)
        after_id = ids[-1]
        sys.stdout.write('.')
        sys.stdout.flush()
        time.sleep(0.2)
    return total


def main():
    print('Populating vibe columns from primary_genre (chunked)...\n')
    grand_total = 0

    for genre, vibes in GENRE_VIBES.items():
        sys.stdout.write(f'  {genre:15s} ')
        sys.stdout.flush()
        n = process_genre(genre, vibes)
        print(f' {n:6,} rows  heat={vibes["heat_score"]} afro={vibes["vibe_afro_heat"]}')
        grand_total += n

    # NULL genre rows — keep below isHypeSong threshold (afro>55 OR party>55)
    null_vibes = dict(vibe_afro_heat=45, vibe_party_mode=48, vibe_chill_vibes=40, vibe_late_night=42, vibe_workout=50, heat_score=45)
    sys.stdout.write(f'  {"(null genre)":15s} ')
    sys.stdout.flush()
    n = process_null(null_vibes)
    print(f' {n:6,} rows  (neutral)')
    grand_total += n

    print(f'\nTotal updated: {grand_total:,}')


if __name__ == '__main__':
    main()
