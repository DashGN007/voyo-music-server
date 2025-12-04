/**
 * VOYO Music - Piped API Service
 *
 * Uses Piped (open-source YouTube frontend) for:
 * - Search (no API key needed!)
 * - Direct audio stream URLs
 * - Direct video stream URLs
 * - Seamless audio↔video switching
 *
 * Public instances: https://github.com/TeamPiped/Piped/wiki/Instances
 */

// Multiple instances for fallback
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.r4fo.com',
];

let currentInstanceIndex = 0;

const getApiBase = () => PIPED_INSTANCES[currentInstanceIndex];

const rotateInstance = () => {
  currentInstanceIndex = (currentInstanceIndex + 1) % PIPED_INSTANCES.length;
  console.log(`[Piped] Rotating to instance: ${getApiBase()}`);
};

// Types
export interface PipedSearchResult {
  url: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  uploadedDate: string;
  duration: number;
  views: number;
  uploaderVerified: boolean;
  isShort: boolean;
}

export interface PipedStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  initStart?: number;
  initEnd?: number;
  indexStart?: number;
  indexEnd?: number;
  width?: number;
  height?: number;
  fps?: number;
  contentLength?: number;
}

export interface PipedVideoDetails {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  audioStreams: PipedStream[];
  videoStreams: PipedStream[];
  relatedStreams: PipedSearchResult[];
  category: string;
  uploaderVerified: boolean;
  uploaderSubscriberCount: number;
}

// Convert Piped search result to VOYO Track format
export interface VoyoTrackFromSearch {
  id: string;
  title: string;
  artist: string;
  youtubeVideoId: string;
  coverUrl: string;
  duration: number;
  views: number;
}

/**
 * Extract video ID from Piped URL format
 * Piped URLs look like: /watch?v=VIDEO_ID
 */
const extractVideoId = (url: string): string => {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : url.replace('/watch?v=', '');
};

/**
 * Search for videos/music
 * @param query - Search query (e.g., "afrobeats 2024")
 * @param filter - Filter type: 'all' | 'videos' | 'channels' | 'playlists' | 'music_songs' | 'music_videos'
 */
export async function searchVideos(
  query: string,
  filter: string = 'music_songs'
): Promise<VoyoTrackFromSearch[]> {
  const url = `${getApiBase()}/search?q=${encodeURIComponent(query)}&filter=${filter}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      rotateInstance();
      throw new Error(`Piped API error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items
      .filter((item: any) => item.type === 'stream' && !item.isShort)
      .map((item: PipedSearchResult) => ({
        id: extractVideoId(item.url),
        title: item.title,
        artist: item.uploaderName,
        youtubeVideoId: extractVideoId(item.url),
        coverUrl: item.thumbnail,
        duration: item.duration,
        views: item.views,
      }));
  } catch (error) {
    console.error('[Piped] Search error:', error);

    // Try next instance
    if (currentInstanceIndex < PIPED_INSTANCES.length - 1) {
      rotateInstance();
      return searchVideos(query, filter);
    }

    throw error;
  }
}

/**
 * Get video details including direct stream URLs
 * This is the MAGIC - returns direct audio AND video URLs!
 */
export async function getVideoStreams(videoId: string): Promise<PipedVideoDetails | null> {
  const url = `${getApiBase()}/streams/${videoId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      rotateInstance();
      throw new Error(`Piped API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Piped] Stream error:', error);

    // Try next instance
    if (currentInstanceIndex < PIPED_INSTANCES.length - 1) {
      rotateInstance();
      return getVideoStreams(videoId);
    }

    return null;
  }
}

/**
 * Get the best audio stream URL
 * Prefers highest bitrate audio-only stream
 */
export async function getBestAudioStreamUrl(videoId: string): Promise<string | null> {
  const details = await getVideoStreams(videoId);

  if (!details || !details.audioStreams?.length) {
    return null;
  }

  // Sort by bitrate (highest first) and prefer mp4/m4a
  const sortedStreams = [...details.audioStreams]
    .filter(s => s.mimeType.includes('audio'))
    .sort((a, b) => {
      // Prefer mp4a codec (better compatibility)
      const aIsMp4 = a.mimeType.includes('mp4') ? 1 : 0;
      const bIsMp4 = b.mimeType.includes('mp4') ? 1 : 0;
      if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4;

      // Then by bitrate
      return b.bitrate - a.bitrate;
    });

  return sortedStreams[0]?.url || null;
}

