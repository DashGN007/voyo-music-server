#!/usr/bin/env python3
"""
seed_creators.py — LLM-bootstrap creator proposals for a lane.
================================================================
Asks Claude (via OpenRouter) to produce ~150 creator proposals for a
given bucket (e.g. genre/kizomba), then writes them to
voyo_creator_proposals with status='pending' for the cockpit panel.

Why this script:
  We want 1,000 creators × 10 reels = 10,000 curated moments. Hand-
  picking 1,000 handles is friction Dash doesn't have time for.
  Claude knows the cultural landscape; Dash batch-approves the 0.85+
  tier and spot-checks the rest.

Usage:
    python3 seed_creators.py --lane genre/kizomba --count 150
    python3 seed_creators.py --lane travel/angola --count 80
    python3 seed_creators.py --lane genre/kizomba --dry-run

Idempotency:
    UNIQUE(lane, handle, platform) on the table. Re-running a lane
    silently skips creators we've already proposed (server-side via
    Prefer: resolution=ignore-duplicates).
"""

import argparse, json, os, sys, time
import urllib.request, urllib.error

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
CACHE_DIR    = '/tmp/voyo-curator-cache'

# Two providers — fall through Gemini → OpenAI on quota/error.
# Keeps a local cache so a successful parse can be replayed for the
# DB insert without re-calling any LLM.
GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
OPENAI_URL     = 'https://api.openai.com/v1/chat/completions'
OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

GEMINI_MODELS     = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro']
OPENAI_MODELS     = ['gpt-4o-mini', 'gpt-4o']
OPENROUTER_MODELS = ['openai/gpt-oss-120b:free', 'openai/gpt-oss-20b:free']

# ── Env loaders ────────────────────────────────────────────────────────

def load_env(path: str) -> dict[str, str]:
    out = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            out[k] = v.strip().strip('"').strip("'")
    return out

ENV = {
    **load_env('/home/dash/voyo-music/.env'),
    **load_env('/home/dash/voyo-music-server/.env'),
}

def env(*keys: str) -> str | None:
    for src in (os.environ, ENV):
        for k in keys:
            if src.get(k): return src[k]
    return None

GEMINI_KEY     = env('GEMINI_API_KEY', 'VITE_GEMINI_API_KEY')
OPENAI_KEY     = env('OPENAI_API_KEY', 'VITE_OPENAI_API_KEY')
OPENROUTER_KEY = env('OPENROUTER_API_KEY')
SERVICE_KEY    = env('SUPABASE_SERVICE_KEY')

if not SERVICE_KEY:
    print('ERROR: SUPABASE_SERVICE_KEY missing', file=sys.stderr)
    sys.exit(2)
if not GEMINI_KEY and not OPENAI_KEY:
    print('ERROR: need at least one of GEMINI_API_KEY or OPENAI_API_KEY', file=sys.stderr)
    sys.exit(2)
os.makedirs(CACHE_DIR, exist_ok=True)

# ── Lane briefs ────────────────────────────────────────────────────────

LANE_BRIEFS: dict[str, str] = {
    'genre/kizomba': """
KIZOMBA — Angolan-rooted sensual partner-dance music + culture. Includes:
  • Singers/producers from Angola, Cape Verde, São Tomé, Guinea-Bissau,
    Mozambique, and the Lusophone diaspora (Portugal, Brazil, France).
  • Dance creators (instructors, performers, social-dance scenes) posting
    Kizomba/Semba/Ghetto-Zouk choreography.
  • DJs and producers in urban-kizomba / kizomba-lite.
  • Adjacent: Tarraxinha, Zouk Love (anglo/franco), Afro-house when the
    creator clearly bridges to kizomba.

EXCLUDE: pure salsa/bachata, generic afrobeats, inactive (>12mo) accounts.

Strong picks (you should know): Anaís, Badoxa, Yuri da Cunha, Pérola,
Matias Damásio, Eddy Tussa, Kyaku Kyadaff, C4 Pedro, Heavy C, Calema,
Jay Oliver, Yola Araújo, Soraia Ramos. Dance: Albir Rojas, Sara López,
Iris Carvalho.
""",
    'travel/angola': """
ANGOLA — feed should feel like Luanda. Music (kizomba/kuduro/afro-house),
lifestyle, fashion, food, and street-culture creators with clear Angolan
context. Comedy/storytelling in Portuguese with Angolan references.
EXCLUDE generic Lusophone-Brazil content, generic afrobeats not tied to
the Angolan scene.
""",
}

