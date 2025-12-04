// VOYO Music - Progress Bar Component
// Shows playback progress with time display
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';

interface ProgressBarProps {
  onSeek?: (percent: number) => void;
  variant?: 'full' | 'mini';
}

// Format seconds to MM:SS
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ProgressBar = ({ onSeek, variant = 'full' }: ProgressBarProps) => {
  const { progress, currentTime, currentTrack } = usePlayerStore();

  const duration = currentTrack?.duration || 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    onSeek?.(percent);
  };

  if (variant === 'mini') {
    return (
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Progress Track */}
      <div
        className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group hover:h-2 transition-all"
        onClick={handleClick}
      >
        {/* Buffered indicator (could be added later) */}

        {/* Progress fill */}
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />

        {/* Scrubber handle */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Time Display */}
      <div className="flex justify-between mt-1.5 text-[10px] text-white/40 font-medium">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
