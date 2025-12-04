// VOYO Music - OYÉ Floating Reaction System
// Tap to react, tap reaction to multiply, creates storms
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { DEFAULT_REACTIONS } from '../../data/tracks';
import { ReactionType } from '../../types';

export const OyeReactions = () => {
  const { reactions, addReaction, multiplyReaction, oyeScore } = usePlayerStore();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerSide, setPickerSide] = useState<'left' | 'right'>('left');

  const handleAreaClick = (side: 'left' | 'right') => {
    setPickerSide(side);
    setShowReactionPicker(true);
  };

  const handleReactionSelect = (reaction: typeof DEFAULT_REACTIONS[number]) => {
    const x = pickerSide === 'left' ? Math.random() * 30 + 5 : Math.random() * 30 + 65;
    const y = Math.random() * 60 + 20;

    addReaction({
      type: reaction.type as ReactionType,
      text: reaction.text,
      emoji: reaction.emoji,
      x,
      y,
      multiplier: 1,
      userId: 'current-user',
    });

    setShowReactionPicker(false);
  };

  const handleReactionTap = (reactionId: string) => {
    multiplyReaction(reactionId);
  };

  return (
    <>
      {/* Left Reaction Zone (HOT - Red) */}
      <motion.div
        className="absolute left-6 top-1/2 -translate-y-1/2 z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          className="flex flex-col items-center gap-2"
          onClick={() => handleAreaClick('left')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/30 to-orange-500/30 backdrop-blur-md border border-red-500/40 flex items-center justify-center cursor-pointer shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-shadow">
            <span className="text-2xl">🔥</span>
          </div>
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">HOT</span>
        </motion.button>
      </motion.div>

      {/* Right Reaction Zone (OYÉ - Purple) */}
      <motion.div
        className="absolute right-6 top-1/2 -translate-y-1/2 z-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          className="flex flex-col items-center gap-2"
          onClick={() => handleAreaClick('right')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur-md border border-purple-500/40 flex items-center justify-center cursor-pointer shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow">
            <span className="text-2xl">✨</span>
          </div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">OYÉ</span>
        </motion.button>
      </motion.div>

      {/* OYÉ Score Display */}
      <motion.div
        className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <motion.div
          className="px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-xl"
          animate={{ scale: oyeScore > 0 ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-lg font-bold">
            <span className="text-yellow-400">{oyeScore.toLocaleString()}</span>
            <span className="text-white/50 ml-2 text-sm">OYÉ</span>
          </span>
        </motion.div>
      </motion.div>

      {/* Floating Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute z-20 cursor-pointer pointer-events-auto"
            style={{
              left: `${reaction.x}%`,
              top: `${reaction.y}%`,
            }}
            initial={{ opacity: 0, scale: 0, y: 0 }}
            animate={{
              opacity: 1,
              scale: 1 + (reaction.multiplier - 1) * 0.2,
              y: -50,
            }}
            exit={{ opacity: 0, y: -100, scale: 0.5 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            onClick={() => handleReactionTap(reaction.id)}
            whileHover={{ scale: 1.2 }}
          >
            <div
              className={`
                px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg
                ${reaction.multiplier > 1
                  ? 'bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border border-yellow-500/50'
                  : 'bg-white/20 border border-white/20'
                }
              `}
            >
              <span className="text-sm font-bold">
                {reaction.emoji} {reaction.text}
                {reaction.multiplier > 1 && (
                  <span className="ml-2 text-yellow-400 font-black">
                    x{reaction.multiplier}
                  </span>
                )}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Reaction Picker Modal */}
      <AnimatePresence>
        {showReactionPicker && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReactionPicker(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Reaction Options */}
            <motion.div
              className={`
                relative grid grid-cols-4 gap-3 p-5 rounded-3xl bg-[#12121a]/95 border border-white/10 shadow-2xl
                ${pickerSide === 'left' ? 'mr-auto ml-8' : 'ml-auto mr-8'}
              `}
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="col-span-4 mb-3 text-center">
                <span className="text-sm text-white/60 uppercase tracking-widest font-medium">
                  Drop your OYÉ
                </span>
              </div>

              {DEFAULT_REACTIONS.map((reaction) => (
                <motion.button
                  key={reaction.type}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/15 transition-all flex flex-col items-center gap-2 border border-transparent hover:border-purple-500/30"
                  onClick={() => handleReactionSelect(reaction)}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-3xl">{reaction.emoji}</span>
                  <span className="text-[10px] text-white/70 font-medium">{reaction.text}</span>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
