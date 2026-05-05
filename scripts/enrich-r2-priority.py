#!/usr/bin/env python3
"""
enrich-r2-priority.py
======================
Targeted enrichment for r2_cached tracks with no genre (or genre='other').
Prioritizes the instantly-playable catalog so vibeEngine genre filters
return real tracks rather than empty sets.

Run AFTER the main enrich-genres-gemini.py completes:
    python3 scripts/enrich-r2-priority.py

Or run independently to keep r2 catalog fully enriched:
    python3 scripts/enrich-r2-priority.py --also-other  # re-enrich 'other' labeled too
"""

import json, os, sys, time, urllib.request, urllib.parse, urllib.error, re, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import cycle

SUPABASE_URL   = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY    = ''
OPENROUTER_KEY = ''

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

FREE_MODELS = [
    'inclusionai/ling-2.6-1t:free',
    'openai/gpt-oss-20b:free',
    'openai/gpt-oss-120b:free',
]
PAID_FALLBACKS = [
    'anthropic/claude-haiku-4.5',
]

BATCH_SIZE  = 100
CONCURRENCY = 3
FETCH_PAGE  = 500
MAX_RETRIES = 3

GENRES = [
    'afrobeats', 'amapiano', 'hiphop', 'rnb', 'afropop', 'gospel',
    'highlife', 'hiplife', 'rumba', 'kizomba', 'zouk', 'afrohouse', 'gqom',
    'bongo-flava', 'dancehall', 'reggae', 'soca', 'reggaeton', 'mbalax', 'bikutsi',
    'soukous', 'ndombolo', 'makossa', 'gengetone', 'kwaito', 'afrobeat',
    'afrofusion', 'afrofolk', 'fuji', 'juju', 'palmwine',
    'kuduro', 'semba', 'tarraxo', 'benga', 'taarab',
    'rai', 'chaabi', 'gnawa', 'afrosoul',
    'lekompo', 'singeli',
    'trap', 'drill', 'grime', 'soul',
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
- Jamaican roots/rocksteady/ska/dub/lovers rock = reggae
- Jamaican dancehall (modern, digital) = dancehall
- Caribbean party = soca; Latin Caribbean = reggaeton
- West African acoustic/folk = afrofolk; older palm wine guitar = palmwine
- Yoruba folk/spiritual = fuji; Yoruba juju music = juju
- Angolan kuduro (fast electronic) = kuduro; kizomba-adjacent = semba; ultra-slow = tarraxo
- Kenyan/Tanzanian benga guitar = benga; East African Arabic-influenced = taarab
- Algerian/North African folk-pop = rai or chaabi; Gnawa spiritual = gnawa
- Smooth Afro R&B crossover = afrosoul
- SA Limpopo folk-electronic = lekompo; Tanzanian hyper-speed urban = singeli
- Gospel rap = gospel
- American/UK trap or drill = trap or drill
- Non-African/Caribbean/diasporic = soul, funk, pop, rock, classical, jazz, electronic
- If unsure = afropop
- "other" only for tracks genuinely fitting NONE of the 53 specific genres

Return ONLY a JSON array of strings, same order as input, no explanation:
["genre1","genre2",...]

Tracks:
{tracks}"""

# ─── Model round-robin ─────────────────────────────────────────────────────────

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
        for m in PAID_FALLBACKS:
            if time.time() >= _model_backoff.get(m, 0):
                return m
        all_models = FREE_MODELS + PAID_FALLBACKS
        soonest = min(all_models, key=lambda m: _model_backoff.get(m, 0))
        wait = _model_backoff.get(soonest, 0) - time.time()
        if wait > 0:
            time.sleep(wait + 0.5)
        return soonest

def _mark_backoff(model: str, seconds: int = 60) -> None:
    with _cycle_lock:
        _model_backoff[model] = time.time() + seconds

# ─── Supabase helpers ──────────────────────────────────────────────────────────

def _load_keys():
    global SERVICE_KEY, OPENROUTER_KEY
    SERVICE_KEY    = SERVICE_KEY    or os.environ.get('SUPABASE_SERVICE_KEY', '')
    OPENROUTER_KEY = OPENROUTER_KEY or os.environ.get('OPENROUTER_API_KEY', '')
    if not SERVICE_KEY:
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
        try:
            with open(env_path) as f:
                for line in f:
                    if line.startswith('SUPABASE_SERVICE_KEY='):
                        SERVICE_KEY = line.split('=', 1)[1].strip()
                    elif line.startswith('OPENROUTER_API_KEY='):
                        OPENROUTER_KEY = line.split('=', 1)[1].strip()
        except FileNotFoundError:
            pass

def sb_fetch_r2_untagged(after_id: str = '', also_other: bool = False) -> list[dict]:
    """Fetch r2_cached tracks with no genre (or 'other' genre if also_other)."""
    if also_other:
        # Two separate queries: null + 'other'
        # PostgREST doesn't support OR across different columns easily, fetch both
        url_null = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
                    f'?select=youtube_id,title,artist'
                    f'&r2_cached=eq.true'
                    f'&primary_genre=is.null'
                    f'&title=not.is.null'
                    f'&order=youtube_id.asc'
                    f'&limit={FETCH_PAGE}')
        url_other = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
                     f'?select=youtube_id,title,artist'
                     f'&r2_cached=eq.true'
                     f'&primary_genre=eq.other'
                     f'&title=not.is.null'
                     f'&order=youtube_id.asc'
                     f'&limit={FETCH_PAGE}')
        if after_id:
            url_null  += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
            url_other += f'&youtube_id=gt.{urllib.parse.quote(after_id)}'
        rows = []
        for url in (url_null, url_other):
            req = urllib.request.Request(url, headers={
                'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
            })
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    rows.extend(json.loads(r.read()) or [])
            except Exception:
                pass
        # Dedup by youtube_id
        seen = set()
        deduped = []
        for row in rows:
            if row['youtube_id'] not in seen:
                seen.add(row['youtube_id'])
                deduped.append(row)
        return sorted(deduped, key=lambda x: x['youtube_id'])
    else:
        url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
               f'?select=youtube_id,title,artist'
               f'&r2_cached=eq.true'
               f'&primary_genre=is.null'
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

def sb_patch_genres(id_genre: dict[str, str]) -> int:
    from collections import defaultdict
    genre_ids: dict[str, list] = defaultdict(list)
    for yt_id, genre in id_genre.items():
        genre_ids[genre].append(yt_id)
    written = 0
    for genre, ids in genre_ids.items():
        chunk_size = 50
        for i in range(0, len(ids), chunk_size):
            chunk = ids[i:i+chunk_size]
            id_list = ','.join(urllib.parse.quote(id) for id in chunk)
            url  = f'{SUPABASE_URL}/rest/v1/video_intelligence?youtube_id=in.({id_list})'
            body = json.dumps({'primary_genre': genre}).encode()
            req  = urllib.request.Request(url, data=body, method='PATCH', headers={
                'apikey':        SERVICE_KEY,
                'Authorization': f'Bearer {SERVICE_KEY}',
                'Content-Type':  'application/json',
                'Prefer':        'return=minimal',
            })
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    written += len(chunk)
            except Exception as e:
                print(f'  [patch] Error: {e}', flush=True)
    return written

# ─── LLM classifier ───────────────────────────────────────────────────────────

def classify_batch(rows: list[dict]) -> dict[str, str]:
    tracks_text = '\n'.join(f'{i+1}. "{r["title"]}" - {r.get("artist") or "Unknown"}' for i, r in enumerate(rows))
    prompt = PROMPT_TMPL.format(genres=', '.join(GENRES), tracks=tracks_text)
    for attempt in range(MAX_RETRIES):
        model = _get_next_model()
        payload = json.dumps({
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.1,
            'max_tokens': len(rows) * 12 + 50,
        }).encode()
        req = urllib.request.Request(OPENROUTER_URL, data=payload, method='POST', headers={
            'Authorization': f'Bearer {OPENROUTER_KEY}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://voyomusic.com',
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read())
            content = data['choices'][0]['message']['content'].strip()
            # Extract JSON array
            m = re.search(r'\[.*\]', content, re.DOTALL)
            if not m:
                raise ValueError(f'No JSON array in response: {content[:200]}')
            genres_list = json.loads(m.group())
            if len(genres_list) != len(rows):
                raise ValueError(f'Length mismatch: got {len(genres_list)}, expected {len(rows)}')
            valid = set(GENRES)
            result = {}
            for row, g in zip(rows, genres_list):
                g = g.strip().lower()
                result[row['youtube_id']] = g if g in valid else 'other'
            return result
        except urllib.error.HTTPError as e:
            status = e.code
            if status == 429:
                _mark_backoff(model, 90)
            elif status in (500, 502, 503):
                time.sleep(5 * (attempt + 1))
            else:
                time.sleep(3)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(5)
    return {r['youtube_id']: 'other' for r in rows}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    also_other = '--also-other' in sys.argv
    _load_keys()
    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY not found', flush=True)
        sys.exit(1)
    if not OPENROUTER_KEY:
        print('ERROR: OPENROUTER_API_KEY not found', flush=True)
        sys.exit(1)

    mode = 'null + other' if also_other else 'null only'
    print(f'[enrich-r2-priority] Mode: {mode}', flush=True)
    print(f'  Batch: {BATCH_SIZE} | Concurrency: {CONCURRENCY}', flush=True)

    # Load all r2 untagged rows
    print('Fetching r2_cached untagged rows...', flush=True)
    all_rows: list[dict] = []
    last_id = ''
    while True:
        page = sb_fetch_r2_untagged(last_id, also_other=also_other)
        if not page:
            break
        all_rows.extend(page)
        last_id = page[-1]['youtube_id']
        print(f'  {len(all_rows):,} fetched...', end='\r', flush=True)
    print(f'  {len(all_rows):,} r2_cached tracks to process.', flush=True)

    if not all_rows:
        print('Nothing to enrich — r2_cached catalog is fully tagged!', flush=True)
        return

    total = len(all_rows)
    classified = 0
    failed = 0
    start_t = time.time()
    lock = threading.Lock()

    def process_batch(batch: list[dict]) -> int:
        nonlocal classified, failed
        result = classify_batch(batch)
        written = sb_patch_genres(result)
        with lock:
            classified += written
            failed += len(batch) - written
        return written

    batches = [all_rows[i:i+BATCH_SIZE] for i in range(0, len(all_rows), BATCH_SIZE)]
    print(f'Processing {len(batches)} batches...', flush=True)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = {ex.submit(process_batch, b): b for b in batches}
        for fut in as_completed(futs):
            elapsed = time.time() - start_t
            rate = classified / elapsed if elapsed > 0 else 0
            pct = (classified + failed) / total * 100 if total else 0
            eta_m = ((total - classified - failed) / rate / 60) if rate > 0 else 0
            print(
                f'  {pct:4.1f}% | {classified:,} classified | {failed} failed'
                f' | {rate:.1f}/s | ETA {eta_m:.0f}m',
                end='\r', flush=True
            )

    elapsed = time.time() - start_t
    print(f'\n\nDone. {classified:,}/{total:,} classified in {elapsed/60:.1f}m', flush=True)
    print(f'Run populate-vibe-scores.py next to update vibe columns.', flush=True)

if __name__ == '__main__':
    main()
