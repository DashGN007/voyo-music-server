#!/usr/bin/env python3
"""
discover_creators.py — research-grade creator catalog builder
=============================================================
Calls a web-grounded LLM (Perplexity sonar-deep-research via
OpenRouter, falls back to Kimi K2 Thinking) to research a lane and
return a catalog of REAL artists with VERIFIED handles across
platforms.

Why this exists:
  Earlier seed_creators.py asked Gemini for handles from training
  memory. ~80% of proposals were squatter/wrong handles because no
  LLM reliably knows the EXACT @username for a given artist without
  web access. The result: ingest spent most of its time failing on
  hallucinated handles.

  This script uses ONLY web-grounded research. The LLM is told to
  search the open web for each artist's verified accounts and return
  the canonical handle plus the source URL it found it on. We then
  hand the catalog to verify_handles.py for a programmatic existence
  check before ingest ever runs.

Output:
  catalogs/{lane}.json — durable, human-readable catalog you can
  hand-edit before verification + ingest.

Usage:
    python3 discover_creators.py --lane genre/kizomba --count 60
    python3 discover_creators.py --lane travel/angola --count 40
    python3 discover_creators.py --lane genre/kizomba --dry-run
"""

import argparse, json, os, sys, time
import urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
ROOT        = Path('/home/dash/voyo-music-server')
CATALOG_DIR = ROOT / 'catalogs'

# Research providers, in fallback order.
# Gemini 2.5 Pro/Flash WITH Google Search grounding does live web
# research and returns grounding metadata (real source URLs). Free
# tier covers our scale. Falls back to OpenRouter Perplexity if you
# top up credits later — same architecture, different upstream.
GEMINI_MODELS     = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
OPENROUTER_MODELS = [
    'perplexity/sonar-deep-research',
    'perplexity/sonar-pro',
    'moonshotai/kimi-k2-thinking',
]

def load_env(path: str) -> dict[str, str]:
    out = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            out[k] = v.strip().strip('"').strip("'")
    return out

ENV = {**load_env('/home/dash/voyo-music/.env'), **load_env(str(ROOT / '.env'))}
def env(*k):
    for src in (os.environ, ENV):
        for kk in k:
            if src.get(kk): return src[kk]
    return None

OPENROUTER_KEY = env('OPENROUTER_API_KEY')
GEMINI_KEY     = env('GEMINI_API_KEY', 'VITE_GEMINI_API_KEY')
if not GEMINI_KEY and not OPENROUTER_KEY:
    print('ERROR: need at least GEMINI_API_KEY or OPENROUTER_API_KEY', file=sys.stderr); sys.exit(2)

# ── Lane briefs ──────────────────────────────────────────────────────

LANE_BRIEFS: dict[str, str] = {
    'genre/kizomba': """
KIZOMBA — Angolan-rooted sensual partner-dance music. Artists span:
  • Original Angolan singers/producers (Semba/Kizomba bridge)
  • Cape Verdean, São Toméan, Mozambican, Guinea-Bissau artists
  • Lusophone diaspora (Portugal, France, Brazil, Netherlands)
  • Kizomba dance instructors and social-dance scene leaders
  • DJs/producers in urban-kizomba / kizomba-lite
  • Adjacent: Tarraxinha producers, Zouk Love singers
""",
    'travel/angola': """
ANGOLA — should feel like Luanda. Music (kizomba/kuduro/afro-house),
lifestyle, fashion, food, street culture, comedy in Portuguese with
Angolan references. Both Luanda-based and Angolan diaspora.
""",
    'genre/afrobeats': """
AFROBEATS — Nigerian/Ghanaian-led contemporary African pop. Includes:
  • Major label artists (Wizkid/Davido/Burna Boy tier)
  • Mid-tier rising artists (street/alté/hood-pop)
  • Producers, DJs, dance choreographers tied to the scene
""",
    'genre/amapiano': """
AMAPIANO — South African house genre. Includes:
  • Originator producers (DJ Maphorisa, Kabza De Small, etc)
  • Vocalists and feature artists
  • DBN Gogo / Uncle Waffles tier dance-DJ crossover
  • Adjacent: gqom artists who bridge into amapiano
""",
}
DEFAULT_BRIEF = "Propose creators unambiguously connected to this lane's culture, language, and aesthetic."

