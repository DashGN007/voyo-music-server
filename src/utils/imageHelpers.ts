/**
 * Image Helper Utilities for VOYO Music
 * Handles fallbacks between coverUrl and getThumbnailUrl
 */

import { Track } from '../types';
import { getThumbnailUrl as getThumb } from '../data/tracks';

/**
 * Get the best available thumbnail URL for a track
 * Prioritizes track.coverUrl (from search results) over generated thumbnail URLs
 */
export function getTrackThumbnailUrl(
  track: Track,
  quality: 'default' | 'medium' | 'high' | 'max' = 'high'
): string {
  // If coverUrl is set (from search results), use it
  if (track.coverUrl && track.coverUrl.startsWith('http')) {
    return track.coverUrl;
  }

  // Otherwise generate from trackId
  return getThumb(track.trackId, quality);
}

/**
 * Get thumbnail URL from either a full URL or trackId
 */
export function getThumbnailUrl(
  source: string | Track,
  quality: 'default' | 'medium' | 'high' | 'max' = 'high'
): string {
  // If it's a Track object
  if (typeof source === 'object' && source !== null) {
    return getTrackThumbnailUrl(source, quality);
  }

  // If it's already a full URL
  if (typeof source === 'string' && source.startsWith('http')) {
    return source;
  }

  // Otherwise it's a trackId, generate URL
  return getThumb(source as string, quality);
}
