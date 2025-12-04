// VOYO Music - Track Card Component
// Supports: Card View, Lyrics View, Video View, Feed View (tap to cycle)
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, Video, Mic2, Layers, Maximize2 } from 'lucide-react';
import { Track, ViewMode } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { ProgressBar } from '../player/ProgressBar';
import { getYouTubeThumbnail } from '../../data/tracks';

interface TrackCardProps {
  track: Track;
  variant: 'main' | 'history' | 'queue';
  isActive?: boolean;
  onTap?: () => void;
}

export const TrackCard = ({ track, variant, isActive = false }: TrackCardProps) => {
  const {
    currentTrack,
    isPlaying,
    viewMode,
    togglePlay,
    cycleViewMode,
    setCurrentTrack,
  } = usePlayerStore();

  const [tapCount, setTapCount] = useState(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Get the best available thumbnail URL
  const getCoverUrl = () => {
    if (imageError) {
      // Fallback to hqdefault if maxres fails
      return getYouTubeThumbnail(track.youtubeVideoId, 'high');
    }
    return track.coverUrl;
  };

  const isCurrentTrack = currentTrack?.id === track.id;

  // Handle tap interactions for main card
  const handleTap = () => {
    if (variant !== 'main') {
      setCurrentTrack(track);
      return;
    }

    setTapCount((prev) => prev + 1);

    if (tapTimeout.current) {
      clearTimeout(tapTimeout.current);
    }

    tapTimeout.current = setTimeout(() => {
      const taps = tapCount + 1;
      setTapCount(0);

      if (taps === 1) {
        cycleViewMode();
      } else if (taps === 2) {
        usePlayerStore.getState().toggleVideoMode();
      } else if (taps >= 3) {
        usePlayerStore.getState().setViewMode('feed');
      }
    }, 250);
  };

  const handleLongPress = () => {
    if (variant === 'main') {
      usePlayerStore.getState().setViewMode('feed');
    }
  };

  const getCardSize = () => {
    switch (variant) {
      case 'main':
        return 'w-64 h-80 md:w-72 md:h-96';
      case 'history':
      case 'queue':
        return 'w-36 h-48 md:w-44 md:h-56';
      default:
        return 'w-64 h-80';
    }
  };

  const getCardStyles = () => {
    if (variant === 'history') {
      return 'opacity-60 saturate-50 scale-90';
    }
    if (variant === 'queue') {
      return 'opacity-80 scale-95';
    }
    return '';
  };

  return (
    <motion.div
      className={`
        relative flex-shrink-0 rounded-3xl overflow-hidden cursor-pointer
        ${getCardSize()}
        ${getCardStyles()}
        ${isActive ? 'ring-2 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]' : 'shadow-2xl'}
        transition-all duration-500 ease-out
      `}
      onClick={handleTap}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      whileHover={{
        scale: variant === 'main' ? 1.02 : 1.08,
        opacity: 1,
        filter: 'saturate(1)'
      }}
      whileTap={{ scale: 0.96 }}
      layout
    >
      {/* Background - Image or Video based on viewMode */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {variant === 'main' && viewMode === 'video' && isCurrentTrack ? (
            // Video Preview Mode - Show embedded YouTube video
            <motion.div
              key="video"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${track.youtubeVideoId}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&loop=1&playlist=${track.youtubeVideoId}&enablejsapi=1`}
                className="w-full h-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none', pointerEvents: 'none' }}
              />
              {/* Fullscreen button overlay */}
              <motion.button
                className="absolute top-14 right-4 p-2 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-colors z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  usePlayerStore.getState().toggleVideoMode();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </motion.button>
            </motion.div>
          ) : (
            // Cover Art Mode
            <motion.div
              key="cover"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50 animate-pulse" />
              )}
              <img
                src={getCoverUrl()}
                alt={track.title}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  if (!imageError) {
                    setImageError(true);
                    setImageLoaded(false);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Multi-layer gradient overlay for depth - reduced in video mode */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black to-transparent transition-opacity duration-300 ${
        variant === 'main' && viewMode === 'video' ? 'via-transparent opacity-70' : 'via-black/30'
      }`} />
      {viewMode !== 'video' && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
      )}

      {/* Glow effect for active card */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 via-transparent to-transparent" />
      )}

      {/* View Mode Indicator (Main Card Only) - Clickable! */}
      {variant === 'main' && (
        <div className="absolute top-4 right-4 flex gap-1.5">
          {[
            { mode: 'card' as ViewMode, icon: Music },
            { mode: 'lyrics' as ViewMode, icon: Mic2 },
            { mode: 'video' as ViewMode, icon: Video },
            { mode: 'feed' as ViewMode, icon: Layers },
          ].map(({ mode, icon: Icon }) => (
            <motion.button
              key={mode}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-300 cursor-pointer ${
                viewMode === mode
                  ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
                  : 'bg-black/40 hover:bg-black/60'
              }`}
              animate={{ scale: viewMode === mode ? 1.1 : 1 }}
              onClick={(e) => {
                e.stopPropagation();
                usePlayerStore.getState().setViewMode(mode);
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-3.5 h-3.5 text-white" />
            </motion.button>
          ))}
        </div>
      )}

      {/* OYÉ Score Badge */}
      <div className="absolute top-4 left-4">
        <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
          <span className="text-sm font-bold">
            <span className="text-yellow-400">{(track.oyeScore / 1000).toFixed(0)}k</span>
            <span className="text-white/50 ml-1 text-xs">OYÉ</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        {/* Track Info */}
        <motion.div layout>
          <h3
            className={`font-bold text-white truncate leading-tight ${
              variant === 'main' ? 'text-xl' : 'text-sm'
            }`}
          >
            {track.title}
          </h3>
          <p
            className={`text-white/70 truncate mt-1 ${
              variant === 'main' ? 'text-sm' : 'text-xs'
            }`}
          >
            {track.artist}
          </p>
        </motion.div>

        {/* Progress Bar (Main Card Only when playing) */}
        {variant === 'main' && isCurrentTrack && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <ProgressBar variant="mini" />
          </div>
        )}

        {/* Play Button (Main Card Only) */}
        {variant === 'main' && (
          <motion.button
            className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-purple-500/30"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 10px 40px rgba(168, 85, 247, 0.4)' }}
            whileTap={{ scale: 0.98 }}
          >
            {isPlaying && isCurrentTrack ? (
              <>
                <Pause className="w-5 h-5" fill="white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" fill="white" />
                <span>Play</span>
              </>
            )}
          </motion.button>
        )}

        {/* Progress Bar (Smaller cards) */}
        {variant !== 'main' && isCurrentTrack && (
          <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${usePlayerStore.getState().progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Playing Indicator - Hide in video mode since video is visible */}
      {isCurrentTrack && isPlaying && viewMode !== 'video' && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 rounded-full bg-purple-500/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-purple-500/30">
            <div className="flex gap-1 items-end h-6">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{
                    height: ['10px', '24px', '10px'],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
