#!/usr/bin/env python3
"""
genre-coverage-snapshot.py
===========================
Quick DB query: logs how many tracks have primary_genre set vs null,
and top-10 genre distribution. Run via cron every few hours.
"""

import os, sys, requests, urllib.parse
from datetime import datetime

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SERVICE_KEY:
    for env_path in [
        os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
    ]:
        try:
            with open(env_path) as f:
                for line in f:
                    if line.startswith('SUPABASE_SERVICE_KEY='):
                        SERVICE_KEY = line.split('=', 1)[1].strip()
                        break
            if SERVICE_KEY:
                break
        except FileNotFoundError:
            pass

if not SERVICE_KEY:
    print('ERROR: SUPABASE_SERVICE_KEY not found'); sys.exit(1)

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
}


def fetch_count(filter_qs: str) -> int:
    url = f'{SUPABASE_URL}/rest/v1/video_intelligence?{filter_qs}&select=youtube_id'
    headers = {**HEADERS, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0'}
    resp = requests.get(url, headers=headers, timeout=20)
    cr = resp.headers.get('Content-Range', '')
    # Content-Range: 0-0/TOTAL
    if '/' in cr:
        return int(cr.split('/')[1])
    return -1


def fetch_genre_distribution() -> list[tuple[str, int]]:
    # Count each genre directly — one HEAD request per genre, avoiding Supabase 1K row limit
    from collections import Counter
    GENRES = [
        'afrobeats', 'amapiano', 'hiphop', 'rnb', 'afropop', 'gospel',
        'highlife', 'hiplife', 'rumba', 'kizomba', 'zouk', 'afrohouse',
        'afro-house', 'gqom', 'bongo-flava', 'dancehall', 'reggae', 'soca',
        'reggaeton', 'mbalax', 'bikutsi', 'soukous', 'ndombolo', 'makossa',
        'gengetone', 'kwaito', 'afrobeat', 'afrofusion', 'afrofolk', 'fuji',
        'trap', 'drill', 'grime', 'soul', 'funk', 'pop', 'rock', 'classical',
        'jazz', 'electronic', 'other', 'congolese',
    ]
    counts: Counter = Counter()
    for genre in GENRES:
        g_enc = urllib.parse.quote(genre)
        url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
               f'?primary_genre=eq.{g_enc}&select=youtube_id')
        hdrs = {**HEADERS, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0'}
        try:
            r = requests.get(url, headers=hdrs, timeout=10)
            cr = r.headers.get('Content-Range', '')
            if '/' in cr:
                n = int(cr.split('/')[1])
                if n > 0:
                    counts[genre] = n
        except Exception:
            pass
    return counts.most_common(15)


def main():
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f'\n[{ts}] VOYO Genre Coverage Snapshot')
    print('=' * 45)

    total    = fetch_count('')
    tagged   = fetch_count('primary_genre=not.is.null')
    untagged = fetch_count('primary_genre=is.null')

    if total > 0:
        pct = tagged / total * 100
        print(f'Total rows:  {total:,}')
        print(f'With genre:  {tagged:,}  ({pct:.1f}%)')
        print(f'No genre:    {untagged:,}  ({100-pct:.1f}%)')

    print('\nTop genres (sample of last 1K tagged rows):')
    dist = fetch_genre_distribution()
    for genre, cnt in dist:
        print(f'  {genre:18s}  {cnt:4d}')

    print(f'\n[{ts}] Snapshot complete.', flush=True)


if __name__ == '__main__':
    main()
