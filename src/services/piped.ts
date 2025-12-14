/**
 * VOYO Music - Piped API Integration
 *
 * Connects to YouTube playlists via Piped API to surface albums.
 * Piped is a privacy-focused YouTube frontend with a public API.
 */

const PIPED_API = 'https://pipedapi.kavin.rocks';

export interface PipedPlaylist {
  id: string;
  name: string;
  artist: string;
  thumbnail: string;
  trackCount: number;
}

export interface PipedTrack {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

/**
 * Search for albums (playlists) on YouTube via Piped
 */
export async function searchAlbums(query: string, limit: number = 10): Promise<PipedPlaylist[]> {
  try {
    const response = await fetch(
      `${PIPED_API}/search?q=${encodeURIComponent(query + ' album')}&filter=playlists`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      throw new Error(`Album search failed: ${response.status}`);
    }

    const data = await response.json();

    return (data.items || [])
      .filter((item: any) => item.type === 'playlist')
      .slice(0, limit)
      .map((item: any) => ({
        id: extractPlaylistId(item.url),
        name: cleanAlbumName(item.name),
        artist: cleanArtistName(item.uploaderName || item.uploader || 'Unknown Artist'),
        thumbnail: item.thumbnail || '',
        trackCount: item.videos || 0,
      }));
  } catch (error) {
    console.error('Album search failed:', error);
    return []; // Return empty array, don't crash
  }
}

/**
 * Get tracks from an album/playlist
 */
export async function getAlbumTracks(playlistId: string): Promise<PipedTrack[]> {
  try {
    const response = await fetch(`${PIPED_API}/playlists/${playlistId}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Album fetch failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.relatedStreams || !Array.isArray(data.relatedStreams)) {
      console.error('Invalid album data structure');
      return [];
    }

    return data.relatedStreams.map((stream: any) => ({
      videoId: extractVideoId(stream.url),
      title: stream.title || 'Unknown Track',
      artist: cleanArtistName(stream.uploaderName || data.uploader || 'Unknown Artist'),
      duration: stream.duration || 0,
      thumbnail: stream.thumbnail || data.thumbnailUrl || '',
    }));
  } catch (error) {
    console.error('Album fetch failed:', error);
    return []; // Return empty array, don't crash
  }
}

/**
 * Search for artist albums specifically
 */
export async function searchArtistAlbums(artistName: string, limit: number = 5): Promise<PipedPlaylist[]> {
  // Search with optimized query for artist albums
  const query = `${artistName} album playlist`;
  return searchAlbums(query, limit);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract playlist ID from Piped URL format
 * Example: "/playlist?list=PLxxxxxxxxx" -> "PLxxxxxxxxx"
 */
function extractPlaylistId(url: string): string {
  const match = url.match(/list=([^&]+)/);
  return match ? match[1] : url.replace('/playlist?list=', '');
}

/**
 * Extract video ID from Piped URL format
 * Example: "/watch?v=xxxxxxxxxxx" -> "xxxxxxxxxxx"
 */
function extractVideoId(url: string): string {
  const match = url.match(/v=([^&]+)/);
  if (match) return match[1];

  // Fallback: remove common prefixes
  return url
    .replace('/watch?v=', '')
    .replace('/watch/', '')
    .split('&')[0]; // Remove any query params
}

/**
 * Clean album name by removing common suffixes
 */
function cleanAlbumName(name: string): string {
  return name
    .replace(/\s*\(Full Album\)/gi, '')
    .replace(/\s*\[Full Album\]/gi, '')
    .replace(/\s*- Full Album/gi, '')
    .replace(/\s*\(Official Album\)/gi, '')
    .replace(/\s*\[Official Album\]/gi, '')
    .trim();
}

/**
 * Clean artist name by removing YouTube-specific suffixes
 */
function cleanArtistName(name: string): string {
  return name
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*- Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official$/i, '')
    .trim();
}

/**
 * Check if a playlist looks like an album (heuristics)
 */
export function isLikelyAlbum(playlist: PipedPlaylist): boolean {
  const name = playlist.name.toLowerCase();
  const artist = playlist.artist.toLowerCase();

  // Check for album indicators
  const hasAlbumKeyword = name.includes('album') ||
                          name.includes('ep') ||
                          name.includes('mixtape');

  // Check for "Topic" channel (YouTube Music auto-generated)
  const isTopicChannel = playlist.artist.includes('Topic');

  // Check track count (albums usually have 8-20 tracks)
  const hasReasonableTrackCount = playlist.trackCount >= 5 && playlist.trackCount <= 30;

  return (hasAlbumKeyword || isTopicChannel) && hasReasonableTrackCount;
}
