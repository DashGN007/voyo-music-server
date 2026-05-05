#!/usr/bin/env python3
"""
patch-unscored-tracks.py
=========================
Patches vibe columns ONLY for tracks that have primary_genre but heat_score=0.
Runs fast — only touches newly-enriched rows, not the full 344K table.
Designed to run every few hours as a cron after genre enrichment adds new tags.
"""

import os, sys, time, requests, urllib.parse
from collections import defaultdict

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SERVICE_KEY:
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith('SUPABASE_SERVICE_KEY='):
                    SERVICE_KEY = line.split('=', 1)[1].strip()
                    break
    except FileNotFoundError:
        pass

if not SERVICE_KEY:
    print('ERROR: SUPABASE_SERVICE_KEY not found')
    sys.exit(1)

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
}

# Mirrors populate-vibe-scores.py GENRE_VIBES dict
GENRE_VIBES: dict[str, dict] = {
    'afrobeats':    dict(vibe_afro_heat=85, vibe_party_mode=80, vibe_chill_vibes=20, vibe_late_night=45, vibe_workout=60, heat_score=85),
    'afrohouse':    dict(vibe_afro_heat=80, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=60, vibe_workout=70, heat_score=80),
    'afro-house':   dict(vibe_afro_heat=80, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=60, vibe_workout=70, heat_score=80),
    'gqom':         dict(vibe_afro_heat=82, vibe_party_mode=85, vibe_chill_vibes=10, vibe_late_night=70, vibe_workout=75, heat_score=82),
    'ndombolo':     dict(vibe_afro_heat=78, vibe_party_mode=82, vibe_chill_vibes=15, vibe_late_night=55, vibe_workout=65, heat_score=78),
    'soukous':      dict(vibe_afro_heat=74, vibe_party_mode=72, vibe_chill_vibes=25, vibe_late_night=48, vibe_workout=62, heat_score=72),
    'congolese':    dict(vibe_afro_heat=70, vibe_party_mode=68, vibe_chill_vibes=30, vibe_late_night=50, vibe_workout=58, heat_score=68),
    'bikutsi':      dict(vibe_afro_heat=72, vibe_party_mode=72, vibe_chill_vibes=22, vibe_late_night=50, vibe_workout=62, heat_score=70),
    'makossa':      dict(vibe_afro_heat=68, vibe_party_mode=68, vibe_chill_vibes=30, vibe_late_night=48, vibe_workout=58, heat_score=66),
    'mbalax':       dict(vibe_afro_heat=74, vibe_party_mode=74, vibe_chill_vibes=22, vibe_late_night=45, vibe_workout=62, heat_score=72),
    'dancehall':    dict(vibe_afro_heat=74, vibe_party_mode=80, vibe_chill_vibes=18, vibe_late_night=65, vibe_workout=72, heat_score=76),
    'afrobeat':     dict(vibe_afro_heat=80, vibe_party_mode=70, vibe_chill_vibes=25, vibe_late_night=45, vibe_workout=58, heat_score=78),
    'afrofusion':   dict(vibe_afro_heat=65, vibe_party_mode=62, vibe_chill_vibes=42, vibe_late_night=48, vibe_workout=50, heat_score=62),
    'reggaeton':    dict(vibe_afro_heat=45, vibe_party_mode=80, vibe_chill_vibes=20, vibe_late_night=62, vibe_workout=70, heat_score=68),
    'kwaito':       dict(vibe_afro_heat=72, vibe_party_mode=72, vibe_chill_vibes=40, vibe_late_night=60, vibe_workout=60, heat_score=68),
    'amapiano':     dict(vibe_afro_heat=72, vibe_party_mode=76, vibe_chill_vibes=32, vibe_late_night=62, vibe_workout=65, heat_score=72),
    'afropop':      dict(vibe_afro_heat=62, vibe_party_mode=64, vibe_chill_vibes=38, vibe_late_night=42, vibe_workout=54, heat_score=62),
    'bongo-flava':  dict(vibe_afro_heat=70, vibe_party_mode=68, vibe_chill_vibes=32, vibe_late_night=45, vibe_workout=56, heat_score=68),
    'highlife':     dict(vibe_afro_heat=66, vibe_party_mode=72, vibe_chill_vibes=38, vibe_late_night=45, vibe_workout=56, heat_score=64),
    'hiphop':       dict(vibe_afro_heat=62, vibe_party_mode=72, vibe_chill_vibes=28, vibe_late_night=55, vibe_workout=72, heat_score=65),
    'trap':         dict(vibe_afro_heat=66, vibe_party_mode=74, vibe_chill_vibes=22, vibe_late_night=62, vibe_workout=74, heat_score=68),
    'drill':        dict(vibe_afro_heat=68, vibe_party_mode=76, vibe_chill_vibes=18, vibe_late_night=62, vibe_workout=78, heat_score=70),
    'pop':          dict(vibe_afro_heat=50, vibe_party_mode=62, vibe_chill_vibes=45, vibe_late_night=48, vibe_workout=55, heat_score=52),
    'kizomba':      dict(vibe_afro_heat=35, vibe_party_mode=30, vibe_chill_vibes=78, vibe_late_night=82, vibe_workout=18, heat_score=30),
    'zouk':         dict(vibe_afro_heat=32, vibe_party_mode=32, vibe_chill_vibes=76, vibe_late_night=80, vibe_workout=18, heat_score=28),
    'rnb':          dict(vibe_afro_heat=42, vibe_party_mode=45, vibe_chill_vibes=68, vibe_late_night=68, vibe_workout=32, heat_score=42),
    'soul':         dict(vibe_afro_heat=35, vibe_party_mode=38, vibe_chill_vibes=72, vibe_late_night=65, vibe_workout=28, heat_score=35),
    'gospel':       dict(vibe_afro_heat=28, vibe_party_mode=22, vibe_chill_vibes=64, vibe_late_night=30, vibe_workout=38, heat_score=22),
    'jazz':         dict(vibe_afro_heat=22, vibe_party_mode=28, vibe_chill_vibes=78, vibe_late_night=72, vibe_workout=22, heat_score=22),
    'afrofolk':     dict(vibe_afro_heat=38, vibe_party_mode=32, vibe_chill_vibes=65, vibe_late_night=58, vibe_workout=28, heat_score=35),
    'fuji':         dict(vibe_afro_heat=65, vibe_party_mode=65, vibe_chill_vibes=35, vibe_late_night=48, vibe_workout=52, heat_score=62),
    'afrojuju':     dict(vibe_afro_heat=62, vibe_party_mode=60, vibe_chill_vibes=40, vibe_late_night=45, vibe_workout=45, heat_score=58),
    'reggae':       dict(vibe_afro_heat=45, vibe_party_mode=52, vibe_chill_vibes=60, vibe_late_night=55, vibe_workout=40, heat_score=45),
    'electronic':   dict(vibe_afro_heat=45, vibe_party_mode=68, vibe_chill_vibes=35, vibe_late_night=65, vibe_workout=60, heat_score=60),
    'rock':         dict(vibe_afro_heat=20, vibe_party_mode=50, vibe_chill_vibes=48, vibe_late_night=45, vibe_workout=42, heat_score=42),
    'classical':    dict(vibe_afro_heat=10, vibe_party_mode=12, vibe_chill_vibes=82, vibe_late_night=60, vibe_workout=12, heat_score=12),
    'grime':        dict(vibe_afro_heat=65, vibe_party_mode=72, vibe_chill_vibes=20, vibe_late_night=60, vibe_workout=68, heat_score=68),
    'hiplife':      dict(vibe_afro_heat=68, vibe_party_mode=70, vibe_chill_vibes=30, vibe_late_night=45, vibe_workout=66, heat_score=66),
    'gengetone':    dict(vibe_afro_heat=72, vibe_party_mode=76, vibe_chill_vibes=25, vibe_late_night=58, vibe_workout=70, heat_score=70),
    'soca':         dict(vibe_afro_heat=75, vibe_party_mode=82, vibe_chill_vibes=18, vibe_late_night=55, vibe_workout=74, heat_score=74),
    'funk':         dict(vibe_afro_heat=68, vibe_party_mode=78, vibe_chill_vibes=30, vibe_late_night=55, vibe_workout=68, heat_score=68),
    'rumba':        dict(vibe_afro_heat=68, vibe_party_mode=65, vibe_chill_vibes=30, vibe_late_night=52, vibe_workout=65, heat_score=65),
    'other':        dict(vibe_afro_heat=55, vibe_party_mode=55, vibe_chill_vibes=45, vibe_late_night=50, vibe_workout=50, heat_score=50),
}

