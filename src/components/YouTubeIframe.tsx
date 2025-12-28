/**
 * VOYO Music - Unified YouTube Iframe
 *
 * Single iframe that handles BOTH:
 * 1. Audio streaming (when track not boosted) - UNMUTED
 * 2. Video display (when user wants video)
 *
 * States:
 * - playbackSource === 'cached' → Iframe MUTED (audio from Boost)
 * - playbackSource === 'iframe' → Iframe UNMUTED (audio from stream)
 * - videoTarget === 'hidden' → Iframe hidden (offscreen for audio only)
 * - videoTarget === 'portrait' → Renders in BigCenterCard (swaps with thumbnail)
 * - videoTarget === 'landscape' → Fullscreen fixed position
 */

import { useEffect, useRef, useCallback, memo } from 'react';
import { usePlayerStore } from '../store/playerStore';

const YT_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

function getYouTubeId(trackId: string): string {
  if (!trackId) return '';
  if (trackId.startsWith('VOYO_')) return trackId.replace('VOYO_', '');
  return trackId;
}

export const YouTubeIframe = memo(() => {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isApiLoadedRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const playbackSource = usePlayerStore((s) => s.playbackSource);
  const videoTarget = usePlayerStore((s) => s.videoTarget);
  const seekPosition = usePlayerStore((s) => s.seekPosition);

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setBufferHealth = usePlayerStore((s) => s.setBufferHealth);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const clearSeekPosition = usePlayerStore((s) => s.clearSeekPosition);

  const youtubeId = currentTrack?.trackId ? getYouTubeId(currentTrack.trackId) : '';
  const showVideo = videoTarget !== 'hidden';

  // Load YouTube API
  useEffect(() => {
    if (isApiLoadedRef.current) return;
    if ((window as any).YT?.Player) {
      isApiLoadedRef.current = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);

    (window as any).onYouTubeIframeAPIReady = () => {
      isApiLoadedRef.current = true;
      if (youtubeId) initPlayer(youtubeId);
    };
  }, []);

  const initPlayer = useCallback((videoId: string) => {
    if (!isApiLoadedRef.current || !(window as any).YT?.Player) return;
    if (!containerRef.current) return;
    if (initializingRef.current) return;
    if (playerRef.current && currentVideoIdRef.current === videoId) return;

    initializingRef.current = true;
    currentVideoIdRef.current = videoId;

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
    }

    containerRef.current.innerHTML = '';
    const isBoosted = usePlayerStore.getState().playbackSource === 'cached';

    playerRef.current = new (window as any).YT.Player(containerRef.current, {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        playsinline: 1,
        origin: window.location.origin,
        enablejsapi: 1,
        mute: isBoosted ? 1 : 0,
      },
      events: {
        onReady: (event: any) => {
          initializingRef.current = false;
          const player = event.target;
          const state = usePlayerStore.getState();

          if (state.playbackSource === 'cached') {
            player.setVolume(0);
            player.mute();
          } else {
            player.unMute();
            player.setVolume(state.volume);
            player.playVideo();
            if (!state.isPlaying) usePlayerStore.getState().togglePlay();
          }

          const duration = player.getDuration();
          if (duration > 0) setDuration(duration);
        },
        onStateChange: (event: any) => {
          const ytState = event.data;
          const state = usePlayerStore.getState();

          if (ytState === YT_STATES.ENDED && state.playbackSource === 'iframe') {
            nextTrack();
          } else if (ytState === YT_STATES.PLAYING) {
            setBufferHealth(100, 'healthy');
            if (state.playbackSource === 'iframe' && !state.isPlaying) {
              usePlayerStore.getState().togglePlay();
            }
          } else if (ytState === YT_STATES.BUFFERING) {
            setBufferHealth(50, 'warning');
          }
        },
        onError: (event: any) => {
          console.error('🎬 [VOYO] Iframe error:', event.data);
          setBufferHealth(0, 'emergency');
          initializingRef.current = false;
        },
      },
    });
  }, [setDuration, setBufferHealth, nextTrack]);

  useEffect(() => {
    if (!youtubeId) return;
    const timer = setTimeout(() => {
      if (isApiLoadedRef.current) initPlayer(youtubeId);
    }, 100);
    return () => clearTimeout(timer);
  }, [youtubeId, initPlayer]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (isPlaying) {
        if (state !== YT_STATES.PLAYING && state !== YT_STATES.BUFFERING) {
          playerRef.current.playVideo();
        }
      } else {
        if (state === YT_STATES.PLAYING || state === YT_STATES.BUFFERING) {
          playerRef.current.pauseVideo();
        }
      }
    } catch (e) {}
  }, [isPlaying]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (playbackSource === 'cached') {
        playerRef.current.mute();
        playerRef.current.setVolume(0);
      } else if (playbackSource === 'iframe') {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch (e) {}
  }, [playbackSource, volume]);

  useEffect(() => {
    if (!playerRef.current || playbackSource !== 'iframe') return;
    try { playerRef.current.setVolume(volume); } catch (e) {}
  }, [volume, playbackSource]);

  useEffect(() => {
    if (seekPosition === null || !playerRef.current) return;
    if (playbackSource === 'cached' && showVideo) {
      try { playerRef.current.seekTo(seekPosition, true); } catch (e) {}
    }
    clearSeekPosition();
  }, [seekPosition, playbackSource, showVideo, clearSeekPosition]);

  useEffect(() => {
    if (playbackSource !== 'iframe' || !playerRef.current) return;
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
          setCurrentTime(currentTime);
          setProgress((currentTime / duration) * 100);
        }
      } catch (e) {}
    }, 250);
    return () => clearInterval(interval);
  }, [playbackSource, setCurrentTime, setProgress]);

  // The iframe content
  const iframeContent = (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );

  // Landscape mode: fullscreen fixed
  if (videoTarget === 'landscape') {
    return (
      <div
        id="voyo-iframe-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          transform: 'scale(1.2)',
          transformOrigin: 'center center',
          zIndex: 100,
          pointerEvents: 'none',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {iframeContent}
      </div>
    );
  }

  // Portrait mode: render in-place, filling parent container
  // Scale 16:9 video to COVER square (crop edges, no black bars)
  if (videoTarget === 'portrait') {
    return (
      <div
        id="voyo-iframe-container"
        className="absolute inset-0 z-10 overflow-hidden rounded-[2rem]"
        style={{
          background: '#000',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '177.78%', // 16:9 ratio = 1.7778
            height: '100%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {iframeContent}
        </div>
      </div>
    );
  }

  // Hidden mode: offscreen but active for audio
  return (
    <div
      id="voyo-iframe-container"
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {iframeContent}
    </div>
  );
});

YouTubeIframe.displayName = 'YouTubeIframe';
export default YouTubeIframe;
