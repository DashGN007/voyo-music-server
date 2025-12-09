// VOYO Music Device - Core Types

// Mood Types
export type MoodType =
  | 'afro'
  | 'feed'
  | 'rnb'
  | 'hype'
  | 'chill'
  | 'heartbreak'
  | 'dance'
  | 'street'
  | 'party'
  | 'worship'
  | 'focus'
  | 'gym';

// Mood Tunnel Interface
export interface MoodTunnel {
  id: MoodType;
  name: string;
  icon: string;
  color: string;
  gradient: string;
}

// Track Interface
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  trackId: string;
  coverUrl: string;
  duration: number;
  tags: string[];
  mood?: MoodType;
  region?: string;
  oyeScore: number;
  createdAt: string;
}

// Playlist Interface
export interface Playlist {
  id: string;
  title: string;
  coverUrl: string;
  trackIds: string[];
  type: 'CURATED' | 'ALGO' | 'USER';
  mood?: MoodType;
  createdAt: string;
}

// View Mode
export type ViewMode = 'card' | 'lyrics' | 'video' | 'feed';

// Player State
export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  volume: number;
  viewMode: ViewMode;
  isVideoMode: boolean;
}

// Queue Item
export interface QueueItem {
  track: Track;
  addedAt: string;
  source: 'auto' | 'manual' | 'roulette' | 'ai';
}

// History Item
export interface HistoryItem {
  track: Track;
  playedAt: string;
  duration: number;
  oyeReactions: number;
}

// Recommendation Zone
export type RecommendationZone = 'hot' | 'ai' | 'discover';

// Recommendation
export interface Recommendation {
  track: Track;
  zone: RecommendationZone;
  reason?: string;
  score: number;
}

// Reaction Types
export type ReactionType =
  | 'oyo'
  | 'oye'
  | 'wazzguan'
  | 'yoooo'
  | 'mad_oh'
  | 'eyyy'
  | 'fire'
  | 'we_move'
  | 'custom';

// Reaction Interface
export interface Reaction {
  id: string;
  type: ReactionType;
  text: string;
  emoji?: string;
  x: number;
  y: number;
  multiplier: number;
  userId: string;
  createdAt: string;
}

// OYE Score
export interface OyeScore {
  total: number;
  reactions: number;
  storms: number;
  peak: number;
}

// User
export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
  country?: string;
  oyoLevel: number;
  oyeScore: number;
  likedTracks: string[];
  playlists: string[];
  createdAt: string;
}

// VOYO Clip
export interface VoyoClip {
  id: string;
  trackId: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption?: string;
  tags: string[];
  oyeScore: number;
  viewCount: number;
  createdAt: string;
}

// Session Types
export type SessionType =
  | 'private_showcase'
  | 'oyo_circle'
  | 'choir_mode'
  | 'street_festival'
  | 'voyo_concert'
  | 'oye_arena';

// Live Session
export interface LiveSession {
  id: string;
  artistId: string;
  oyeGoal: number;
  currentOye: number;
  sessionType: SessionType;
  scheduledAt?: string;
  isLive: boolean;
  rsvpCount: number;
  highlightClipIds: string[];
}

// =============================================
// VOYO SUPERAPP TYPES (Genesis Blueprint v1.0)
// =============================================

// VOYO Tab Navigation
export type VoyoTab = 'music' | 'feed' | 'upload';

// Feed Item (TikTok-style content)
export interface FeedItem {
  id: string;
  user: string;
  userAvatar?: string;
  caption: string;
  likes: string;
  oyes: string;
  videoUrl: string;
  thumbnailUrl?: string;
  songId?: string;
  songTitle?: string;
  songArtist?: string;
  tags?: string[];
  createdAt: string;
}

// DJ Mode States
export type DJMode = 'idle' | 'listening' | 'thinking' | 'responding';
