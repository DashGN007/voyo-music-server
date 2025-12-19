/**
 * ContinuePlayingButton - The "I Want More" Hook
 *
 * Shows after user engages (OYÉ, double-tap, or watches for X seconds)
 * Slides up from bottom, pulses with music
 * Tapping takes them to full music player at CURRENT position
 *
 * This is THE conversion point: Feed Browser → Music Listener
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Headphones, ArrowRight, Sparkles } from 'lucide-react';

interface ContinuePlayingButtonProps {
  isVisible: boolean;
  isPlaying: boolean;
  trackTitle: string;
  trackArtist: string;
  progress: number; // 0-100
  onContinue: () => void;
  variant?: 'minimal' | 'full' | 'pulse';
}

export const ContinuePlayingButton = ({
  isVisible,
  isPlaying,
  trackTitle,
  trackArtist,
  progress,
  onContinue,
  variant = 'full',
}: ContinuePlayingButtonProps) => {
  const [hasShown, setHasShown] = useState(false);

  // Track if button has been shown this session
  useEffect(() => {
    if (isVisible && !hasShown) {
      setHasShown(true);
    }
  }, [isVisible, hasShown]);

  if (!isVisible) return null;

  // Minimal variant - just a small pill
  if (variant === 'minimal') {
    return (
      <motion.button
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={onContinue}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30">
          <Headphones className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">Keep Listening</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </motion.button>
    );
  }

  // Pulse variant - animated pulsing button
  if (variant === 'pulse') {
    return (
      <motion.button
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        initial={{ y: 50, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.8 }}
        onClick={onContinue}
      >
        <motion.div
          className="relative flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%]"
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            boxShadow: isPlaying
              ? [
                  '0 0 20px rgba(168, 85, 247, 0.4)',
                  '0 0 40px rgba(236, 72, 153, 0.6)',
                  '0 0 20px rgba(168, 85, 247, 0.4)',
                ]
              : '0 0 20px rgba(168, 85, 247, 0.3)',
          }}
          transition={{
            backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' },
            boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Sparkle effects */}
          <motion.div
            className="absolute -top-1 -left-1"
            animate={{ rotate: 360, opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>

          <motion.div
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <Play className="w-5 h-5 text-white ml-0.5" style={{ fill: 'white' }} />
          </motion.div>

          <div className="flex flex-col items-start">
            <span className="text-white text-xs opacity-80">Love this vibe?</span>
            <span className="text-white text-sm font-bold">Keep Playing</span>
          </div>

          <ArrowRight className="w-5 h-5 text-white" />
        </motion.div>
      </motion.button>
    );
  }

  // Full variant - rich card with track info
  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-24 left-4 right-4 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <motion.button
          className="w-full"
          onClick={onContinue}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/90 to-pink-900/90 backdrop-blur-xl border border-white/10">
            {/* Animated gradient overlay */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/30 to-purple-500/20"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            <div className="relative p-4 flex items-center gap-4">
              {/* Play icon with pulse */}
              <motion.div
                className="w-14 h-14 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center"
                animate={isPlaying ? {
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(168, 85, 247, 0.4)',
                    '0 0 0 15px rgba(168, 85, 247, 0)',
                    '0 0 0 0 rgba(168, 85, 247, 0)',
                  ],
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : {}}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Headphones className="w-7 h-7 text-white" />
                </motion.div>
              </motion.div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs mb-0.5">Now vibing to</p>
                <h4 className="text-white font-bold text-sm truncate">{trackTitle}</h4>
                <p className="text-white/70 text-xs truncate">{trackArtist}</p>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
                <span className="text-white text-sm font-bold">Full Song</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};

export default ContinuePlayingButton;
