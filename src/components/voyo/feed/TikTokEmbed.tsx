/**
 * TikTokEmbed - Embed TikTok Videos in VOYO Feed
 *
 * Strategy: "Steal content like IG did with Vine"
 * - Embed trending TikTok videos
 * - Match them with VOYO music (mute TikTok, play VOYO audio)
 * - Song starts from beginning for these
 *
 * TikTok Embed URL format:
 * https://www.tiktok.com/embed/v2/{VIDEO_ID}
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Film, Play, Loader2 } from 'lucide-react';

interface TikTokEmbedProps {
  videoId: string; // TikTok video ID
  isActive: boolean;
  isPlaying: boolean;
  fallbackThumbnail?: string;
  onReady?: () => void;
  onError?: () => void;
}

// TikTok embed URL builder
const getTikTokEmbedUrl = (videoId: string): string => {
  const params = new URLSearchParams({
    hide_share_button: '1',
    hide_download_button: '1',
    muted: '1', // We control audio with VOYO
    autoplay: '1',
    loop: '1',
  });
  return `https://www.tiktok.com/embed/v2/${videoId}?${params.toString()}`;
};

// Alternative: Use TikTok's oEmbed API for getting video info
const getTikTokVideoInfo = async (videoUrl: string): Promise<{
  title: string;
  author_name: string;
  thumbnail_url: string;
  html: string;
} | null> => {
  try {
    const response = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const TikTokEmbed = ({
  videoId,
  isActive,
  isPlaying,
  fallbackThumbnail,
  onReady,
  onError,
}: TikTokEmbedProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build embed URL
  const embedUrl = getTikTokEmbedUrl(videoId);

  // Load iframe when active
  useEffect(() => {
    if (isActive && !showIframe) {
      const timer = setTimeout(() => {
        setShowIframe(true);
        console.log(`[TikTokEmbed] Loading TikTok video ${videoId}`);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, showIframe, videoId]);

  // Handle iframe load
  const handleLoad = () => {
    setIsLoaded(true);
    onReady?.();
    console.log(`[TikTokEmbed] ✅ TikTok video loaded: ${videoId}`);
  };

  // Handle errors
  const handleError = () => {
    onError?.();
    console.error(`[TikTokEmbed] ❌ Failed to load TikTok: ${videoId}`);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Fallback thumbnail */}
      {fallbackThumbnail && (
        <motion.img
          src={fallbackThumbnail}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
          animate={{
            opacity: isLoaded ? 0 : 1,
            scale: isPlaying ? [1, 1.02, 1] : 1,
          }}
          transition={{
            scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.5 },
          }}
        />
      )}

      {/* TikTok iframe */}
      {showIframe && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          style={{
            // Scale up to fill container and hide TikTok UI
            transform: 'scale(1.3)',
            transformOrigin: 'center center',
          }}
        >
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="absolute inset-0 w-full h-full pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            onLoad={handleLoad}
            onError={handleError}
            style={{ border: 'none' }}
          />
        </motion.div>
      )}

      {/* Loading spinner */}
      {isActive && showIframe && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-10 h-10 text-pink-500" />
          </motion.div>
        </div>
      )}

      {/* TikTok badge */}
      {isLoaded && isActive && (
        <motion.div
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Film className="w-3 h-3 text-pink-400" />
          <span className="text-white/90 text-xs font-medium">TikTok</span>
        </motion.div>
      )}

      {/* Play overlay when paused */}
      {isLoaded && isActive && !isPlaying && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play className="w-10 h-10 text-white ml-1" style={{ fill: 'white' }} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

// ============================================
// TIKTOK CONTENT MATCHING
// ============================================

// Sample matched content (TikTok video ID -> VOYO track ID)
// In production, this would come from a database/API
export interface TikTokMatch {
  tiktokId: string;
  tiktokUrl: string; // Full TikTok URL
  trackId: string; // VOYO track to play with this video
  trackTitle: string;
  trackArtist: string;
  thumbnail?: string;
  description?: string;
  creator?: string; // TikTok creator username
  tags?: string[];
}

// Trending TikToks matched with VOYO tracks
export const MATCHED_TIKTOKS: TikTokMatch[] = [
  // These are example IDs - in production, scrape trending TikToks
  // and match them with appropriate music from VOYO library
];

// API to fetch and match TikToks with VOYO music
export const fetchMatchedTikToks = async (count = 10): Promise<TikTokMatch[]> => {
  // In production:
  // 1. Fetch trending TikToks from TikTok's public feeds
  // 2. Analyze the audio/content
  // 3. Match with appropriate VOYO tracks
  // 4. Return matched content

  // For now, return mock data
  return MATCHED_TIKTOKS.slice(0, count);
};

// Extract TikTok video ID from URL
export const extractTikTokId = (url: string): string | null => {
  // Handle various TikTok URL formats:
  // https://www.tiktok.com/@user/video/1234567890
  // https://vm.tiktok.com/ABC123/
  // https://www.tiktok.com/t/ABC123/

  const patterns = [
    /\/video\/(\d+)/,
    /\/v\/(\d+)/,
    /tiktok\.com\/t\/([A-Za-z0-9]+)/,
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

export default TikTokEmbed;
