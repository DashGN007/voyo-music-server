/**
 * VOYO Music - Timeline Component
 * TOP ROW: Horizontal scrollable timeline showing Past | Current | Queue
 * Reference: VOYO - Portrait mode Mobile.jpg
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { Track } from '../../types';

// Mini Track Card for Timeline
const TimelineCard = ({
  track,
  isCurrent = false,
  isPast = false,
  onClick,
}: {
  track: Track;
  isCurrent?: boolean;
  isPast?: boolean;
  onClick: () => void;
}) => {
  return (
    <motion.button
      className={`
        relative flex-shrink-0 rounded-xl overflow-hidden transition-all
        ${isCurrent
          ? 'w-28 h-36 ring-2 ring-purple-500 shadow-lg shadow-purple-500/30'
          : 'w-20 h-28 opacity-70 hover:opacity-100'
        }
        ${isPast ? 'saturate-50' : ''}
      `}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Cover Image */}
      <img
        src={getYouTubeThumbnail(track.youtubeVideoId, 'high')}
        alt={track.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = getYouTubeThumbnail(track.youtubeVideoId, 'medium');
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {/* Track Info */}
      <div className="absolute bottom-2 left-2 right-2">
        <p className={`text-white font-semibold truncate ${isCurrent ? 'text-xs' : 'text-[10px]'}`}>
          {track.title}
        </p>
        <p className={`text-white/60 truncate ${isCurrent ? 'text-[10px]' : 'text-[8px]'}`}>
          {track.artist}
        </p>
      </div>

      {/* Playing Indicator for Current */}
      {isCurrent && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
            <div className="flex gap-0.5 items-end h-3">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-white rounded-full"
                  animate={{ height: ['4px', '12px', '4px'] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.button>
  );
};

export const Timeline = () => {
  const { currentTrack, history, queue, setCurrentTrack } = usePlayerStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get last 3 from history
  const pastTracks = history.slice(-3).map(h => h.track).reverse();

  // Get next 3 from queue
  const queueTracks = queue.slice(0, 3).map(q => q.track);

  // Auto-scroll to center (current track) on mount
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollCenter = container.scrollWidth / 2 - container.clientWidth / 2;
      container.scrollTo({ left: scrollCenter, behavior: 'smooth' });
    }
  }, [currentTrack?.id]);

  return (
    <div className="relative w-full py-4">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

      {/* Scrollable Timeline */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto scrollbar-hide px-8"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {/* Past Tracks */}
        <AnimatePresence>
          {pastTracks.map((track, index) => (
            <motion.div
              key={`past-${track.id}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ scrollSnapAlign: 'center' }}
            >
              <TimelineCard
                track={track}
                isPast
                onClick={() => setCurrentTrack(track)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Current Track (Center, Bigger) */}
        {currentTrack && (
          <motion.div
            key={`current-${currentTrack.id}`}
            className="flex-shrink-0"
            style={{ scrollSnapAlign: 'center' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <TimelineCard
              track={currentTrack}
              isCurrent
              onClick={() => {}}
            />
          </motion.div>
        )}

        {/* Queue Tracks */}
        <AnimatePresence>
          {queueTracks.map((track, index) => (
            <motion.div
              key={`queue-${track.id}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ scrollSnapAlign: 'center' }}
            >
              <TimelineCard
                track={track}
                onClick={() => setCurrentTrack(track)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add to Queue Button */}
        <motion.button
          className="flex-shrink-0 w-16 h-24 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-6 h-6 text-white/40" />
        </motion.button>
      </div>
    </div>
  );
};
