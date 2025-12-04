// VOYO Music - 3-Card Player Layout
// LEFT: History (blurred) | CENTER: Now Playing | RIGHT: Queue
import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { SkipBack, SkipForward, ChevronLeft, ChevronRight, Download, ListPlus, Library } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { TrackCard } from '../cards/TrackCard';
import { Track } from '../../types';

export const ThreeCardPlayer = () => {
  const {
    currentTrack,
    queue,
    history,
    isPlaying,
    nextTrack,
    prevTrack,
    setCurrentTrack,
    isRouletteMode,
    rouletteTracks,
    stopRoulette,
  } = usePlayerStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // For roulette scroll - play on release
  const handleScroll = () => {
    if (!scrollRef.current) return;
    setScrollPosition(scrollRef.current.scrollLeft);
    setIsScrolling(true);

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
      // Play the centered track when scroll stops
      if (isRouletteMode && scrollRef.current) {
        const cardWidth = 240;
        const center = scrollRef.current.scrollLeft + scrollRef.current.clientWidth / 2;
        const trackIndex = Math.floor(center / cardWidth);
        const selectedTrack = rouletteTracks[trackIndex];
        if (selectedTrack) {
          stopRoulette(selectedTrack);
        }
      }
    }, 150);
  };

  // Get last 3 from history for display
  const recentHistory = history.slice(-3).reverse();

  // Get next 3 from queue for display
  const upcomingQueue = queue.slice(0, 3);

  return (
    <div className="relative w-full py-6">
      {/* Roulette Mode Indicator */}
      <AnimatePresence>
        {isRouletteMode && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-purple-500/20 backdrop-blur-md border border-purple-500/50"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span className="text-sm font-medium text-purple-300">
              Roulette Mode - Release to Play
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 3-Card Layout */}
      <div className="flex items-center justify-center gap-4 px-4">
        {/* Left Side - History (Blurred) */}
        <div className="relative">
          {/* History Action Hint */}
          <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-2 text-xs text-white/50">
            <ChevronLeft className="w-4 h-4" />
            <span>Scroll for history</span>
          </div>

          <div className="flex gap-2 items-center">
            {recentHistory.length > 0 ? (
              <motion.div
                className="relative group cursor-pointer"
                whileHover={{ x: -10 }}
              >
                <TrackCard
                  track={recentHistory[0].track}
                  variant="history"
                  isActive={false}
                />
                {/* Action buttons on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center gap-2">
                  <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                    <ListPlus className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                    <Library className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="w-32 h-44 md:w-40 md:h-52 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-white/30 text-xs">No history</span>
              </div>
            )}
          </div>
        </div>

        {/* Center - Main Card (Now Playing) */}
        <div className="relative z-10">
          {/* Now Playing Label */}
          <div className="absolute -top-8 left-0 right-0 text-center">
            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
              Now Playing
            </span>
          </div>

          {currentTrack ? (
            <TrackCard track={currentTrack} variant="main" isActive={true} />
          ) : (
            <div className="w-56 h-72 md:w-64 md:h-80 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-white/30">Select a track</span>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <motion.button
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={prevTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipBack className="w-5 h-5" />
            </motion.button>

            <motion.button
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={nextTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipForward className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Right Side - Queue */}
        <div className="relative">
          {/* Queue Action Hint */}
          <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-2 text-xs text-white/50">
            <span>Queue</span>
            <ChevronRight className="w-4 h-4" />
          </div>

          <div className="flex gap-2 items-center">
            {upcomingQueue.length > 0 ? (
              <motion.div
                className="cursor-pointer"
                whileHover={{ x: 10 }}
              >
                <TrackCard
                  track={upcomingQueue[0].track}
                  variant="queue"
                  isActive={false}
                />
              </motion.div>
            ) : (
              <div className="w-32 h-44 md:w-40 md:h-52 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-white/30 text-xs">Queue empty</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Indicator */}
      <div className="flex items-center justify-center mt-6">
        <div className="flex items-center gap-2 text-white/40">
          <ChevronLeft className="w-4 h-4" />
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-500"
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Roulette Scroll Area (Hidden by default, activated in roulette mode) */}
      <AnimatePresence>
        {isRouletteMode && (
          <motion.div
            className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              ref={scrollRef}
              className="flex items-center gap-4 h-full overflow-x-auto no-scrollbar snap-x px-[calc(50%-120px)]"
              onScroll={handleScroll}
            >
              {rouletteTracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  className="snap-center flex-shrink-0"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TrackCard track={track} variant="main" isActive={false} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