/**
 * Get the best video stream URL for a given quality
 * @param videoId - YouTube video ID
 * @param preferredQuality - '360' | '480' | '720' | '1080' | 'best'
 */
export async function getBestVideoStreamUrl(
  videoId: string,
  preferredQuality: string = '720'
): Promise<string | null> {
  const details = await getVideoStreams(videoId);

  if (!details || !details.videoStreams?.length) {
    return null;
  }

  // Filter video streams (with both video and audio, or video-only)
  const videoStreams = details.videoStreams
    .filter(s => s.mimeType.includes('video'))
    .sort((a, b) => {
      // Sort by quality (height)
      return (b.height || 0) - (a.height || 0);
    });

  if (preferredQuality === 'best') {
    return videoStreams[0]?.url || null;
  }

  // Find closest quality
  const targetHeight = parseInt(preferredQuality);
  const closest = videoStreams.reduce((prev, curr) => {
    const prevDiff = Math.abs((prev.height || 0) - targetHeight);
    const currDiff = Math.abs((curr.height || 0) - targetHeight);
    return currDiff < prevDiff ? curr : prev;
  });

  return closest?.url || null;
}

/**
 * Get both audio and video stream URLs for seamless switching
 * This enables the VOYO magic: switch between audio-only and video modes
 * while maintaining the same playback position!
 */
export async function getStreamUrls(videoId: string): Promise<{
  audioUrl: string | null;
  videoUrl: string | null;
  details: PipedVideoDetails | null;
}> {
  const details = await getVideoStreams(videoId);

  if (!details) {
    return { audioUrl: null, videoUrl: null, details: null };
  }

  // Get best audio stream
  const audioStream = details.audioStreams
    ?.filter(s => s.mimeType.includes('audio'))
    ?.sort((a, b) => b.bitrate - a.bitrate)[0];

  // Get best video stream (720p preferred for mobile)
  const videoStream = details.videoStreams
    ?.filter(s => s.mimeType.includes('video'))
    ?.sort((a, b) => {
      // Prefer 720p
      const aPref = Math.abs((a.height || 0) - 720);
      const bPref = Math.abs((b.height || 0) - 720);
      return aPref - bPref;
    })[0];

  return {
    audioUrl: audioStream?.url || null,
    videoUrl: videoStream?.url || null,
    details,
  };
}

/**
 * Get trending music videos
 * @param region - Country code (e.g., 'NG' for Nigeria, 'ZA' for South Africa)
 */
export async function getTrending(region: string = 'NG'): Promise<VoyoTrackFromSearch[]> {
  const url = `${getApiBase()}/trending?region=${region}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      rotateInstance();
      throw new Error(`Piped API error: ${response.status}`);
    }

    const items = await response.json();

    return items
      .filter((item: any) => !item.isShort)
      .slice(0, 20)
      .map((item: PipedSearchResult) => ({
        id: extractVideoId(item.url),
        title: item.title,
        artist: item.uploaderName,
        youtubeVideoId: extractVideoId(item.url),
        coverUrl: item.thumbnail,
        duration: item.duration,
        views: item.views,
      }));
  } catch (error) {
    console.error('[Piped] Trending error:', error);
    throw error;
  }
}

/**
 * Get related videos (for recommendations)
 */
export async function getRelatedVideos(videoId: string): Promise<VoyoTrackFromSearch[]> {
  const details = await getVideoStreams(videoId);

  if (!details?.relatedStreams) {
    return [];
  }

  return details.relatedStreams
    .filter((item) => !item.isShort)
    .slice(0, 10)
    .map((item) => ({
      id: extractVideoId(item.url),
      title: item.title,
      artist: item.uploaderName,
      youtubeVideoId: extractVideoId(item.url),
      coverUrl: item.thumbnail,
      duration: item.duration,
      views: item.views,
    }));
}

/**
 * Search specifically for African music
 * Helper that adds regional keywords
 */
export async function searchAfricanMusic(query: string): Promise<VoyoTrackFromSearch[]> {
  const enhancedQuery = `${query} african music afrobeats`;
  return searchVideos(enhancedQuery, 'music_songs');
}

/**
 * Health check - test if Piped API is working
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/trending?region=US`);
    return response.ok;
  } catch {
    return false;
  }
}

// Export current instance for debugging
export const getCurrentInstance = () => getApiBase();