DEFAULT_BRIEF = """
Propose creators unambiguously connected to this lane's culture, language,
and aesthetic. Prefer creators with 5K+ followers, posting in the last 6
months. Surface long-tail creators alongside the obvious hits.
"""

# ── Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You curate a music+culture social-video catalog. You propose creators for a specific lane.

Output ONLY a JSON array. No prose, no markdown fences. Each item must be:
{
  "handle":     "no-leading-at (Instagram username, TikTok username, or YouTube channel handle without the @)",
  "platform":   "instagram" or "tiktok" or "youtube",
  "region":     "iso-2 country code or geographic shorthand",
  "language":   "iso-639-1 (pt, en, fr, ar, sw, ...)",
  "confidence": 0.50..1.00 numeric,
  "rationale":  "<= 14-word reason this fits the lane"
}

Rules:
- Only REAL accounts you are confident exist with their CORRECT handle. Many
  artists' "obvious" guesses (badoxa_oficial, matiasdamasio_oficial) are
  squatters. If you don't know the EXACT handle, lower confidence below 0.5
  or omit the entry entirely. Better to return fewer high-confidence
  proposals than many wrong ones.
- For YouTube, use the official channel handle (the part after @ on
  youtube.com/@HANDLE). Music artists usually have an "Official Topic"
  channel auto-generated by YouTube — those are fine too.
