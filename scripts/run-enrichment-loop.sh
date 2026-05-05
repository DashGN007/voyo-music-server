#!/bin/bash
# Auto-restarts genre enrichment until all rows are tagged.
# Cursor-based pagination (v1074 fix) means each restart picks up
# from where the last left off (fetches next untagged youtube_id batch).

set -e
cd "$(dirname "$0")/.."

LOG=/tmp/voyo_genre_enrichment.log
MAX_RUNS=20  # safety cap (20 × 66K = 1.3M rows, more than enough for 344K)

echo "$(date): Starting enrichment loop (max ${MAX_RUNS} runs)" | tee -a "$LOG"

for i in $(seq 1 $MAX_RUNS); do
  echo "$(date): Run #${i}" | tee -a "$LOG"
  PYTHONUNBUFFERED=1 python3 -u scripts/enrich-genres-gemini.py \
    --batch 100 --concurrency 3 2>&1 | tee -a "$LOG"

  # Check exit code — stop if script reports all rows tagged
  if grep -q "All rows already have primary_genre" "$LOG"; then
    echo "$(date): All rows tagged. Loop complete after ${i} run(s)." | tee -a "$LOG"
    break
  fi

  echo "$(date): Batch ${i} done. Sleeping 60s before next run..." | tee -a "$LOG"
  sleep 60
done

echo "$(date): Enrichment loop finished." | tee -a "$LOG"
