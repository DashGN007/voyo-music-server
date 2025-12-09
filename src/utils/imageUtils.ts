/**
 * VOYO Music - Image Utilities
 * Bulletproof thumbnail system with fallback chains and caching
 */

// YouTube thumbnail quality chain (best to worst)
export const THUMBNAIL_QUALITIES = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'] as const;

export type ThumbnailQuality = typeof THUMBNAIL_QUALITIES[number];

/**
 * Generate YouTube thumbnail URL with specific quality
 */
export const getYouTubeThumbnail = (trackId: string, quality: ThumbnailQuality): string => {
  return `https://i.ytimg.com/vi/${trackId}/${quality}.jpg`;
};

/**
 * Get all possible thumbnail URLs for a track (fallback chain)
 */
export const getThumbnailFallbackChain = (trackId: string): string[] => {
  return THUMBNAIL_QUALITIES.map(q => getYouTubeThumbnail(trackId, q));
};

/**
 * Generate a hash code from a string (for color generation)
 */
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Generate placeholder SVG with gradient and initial letter
 */
export const generatePlaceholder = (title: string, size: number = 200): string => {
  const initial = title.charAt(0).toUpperCase();
  const hash = hashCode(title);

  // Generate gradient colors based on hash
  const hue1 = hash % 360;
  const hue2 = (hash + 60) % 360;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1}, 70%, 50%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue2}, 70%, 40%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${size * 0.4}"
        font-weight="bold"
        fill="white"
        opacity="0.9"
      >${initial}</text>
    </svg>
  `.trim();

  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Preload an image and return success status
 */
export const preloadImage = (src: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
};

/**
 * Find first working thumbnail from fallback chain
 * Returns the URL if found, null otherwise
 */
export const findWorkingThumbnail = async (trackId: string): Promise<string | null> => {
  const chain = getThumbnailFallbackChain(trackId);

  for (const url of chain) {
    const success = await preloadImage(url);
    if (success) {
      return url;
    }
  }

  return null;
};

/**
 * Get thumbnail quality from URL
 */
export const getThumbnailQualityFromUrl = (url: string): ThumbnailQuality | null => {
  for (const quality of THUMBNAIL_QUALITIES) {
    if (url.includes(`/${quality}.jpg`)) {
      return quality;
    }
  }
  return null;
};

/**
 * Extract trackId from YouTube thumbnail URL
 */
export const extractTrackIdFromUrl = (url: string): string | null => {
  const match = url.match(/\/vi\/([^\/]+)\//);
  return match ? match[1] : null;
};
