#!/usr/bin/env python3
"""
enrich-genres-gemini.py
========================
Batch-classifies primary_genre on video_intelligence rows where it's NULL.
Uses OpenRouter free models in round-robin to stay within per-model rate limits.

65K rows → 328 batches at 200 tracks/batch → ~0 cost.
Rate strategy: 200 req/day per model × 2 models = 400 req/day → covers all 65K.

Usage:
    python3 scripts/enrich-genres-gemini.py
    python3 scripts/enrich-genres-gemini.py --dry-run
    python3 scripts/enrich-genres-gemini.py --limit 500
    python3 scripts/enrich-genres-gemini.py --backend openrouter-haiku  # paid fallback
"""

import json, os, sys, time, urllib.request, urllib.parse, urllib.error, re, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import cycle

# ─── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL   = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY    = ''
OPENROUTER_KEY = ''

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

# Team Force — free models first, paid fallback last
FREE_MODELS = [
    'inclusionai/ling-2.6-1t:free',  # 262K ctx, 1T, 2.3s/batch — fastest free
    'openai/gpt-oss-20b:free',        # 131K ctx, 20B, 14.8s/batch
    'openai/gpt-oss-120b:free',       # 131K ctx, 120B, 19.1s/batch — highest quality free
]
# Paid fallbacks — used only when all FREE_MODELS are in rate-limit backoff
PAID_FALLBACKS = [
    'anthropic/claude-haiku-4.5',    # ~$0.013/batch, best accuracy
]
OR_MODEL_HAIKU = 'anthropic/claude-haiku-4.5'

BATCH_SIZE  = 200   # tracks per LLM call
CONCURRENCY = 4     # threads — shared across models, ~2 per model
FETCH_PAGE  = 500
MAX_RETRIES = 3
BACKEND     = 'openrouter-free'   # 'openrouter-free' | 'openrouter-haiku'

# Canonical genre labels
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

# ─── Model round-robin ────────────────────────────────────────────────────────

_model_cycle = None
_cycle_lock  = threading.Lock()
# Per-model backoff state: {model: until_ts}
_model_backoff: dict[str, float] = {}

def _get_next_model() -> str:
    global _model_cycle
    with _cycle_lock:
        if _model_cycle is None:
            _model_cycle = cycle(FREE_MODELS)
        # Try free models first (skip those in backoff)
        for _ in range(len(FREE_MODELS) * 2):
            m = next(_model_cycle)
            if time.time() >= _model_backoff.get(m, 0):
                return m
        # All free models in backoff — use paid fallback if available
        for m in PAID_FALLBACKS:
            if time.time() >= _model_backoff.get(m, 0):
                return m
        # Everything in backoff — wait for the soonest free model to recover
        all_models = FREE_MODELS + PAID_FALLBACKS
        soonest = min(all_models, key=lambda m: _model_backoff.get(m, 0))
        wait = max(0, _model_backoff.get(soonest, 0) - time.time())
        if wait > 0:
            print(f'\n  [rate limit] waiting {wait:.0f}s for {soonest.split("/")[1][:20]}...', end='')
            time.sleep(wait + 1)
        return soonest

def _backoff_model(model: str, seconds: float = 60):
    _model_backoff[model] = time.time() + seconds

# ─── Env loading ─────────────────────────────────────────────────────────────

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

# ─── Supabase helpers ─────────────────────────────────────────────────────────

def sb_fetch_page(after_id: str = '') -> list[dict]:
    # Cursor-based pagination via youtube_id.gt — avoids Supabase offset ceiling (~66K rows)
    url = (f'{SUPABASE_URL}/rest/v1/video_intelligence'
           f'?select=youtube_id,title,artist'
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
    PATCH_BATCH = 30
    for genre, ids in genre_ids.items():
        for i in range(0, len(ids), PATCH_BATCH):
            chunk = ids[i:i+PATCH_BATCH]
            id_list = ','.join(chunk)
            url = f'{SUPABASE_URL}/rest/v1/video_intelligence?youtube_id=in.({id_list})&primary_genre=is.null'
            req = urllib.request.Request(url,
                data=json.dumps({'primary_genre': genre}).encode(),
                headers={
                    'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
                    'Content-Type': 'application/json', 'Prefer': 'return=minimal',
                }, method='PATCH')
            try:
                with urllib.request.urlopen(req, timeout=15):
                    written += len(chunk)
            except Exception:
                pass
    return written

# ─── Parse LLM response ───────────────────────────────────────────────────────

def _parse_genres(text: str, expected: int) -> list[str] | None:
    m = re.search(r'\[.*?\]', text, re.DOTALL)
    if not m: return None
    try:
        genres = json.loads(m.group())
    except Exception:
        return None
    # Accept if count matches or if model returned extra (thinking models pad)
    if len(genres) >= expected:
        return genres[:expected]
    # Accept close misses (within 5%) — model may have skipped a few
    if len(genres) >= expected * 0.95:
        return genres
    return None

def _build_result(tracks: list[dict], genres: list[str]) -> dict[str, str]:
    result = {}
    for t, g in zip(tracks, genres):
        genre = g.lower().strip()
        if genre not in GENRES:
            genre = 'afropop'
        result[t['youtube_id']] = genre
    return result

# ─── OpenRouter call ─────────────────────────────────────────────────────────

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
        'X-Title': 'VOYO Genre Enrichment',
    })
    with urllib.request.urlopen(req, timeout=90) as r:
        resp = json.loads(r.read())
    text = resp['choices'][0]['message']['content'].strip()
    return _parse_genres(text, n_tracks)

