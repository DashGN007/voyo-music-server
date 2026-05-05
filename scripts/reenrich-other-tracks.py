#!/usr/bin/env python3
"""
reenrich-other-tracks.py
=========================
Re-classify tracks currently labeled 'other' using the improved prompt.
Only overwrites if the new classification is NOT 'other' (conservative — keeps
genuine unknowns, updates misclassified reggae/dancehall/soul/etc.).

Run after completing the main enrichment loop so API quota isn't split:
    cd /home/dash/voyo-music-server
    python3 scripts/reenrich-other-tracks.py

Progress is logged to /tmp/voyo_reenrich_other.log
"""

import json, os, sys, time, urllib.request, urllib.parse, urllib.error, re, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import cycle

SUPABASE_URL    = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
OPENROUTER_URL  = 'https://openrouter.ai/api/v1/chat/completions'
SERVICE_KEY     = ''
OPENROUTER_KEY  = ''

FREE_MODELS = [
    'openai/gpt-oss-20b:free',
    'openai/gpt-oss-120b:free',
    'inclusionai/ling-2.6-1t:free',
]

BATCH_SIZE  = 100
CONCURRENCY = 3
FETCH_PAGE  = 500

GENRES = [
    'afrobeats', 'amapiano', 'hiphop', 'rnb', 'afropop', 'gospel',
    'highlife', 'hiplife', 'rumba', 'kizomba', 'zouk', 'afrohouse', 'gqom',
    'bongo-flava', 'dancehall', 'reggae', 'soca', 'reggaeton', 'mbalax', 'bikutsi',
    'soukous', 'ndombolo', 'makossa', 'gengetone', 'kwaito', 'afrobeat',
    'afrofusion', 'afrofolk', 'fuji', 'trap', 'drill', 'grime', 'soul',
    'funk', 'pop', 'rock', 'classical', 'jazz', 'electronic', 'other',
]

PROMPT_TMPL = """You are a music genre expert specialising in African and global music.
For each track below, return ONLY the primary genre from this list:
{genres}

Rules:
- Nigerian/Ghanaian pop = afrobeats (unless clearly amapiano/highlife/hiplife)
- Fela Kuti style = afrobeat (not afrobeats)
- South African house = amapiano or afrohouse
- South African township = kwaito or gqom
- Congolese = rumba or soukous or ndombolo
- Tanzanian/Kenyan = bongo-flava; Kenyan street = gengetone
- Cameroonian = bikutsi or makossa
- Senegalese = mbalax
- Jamaican roots/rocksteady/ska/dub/lovers rock = reggae (Bob Marley, Dennis Brown, Gregory Isaacs, Burning Spear, etc.)
- Jamaican dancehall (modern, digital) = dancehall (Beenie Man, Bounty Killer, Shaggy, Yellowman)
- Caribbean party = soca; Latin Caribbean = reggaeton
- West African acoustic/folk = afrofolk
- Yoruba folk/spiritual = fuji
- Gospel rap = gospel (faith > rap)
- American/UK trap or drill = trap or drill (not afrobeats)
- Non-African/Caribbean/diasporic genres = soul, funk, pop, rock, classical, jazz, electronic
- If unsure between two African genres = afropop
- Only use "other" for tracks that genuinely fit NONE of the 39 specific genres above

Return ONLY a JSON array of strings, same order as input, no explanation:
["genre1","genre2",...]

Tracks:
{tracks}"""

_model_cycle = None
_cycle_lock  = threading.Lock()
_model_backoff: dict[str, float] = {}

def _get_next_model() -> str:
    global _model_cycle
    with _cycle_lock:
        if _model_cycle is None:
            _model_cycle = cycle(FREE_MODELS)
        for _ in range(len(FREE_MODELS) * 2):
            m = next(_model_cycle)
            if time.time() >= _model_backoff.get(m, 0):
                return m
        all_models = FREE_MODELS[:]
        soonest = min(all_models, key=lambda m: _model_backoff.get(m, 0))
        wait = max(0, _model_backoff.get(soonest, 0) - time.time())
        if wait > 0:
            time.sleep(wait + 1)
        return soonest

def _backoff_model(model: str, seconds: float = 60):
    _model_backoff[model] = time.time() + seconds

def load_env():
    global SERVICE_KEY, OPENROUTER_KEY
    paths = [
        os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
    ]
    for p in paths:
        if not os.path.exists(p): continue
        for line in open(p):
            k, _, v = line.partition('=')
            v = v.strip().strip('"').strip("'")
            if k == 'SUPABASE_SERVICE_KEY': SERVICE_KEY    = v
            if k == 'OPENROUTER_API_KEY':   OPENROUTER_KEY = v
    SERVICE_KEY    = SERVICE_KEY    or os.environ.get('SUPABASE_SERVICE_KEY', '')
    OPENROUTER_KEY = OPENROUTER_KEY or os.environ.get('OPENROUTER_API_KEY', '')

