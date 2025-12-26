/**
 * VOYO Mini Picture-in-Picture
 *
 * Minimal floating album art window for background playback safety.
 * Uses canvas-to-video approach (Chrome 70+, Safari 13.1+).
 *
 * Flow:
 * 1. Create canvas with album art
 * 2. Convert to video stream
 * 3. Request PiP when backgrounded
 * 4. MediaSession handles controls (already implemented)
 */

import { useRef, useCallback, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { getYouTubeThumbnail } from '../data/tracks';

// PiP window size (small and minimal)
const PIP_SIZE = 256;

export function useMiniPiP() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isActiveRef = useRef(false);

  const { currentTrack, isPlaying } = usePlayerStore();

  // Check if PiP is supported
  const isSupported = useCallback(() => {
    return 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  }, []);

  // Initialize canvas and video elements
  const initElements = useCallback(() => {
    if (canvasRef.current) return; // Already initialized

    // Create canvas for album art
    const canvas = document.createElement('canvas');
    canvas.width = PIP_SIZE;
    canvas.height = PIP_SIZE;
    canvasRef.current = canvas;

    // Create video element from canvas stream
    const video = document.createElement('video');
    video.srcObject = canvas.captureStream(1); // 1 FPS is enough for static image
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    videoRef.current = video;

    // Handle PiP window close
    video.addEventListener('leavepictureinpicture', () => {
      isActiveRef.current = false;
      console.log('[VOYO PiP] Mini player closed');
    });

    console.log('[VOYO PiP] Initialized');
  }, []);

  // Draw album art on canvas
  const drawAlbumArt = useCallback(async (trackId: string) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Get thumbnail URL
    const thumbnailUrl = getYouTubeThumbnail(trackId, 'high');

    try {
      // Load image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = thumbnailUrl;
      });

      // Draw centered and cropped to square
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, PIP_SIZE, PIP_SIZE);
      ctx.drawImage(img, sx, sy, size, size, 0, 0, PIP_SIZE, PIP_SIZE);

      console.log('[VOYO PiP] Album art updated');
    } catch (err) {
      // Fallback: gradient background with VOYO text
      const gradient = ctx.createLinearGradient(0, 0, PIP_SIZE, PIP_SIZE);
      gradient.addColorStop(0, '#7c3aed');
      gradient.addColorStop(1, '#ec4899');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PIP_SIZE, PIP_SIZE);

      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VOYO', PIP_SIZE / 2, PIP_SIZE / 2);
    }
  }, []);

  // Enter PiP mode
  const enterPiP = useCallback(async () => {
    if (!isSupported()) {
      console.log('[VOYO PiP] Not supported');
      return false;
    }

    if (isActiveRef.current) {
      console.log('[VOYO PiP] Already active');
      return true;
    }

    initElements();

    if (!videoRef.current || !currentTrack) return false;

    try {
      // Update album art
      await drawAlbumArt(currentTrack.trackId);

      // Play video (required for PiP)
      await videoRef.current.play();

      // Request PiP
      await videoRef.current.requestPictureInPicture();
      isActiveRef.current = true;

      console.log('[VOYO PiP] Entered mini player mode');
      return true;
    } catch (err) {
      console.warn('[VOYO PiP] Failed to enter:', err);
      return false;
    }
  }, [isSupported, initElements, drawAlbumArt, currentTrack]);

  // Exit PiP mode
  const exitPiP = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      isActiveRef.current = false;
      console.log('[VOYO PiP] Exited mini player mode');
    } catch (err) {
      // Ignore errors
    }
  }, []);

  // Toggle PiP
  const togglePiP = useCallback(async () => {
    if (isActiveRef.current) {
      await exitPiP();
    } else {
      await enterPiP();
    }
  }, [enterPiP, exitPiP]);

  // Update album art when track changes (while PiP is active)
  useEffect(() => {
    if (isActiveRef.current && currentTrack) {
      drawAlbumArt(currentTrack.trackId);
    }
  }, [currentTrack?.trackId, drawAlbumArt]);

  // Auto-enter PiP when app goes to background (optional - can be enabled)
  // Disabled by default - user can trigger manually or we can enable later
  /*
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isPlaying && currentTrack) {
        enterPiP();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, currentTrack, enterPiP]);
  */

  // Cleanup
  useEffect(() => {
    return () => {
      exitPiP();
      if (videoRef.current) {
        videoRef.current.remove();
      }
    };
  }, [exitPiP]);

  return {
    isSupported: isSupported(),
    isActive: isActiveRef.current,
    enterPiP,
    exitPiP,
    togglePiP,
  };
}
