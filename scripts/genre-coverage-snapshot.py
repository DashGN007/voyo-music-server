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
    # Fetch up to 40 genre rows, grouped by primary_genre via Supabase aggregation workaround:
    # fetch distinct genres, then count each
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?primary_genre=not.is.null'
           f'&select=primary_genre'
           f'&limit=5000')  # sample for distribution
    resp = requests.get(url, headers=HEADERS, timeout=20)
    rows = resp.json()
    if not isinstance(rows, list):
        return []
    from collections import Counter
    counts = Counter(r['primary_genre'] for r in rows if r.get('primary_genre'))
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
