// VOYO Music - YouTube Player Component
// Hidden audio player / Visible video player based on viewMode
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';

const PLAYER_CONTAINER_ID = 'voyo-youtube-player';

export const YouTubePlayer = () => {
  const {
    viewMode,
    isVideoMode,
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    setViewMode,
    progress,
  } = usePlayerStore();
  const [playerState, setPlayerState] = useState<number>(-1);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const { isAPIReady, isPlayerReady, seekToPercent } = useYouTubePlayer({
    containerId: PLAYER_CONTAINER_ID,
    onReady: () => {
      console.log('YouTube Player Ready');
    },
    onStateChange: (state) => {
      setPlayerState(state);
      setHasError(false);
    },
    onError: (error) => {
      console.error('YouTube Player Error:', error);
      setHasError(true);
    },
  });

  // Show video when in video mode or video viewMode
  const showVideo = viewMode === 'video' || isVideoMode;

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    seekToPercent(percent);
  };

  return (
    <>
      {/* Hidden Player Container (Audio Mode) */}
      <div
        className={`
          fixed transition-all duration-500 ease-out z-50
          ${showVideo
            ? 'inset-0 bg-black'
            : 'bottom-0 left-0 w-1 h-1 opacity-0 pointer-events-none'
          }
        `}
      >
        {/* Video Overlay UI */}
        <AnimatePresence>
          {showVideo && currentTrack && (
            <motion.div
              className="absolute inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: showControls ? 1 : 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowControls(!showControls)}
            >
              {/* Top Bar with Close Button */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                      VOYO
                    </span>
                  </div>
                  <motion.button
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode('card');
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>

              {/* Center Play/Pause Button */}
              <motion.button
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center pointer-events-auto hover:bg-white/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10" fill="white" />
                ) : (
                  <Play className="w-10 h-10 ml-1" fill="white" />
                )}
              </motion.button>

              {/* Bottom gradient with track info and controls */}
              <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-auto">
                <div className="absolute bottom-8 left-6 right-6">
                  {/* Track Info */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {currentTrack.title}
                    </h2>
                    <p className="text-white/70">{currentTrack.artist}</p>
                  </motion.div>

                  {/* Progress Bar */}
                  <div
                    className="mt-4 h-1.5 bg-white/20 rounded-full cursor-pointer hover:h-2 transition-all group"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProgressClick(e);
                    }}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-6">
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); prevTrack(); }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <SkipBack className="w-6 h-6" />
                      </motion.button>
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8" fill="white" />
                        ) : (
                          <Play className="w-8 h-8" fill="white" />
                        )}
                      </motion.button>
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); nextTrack(); }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <SkipForward className="w-6 h-6" />
                      </motion.button>
                    </div>

                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVolume(volume === 0 ? 80 : 0);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {volume === 0 ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </motion.button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading Indicator */}
              {!isPlayerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-white/70">Loading video...</span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
                  <div className="text-center">
                    <span className="text-4xl mb-4 block">:(</span>
                    <p className="text-white/70">Video unavailable</p>
                    <p className="text-white/50 text-sm mt-2">Trying next track...</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* YouTube IFrame Container */}
        <div
          id={PLAYER_CONTAINER_ID}
          className={`
            w-full h-full
            ${showVideo ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </div>

      {/* Mini Player Indicator (when in audio mode) */}
      <AnimatePresence>
        {!showVideo && isPlayerReady && (
          <motion.div
            className="fixed bottom-32 right-4 z-40"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
