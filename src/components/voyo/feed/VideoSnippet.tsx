/**
 * VideoSnippet - YouTube iFrame Video for Feed Cards
 *
 * SIMPLE ARCHITECTURE:
 * - YouTube provides BOTH video AND audio (native sync)
 * - Only ACTIVE card plays (via postMessage control)
 * - Preloaded cards are paused until they become active
 * - No separate AudioPlayer - YouTube handles everything
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Film, Play } from 'lucide-react';

interface VideoSnippetProps {
  trackId: string; // YouTube video ID or VOYO ID
  isActive: boolean;
  isPlaying: boolean;
  isThisTrack: boolean;
  shouldPreload?: boolean; // Preload this video (for upcoming cards)
  fallbackThumbnail?: string;
  onVideoReady?: () => void;
  onVideoError?: () => void;
}

export const VideoSnippet = ({
  trackId,
  isActive,
  isPlaying,
  isThisTrack,
  shouldPreload = false,
  fallbackThumbnail,
  onVideoReady,
  onVideoError,
}: VideoSnippetProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Decode VOYO ID to YouTube ID if needed
  const youtubeId = useMemo(() => {
    if (!trackId.startsWith('vyo_')) return trackId;

    const encoded = trackId.substring(4);
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    try {
      return atob(base64);
    } catch {
      return trackId;
    }
  }, [trackId]);

  // Build YouTube embed URL with optimal params
  // SIMPLE & CLEAN: YouTube provides BOTH video AND audio (native sync)
  // NOTE: autoplay=0 because we control playback via postMessage (prevents preloaded cards from playing)
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '0', // NO autoplay - we control via postMessage when card becomes active
      mute: '0', // NOT muted - audio comes from YouTube
      controls: '0',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3', // Hide annotations
      loop: '0',
      modestbranding: '1',
      playsinline: '1',
      rel: '0',
      showinfo: '0',
      enablejsapi: '1', // Enable JS API for control
      origin: window.location.origin,
    });

    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }, [youtubeId]);

  // Load iframe when card becomes active OR when preloading next cards
  useEffect(() => {
    if (isActive && !showIframe) {
      // Immediate load for active card (no delay - preloading handles smoothness)
      setShowIframe(true);
      console.log(`[VideoSnippet] Loading YouTube iframe for ${youtubeId}`);
    }
  }, [isActive, showIframe, youtubeId]);

  // PRELOAD: Start loading iframe for upcoming cards
  // This creates a buffer zone for smoother transitions
  useEffect(() => {
    if (shouldPreload && !isActive && !showIframe) {
      // Preload iframe for next 2 cards
      const preloadTimer = setTimeout(() => {
        setShowIframe(true);
        console.log(`[VideoSnippet] 🔄 Preloading YouTube iframe for ${youtubeId}`);
      }, 300); // 300ms delay to stagger preloads

      return () => clearTimeout(preloadTimer);
    }
  }, [shouldPreload, isActive, showIframe, youtubeId]);

  // Control playback via postMessage - SIMPLE: active card plays, others pause
  useEffect(() => {
    if (!iframeRef.current || !isLoaded) return;

    const iframe = iframeRef.current;

    if (isActive) {
      // Active card: PLAY (this is the only card that should have audio)
      iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      console.log(`[VideoSnippet] ▶️ Playing: ${youtubeId}`);
    } else {
      // Inactive cards: PAUSE (prevents audio interference from preloaded cards)
      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }
  }, [isActive, isLoaded, youtubeId]);

  // Detect YouTube errors (geo-blocked, unavailable, etc.)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // YouTube error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=blocked
        if (data.event === 'onError' || data.info?.errorCode) {
          const errorCode = data.info?.errorCode || data.errorCode;
          console.error(`[VideoSnippet] ❌ YouTube error ${errorCode} for ${youtubeId}`);
          setHasError(true);
          onVideoError?.();
        }

        // Also detect "unplayable" state
        if (data.event === 'onStateChange' && data.info === -1) {
          // -1 = unstarted/unplayable after attempt
          setTimeout(() => {
            if (!isLoaded) {
              console.warn(`[VideoSnippet] ⚠️ Video unplayable: ${youtubeId}`);
              setHasError(true);
              onVideoError?.();
            }
          }, 3000);
        }
      } catch {
        // Not JSON, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [youtubeId, isLoaded, onVideoError]);

  // Timeout fallback - if iframe doesn't load in 8s, assume blocked
  useEffect(() => {
    if (!showIframe || isLoaded || hasError) return;

    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn(`[VideoSnippet] ⏱️ Load timeout for ${youtubeId} - assuming blocked`);
        setHasError(true);
        onVideoError?.();
      }
    }, 8000);

    return () => clearTimeout(timeout);
  }, [showIframe, isLoaded, hasError, youtubeId, onVideoError]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoaded(true);
    onVideoReady?.();
    console.log(`[VideoSnippet] ✅ YouTube iframe loaded for ${youtubeId}`);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Fallback thumbnail (shows while iframe loads) */}
      {fallbackThumbnail && (
        <motion.img
          src={fallbackThumbnail}
          alt="Track thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
          animate={{
            scale: isPlaying && isThisTrack ? [1, 1.02, 1] : 1,
            opacity: isLoaded ? 0 : 1,
          }}
          transition={{
            scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.5 },
          }}
        />
      )}

      {/* YouTube iframe - FULL SCREEN video fill */}
      {showIframe && (
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {/*
            Full screen video container
            16:9 video filling 9:16 portrait = need ~3.16x width scale
            Using fixed viewport units for true full screen
          */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            onLoad={handleIframeLoad}
            style={{
              border: 'none',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              // 16:9 video needs to be scaled to fill 9:16 portrait
              // Width = height * (16/9) to maintain aspect while filling height
              width: '177.78vh', // 100vh * (16/9)
              height: '100vh',
              minWidth: '100vw', // Ensure it's at least full width too
              minHeight: '56.25vw', // 100vw * (9/16) - fallback for landscape
            }}
          />
        </motion.div>
      )}

      {/* Loading indicator */}
      {isActive && showIframe && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-12 h-12 rounded-full border-3 border-purple-500/30 border-t-purple-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* Video indicator badge */}
      {isLoaded && isActive && (
        <motion.div
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Film className="w-3 h-3 text-purple-400" />
          <span className="text-white/90 text-xs font-medium">Video</span>
          {isPlaying && isThisTrack && (
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>
      )}

      {/* Play button overlay when paused */}
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

export default VideoSnippet;
