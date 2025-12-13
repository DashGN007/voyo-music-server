// VOYO Music - Seed Data (African Bangers with REAL YouTube IDs)
import { Track, Playlist, MoodTunnel, Reaction } from '../types';
import { getThumb } from '../utils/thumbnail';

// Re-export thumbnail utilities for backward compatibility
export { getThumb as getThumbnailUrl, getThumb as getYouTubeThumbnail, getThumbWithFallback as getThumbnailWithFallback } from '../utils/thumbnail';

// Local alias for internal use
const getThumbnailUrl = getThumb;

// ============================================
// MOOD TUNNELS
// ============================================

export const MOOD_TUNNELS: MoodTunnel[] = [
  {
    id: 'afro',
    name: 'AFRO',
    icon: '🌍',
    color: '#a855f7',
    gradient: 'from-purple-600 to-pink-600',
  },
  {
    id: 'feed',
    name: 'FEED',
    icon: '🔥',
    color: '#ef4444',
    gradient: 'from-red-500 to-orange-500',
  },
  {
    id: 'rnb',
    name: 'RNB',
    icon: '💜',
    color: '#8b5cf6',
    gradient: 'from-violet-600 to-purple-600',
  },
  {
    id: 'hype',
    name: 'HYPE',
    icon: '⚡',
    color: '#f59e0b',
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'chill',
    name: 'CHILL',
    icon: '🌙',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'heartbreak',
    name: 'FEELS',
    icon: '💔',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
  },
];

// ============================================
// TRACKS (REAL YouTube Video IDs - African Bangers)
// ============================================

