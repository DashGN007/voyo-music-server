/**
 * VOYO Music - Piped Player Hook
 *
 * Handles seamless audio↔video switching using Piped API
 * The VOYO magic: Switch between audio-only and video modes
 * while maintaining the exact playback position!
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getStreamUrls, PipedVideoDetails } from '../services/piped';

export type PlayerMode = 'audio' | 'video';

interface UsePipedPlayerOptions {
  initialMode?: PlayerMode;
  preferredVideoQuality?: '360' | '480' | '720' | '1080';
  onError?: (error: Error) => void;
  onModeChange?: (mode: PlayerMode) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

interface UsePipedPlayerReturn {
  // Refs for direct access
  audioRef: React.RefObject<HTMLAudioElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;

  // State
  isLoading: boolean;
  isPlaying: boolean;
  currentMode: PlayerMode;
  currentTime: number;
  duration: number;
  buffered: number;
  videoDetails: PipedVideoDetails | null;

  // Stream URLs
  audioUrl: string | null;
  videoUrl: string | null;

  // Actions
  loadTrack: (videoId: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  switchMode: (mode: PlayerMode) => Promise<void>;
  toggleMode: () => Promise<void>;

  // Volume
  volume: number;
  setVolume: (vol: number) => void;
  muted: boolean;
  toggleMute: () => void;
}

export function usePipedPlayer(options: UsePipedPlayerOptions = {}): UsePipedPlayerReturn {
  const {
    initialMode = 'audio',
    onError,
    onModeChange,
    onTimeUpdate,
    onEnded,
  } = options;

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMode, setCurrentMode] = useState<PlayerMode>(initialMode);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);

  // Stream data
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<PipedVideoDetails | null>(null);

  // Track currently loaded video ID
  const currentVideoIdRef = useRef<string | null>(null);

  // Get the active player element based on mode
  const getActivePlayer = useCallback((): HTMLAudioElement | HTMLVideoElement | null => {
    return currentMode === 'audio' ? audioRef.current : videoRef.current;
  }, [currentMode]);

  // Load a track by YouTube video ID
  const loadTrack = useCallback(async (videoId: string) => {
    setIsLoading(true);

    try {
      const { audioUrl: newAudioUrl, videoUrl: newVideoUrl, details } = await getStreamUrls(videoId);

      if (!newAudioUrl) {
        throw new Error('Failed to get audio stream URL');
      }

      setAudioUrl(newAudioUrl);
      setVideoUrl(newVideoUrl);
      setVideoDetails(details);
      currentVideoIdRef.current = videoId;

      // Reset playback state
      setCurrentTime(0);
      setDuration(details?.duration || 0);
      setIsPlaying(false);

      // Load into the current player
      const player = getActivePlayer();
      if (player) {
        player.src = currentMode === 'audio' ? newAudioUrl : (newVideoUrl || newAudioUrl);
        player.load();
      }
    } catch (error) {
      console.error('[usePipedPlayer] Load error:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMode, getActivePlayer, onError]);

  // Play
  const play = useCallback(async () => {
    const player = getActivePlayer();
    if (player) {
      try {
        await player.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('[usePipedPlayer] Play error:', error);
        onError?.(error as Error);
      }
    }
  }, [getActivePlayer, onError]);

  // Pause
  const pause = useCallback(() => {
    const player = getActivePlayer();
    if (player) {
      player.pause();
      setIsPlaying(false);
    }
  }, [getActivePlayer]);

  // Seek
  const seek = useCallback((time: number) => {
    const player = getActivePlayer();
    if (player) {
      player.currentTime = time;
      setCurrentTime(time);
    }
  }, [getActivePlayer]);

  // Switch between audio and video mode - THE MAGIC!
  const switchMode = useCallback(async (newMode: PlayerMode) => {
    if (newMode === currentMode) return;

    const currentPlayer = getActivePlayer();
    const savedTime = currentPlayer?.currentTime || currentTime;
    const wasPlaying = isPlaying;

    // Pause current player
    if (currentPlayer) {
      currentPlayer.pause();
    }

    // Update mode
    setCurrentMode(newMode);

    // Wait for next tick to get new player
    await new Promise(resolve => setTimeout(resolve, 0));

    // Get the new player
    const newPlayer = newMode === 'audio' ? audioRef.current : videoRef.current;

    if (newPlayer) {
      // Set the correct source
      const newUrl = newMode === 'audio' ? audioUrl : (videoUrl || audioUrl);
      if (newUrl && newPlayer.src !== newUrl) {
        newPlayer.src = newUrl;
      }

      // Resume at the same position!
      newPlayer.currentTime = savedTime;

      // Resume playback if it was playing
      if (wasPlaying) {
        try {
          await newPlayer.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('[usePipedPlayer] Resume error:', error);
        }
      }
    }

    onModeChange?.(newMode);
  }, [currentMode, currentTime, isPlaying, audioUrl, videoUrl, getActivePlayer, onModeChange]);

  // Toggle between modes
  const toggleMode = useCallback(async () => {
    await switchMode(currentMode === 'audio' ? 'video' : 'audio');
  }, [currentMode, switchMode]);

  // Volume control
  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);

    if (audioRef.current) audioRef.current.volume = clampedVol;
    if (videoRef.current) videoRef.current.volume = clampedVol;
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const newMuted = !prev;
      if (audioRef.current) audioRef.current.muted = newMuted;
      if (videoRef.current) videoRef.current.muted = newMuted;
      return newMuted;
    });
  }, []);

  // Time update handler
  useEffect(() => {
    const handleTimeUpdate = () => {
      const player = getActivePlayer();
      if (player) {
        setCurrentTime(player.currentTime);
        onTimeUpdate?.(player.currentTime, player.duration);
      }
    };

    const handleDurationChange = () => {
      const player = getActivePlayer();
      if (player && player.duration) {
        setDuration(player.duration);
      }
    };

    const handleProgress = () => {
      const player = getActivePlayer();
      if (player && player.buffered.length > 0) {
        setBuffered(player.buffered.end(player.buffered.length - 1));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // Attach to both players
    const audio = audioRef.current;
    const video = videoRef.current;

    const attachListeners = (el: HTMLMediaElement | null) => {
      if (!el) return;
      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('durationchange', handleDurationChange);
      el.addEventListener('progress', handleProgress);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('play', handlePlay);
      el.addEventListener('pause', handlePause);
    };

    const removeListeners = (el: HTMLMediaElement | null) => {
      if (!el) return;
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('durationchange', handleDurationChange);
      el.removeEventListener('progress', handleProgress);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
    };

    attachListeners(audio);
    attachListeners(video);

    return () => {
      removeListeners(audio);
      removeListeners(video);
    };
  }, [getActivePlayer, onTimeUpdate, onEnded]);

  // Sync volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  return {
    audioRef,
    videoRef,
    isLoading,
    isPlaying,
    currentMode,
    currentTime,
    duration,
    buffered,
    videoDetails,
    audioUrl,
    videoUrl,
    loadTrack,
    play,
    pause,
    seek,
    switchMode,
    toggleMode,
    volume,
    setVolume,
    muted,
    toggleMute,
  };
}

export default usePipedPlayer;
