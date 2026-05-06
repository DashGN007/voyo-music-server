# VOYO Curated Pool — Strategy & Architecture

**Locked**: 2026-05-06
**Authors**: Dash + ZION
**Status**: Active build

---

## Core philosophy

VOYO Moments is a **curated rotating pool**, not a stockpile. Like a
broadcast station, not a video archive. Every video in R2 either:

- Is **core** — top-tier, never rotates out (the bedrock)
- Is **in-pool** — currently live in the feed (rotates daily, 10% in / 10% out)

Anything else lives only as metadata + an embed URL on the originating
creator's "creator page" (oEmbed iframe → no R2 cost, source platform
gets the traffic = goodwill instead of theft signal).

This means:

- Storage stays bounded (target ~2,500 videos × ~7MB = ~17GB → ~$0.30/mo R2)
- Feed stays fresh (250 new reels/day pulled from top-tier creators)
- Old content doesn't disappear — it gets a permanent home on the
  creator's page via oEmbed
- Quality stays high — every R2 entry passed the tier-aware engagement
  gate at ingest, and the rotation strips low-VOYO-engagement bottoms

---

## Pool sizing

| Tier | Definition | Behavior |
|------|------------|----------|
| **core** | Top 7% by virality_score within siphon-discovered + manual marks | Permanent. Never rotates. ~50–200 entries. Bedrock. |
| **in-pool** | Currently live in feed | Rotates daily. ~2,300 entries. |
| **archived** | Was in pool, evicted to creator page | R2 file deleted. Row keeps `embed_url` for creator-page render. |

| Lane category | Per-lane in-pool target |
|---------------|------------------------|
| Major (afrobeats, kizomba, hiphop, amapiano) | ~250 each |
| Mid (nigeria, angola, north-africa, dance, comedy, ghana) | ~150 each |
| Minor (senegal, south-africa, west-africa, bongo-flava, gospel, fashion, algeria) | ~80 each |

Sum: ~2,400 active + ~100 core ≈ **2,500 video pool**

---

## Daily rotation (10% in / 10% out)

**Cron**: 04:00 UTC (low-traffic window)
**Script**: `scripts/curated/rotate_pool.py`

### Eviction (out)

- Skip rows where `is_core = true`
- Score every `in_pool=true` row:
  - `score = (voyo_plays - 2*voyo_skips) * decay(age_in_pool_days, half_life=14)`
- Bottom 10% by score → mark `in_pool=false`, `archived_at=now()`,
  `archive_reason='rotation'`, populate `embed_url` from source URL
- Async: delete R2 file (`moments/{platform}/{source_id}.mp4`)

### Ingestion (in)

- For each active lane, identify the top creators currently UNDER-represented
  in the in-pool count (their last reel was added > 7 days ago)
- Run `ingest_from_catalog.py` for those creators with `--reels 2 --since 14d`
- New rows land with `in_pool=true`, `archived_at=null`
- Tier-aware quality gate applies — bad reels never reach R2

### Invariants

- `core` rows are immutable — even a low-engagement core row stays.
  Removing core requires an explicit operator action (cockpit panel).
- Pool size stays within ±5% of target after each rotation.
- A creator can have ≤ 5 in-pool entries at any time (forces breadth across artists).

---

## Schema delta (migration 031)

```sql
ALTER TABLE voyo_moments
  ADD COLUMN IF NOT EXISTS in_pool          BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_core          BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason   TEXT,
  ADD COLUMN IF NOT EXISTS embed_url        TEXT;

CREATE INDEX IF NOT EXISTS idx_voyo_moments_in_pool
  ON voyo_moments (in_pool) WHERE in_pool = true;
CREATE INDEX IF NOT EXISTS idx_voyo_moments_is_core
  ON voyo_moments (is_core) WHERE is_core = true;
```

---

## Feed query (after migration)

```ts
// Primary fetch: only in-pool rows, virality + recency ranked
.eq('is_active', true)
.or('in_pool.eq.true,is_core.eq.true')
.order('virality_score', desc)
```

Curated_lane filter logic stays the same; just add `in_pool OR is_core`
as a top-level filter. Archived rows show ONLY on `/creator/<handle>`
pages, never on the feed.

---

## Initial population (Day 0 — today)

1. Existing R2 has 6,925 active rows.
2. Of those: 950 have view-count signal (siphon), 5,975 are orphan
   imports (no metadata).
3. **Core selection**: top 7% of 950 by virality_score = ~67 rows →
   `is_core=true, in_pool=true`.
4. **Creator extraction**: every distinct `creator_username` from
   siphon → write to `catalogs/_seeds/orphan_creators.json` for the
   next discovery sweep.
5. **Archive everything else**: 6,858 rows → `in_pool=false`,
   `archived_at=now()`, R2 deletion queued.
6. R2 deletion batch runs in background (boto3 `delete_objects`).
7. Creator catalog discovery + ingest fills pool back up to ~2,400
   target (over the next ~3 days as we cover all 17 lanes).

---

## Open questions tracked elsewhere (Phase 2)

- Watch-through-rate per moment (replace virality_score with VOYO-native engagement)
- Vector embeddings per video (TikTok-grade similarity)
- Cold-start: first 10 swipes for new users
- Per-creator velocity check (skip whole creators whose last 10 reels avg < 5%)
- Cockpit curator approval queue (manual review of new candidates before they hit pool)

---

## Files

- `catalogs/_taxonomy.json` — canonical tag vocabulary (lanes, regions, languages, roles, subgenres, tiers)
- `catalogs/<lane>.json` — per-lane creator catalogs (e.g. `genre_kizomba.json`)
- `catalogs/_seeds/<source>.json` — seed lists for discovery (e.g. `orphan_creators.json`)
- `scripts/curated/discover_creators.py` — LLM-grounded creator discovery
- `scripts/curated/verify_handles.py` — programmatic existence + tier check
- `scripts/curated/ingest_from_catalog.py` — verified-catalog → R2 + DB (with quality gate)
- `scripts/curated/rotate_pool.py` — daily 10% in / 10% out
- `scripts/curated/extract_orphan_seeds.py` — pulls creator names from existing siphon rows
- `scripts/curated/wipe_archived_r2.py` — deletes archived R2 files (batched)
