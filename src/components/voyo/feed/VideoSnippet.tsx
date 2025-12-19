/**
 * VideoSnippet - Embedded Video Player for Feed Cards
 *
 * Fetches video stream from Piped API and displays as background
 * Video is MUTED - audio comes from our AudioPlayer engine
 * Syncs video position with audio playback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Film, WifiOff } from 'lucide-react';
import { getVideoStreamUrl } from '../../../services/piped';
import { usePlayerStore } from '../../../store/playerStore';

interface VideoSnippetProps {
  trackId: string; // YouTube video ID
  isActive: boolean;
  isPlaying: boolean;
  isThisTrack: boolean;
  fallbackThumbnail?: string;
  onVideoReady?: () => void;
  onVideoError?: () => void;
}

export const VideoSnippet = ({
  trackId,
  isActive,
  isPlaying,
  isThisTrack,
  fallbackThumbnail,
  onVideoReady,
  onVideoError,
}: VideoSnippetProps) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { currentTime, progress } = usePlayerStore();

  // Decode VOYO ID to YouTube ID if needed
  const getYoutubeId = useCallback((id: string): string => {
    if (!id.startsWith('vyo_')) return id;

    const encoded = id.substring(4);
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    try {
      return atob(base64);
    } catch {
      return id;
    }
  }, []);

  // Fetch video stream URL when card becomes active
  useEffect(() => {
    if (!isActive || videoUrl) return;

    const fetchVideo = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const youtubeId = getYoutubeId(trackId);
        const url = await getVideoStreamUrl(youtubeId, '480p');

        if (url) {
          setVideoUrl(url);
          console.log(`[VideoSnippet] Got video URL for ${youtubeId}`);
        } else {
          setHasError(true);
          onVideoError?.();
        }
      } catch (error) {
        console.error('[VideoSnippet] Failed to fetch video:', error);
        setHasError(true);
        onVideoError?.();
      }

      setIsLoading(false);
    };

    fetchVideo();
  }, [isActive, trackId, videoUrl, getYoutubeId, onVideoError]);

  // Control video playback based on audio state
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    if (isPlaying && isThisTrack) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked - that's fine, video is supplementary
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, isThisTrack, videoUrl]);

  // Sync video position with audio (every 3 seconds to avoid constant seeking)
  useEffect(() => {
    if (!videoRef.current || !isThisTrack || !isPlaying) return;

    const video = videoRef.current;
    const audioDuration = usePlayerStore.getState().duration;

    if (audioDuration > 0) {
      const targetTime = (progress / 100) * audioDuration;
      const currentVideoTime = video.currentTime;

      // Only seek if more than 2 seconds out of sync
      if (Math.abs(currentVideoTime - targetTime) > 2) {
        video.currentTime = targetTime;
      }
    }
  }, [progress, isThisTrack, isPlaying]);

  // Handle video loaded
  const handleVideoLoaded = () => {
    setShowVideo(true);
    onVideoReady?.();
  };

  // Handle video error
  const handleVideoError = () => {
    setHasError(true);
    setShowVideo(false);
    onVideoError?.();
  };

  // Show loading state
  if (isLoading && isActive) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
        <motion.div
          className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // Show error/fallback state
  if (hasError || !videoUrl) {
    return (
      <>
        {/* Show thumbnail as fallback */}
        {fallbackThumbnail && (
          <motion.img
            src={fallbackThumbnail}
            alt="Track thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
            animate={{
              scale: isPlaying && isThisTrack ? [1, 1.02, 1] : 1,
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        {/* Video unavailable indicator */}
        {hasError && isActive && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-white/60 text-xs">
            <WifiOff className="w-3 h-3" />
            <span>Video unavailable</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Fallback thumbnail (shows while video loads) */}
      {!showVideo && fallbackThumbnail && (
        <img
          src={fallbackThumbnail}
          alt="Track thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Video element */}
      <motion.video
        ref={videoRef}
        src={videoUrl}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          showVideo ? 'opacity-100' : 'opacity-0'
        }`}
        muted // Audio comes from our AudioPlayer
        playsInline
        loop={false}
        preload="auto"
        onLoadedData={handleVideoLoaded}
        onError={handleVideoError}
        initial={{ opacity: 0 }}
        animate={{ opacity: showVideo ? 1 : 0 }}
      />

      {/* Video playing indicator */}
      {showVideo && isPlaying && isThisTrack && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-white/80 text-xs">
          <Film className="w-3 h-3 text-purple-400" />
          <span>Video</span>
        </div>
      )}
    </>
  );
};

export default VideoSnippet;