def sb_fetch_other_page(after_id: str = '') -> list[dict]:
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?select=youtube_id,title,artist'
           f'&primary_genre=eq.other'
           f'&title=not.is.null'
           f'&order=youtube_id.asc'
           f'&limit={FETCH_PAGE}')
    if after_id:
        url += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read()) or []
    except Exception:
        return []

def sb_patch_genre(yt_id: str, genre: str) -> bool:
    url = f'{SUPABASE_URL}/rest/v1/video_intelligence?youtube_id=eq.{urllib.parse.quote(yt_id)}'
    req = urllib.request.Request(url,
        data=json.dumps({'primary_genre': genre}).encode(),
        headers={
            'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        }, method='PATCH')
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True
    except Exception:
        return False

def _parse_genres(text: str, expected: int) -> list[str] | None:
    m = re.search(r'\[.*?\]', text, re.DOTALL)
    if not m: return None
    try:
        genres = json.loads(m.group())
    except Exception:
        return None
    if len(genres) >= expected:
        return genres[:expected]
    if len(genres) >= expected * 0.95:
        return genres
    return None

def _call_openrouter(model: str, prompt: str, n_tracks: int) -> list[str] | None:
    payload = json.dumps({
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0,
        'max_tokens': max(n_tracks * 8, 512),
    }).encode()
    req = urllib.request.Request(OPENROUTER_URL, data=payload, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENROUTER_KEY}',
        'HTTP-Referer': 'https://voyomusic.com',
        'X-Title': 'VOYO Genre Re-enrichment',
    })
    with urllib.request.urlopen(req, timeout=90) as r:
        resp = json.loads(r.read())
    text = resp['choices'][0]['message']['content'].strip()
    return _parse_genres(text, n_tracks)

def classify_batch(tracks: list[dict]) -> dict[str, str]:
    lines = '\n'.join(f'{i+1}. "{t["title"]}" by {t["artist"]}' for i, t in enumerate(tracks))
    prompt = PROMPT_TMPL.format(genres=', '.join(GENRES), tracks=lines)
    for attempt in range(3 * len(FREE_MODELS)):
        model = _get_next_model()
        try:
            genres = _call_openrouter(model, prompt, len(tracks))
            if genres is not None:
                result = {}
                for t, g in zip(tracks, genres):
                    genre = g.lower().strip()
                    if genre not in GENRES:
                        genre = 'afropop'
                    result[t['youtube_id']] = genre
                return result
        except urllib.error.HTTPError as e:
            if e.code == 429:
                _backoff_model(model, 60 + attempt * 30)
            elif e.code in (502, 503, 504):
                time.sleep(5)
        except Exception:
            time.sleep(2)
    return {}

def main():
    load_env()
    if not SERVICE_KEY or not OPENROUTER_KEY:
        print('ERROR: Missing keys'); sys.exit(1)

    print('Fetching tracks with primary_genre=other...')
    tracks: list[dict] = []
    after_id = ''
    while True:
        page = sb_fetch_other_page(after_id)
        if not page:
            break
        tracks.extend(page)
        after_id = page[-1]['youtube_id']
        if len(page) < FETCH_PAGE:
            break
        print(f'  Fetched {len(tracks)} so far...', end='\r')

    total = len(tracks)
    print(f'  Found {total:,} "other" tracks to re-classify')
    if not total:
        print('Nothing to do.'); return

    reclassified = 0
    kept_other   = 0
    failed       = 0
    start = time.time()

    batches = [tracks[i:i+BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(classify_batch, b): b for b in batches}
        done = 0
        for fut in as_completed(futures):
            batch = futures[fut]
            done += len(batch)
            result = fut.result()
            for yt_id, new_genre in result.items():
                if new_genre != 'other':
                    if sb_patch_genre(yt_id, new_genre):
                        reclassified += 1
                else:
                    kept_other += 1
            failed += len(batch) - len(result)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            pct = done / total * 100
            print(f'  {pct:5.1f}% | reclassified={reclassified} | kept_other={kept_other} | failed={failed} | {rate:.1f}/s', end='\r')

    print(f'\n\n✅ Done:')
    print(f'   Reclassified: {reclassified:,} (were other, now have specific genre)')
    print(f'   Kept other:   {kept_other:,} (genuinely unclassifiable)')
    print(f'   Failed:       {failed:,}')

if __name__ == '__main__':
    main()
