/**
 * VOYO Music - DJ Commands
 * Quick command interface - NOT a chat, just instant actions!
 *
 * "Wazzguán" = Quick access to DJ commands
 * Voice mode: Speak your command
 * Tap mode: Quick action buttons
 *
 * Commands:
 * - "Skip" / "Next"
 * - "More like this"
 * - "Arrange queue: soft to hyped"
 * - "Arrange queue: sensual vibes"
 * - "Play something different"
 * - "Afrobeats only"
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Zap, Flame, Moon, Heart, Shuffle, SkipForward, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

interface DJCommandsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Command type definition
interface DJCommand {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  action: () => void;
}

export const DJCommands = ({ isOpen, onClose }: DJCommandsProps) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const { nextTrack, refreshRecommendations, setVolume, volume } = usePlayerStore();

  // Store original volume for fade
  const originalVolumeRef = useRef(volume);

  // Fade music when opened
  useEffect(() => {
    if (isOpen) {
      originalVolumeRef.current = volume;
      setVolume(Math.max(15, volume * 0.4));
    } else {
      setVolume(originalVolumeRef.current);
    }
  }, [isOpen]);

  const executeCommand = (label: string) => {
    setLastCommand(label);
    setShowFeedback(true);

    // Auto-close after feedback
    setTimeout(() => {
      setShowFeedback(false);
      onClose();
    }, 1500);
  };

  const commands: DJCommand[] = [
    {
      id: 'skip',
      icon: SkipForward,
      label: 'Skip',
      description: 'Play next track',
      color: 'from-blue-500 to-cyan-500',
      action: () => {
        nextTrack();
        executeCommand('Skipping...');
      },
    },
    {
      id: 'more-like-this',
      icon: Flame,
      label: 'More like this',
      description: 'Similar vibes coming up',
      color: 'from-orange-500 to-red-500',
      action: () => {
        refreshRecommendations();
        executeCommand('Got you fam! 🔥');
      },
    },
    {
      id: 'soft-to-hyped',
      icon: Zap,
      label: 'Soft → Hyped',
      description: 'Arrange queue: build up energy',
      color: 'from-yellow-500 to-orange-500',
      action: () => {
        refreshRecommendations();
        executeCommand('Building the energy! ⚡');
      },
    },
    {
      id: 'sensual',
      icon: Heart,
      label: 'Sensual vibes',
      description: 'Romantic & smooth tracks',
      color: 'from-pink-500 to-rose-500',
      action: () => {
        refreshRecommendations();
        executeCommand('Setting the mood... 💜');
      },
    },
    {
      id: 'chill',
      icon: Moon,
      label: 'Chill mode',
      description: 'Relax & unwind',
      color: 'from-indigo-500 to-purple-500',
      action: () => {
        refreshRecommendations();
        executeCommand('Cooling it down... 🌙');
      },
    },
    {
      id: 'shuffle',
      icon: Shuffle,
      label: 'Surprise me',
      description: 'Random vibes',
      color: 'from-green-500 to-teal-500',
      action: () => {
        refreshRecommendations();
        executeCommand('Say less! 🎲');
      },
    },
  ];

  const toggleVoice = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setVolume(5); // Fade more for voice
    } else {
      setVolume(Math.max(15, originalVolumeRef.current * 0.4));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-lg"
            onClick={onClose}
          />

          {/* Command Feedback */}
          <AnimatePresence>
            {showFeedback && lastCommand && (
              <motion.div
                className="absolute z-60 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-2xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <span className="text-white font-bold text-xl">{lastCommand}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Command Panel */}
          {!showFeedback && (
            <motion.div
              className="relative z-50 w-full max-w-sm mx-4"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-white font-bold text-xl">Wazzguán! 🎧</h2>
                  <p className="text-white/50 text-sm">What you need?</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Voice Button */}
                  <motion.button
                    className={`p-3 rounded-full transition-colors ${
                      isListening
                        ? 'bg-red-500 animate-pulse'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                    onClick={toggleVoice}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isListening ? (
                      <MicOff className="w-6 h-6 text-white" />
                    ) : (
                      <Mic className="w-6 h-6 text-white/70" />
                    )}
                  </motion.button>
                  <motion.button
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20"
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6 text-white/70" />
                  </motion.button>
                </div>
              </div>

              {/* Voice Listening Indicator */}
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    className="mb-6 p-4 rounded-2xl bg-red-500/20 border border-red-500/30"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-red-400 rounded-full"
                            animate={{ height: [8, 24, 8] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                      <span className="text-red-300 text-sm">Listening... speak your command</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Command Grid */}
              <div className="grid grid-cols-2 gap-3">
                {commands.map((cmd, i) => (
                  <motion.button
                    key={cmd.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                    onClick={cmd.action}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cmd.color} flex items-center justify-center mb-3`}>
                      <cmd.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-white font-semibold text-sm">{cmd.label}</p>
                    <p className="text-white/40 text-xs mt-1">{cmd.description}</p>
                  </motion.button>
                ))}
              </div>

              {/* Volume Indicator */}
              <div className="flex items-center justify-center gap-2 mt-6 text-white/30 text-xs">
                <Volume2 className="w-4 h-4" />
                <span>Music faded to {Math.round((volume / originalVolumeRef.current) * 100)}%</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