# ── Prompt ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a music + culture researcher. Your task: build a catalog of REAL artists for a specific lane, with their CANONICAL platform handles VERIFIED via web search.

You MUST search the open web for each artist. Do not output a handle from memory unless you have just verified it on a current public source. If you cannot find a verified handle for a platform, omit that platform from the entry.

Output ONLY a JSON array of objects. No prose, no markdown fences. Each object MUST be:
{
  "name":          "Artist's full name (canonical)",
  "platforms": {
    "youtube":   "official channel handle (the part after @ on youtube.com/@HANDLE), or null if you can't find one",
    "instagram": "official IG username (no @), or null",
    "tiktok":    "official TikTok username (no @), or null"
  },
  "region":        "iso-2 country code where the artist is based (or 'diaspora-NL', 'diaspora-PT' etc)",
  "language":      "iso-639-1 main performing language",
  "role":          "singer | producer | dj | dancer | instructor | curator | label",
  "rationale":     "≤ 25-word reason this artist belongs in the lane",
  "sources":       ["url1", "url2"]    // 1-3 URLs you used to verify the handles
}

Rules:
- 100% of entries MUST have at least ONE non-null platform handle.
- Confidence floor: if you're not sure a handle is correct, use null. Better to have a name with a single verified YouTube than three guessed handles.
- Bias toward DEPTH per artist (multi-platform when you can verify) over breadth of names.
- Avoid 'Topic' auto-channels for YouTube unless the artist has no real channel.
- Don't propose duplicates within your response.
- Return at most COUNT items.
"""

# ── LLM call ─────────────────────────────────────────────────────────

def call_or(model: str, system: str, user: str) -> tuple[str, dict]:
    body = json.dumps({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': user},
        ],
        'temperature': 0.2,
        'max_tokens':  16000,
    }).encode()
    req = urllib.request.Request(OPENROUTER_URL, data=body, headers={
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {OPENROUTER_KEY}',
        'HTTP-Referer':  'https://voyomusic.com',
        'X-Title':       'VOYO Curator Discovery',
    })
    with urllib.request.urlopen(req, timeout=600) as r:  # deep-research can be slow
        resp = json.loads(r.read())
    text = resp['choices'][0]['message']['content']
    usage = resp.get('usage', {})
    return text, usage

def call_research(system: str, user: str) -> tuple[str, str]:
    last_err = None
    for model in MODELS:
        try:
            text, usage = call_or(model, system, user)
            print(f'  [{model}] tokens={usage.get("total_tokens","?")}', flush=True)
            return text, model
        except urllib.error.HTTPError as e:
            err = e.read()[:300].decode('utf-8', 'ignore')
            last_err = f'{model}: HTTP {e.code} {err}'
            print(f'  [warn] {last_err[:200]}', file=sys.stderr)
            time.sleep(1)
        except Exception as e:
            last_err = f'{model}: {e}'
            print(f'  [warn] {last_err}', file=sys.stderr)
            time.sleep(1)
    print(f'ERROR: all models failed. Last: {last_err}', file=sys.stderr)
    sys.exit(1)

# ── Output parsing ───────────────────────────────────────────────────

def _salvage_objects(text: str) -> list[dict]:
    out: list[dict] = []
    i, n = 0, len(text)
    while i < n:
        if text[i] == '{':
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
                try: out.append(json.loads(text[i:j]))
                except json.JSONDecodeError: pass
                i = j
                continue
            else:
                break
        i += 1
    return out

def parse_catalog(text: str) -> list[dict]:
    text = text.strip()
    # Strip <think>...</think> blocks (Kimi reasoning models)
    if '<think>' in text:
        text = text.split('</think>', 1)[-1].strip()
    # Strip code fences
    if text.startswith('```'):
        text = text.split('```', 2)[1]
        if text.lstrip().startswith('json'):
            text = text.split('\n', 1)[1] if '\n' in text else text[4:]
        text = text.rsplit('```', 1)[0].strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = _salvage_objects(text)
    if isinstance(data, dict):
        for k in ('catalog', 'entries', 'creators', 'data', 'results'):
            if k in data and isinstance(data[k], list):
                data = data[k]; break
    if not isinstance(data, list):
        raise ValueError(f'expected list, got {type(data).__name__}')
    return data

# ── Catalog write ────────────────────────────────────────────────────

def normalize_entry(e: dict) -> dict | None:
    name = (e.get('name') or '').strip()
    if not name: return None
    plats = e.get('platforms') or {}
    if isinstance(plats, list):  # some models flatten to a list of {platform,handle}
        plats = {p.get('platform'): p.get('handle') for p in plats if isinstance(p, dict)}
    out_plats = {}
    for p in ('youtube', 'instagram', 'tiktok'):
        h = plats.get(p)
        if isinstance(h, dict):
            h = h.get('handle')
        if h is None or h == '': continue
        h = str(h).strip().lstrip('@')
        if not h or h.lower() in ('null', 'none', 'n/a'): continue
        out_plats[p] = h
    if not out_plats:
        return None
    return {
        'name':       name[:120],
        'platforms':  out_plats,
        'region':     (e.get('region') or '').strip()[:24] or None,
        'language':   (e.get('language') or '').strip()[:8] or None,
        'role':       (e.get('role') or '').strip()[:24] or None,
        'rationale':  (e.get('rationale') or '').strip()[:280] or None,
        'sources':    [s for s in (e.get('sources') or []) if isinstance(s, str)][:3],
    }

# ── Main ─────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lane', required=True)
    p.add_argument('--count', type=int, default=60)
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CATALOG_DIR / (args.lane.replace('/', '_') + '.json')

    brief = LANE_BRIEFS.get(args.lane, DEFAULT_BRIEF)
    user = (
        f'LANE: {args.lane}\nCOUNT: {args.count}\n\n'
        f'LANE BRIEF:\n{brief}\n\n'
        'For each artist, search the web for their official YouTube channel '
        '(youtube.com/@HANDLE), Instagram (instagram.com/HANDLE), and TikTok '
        '(tiktok.com/@HANDLE). Include only handles you can verify on a '
        'current source. Cite 1-3 source URLs per entry. Return the JSON '
        'array now.'
    )

    print(f'Researching {args.count} creators for lane="{args.lane}"…', flush=True)
    text, model = call_research(SYSTEM_PROMPT, user)

    try:
        raw = parse_catalog(text)
    except Exception as e:
        print(f'ERROR parsing: {e}', file=sys.stderr)
        print(f'--- first 800 chars ---\n{text[:800]}', file=sys.stderr)
        sys.exit(1)

    entries = [n for n in (normalize_entry(e) for e in raw) if n]
    print(f'  parsed {len(raw)} → {len(entries)} valid entries', flush=True)

    catalog = {
        'lane':           args.lane,
        'discovered_at':  datetime.now(timezone.utc).isoformat(),
        'discovered_by':  model,
        'count_requested': args.count,
        'count_returned':  len(entries),
        'verified':        False,  # flipped by verify_handles.py
        'entries':         entries,
    }

    if args.dry_run:
        print('\n--- DRY-RUN sample (top 8) ---')
        for e in entries[:8]:
            plats = ' / '.join(f'{k}:{v}' for k, v in e['platforms'].items())
            print(f'  {e["name"]:25} [{e.get("role") or "?"}] {plats}')
        print(f'\n  not written.')
        return

    # Backup existing catalog if any
    if out_path.exists():
        bak = out_path.with_suffix('.json.bak')
        os.replace(out_path, bak)
        print(f'  backed up existing → {bak.name}')
    with open(out_path, 'w') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f'\nCatalog written: {out_path}')
    print(f'Next: python3 verify_handles.py --lane {args.lane}')

if __name__ == '__main__':
    main()
