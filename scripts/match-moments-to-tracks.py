#!/usr/bin/env python3
"""
match-moments-to-tracks.py
===========================
Finds voyo_moments rows that have parent_track_title + parent_track_artist
but no parent_track_id, then searches video_intelligence for a match
and writes the parent_track_id back.

Strategy:
  1. Fetch all unlinked moments with title+artist
  2. For each, search video_intelligence by artist (ilike) + title (ilike)
  3. If confidence ≥ threshold, PATCH voyo_moments with the youtube_id

Run:
    python3 scripts/match-moments-to-tracks.py
    python3 scripts/match-moments-to-tracks.py --dry-run
"""

import json, os, sys, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = 'https://anmgyxhnyhbyxzpjhxgx.supabase.co'
SERVICE_KEY  = ''

PAGE        = 200   # moments per fetch
CONCURRENCY = 5

# ─── Load key ─────────────────────────────────────────────────────────────────

def load_key():
    env = os.path.join(os.path.dirname(__file__), '..', '..', 'voyo-music', '.env')
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('SUPABASE_SERVICE_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('SUPABASE_SERVICE_KEY', '')

# ─── Supabase helpers ──────────────────────────────────────────────────────────

def sb_get(path: str, params: dict = None) -> list | dict | None:
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None

def sb_patch(path: str, params: dict, body: dict) -> bool:
    url = f'{SUPABASE_URL}/rest/v1/{path}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url,
        data=json.dumps(body).encode(),
        headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        method='PATCH',
    )
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True
    except Exception:
        return False

# ─── Similarity ────────────────────────────────────────────────────────────────

import re as _re

def _norm(s: str) -> str:
    return _re.sub(r'[^\w\s]', '', s.lower()).strip()

_STRIP_PATTERNS = _re.compile(
    r'\b(challenge|sped up|speed up|remix|rmx|ft\.?|feat\.?|official|video|audio|by\s+\w+|dance|version|cover)\b',
    _re.IGNORECASE
)
_FEAT_PARENS = _re.compile(r'\s*[\(\[][^\)\]]*[\)\]]')

# Generic words that don't distinguish tracks — exclude from overlap scoring
_STOPWORDS = {
    'the','a','an','in','of','at','on','for','with','to','and','or','is','it',
    'my','me','you','your','we','our','by','be','do','so','up','go','no','oh',
    'its','was','are','has','had','but','not','can','all','one',
    'this','that','from','just',
}

def _clean_title(s: str) -> str:
    """Strip feat., challenge, sped up, parenthetical extras."""
    s = _FEAT_PARENS.sub('', s)
    s = _STRIP_PATTERNS.sub('', s)
    return _norm(s)

def _meaningful_tokens(tokens: set) -> set:
    """Remove stopwords and very short tokens from a token set."""
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS}

def title_score(a: str, b: str) -> float:
    """Token overlap that handles 'feat.' extensions and stopword noise.

    Uses CLEAN tokens for matching (strips feat./challenge/parens so 'Umbrella'
    matches 'Umbrella (feat. Wande Coal)'), but RAW meaningful tokens for sizing
    (so 'Money' cleaned from 'Money (feat. Fredo)' doesn't inflate score).
    Requires ≥2 overlapping tokens when both raw sets are multi-word."""
    ta_raw = _meaningful_tokens(set(_norm(a).split()))
    tb_raw = _meaningful_tokens(set(_norm(b).split()))
    ta = _meaningful_tokens(set(_clean_title(a).split())) or ta_raw
    tb = _meaningful_tokens(set(_clean_title(b).split())) or tb_raw

    overlap = ta & tb
    shorter_raw = min(len(ta_raw), len(tb_raw))

    if not overlap or shorter_raw == 0:
        return 0.0

    # Clean-size ratio guard: if one title is much longer in clean form (after feat-stripping),
    # the titles are likely different songs. "Money Over Love" (3) vs "Money" (1) = 0.33 < 0.4.
    # "Umbrella" (1) vs "Umbrella" (1) = 1.0. Avoids short DB titles over-matching.
    len_a, len_b = max(len(ta), 1), max(len(tb), 1)
    if min(len_a, len_b) / max(len_a, len_b) < 0.4:
        return 0.0

    # Require ≥2 overlapping tokens when the MOMENT has 2+ meaningful raw tokens.
    # Uses len(ta_raw) (not shorter) so "Na money challenge" (2 raw) can't match
    # a 1-token DB title like "Money" on a single shared word.
    if len(ta_raw) >= 2 and len(overlap) < 2:
        return 0.0

    return len(overlap) / shorter_raw

# ─── Search logic ─────────────────────────────────────────────────────────────

def _best_from_results(title: str, results: list) -> tuple[str | None, float]:
    best_id, best_score = None, 0.0
    for row in results:
        sc = title_score(title, row.get('title', ''))
        if sc > best_score:
            best_score = sc
            best_id = row['youtube_id']
    return best_id, best_score

