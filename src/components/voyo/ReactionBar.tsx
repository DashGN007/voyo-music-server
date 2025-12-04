/**
 * VOYO Music - Reaction Bar
 * Horizontal bar of reaction buttons below the play circle
 * Reference: VOYO - Portrait mode Mobile.jpg
 *
 * Buttons: [OYO] [OYÉÉ] [Wazzguán] [Fireee]
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { DEFAULT_REACTIONS } from '../../data/tracks';
import { ReactionType } from '../../types';

// Floating reaction animation
const FloatingReaction = ({
  emoji,
  text,
  x,
  onComplete,
}: {
  emoji: string;
  text: string;
  x: number;
  onComplete: () => void;
}) => {
  return (
    <motion.div
      className="fixed pointer-events-none z-50"
      style={{ left: `${x}%`, bottom: '30%' }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: -200,
        scale: [1, 1.2, 0.8],
      }}
      transition={{ duration: 2, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
    >
      <div className="flex flex-col items-center">
        <span className="text-4xl">{emoji}</span>
        <span className="text-white font-bold text-sm">{text}</span>
      </div>
    </motion.div>
  );
};

export const ReactionBar = () => {
  const { addReaction } = usePlayerStore();
  const [floatingReactions, setFloatingReactions] = useState<Array<{
    id: number;
    emoji: string;
    text: string;
    x: number;
  }>>([]);

  const handleReaction = (reaction: typeof DEFAULT_REACTIONS[number]) => {
    // Add floating animation
    const newReaction = {
      id: Date.now(),
      emoji: reaction.emoji,
      text: reaction.text,
      x: 30 + Math.random() * 40, // Random position 30-70%
    };

    setFloatingReactions(prev => [...prev, newReaction]);

    // Add to store
    addReaction({
      type: reaction.type as ReactionType,
      text: reaction.text,
      emoji: reaction.emoji,
      x: newReaction.x,
      y: 50,
      multiplier: 1,
      userId: 'current-user',
    });
  };

  const removeFloatingReaction = (id: number) => {
    setFloatingReactions(prev => prev.filter(r => r.id !== id));
  };

  // Primary reactions to show in bar (first 4)
  const primaryReactions = DEFAULT_REACTIONS.slice(0, 4);

  return (
    <>
      {/* Floating Reactions */}
      <AnimatePresence>
        {floatingReactions.map((reaction) => (
          <FloatingReaction
            key={reaction.id}
            emoji={reaction.emoji}
            text={reaction.text}
            x={reaction.x}
            onComplete={() => removeFloatingReaction(reaction.id)}
          />
        ))}
      </AnimatePresence>

      {/* Reaction Bar */}
      <div className="flex items-center justify-center gap-2 py-4 px-4">
        {primaryReactions.map((reaction, index) => (
          <motion.button
            key={reaction.type}
            className={`
              px-4 py-2.5 rounded-full
              bg-gradient-to-r
              ${index === 0 ? 'from-yellow-500/20 to-orange-500/20 border-yellow-500/40' : ''}
              ${index === 1 ? 'from-purple-500/20 to-pink-500/20 border-purple-500/40' : ''}
              ${index === 2 ? 'from-cyan-500/20 to-blue-500/20 border-cyan-500/40' : ''}
              ${index === 3 ? 'from-red-500/20 to-orange-500/20 border-red-500/40' : ''}
              border backdrop-blur-md
              hover:scale-105 active:scale-95 transition-transform
            `}
            onClick={() => handleReaction(reaction)}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-white">
              <span>{reaction.emoji}</span>
              <span className="text-xs">{reaction.text}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </>
  );
};
