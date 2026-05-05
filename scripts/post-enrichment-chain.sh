#!/usr/bin/env bash
# post-enrichment-chain.sh
# Watches for enrich-genres-gemini.py to finish, then runs the completion chain.
# Usage: nohup bash scripts/post-enrichment-chain.sh > /tmp/voyo_post_chain.log 2>&1 &

set -e
cd "$(dirname "$0")/.."

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Post-enrichment chain watcher started. Waiting for enrich-genres-gemini.py to finish..."

# Poll every 60s until the enrichment process is gone
while ps aux | grep "enrich-genres-gemini.py" | grep -v grep > /dev/null 2>&1; do
  sleep 60
done

log "Enrichment complete. Starting post-chain..."

# Step 1: Populate vibe scores from newly-classified genres
log "=== Step 1: populate-vibe-scores.py ==="
python3 scripts/populate-vibe-scores.py 2>&1
log "Vibe scores done."

# Step 2: Enrich moment cultural tags with newly-available genres
log "=== Step 2: enrich-moment-genre-tags.py ==="
python3 scripts/enrich-moment-genre-tags.py 2>&1
log "Moment genre tags done."

# Step 3: Re-enrich tracks classified as 'other'
log "=== Step 3: reenrich-other-tracks.py ==="
PYTHONUNBUFFERED=1 nohup python3 -u scripts/reenrich-other-tracks.py >> /tmp/voyo_reenrich_other.log 2>&1 &
log "Re-enrichment of 'other' tracks started in background (PID: $!). Watch: tail -f /tmp/voyo_reenrich_other.log"

log "Post-enrichment chain complete."
