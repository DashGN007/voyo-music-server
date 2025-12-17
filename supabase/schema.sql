-- VOYO Universe Schema
-- The smart KV: username = key, universe = value
-- Run this in Supabase SQL Editor

-- ============================================
-- UNIVERSES TABLE (The Core)
-- ============================================
CREATE TABLE IF NOT EXISTS universes (
  -- THE KEY (URL identity)
  username TEXT PRIMARY KEY,

  -- THE LOCK (PIN auth, no email needed)
  pin_hash TEXT NOT NULL,
  phone TEXT,  -- Optional: for PIN recovery via SMS

  -- THE VALUE (user's universe)
  state JSONB DEFAULT '{
    "likes": [],
    "playlists": [],
    "queue": [],
    "history": [],
    "preferences": {
      "boostProfile": "boosted",
      "shuffleMode": false,
      "repeatMode": "off"
    },
    "stats": {
      "totalListens": 0,
      "totalMinutes": 0,
      "totalOyes": 0
    }
  }'::jsonb,

  -- PUBLIC VIEW (what visitors see without PIN)
  public_profile JSONB DEFAULT '{
    "displayName": "",
    "bio": "",
    "avatarUrl": null,
    "topTracks": [],
    "publicPlaylists": [],
    "isPublic": true
  }'::jsonb,

  -- PORTAL (real-time sync)
  now_playing JSONB,  -- { trackId, title, artist, thumbnail, currentTime, duration }
  portal_open BOOLEAN DEFAULT false,
  portal_viewers TEXT[] DEFAULT '{}',

  -- METADATA
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_universes_portal_open ON universes(portal_open) WHERE portal_open = true;
CREATE INDEX IF NOT EXISTS idx_universes_last_active ON universes(last_active DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles and portal state
CREATE POLICY "Public profiles are viewable by everyone"
  ON universes FOR SELECT
  USING (true);

-- Only authenticated user can update their own universe
-- (We'll handle auth via PIN verification in the app)
CREATE POLICY "Users can update own universe"
  ON universes FOR UPDATE
  USING (true)  -- We verify PIN in app before allowing updates
  WITH CHECK (true);

-- Anyone can insert (create account)
CREATE POLICY "Anyone can create universe"
  ON universes FOR INSERT
  WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER universes_updated_at
  BEFORE UPDATE ON universes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- REALTIME
-- ============================================
-- Enable realtime for portal sync
ALTER PUBLICATION supabase_realtime ADD TABLE universes;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- INSERT INTO universes (username, pin_hash, public_profile)
-- VALUES (
--   'dash',
--   '$2a$10$...', -- hashed PIN
--   '{
--     "displayName": "Dash",
--     "bio": "Building the future of music",
--     "topTracks": ["track1", "track2"],
--     "isPublic": true
--   }'::jsonb
-- );