# ─── Classify batch ───────────────────────────────────────────────────────────

def classify_batch(tracks: list[dict]) -> dict[str, str]:
    lines = '\n'.join(f'{i+1}. "{t["title"]}" by {t["artist"]}' for i, t in enumerate(tracks))
    prompt = PROMPT_TMPL.format(genres=', '.join(GENRES), tracks=lines)

    if BACKEND == 'openrouter-haiku':
        models_to_try = [OR_MODEL_HAIKU]
        use_rotation  = False
    else:
        models_to_try = FREE_MODELS
        use_rotation  = True

    for attempt in range(MAX_RETRIES * len(models_to_try)):
        model = _get_next_model() if use_rotation else models_to_try[0]
        try:
            genres = _call_openrouter(model, prompt, len(tracks))
            if genres is not None:
                return _build_result(tracks, genres)
            # Parse failed — try next model
        except urllib.error.HTTPError as e:
            if e.code == 429:
                _backoff_model(model, 60 + attempt * 30)
            elif e.code in (502, 503, 504):
                time.sleep(5)
            else:
                body = e.read().decode('utf-8', errors='replace')[:150]
                print(f'\n  [{model.split("/")[1][:20]}] HTTP {e.code}: {body}', end='')
                if not use_rotation: break
        except Exception:
            time.sleep(2)
    return {}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global SERVICE_KEY, OPENROUTER_KEY, BACKEND, BATCH_SIZE, CONCURRENCY
    load_env()

    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == '--backend' and i < len(sys.argv) - 1:
            BACKEND = sys.argv[i + 1]
        if arg == '--batch' and i < len(sys.argv) - 1:
            BATCH_SIZE = int(sys.argv[i + 1])
        if arg == '--concurrency' and i < len(sys.argv) - 1:
            CONCURRENCY = int(sys.argv[i + 1])

    dry_run = '--dry-run' in sys.argv
    limit   = int(next((sys.argv[sys.argv.index('--limit')+1] for _ in ['x'] if '--limit' in sys.argv), 0) or 0)

    if not SERVICE_KEY:
        print('ERROR: missing SUPABASE_SERVICE_KEY'); sys.exit(1)
    if not OPENROUTER_KEY:
        print('ERROR: missing OPENROUTER_API_KEY'); sys.exit(1)

    model_label = BACKEND
    if BACKEND == 'openrouter-free':
        model_label = f'round-robin: {", ".join(m.split("/")[1].split(":")[0] for m in FREE_MODELS)}'
    elif BACKEND == 'openrouter-haiku':
        model_label = OR_MODEL_HAIKU

    print(f'Backend: {model_label}')
    print(f'batch={BATCH_SIZE} | concurrency={CONCURRENCY}')

    print('Fetching untagged rows from video_intelligence...')
    all_rows: list[dict] = []
    last_id = ''
    while True:
        batch = sb_fetch_page(last_id)
        if not batch: break
        all_rows.extend(batch)
        last_id = batch[-1]['youtube_id']
        print(f'  {len(all_rows):,} fetched...', end='\r')
        if len(batch) < FETCH_PAGE: break
        if limit and len(all_rows) >= limit: break

    if limit: all_rows = all_rows[:limit]
    total = len(all_rows)
    print(f'\n  {total:,} rows need genre tagging')
    if total == 0:
        print('✅ All rows already have primary_genre.'); return

    batches = [all_rows[i:i+BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    est_days = len(batches) / (len(FREE_MODELS) * 200) if BACKEND == 'openrouter-free' else 0
    print(f'  {len(batches)} batches × up to {BATCH_SIZE} tracks')
    if BACKEND == 'openrouter-free' and est_days < 1:
        print(f'  Est: {len(batches) * BATCH_SIZE / 60:.0f} min at ~{CONCURRENCY * 3} req/min effective')

    if dry_run:
        print('\n[DRY RUN] First 2 batches:')
        for b in batches[:2]:
            res = classify_batch(b)
            if not res:
                print('  (batch returned empty — check model / key)')
            for yt_id, g in list(res.items())[:8]:
                t = next(x for x in b if x['youtube_id'] == yt_id)
                print(f'  {g:<15} "{t["title"]}" — {t["artist"]}')
            if len(res) > 8:
                print(f'  ... ({len(res)} total)')
        print('\n[DRY RUN] No writes performed.')
        return

    classified = 0
    failed     = 0
    written    = 0
    t0         = time.time()
    pending: dict[str, str] = {}

    def flush_pending():
        nonlocal written, pending
        if pending:
            written += sb_patch_genres(pending)
            pending = {}

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(classify_batch, b): b for b in batches}
        for fut in as_completed(futures):
            result = fut.result()
            if result:
                classified += len(result)
                pending.update(result)
                if len(pending) >= 1000:
                    flush_pending()
            else:
                failed += len(futures[fut])
            pct  = (classified + failed) / total * 100
            rate = classified / (time.time() - t0 + 0.001)
            eta  = (total - classified - failed) / rate if rate > 0 else 0
            print(f'  {pct:5.1f}% | {classified:,} classified | {failed} failed | {rate:.0f}/s | ETA {eta/60:.0f}m', end='\r')

    flush_pending()
    elapsed = time.time() - t0
    print(f'\n\n✅ Done in {elapsed/60:.1f}min')
    print(f'   Classified: {classified:,} | Written to DB: {written:,} | Failed: {failed}')
    if failed:
        print(f'   Re-run to retry {failed} unclassified tracks.')

if __name__ == '__main__':
    main()
