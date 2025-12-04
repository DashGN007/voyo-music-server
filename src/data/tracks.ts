// VOYO Music - Seed Data (African Bangers with REAL YouTube IDs)
import { Track, Playlist, MoodTunnel, Reaction } from '../types';

// Helper to get YouTube thumbnail - using 'hqdefault' as default (more reliable than maxresdefault)
export const getYouTubeThumbnail = (videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'high') => {
  const qualities = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    max: 'maxresdefault'
  };
  return `https://img.youtube.com/vi/${videoId}/${qualities[quality]}.jpg`;
};

// Get multiple thumbnail URLs for fallback
export const getYouTubeThumbnailWithFallback = (videoId: string) => ({
  primary: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  fallback: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  fallback2: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
});

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

export const TRACKS: Track[] = [
  {
    id: '1',
    title: 'Unavailable',
    artist: 'Davido ft. Musa Keys',
    album: 'Timeless',
    youtubeVideoId: 'fPglLrjMzMs',
    coverUrl: getYouTubeThumbnail('fPglLrjMzMs'),
    duration: 182,
    tags: ['afrobeats', 'amapiano', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 45000,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Rush',
    artist: 'Ayra Starr',
    album: '19 & Dangerous',
    youtubeVideoId: 'GLZRY5Pv_cU',
    coverUrl: getYouTubeThumbnail('GLZRY5Pv_cU'),
    duration: 199,
    tags: ['afrobeats', 'pop', 'dance'],
    mood: 'dance',
    region: 'NG',
    oyeScore: 78000,
    createdAt: '2023-06-20',
  },
  {
    id: '3',
    title: 'Calm Down',
    artist: 'Rema ft. Selena Gomez',
    album: 'Rave & Roses',
    youtubeVideoId: 'CQLsdm1ZYAw',
    coverUrl: getYouTubeThumbnail('CQLsdm1ZYAw'),
    duration: 234,
    tags: ['afrobeats', 'pop', 'rnb'],
    mood: 'rnb',
    region: 'NG',
    oyeScore: 120000,
    createdAt: '2022-08-25',
  },
  {
    id: '4',
    title: 'Last Last',
    artist: 'Burna Boy',
    album: 'Love, Damini',
    youtubeVideoId: 'RQdxHi4_Pvc',
    coverUrl: getYouTubeThumbnail('RQdxHi4_Pvc'),
    duration: 185,
    tags: ['afrobeats', 'heartbreak', 'party'],
    mood: 'heartbreak',
    region: 'NG',
    oyeScore: 95000,
    createdAt: '2022-05-13',
  },
  {
    id: '5',
    title: 'Essence',
    artist: 'Wizkid ft. Tems',
    album: 'Made in Lagos',
    youtubeVideoId: 'GVlQmOIkHaE',
    coverUrl: getYouTubeThumbnail('GVlQmOIkHaE'),
    duration: 266,
    tags: ['afrobeats', 'rnb', 'chill'],
    mood: 'chill',
    region: 'NG',
    oyeScore: 150000,
    createdAt: '2020-10-30',
  },
  {
    id: '6',
    title: 'Water',
    artist: 'Tyla',
    album: 'Water',
    youtubeVideoId: 'Y6etIBTA-nM',
    coverUrl: getYouTubeThumbnail('Y6etIBTA-nM'),
    duration: 193,
    tags: ['amapiano', 'rnb', 'dance'],
    mood: 'dance',
    region: 'ZA',
    oyeScore: 200000,
    createdAt: '2023-07-28',
  },
  {
    id: '7',
    title: 'Buga',
    artist: 'Kizz Daniel ft. Tekno',
    album: 'Buga',
    youtubeVideoId: 'RDKcVdqLpfU',
    coverUrl: getYouTubeThumbnail('RDKcVdqLpfU'),
    duration: 172,
    tags: ['afrobeats', 'dance', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 180000,
    createdAt: '2022-05-04',
  },
  {
    id: '8',
    title: 'Peru',
    artist: 'Fireboy DML',
    album: 'Playboy',
    youtubeVideoId: 'twrn_SryMVI',
    coverUrl: getYouTubeThumbnail('twrn_SryMVI'),
    duration: 186,
    tags: ['afrobeats', 'pop', 'chill'],
    mood: 'chill',
    region: 'NG',
    oyeScore: 110000,
    createdAt: '2021-07-20',
  },
  {
    id: '9',
    title: 'Jerusalema',
    artist: 'Master KG ft. Nomcebo',
    album: 'Jerusalema',
    youtubeVideoId: '7K3lzsRQ5qM',
    coverUrl: getYouTubeThumbnail('7K3lzsRQ5qM'),
    duration: 362,
    tags: ['amapiano', 'gospel', 'dance'],
    mood: 'worship',
    region: 'ZA',
    oyeScore: 250000,
    createdAt: '2019-12-13',
  },
  {
    id: '10',
    title: 'Love Nwantiti',
    artist: 'CKay',
    album: 'CKay the First',
    youtubeVideoId: 'ONM9oE9R_uc',
    coverUrl: getYouTubeThumbnail('ONM9oE9R_uc'),
    duration: 138,
    tags: ['afrobeats', 'rnb', 'chill'],
    mood: 'rnb',
    region: 'NG',
    oyeScore: 300000,
    createdAt: '2019-07-26',
  },
  {
    id: '11',
    title: 'Sability',
    artist: 'Ayra Starr',
    album: '19 & Dangerous',
    youtubeVideoId: 'rk4rr3l9LhE',
    coverUrl: getYouTubeThumbnail('rk4rr3l9LhE'),
    duration: 165,
    tags: ['afrobeats', 'pop'],
    mood: 'afro',
    region: 'NG',
    oyeScore: 52000,
    createdAt: '2023-07-10',
  },
  {
    id: '12',
    title: 'Ye',
    artist: 'Burna Boy',
    album: 'Outside',
    youtubeVideoId: 'T8c1DLJ-bPs',
    coverUrl: getYouTubeThumbnail('T8c1DLJ-bPs'),
    duration: 195,
    tags: ['afrobeats', 'street', 'hype'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 75000,
    createdAt: '2019-07-26',
  },
  {
    id: '13',
    title: 'Joha',
    artist: 'Aya Nakamura',
    album: 'AYA',
    youtubeVideoId: 'vGj5Yfr4yzQ',
    coverUrl: getYouTubeThumbnail('vGj5Yfr4yzQ'),
    duration: 178,
    tags: ['afropop', 'french', 'dance'],
    mood: 'dance',
    region: 'FR',
    oyeScore: 92000,
    createdAt: '2020-11-13',
  },
  {
    id: '14',
    title: 'Bloody Samaritan',
    artist: 'Ayra Starr',
    album: '19 & Dangerous',
    youtubeVideoId: '3A9kPEPKlHM',
    coverUrl: getYouTubeThumbnail('3A9kPEPKlHM'),
    duration: 202,
    tags: ['afrobeats', 'inspirational', 'chill'],
    mood: 'chill',
    region: 'NG',
    oyeScore: 85000,
    createdAt: '2020-08-14',
  },
  {
    id: '15',
    title: 'Loaded',
    artist: 'Tiwa Savage ft. Asake',
    album: 'Water & Garri',
    youtubeVideoId: 'EZEiYMfNgmM',
    coverUrl: getYouTubeThumbnail('EZEiYMfNgmM'),
    duration: 210,
    tags: ['afrobeats', 'amapiano', 'party'],
    mood: 'hype',
    region: 'NG',
    oyeScore: 65000,
    createdAt: '2022-09-15',
  },
];

// ============================================
// PLAYLISTS
// ============================================

export const PLAYLISTS: Playlist[] = [
  {
    id: 'pl1',
    title: 'Afro Bangers 2024',
    coverUrl: getYouTubeThumbnail('fPglLrjMzMs'),
    trackIds: ['1', '2', '3', '7', '10'],
    type: 'CURATED',
    mood: 'afro',
    createdAt: '2024-01-01',
  },
  {
    id: 'pl2',
    title: 'Amapiano Vibes',
    coverUrl: getYouTubeThumbnail('Y6etIBTA-nM'),
    trackIds: ['6', '9', '15'],
    type: 'CURATED',
    mood: 'dance',
    createdAt: '2024-01-05',
  },
  {
    id: 'pl3',
    title: 'Late Night Feels',
    coverUrl: getYouTubeThumbnail('GVlQmOIkHaE'),
    trackIds: ['4', '5', '8', '10', '14'],
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