- Distribute across platforms by lane fit:
  • Music genres → 60% YouTube (artists' channels) + 30% Instagram + 10% TikTok
  • Travel/culture → 50% Instagram + 30% TikTok + 20% YouTube
  • Comedy/dance → 40% TikTok + 40% Instagram + 20% YouTube
- Prefer breadth: surface lesser-known creators alongside obvious hits.
- No duplicate (handle + platform) within your response.
- Return at most COUNT items.
"""

def _call_gemini(model: str, system: str, user: str) -> str:
    url = GEMINI_URL.format(model=model) + f'?key={GEMINI_KEY}'
    body = json.dumps({
        'contents': [{'role': 'user', 'parts': [{'text': user}]}],
        'systemInstruction': {'parts': [{'text': system}]},
        'generationConfig': {
            'temperature': 0.3,
            'maxOutputTokens': 32000,
            'thinkingConfig': {'thinkingBudget': 0},
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'ARRAY',
                'items': {
                    'type': 'OBJECT',
                    'properties': {
                        'handle':     {'type': 'STRING'},
                        'platform':   {'type': 'STRING', 'enum': ['instagram', 'tiktok', 'youtube']},
                        'region':     {'type': 'STRING'},
                        'language':   {'type': 'STRING'},
                        'confidence': {'type': 'NUMBER'},
                        'rationale':  {'type': 'STRING'},
                    },
                    'required': ['handle', 'platform', 'confidence'],
                },
            },
        },
    }).encode()
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read())
    cands = resp.get('candidates', [])
    if not cands:
        raise ValueError(f'no candidates: {json.dumps(resp)[:300]}')
    text = ''.join(p.get('text', '') for p in cands[0].get('content', {}).get('parts', []))
    usage = resp.get('usageMetadata', {})
    print(f'  [gemini/{model}] used {usage.get("totalTokenCount","?")} tokens', flush=True)
    return text

def _call_openai(model: str, system: str, user: str) -> str:
    body = json.dumps({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': user + '\n\nReturn an ARRAY of objects (not a single object).'},
        ],
        'temperature': 0.3,
        'max_tokens': 16000,
        'response_format': {'type': 'json_object'},
    }).encode()
    req = urllib.request.Request(OPENAI_URL, data=body, headers={
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {OPENAI_KEY}',
    })
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read())
    text = resp['choices'][0]['message']['content']
    usage = resp.get('usage', {})
    print(f'  [openai/{model}] used {usage.get("total_tokens","?")} tokens', flush=True)
    return text

def _call_openrouter(model: str, system: str, user: str) -> str:
    body = json.dumps({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            # Free models often default to single-object output. Force array
            # via explicit phrasing + show the expected wrapper shape.
            {'role': 'user',   'content': user + '\n\nReturn ONLY a JSON array of objects: [{...}, {...}, ...]. Not a single object. Not wrapped in {"proposals":[...]}.'},
        ],
        'temperature': 0.3,
        'max_tokens': 16000,
    }).encode()
    req = urllib.request.Request(OPENROUTER_URL, data=body, headers={
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {OPENROUTER_KEY}',
        'HTTP-Referer':  'https://voyomusic.com',
        'X-Title':       'VOYO Curator Seed',
    })
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read())
    text = resp['choices'][0]['message']['content']
    usage = resp.get('usage', {})
    print(f'  [openrouter/{model}] used {usage.get("total_tokens","?")} tokens', flush=True)
    return text

def call_llm(system: str, user: str) -> tuple[str, str]:
    """Returns (response_text, model_used). Tries Gemini → OpenAI."""
    last_err = None
    if GEMINI_KEY:
        for model in GEMINI_MODELS:
            try:
                return _call_gemini(model, system, user), f'gemini/{model}'
            except urllib.error.HTTPError as e:
                err = e.read()[:200].decode('utf-8', 'ignore')
                last_err = f'gemini/{model}: HTTP {e.code} {err}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
            except Exception as e:
                last_err = f'gemini/{model}: {e}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
    if OPENAI_KEY:
        for model in OPENAI_MODELS:
            try:
                return _call_openai(model, system, user), f'openai/{model}'
            except urllib.error.HTTPError as e:
                err = e.read()[:200].decode('utf-8', 'ignore')
                last_err = f'openai/{model}: HTTP {e.code} {err}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
            except Exception as e:
                last_err = f'openai/{model}: {e}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
    if OPENROUTER_KEY:
        for model in OPENROUTER_MODELS:
            try:
                return _call_openrouter(model, system, user), f'openrouter/{model}'
            except urllib.error.HTTPError as e:
                err = e.read()[:200].decode('utf-8', 'ignore')
                last_err = f'openrouter/{model}: HTTP {e.code} {err}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
            except Exception as e:
                last_err = f'openrouter/{model}: {e}'
                print(f'  [warn] {last_err}', file=sys.stderr)
                time.sleep(1)
    print(f'ERROR: all providers failed. Last: {last_err}', file=sys.stderr)
    sys.exit(1)

def parse_proposals(text: str) -> list[dict]:
    text = text.strip()
    if text.startswith('```'):
        text = text.split('```', 2)[1]
        if text.lstrip().startswith('json'):
            text = text.split('\n', 1)[1] if '\n' in text else text[4:]
        text = text.rsplit('```', 1)[0].strip()
    # Try strict parse first
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Salvage: extract {...} objects in order, skip the truncated tail
        data = _salvage_objects(text)
    if isinstance(data, dict):
        for k in ('proposals', 'creators', 'data', 'results'):
            if k in data and isinstance(data[k], list):
                data = data[k]; break
        else:
            raise ValueError(f'response is dict, no list found in keys {list(data.keys())[:5]}')
    if not isinstance(data, list):
        raise ValueError(f'expected list, got {type(data)}')
    return data

def _salvage_objects(text: str) -> list[dict]:
    """Walk the text, extract every well-formed {...} object. Used when
    the model truncated mid-array — we still get the complete head."""
    out: list[dict] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == '{':
            depth, in_str, esc, j = 1, False, False, i + 1
            while j < n and depth > 0:
                ch = text[j]
                if in_str:
                    if esc: esc = False
                    elif ch == '\\': esc = True
                    elif ch == '"': in_str = False
                else:
                    if ch == '"': in_str = True
                    elif ch == '{': depth += 1
                    elif ch == '}': depth -= 1
                j += 1
            if depth == 0:
                try:
                    out.append(json.loads(text[i:j]))
                except json.JSONDecodeError:
                    pass
                i = j
                continue
            else:
                # truncated tail — stop here
                break
        i += 1
    return out

# ── DB write ───────────────────────────────────────────────────────────

def insert_proposals(rows: list[dict], lane: str, model_used: str, dry: bool) -> int:
    payload = []
    for r in rows:
        handle = (r.get('handle') or '').strip().lstrip('@').lower()
        platform = (r.get('platform') or '').strip().lower()
        if not handle or platform not in ('instagram', 'tiktok', 'youtube'):
            continue
        try:
            conf = float(r.get('confidence', 0.5))
        except Exception:
            conf = 0.5
        conf = max(0.0, min(1.0, conf))
        payload.append({
            'lane':        lane,
            'handle':      handle,
            'platform':    platform,
            'region':      ((r.get('region') or '').strip()[:32] or None),
            'language':    ((r.get('language') or '').strip()[:8] or None),
            'confidence':  round(conf, 2),
            'rationale':   ((r.get('rationale') or '').strip()[:280] or None),
            'status':      'pending',
            'proposed_by': model_used,
        })
    if not payload: return 0
    if dry:
        print(f'\n--- DRY-RUN sample (top 10 by confidence) ---')
        for p in sorted(payload, key=lambda x: -x['confidence'])[:10]:
            print(f"  {p['platform']:9} {p['handle']:25} conf={p['confidence']:.2f} {p['region'] or '?':4}/{p['language'] or '?':2} — {p['rationale']}")
        print(f'\n  total payload: {len(payload)} (dry — nothing written)')
        return 0
    # on_conflict tells PostgREST which UNIQUE to merge against
    url = f'{SUPABASE_URL}/rest/v1/voyo_creator_proposals?on_conflict=lane,handle,platform'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            'apikey':        SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type':  'application/json',
            # merge-duplicates lets us upsert: re-running a lane bumps stale
            # rejected/pending rows back to current confidence + rationale.
            'Prefer':        'return=minimal,resolution=merge-duplicates',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return len(payload)
    except urllib.error.HTTPError as e:
        body = e.read()[:500].decode('utf-8', 'ignore')
        print(f'INSERT failed: HTTP {e.code} — {body}', file=sys.stderr)
        return 0

# ── Main ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lane',  required=True, help='e.g. genre/kizomba')
    p.add_argument('--count', type=int, default=150)
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--replay', action='store_true', help='reuse cached LLM output instead of calling the API')
    args = p.parse_args()

    cache_path = os.path.join(CACHE_DIR, args.lane.replace('/', '_') + '.json')

    if args.replay and os.path.exists(cache_path):
        cached = json.load(open(cache_path))
        rows = cached['rows']
        model_used = cached.get('model', 'cached')
        print(f'Replaying {len(rows)} cached proposals from {cache_path} (model={model_used})', flush=True)
    else:
        brief = LANE_BRIEFS.get(args.lane, DEFAULT_BRIEF)
        user = f'LANE: {args.lane}\nCOUNT: {args.count}\n\nLANE BRIEF:\n{brief}\n\nReturn the JSON array now.'
        print(f'Asking LLM for {args.count} creators on lane="{args.lane}"…', flush=True)
        text, model_used = call_llm(SYSTEM_PROMPT, user)
        try:
            rows = parse_proposals(text)
        except Exception as e:
            print(f'ERROR parsing LLM output: {e}', file=sys.stderr)
            print(f'--- first 500 chars of response ---\n{text[:500]}', file=sys.stderr)
            sys.exit(1)
        print(f'  parsed {len(rows)} proposals', flush=True)
        # Cache parsed rows so a subsequent --replay skips the LLM call.
        with open(cache_path, 'w') as f:
            json.dump({'lane': args.lane, 'model': model_used, 'rows': rows}, f, indent=2)
        print(f'  cached to {cache_path}', flush=True)

    sent = insert_proposals(rows, args.lane, model_used, args.dry_run)
    if not args.dry_run:
        print(f'\nPOSTed {sent} proposals to voyo_creator_proposals.')
        print(f'Next: open the cockpit Curator panel, batch-approve confidence ≥ 0.85, spot-check the rest.')

if __name__ == '__main__':
    main()