# TikTok placeholder sound names — never worth matching
_TIKTOK_PLACEHOLDERS = {
    'son original', 'original sound', 'sons originaux', 'sonido original',
    'suono originale', 'original audio', 'original music',
}

def find_track(title: str, artist: str) -> tuple[str | None, float]:
    """Returns (youtube_id, confidence) or (None, 0)."""
    if (_norm(title) in _TIKTOK_PLACEHOLDERS
            or title.lower().startswith('original sound')
            or 'tiktok' in title.lower()):
        return None, 0.0

    title_clean = _clean_title(title)
    ta_clean    = _meaningful_tokens(set(title_clean.split()))
    ta_orig_len = len(_norm(title).split())
    artist_words = _norm(artist).split()
    # Use first meaningful word from artist (TikTok handles are long/weird)
    artist_key   = artist_words[0][:30] if artist_words else ''

    # 1. Artist search
    if artist_key:
        results = sb_get('video_intelligence', {
            'select': 'youtube_id,title,artist',
            'artist': f'ilike.*{artist_key}*',
            'limit': '30',
        })
        if results:
            yt_id, score = _best_from_results(title, results)
            if score >= 0.35:
                return yt_id, score

    # 2. Title keyword fallback — use cleaned title's first meaningful word
    # Skip if original had ≥3 words but cleaning stripped to ≤1 meaningful token:
    # "Na money challenge" → 3 words → 1 token = stripped too aggressively to trust
    if ta_orig_len >= 3 and len(ta_clean) <= 1:
        return None, 0.0

    title_words = [w for w in title_clean.split() if len(w) > 3]
    if title_words:
        kw = title_words[0][:30]
        results = sb_get('video_intelligence', {
            'select': 'youtube_id,title,artist',
            'title': f'ilike.*{kw}*',
            'limit': '30',
        })
        if results:
            yt_id, score = _best_from_results(title, results)
            if score >= 0.67:  # strict threshold: ≥2/3 tokens must match
                return yt_id, score

    return None, 0.0

# ─── Main ─────────────────────────────────────────────────────────────────────

def fetch_unlinked_moments() -> list[dict]:
    """Paginate all moments that have title+artist but no parent_track_id."""
    moments = []
    offset  = 0
    while True:
        batch = sb_get('voyo_moments', {
            'select': 'id,parent_track_title,parent_track_artist',
            'parent_track_id': 'is.null',
            'parent_track_title': 'not.is.null',
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
    return moments

def process_moment(m: dict, dry_run: bool) -> tuple[str, str | None, float]:
    """Returns (moment_id, matched_yt_id_or_None, confidence)."""
    title  = m.get('parent_track_title', '') or ''
    artist = m.get('parent_track_artist', '') or ''
    if not title or not artist:
        return m['id'], None, 0.0

    yt_id, confidence = find_track(title, artist)
    if not yt_id:
        return m['id'], None, 0.0

    if dry_run:
        return m['id'], yt_id, confidence

    ok = sb_patch('voyo_moments', {'id': f'eq.{m["id"]}'}, {
        'parent_track_id': yt_id,
        'track_match_confidence': round(confidence, 2),
        'track_match_method': 'fuzzy_title_artist',
    })
    return m['id'], yt_id if ok else None, confidence

def main():
    global SERVICE_KEY
    dry_run = '--dry-run' in sys.argv
    SERVICE_KEY = load_key()
    if not SERVICE_KEY:
        print('ERROR: SUPABASE_SERVICE_KEY not found')
        sys.exit(1)

    print('Fetching unlinked moments (have title+artist, no parent_track_id)...')
    moments = fetch_unlinked_moments()
    print(f'  {len(moments)} unlinked moments to process')

    if not moments:
        print('Nothing to do.')
        return

    matched  = 0
    no_match = 0
    t0       = time.time()

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(process_moment, m, dry_run): m for m in moments}
        for i, fut in enumerate(as_completed(futures), 1):
            moment_id, yt_id, conf = fut.result()
            m = futures[fut]
            if yt_id:
                matched += 1
                if dry_run:
                    print(f'  [DRY] "{m["parent_track_title"]}" / {m["parent_track_artist"]}'
                          f' → {yt_id} ({conf:.0%})')
            else:
                no_match += 1
            pct = i / len(moments) * 100
            print(f'  {pct:5.1f}% | {matched} matched | {no_match} no-match', end='\r')

    elapsed = time.time() - t0
    print(f'\n\n✅ Done in {elapsed:.1f}s')
    print(f'   Matched:   {matched}/{len(moments)} ({matched/len(moments)*100:.0f}%)')
    print(f'   No match:  {no_match}')
    if dry_run:
        print('\n[DRY RUN] No writes performed.')

if __name__ == '__main__':
    main()
