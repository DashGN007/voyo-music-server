// VOYO Music - YouTube Player Hook
// Manages YouTube IFrame API integration for audio/video playback
import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

// YouTube Player State Constants
const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
}

interface UseYouTubePlayerOptions {
  containerId: string;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onError?: (error: number) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          height: string | number;
          width: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: typeof YT_PLAYER_STATE;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Load YouTube IFrame API script
const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    // Check if script is already loading
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';

    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });
};

export const useYouTubePlayer = ({ containerId, onReady, onStateChange, onError }: UseYouTubePlayerOptions) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const {
    currentTrack,
    isPlaying,
    volume,
    setProgress,
    setCurrentTime,
    nextTrack,
  } = usePlayerStore();

  // Initialize YouTube API
  useEffect(() => {
    loadYouTubeAPI().then(() => {
      setIsAPIReady(true);
    });
  }, []);

  // Create player when API is ready
  useEffect(() => {
    if (!isAPIReady || !currentTrack) return;

    // Wait for container to exist
    const container = document.getElementById(containerId);
    if (!container) return;

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Player might already be destroyed
      }
    }

    // Create new player
    playerRef.current = new window.YT.Player(containerId, {
      height: '100%',
      width: '100%',
      videoId: currentTrack.youtubeVideoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        showinfo: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          setIsPlayerReady(true);
          event.target.setVolume(volume);
          onReady?.();
        },
        onStateChange: (event) => {
          onStateChange?.(event.data);

          // Handle track ended
          if (event.data === YT_PLAYER_STATE.ENDED) {
            nextTrack();
          }
        },
        onError: (event) => {
          console.error('YouTube Player Error:', event.data);
          onError?.(event.data);
        },
      },
    });

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isAPIReady, containerId, currentTrack?.id]);

  // Handle play/pause state
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      // Player might not be ready
    }
  }, [isPlaying, isPlayerReady]);

  // Handle volume changes
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      playerRef.current.setVolume(volume);
    } catch (e) {
      // Player might not be ready
    }
  }, [volume, isPlayerReady]);

  // Progress tracking
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        try {
          const currentTime = playerRef.current?.getCurrentTime() || 0;
          const duration = playerRef.current?.getDuration() || 1;
          const progress = (currentTime / duration) * 100;

          setCurrentTime(currentTime);
          setProgress(progress);
        } catch (e) {
          // Player might be in invalid state
        }
      }, 250);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, isPlayerReady, setProgress, setCurrentTime]);

  // Load new video when track changes
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || !currentTrack) return;

    try {
      playerRef.current.loadVideoById(currentTrack.youtubeVideoId);
      if (isPlaying) {
        playerRef.current.playVideo();
      }
    } catch (e) {
      // Player might not be ready for new video
    }
  }, [currentTrack?.youtubeVideoId]);

  // Seek function
  const seek = useCallback((seconds: number) => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      playerRef.current.seekTo(seconds, true);
    } catch (e) {
      // Player might not be ready
    }
  }, [isPlayerReady]);

  // Seek to percentage
  const seekToPercent = useCallback((percent: number) => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      const duration = playerRef.current.getDuration();
      const seconds = (percent / 100) * duration;
      playerRef.current.seekTo(seconds, true);
    } catch (e) {
      // Player might not be ready
    }
  }, [isPlayerReady]);

  // Get duration
  const getDuration = useCallback(() => {
    if (!playerRef.current || !isPlayerReady) return 0;

    try {
      return playerRef.current.getDuration();
    } catch (e) {
      return 0;
    }
  }, [isPlayerReady]);

  return {
    isAPIReady,
    isPlayerReady,
    seek,
    seekToPercent,
    getDuration,
    player: playerRef.current,
  };
};