// REAL WORKING Video IDs (verified Dec 2025)
export const TRACKS: Track[] = [
  {
    id: '0',
    title: 'GINJA SESSIONS | Afrobeats, Dancehall, Amapiano Mix',
    artist: 'Ethan Tomas',
    album: 'GINJA SESSIONS',
    trackId: 'mhd0RcE6XC4',
    coverUrl: getThumbnailUrl('mhd0RcE6XC4'),
    duration: 4103,
    tags: ['afrobeats', 'dancehall', 'amapiano', 'mix', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 999999999,
    createdAt: '2024-12-08',
  },
  {
    id: '1',
    title: 'UNAVAILABLE',
    artist: 'Davido ft. Musa Keys',
    album: 'Timeless',
    trackId: 'OSBan_sH_b8',
    coverUrl: getThumbnailUrl('OSBan_sH_b8'),
    duration: 190,
    tags: ['afrobeats', 'amapiano', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 141223051,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Calm Down',
    artist: 'Rema ft. Selena Gomez',
    album: 'Rave & Roses',
    trackId: 'WcIcVapfqXw',
    coverUrl: getThumbnailUrl('WcIcVapfqXw'),
    duration: 240,
    tags: ['afrobeats', 'pop', 'rnb'],
    mood: 'rnb',
    region: 'NG',
    oyeScore: 1267074719,
    createdAt: '2022-08-25',
  },
  {
    id: '3',
    title: 'City Boys',
    artist: 'Burna Boy',
    album: 'I Told Them...',
    trackId: 'hLDQ88vAhIs',
    coverUrl: getThumbnailUrl('hLDQ88vAhIs'),
    duration: 154,
    tags: ['afrobeats', 'street', 'hype'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 104335746,
    createdAt: '2023-08-25',
  },
  {
    id: '4',
    title: 'Rush',
    artist: 'Ayra Starr',
    album: '19 & Dangerous',
    trackId: 'crtQSTYWtqE',
    coverUrl: getThumbnailUrl('crtQSTYWtqE'),
    duration: 186,
    tags: ['afrobeats', 'pop', 'dance'],
    mood: 'dance',
    region: 'NG',
    oyeScore: 513773557,
    createdAt: '2023-06-20',
  },
  {
    id: '5',
    title: 'Joha',
    artist: 'Asake',
    album: 'Work of Art',
    trackId: 'fXl5dPuiJa0',
    coverUrl: getThumbnailUrl('fXl5dPuiJa0'),
    duration: 153,
    tags: ['afrobeats', 'amapiano', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 42280341,
    createdAt: '2023-09-15',
  },
  {
    id: '6',
    title: 'Essence',
    artist: 'Wizkid ft. Tems',
    album: 'Made in Lagos',
    trackId: 'jipQpjUA_o8',
    coverUrl: getThumbnailUrl('jipQpjUA_o8'),
    duration: 246,
    tags: ['afrobeats', 'rnb', 'chill'],
    mood: 'chill',
    region: 'NG',
    oyeScore: 236664390,
    createdAt: '2020-10-30',
  },
  {
    id: '7',
    title: 'Commas',
    artist: 'Ayra Starr',
    album: 'The Year I Turned 21',
    trackId: 'EhyzYPSHRQU',
    coverUrl: getThumbnailUrl('EhyzYPSHRQU'),
    duration: 157,
    tags: ['afrobeats', 'pop'],
    mood: 'afro',
    region: 'NG',
    oyeScore: 172897365,
    createdAt: '2024-08-14',
  },
  {
    id: '8',
    title: 'Last Last',
    artist: 'Burna Boy',
    album: 'Love, Damini',
    trackId: 'RQdxHi4_Pvc',
    coverUrl: getThumbnailUrl('RQdxHi4_Pvc'),
    duration: 185,
    tags: ['afrobeats', 'heartbreak', 'party'],
    mood: 'heartbreak',
    region: 'NG',
    oyeScore: 95000000,
    createdAt: '2022-05-13',
  },
  {
    id: '9',
    title: 'Water',
    artist: 'Tyla',
    album: 'TYLA',
    trackId: 'XoiOOiuH8iI',
    coverUrl: getThumbnailUrl('XoiOOiuH8iI'),
    duration: 193,
    tags: ['amapiano', 'rnb', 'dance'],
    mood: 'dance',
    region: 'ZA',
    oyeScore: 200000000,
    createdAt: '2023-07-28',
  },
  {
    id: '10',
    title: 'Love Nwantiti (Remix)',
    artist: 'CKay ft. Joeboy & Kuami Eugene',
    album: 'CKay the First',
    trackId: 'D-YDEyuDxWU',
    coverUrl: getThumbnailUrl('D-YDEyuDxWU'),
    duration: 217,
    tags: ['afrobeats', 'rnb', 'chill'],
    mood: 'rnb',
    region: 'NG',
    oyeScore: 300000000,
    createdAt: '2021-07-26',
  },
];

// ============================================
// PLAYLISTS
// ============================================

export const PLAYLISTS: Playlist[] = [
  {
    id: 'pl1',
    title: 'Afro Bangers 2024',
    coverUrl: getThumbnailUrl('OSBan_sH_b8'),  // UNAVAILABLE track
    trackIds: ['1', '2', '3', '7', '10'],
    type: 'CURATED',
    mood: 'afro',
    createdAt: '2024-01-01',
  },
  {
    id: 'pl2',
    title: 'Amapiano Vibes',
    coverUrl: getThumbnailUrl('XoiOOiuH8iI'),  // Water by Tyla
    trackIds: ['6', '9'],
    type: 'CURATED',
    mood: 'dance',
    createdAt: '2024-01-05',
  },
  {
    id: 'pl3',
    title: 'Late Night Feels',
    coverUrl: getThumbnailUrl('jipQpjUA_o8'),  // Essence
    trackIds: ['4', '5', '8', '10'],
    type: 'CURATED',
    mood: 'chill',
    createdAt: '2024-01-10',
  },
];

// ============================================
// DEFAULT REACTIONS (DA Language Pack)
// ============================================

export const DEFAULT_REACTIONS = [
  { type: 'oyo', text: 'OYO', emoji: '👋' },
  { type: 'oye', text: 'OYÉÉ', emoji: '🔥' },
  { type: 'wazzguan', text: 'Wazzguán!', emoji: '✨' },
  { type: 'yoooo', text: 'Yooooo!', emoji: '🚀' },
  { type: 'mad_oh', text: 'Mad oh!', emoji: '🤯' },
  { type: 'eyyy', text: 'Eyyy!', emoji: '💫' },
  { type: 'fire', text: '🔥🔥🔥', emoji: '🔥' },
  { type: 'we_move', text: 'WE MOVE!', emoji: '💪' },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getTrackById = (id: string): Track | undefined => {
  return TRACKS.find((t) => t.id === id);
};

export const getTracksByMood = (mood: string): Track[] => {
  return TRACKS.filter((t) => t.mood === mood);
};

export const getTracksByTag = (tag: string): Track[] => {
  return TRACKS.filter((t) => t.tags.includes(tag));
};

export const getRandomTracks = (count: number): Track[] => {
  const shuffled = [...TRACKS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const getHotTracks = (): Track[] => {
  return [...TRACKS].sort((a, b) => b.oyeScore - a.oyeScore).slice(0, 5);
};

export const getDiscoverTracks = (excludeIds: string[]): Track[] => {
  return TRACKS.filter((t) => !excludeIds.includes(t.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
};

// ============================================
// SMART DISCOVERY - Adaptive Recommendations
// ============================================

/**
 * Get tracks by artist
 */
export const getTracksByArtist = (artist: string): Track[] => {
  return TRACKS.filter((t) => t.artist.toLowerCase() === artist.toLowerCase());
};

/**
 * Get tracks by multiple tags (OR logic - matches any tag)
 */
export const getTracksByTags = (tags: string[]): Track[] => {
  if (!tags || tags.length === 0) return [];
  const lowerTags = tags.map((t) => t.toLowerCase());
  return TRACKS.filter((track) =>
    track.tags.some((tag) => lowerTags.includes(tag.toLowerCase()))
  );
};

/**
 * Smart scoring algorithm for track similarity
 * Returns tracks sorted by relevance to the reference track
 */
export const getRelatedTracks = (track: Track, limit: number = 5, excludeIds: string[] = []): Track[] => {
  if (!track) return getRandomTracks(limit);

  // Score each track based on similarity
  const scored = TRACKS.filter((t) => t.id !== track.id && !excludeIds.includes(t.id))
    .map((t) => {
      let score = 0;

      // +50 points: Same artist (strongest signal)
      if (t.artist.toLowerCase() === track.artist.toLowerCase()) {
        score += 50;
      }

      // +30 points: Same mood
      if (t.mood && track.mood && t.mood === track.mood) {
        score += 30;
      }

      // +10 points per matching tag
      const matchingTags = t.tags.filter((tag) =>
        track.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
      );
      score += matchingTags.length * 10;

      // +5 points: Same region
      if (t.region && track.region && t.region === track.region) {
        score += 5;
      }

      // Bonus: Popular tracks get slight boost (oyeScore / 1M)
      score += t.oyeScore / 1000000;

      return { track: t, score };
    });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If we have enough high-scoring tracks (score > 20), use them
  const highScorers = scored.filter((s) => s.score > 20);
  if (highScorers.length >= limit) {
    return highScorers.slice(0, limit).map((s) => s.track);
  }

  // Otherwise mix high scorers with hot tracks to fill the gap
  const needed = limit - highScorers.length;
  const hotTracks = getHotTracks().filter(
    (t) => t.id !== track.id &&
    !excludeIds.includes(t.id) &&
    !highScorers.some((s) => s.track.id === t.id)
  );

  return [
    ...highScorers.map((s) => s.track),
    ...hotTracks.slice(0, needed),
  ].slice(0, limit);
};