CHUNK = 400


NULL_GENRE_DEFAULT_SCORE = 45  # heat_score set by populate-vibe-scores.py for null-genre rows

def fetch_unscored_chunk(genre: str, after_id: str = '', score_filter: str = 'eq.0') -> list[str]:
    """Fetch youtube_ids with this genre that still have heat_score unset or at null-genre default."""
    g_enc = urllib.parse.quote(genre)
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?primary_genre=eq.{g_enc}'
           f'&heat_score={score_filter}'
           f'&select=youtube_id'
           f'&order=youtube_id.asc'
           f'&limit={CHUNK}')
    if after_id:
        url += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
    resp = requests.get(url, headers=HEADERS, timeout=20)
    data = resp.json()
    if not isinstance(data, list):
        return []
    return [r['youtube_id'] for r in data]


def patch_ids(ids: list[str], vibes: dict, vibe_scores_json: dict) -> int:
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
    expected_score = vibes['heat_score']
    # Two passes: catch heat_score=0 (never scored) AND heat_score=45 (null-genre default
    # that got enriched — these tracks were scored as neutral before genre was known).
    filters = ['eq.0', f'eq.{NULL_GENRE_DEFAULT_SCORE}']
    # Skip the null-default pass if this genre's correct score IS the default (no-op)
    if expected_score == NULL_GENRE_DEFAULT_SCORE:
        filters = ['eq.0']
    for score_filter in filters:
        after_id = ''
        while True:
            ids = fetch_unscored_chunk(genre, after_id, score_filter)
            if not ids:
                break
            status = patch_ids(ids, vibes, vibe_scores_json)
            if status not in (200, 204):
                print(f'    {genre} chunk error: {status}', flush=True)
            total += len(ids)
            after_id = ids[-1]
            time.sleep(0.2)
    return total


def main():
    print(f'Patching unscored tracks (heat_score=0 + primary_genre set)...\n', flush=True)
    grand_total = 0

    for genre, vibes in GENRE_VIBES.items():
        n = process_genre(genre, vibes)
        if n > 0:
            print(f'  {genre:15s} {n:6,} rows  heat={vibes["heat_score"]}', flush=True)
        grand_total += n

    print(f'\nTotal patched: {grand_total:,}', flush=True)


if __name__ == '__main__':
    main()
