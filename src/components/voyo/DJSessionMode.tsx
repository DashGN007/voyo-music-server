/**
 * VOYO Music - DJ SESSION MODE 🔥
 *
 * Inspired by GINJA SESSIONS - Ethan Tomas vibes
 * Real DJ energy with live reactions and party atmosphere
 *
 * Features:
 * - DJ character with headphones mixing
 * - Floating live reactions (OYÉ, 🔥, comments)
 * - Current track display with timestamps
 * - Party crowd energy meter
 * - Live comment section
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  Play, Pause, SkipForward, SkipBack,
  MessageCircle, Flame,
  Radio
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';

// ============================================
// TYPES
// ============================================
interface FloatingReaction {
  id: number;
  type: 'oye' | 'fire' | 'love' | 'zap' | 'comment';
  text?: string;
  x: number;
  emoji: string;
  // Pre-computed animation values
  xOffset1: number;
  xOffset2: number;
}

interface LiveComment {
  id: number;
  user: string;
  text: string;
  time: number;
}

// ============================================
// FAKE LIVE COMMENTS DATA
// ============================================
const LIVE_COMMENTS: LiveComment[] = [
  { id: 1, user: 'nathanp2001', text: 'Omg this dude got in his BAG with this set!!! 🔥🔥🔥 THIS IS NUTS!', time: 0 },
  { id: 2, user: 'abdoulaziz', text: 'DJ I left my playlist running I found youuuu OHhhhh DJ DJ DJ', time: 3 },
  { id: 3, user: 'saralove', text: 'Great vibez 🔥💯 New afro 🎶', time: 6 },
  { id: 4, user: 'angelanorman', text: 'The guy in the green hat got some DAMN GOOD moves!!!', time: 9 },
  { id: 5, user: 'dashfam', text: 'OYÉÉÉÉ!!! 🦉⚡ This is FIRE', time: 12 },
  { id: 6, user: 'afrovibes', text: 'Amapiano hits different at 3am 🌙', time: 15 },
  { id: 7, user: 'gaborone_g', text: 'South Africa in the building!! 🇿🇦', time: 18 },
  { id: 8, user: 'lagosqueen', text: 'Nigeria stand UP! 🇳🇬🔥', time: 21 },
  { id: 9, user: 'accraboy', text: 'Ghana to the world! 🇬🇭', time: 24 },
  { id: 10, user: 'freetownvibes', text: 'Sierra Leone we outside!! 🇸🇱', time: 27 },
];

// ============================================
// OYO THE OWL - DJ CHARACTER 🦉
// Asymmetric ears = PERFECT for mixing!
// ============================================
const OYODJCharacter = ({ isPlaying }: { isPlaying: boolean }) => {
  const controls = useAnimation();
  const [blinkEye, setBlinkEye] = useState<'left' | 'right' | 'both' | null>(null);

  // Random blinking - owls blink independently!
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      const blink = Math.random() > 0.7 ? 'both' : Math.random() > 0.5 ? 'left' : 'right';
      setBlinkEye(blink);
      setTimeout(() => setBlinkEye(null), 150);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Vibe to the music
  useEffect(() => {
    if (isPlaying) {
      controls.start({
        y: [0, -8, 0, -5, 0],
        rotate: [0, -3, 0, 3, 0],
        transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
      });
    } else {
      controls.stop();
      controls.set({ y: 0, rotate: 0 });
    }
  }, [isPlaying, controls]);

  const getGlowColor = () => isPlaying ? '#a855f7' : '#7c3aed';

  return (
    <motion.div className="relative" animate={controls}>
      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ margin: '-30px' }}
        animate={{
          boxShadow: isPlaying ? [
            `0 0 40px ${getGlowColor()}50, 0 0 80px ${getGlowColor()}30`,
            `0 0 60px ${getGlowColor()}70, 0 0 120px ${getGlowColor()}40`,
            `0 0 40px ${getGlowColor()}50, 0 0 80px ${getGlowColor()}30`,
          ] : `0 0 30px ${getGlowColor()}30`
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Main OYO Body */}
      <motion.div
        className="relative w-40 h-48 rounded-[2.5rem] flex flex-col items-center justify-center overflow-visible"
        style={{
          background: `linear-gradient(145deg, #2a1a4a 0%, #1a0a2e 50%, #0a0a0f 100%)`,
          border: `3px solid ${getGlowColor()}70`,
          boxShadow: `0 0 50px ${getGlowColor()}40, inset 0 0 40px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Ear tufts - ASYMMETRIC like real owls! */}
        <div className="absolute -top-4 left-5 w-0 h-0 border-l-[14px] border-r-[14px] border-b-[28px] border-l-transparent border-r-transparent border-b-purple-900/90" />
        <div className="absolute -top-6 right-5 w-0 h-0 border-l-[14px] border-r-[14px] border-b-[32px] border-l-transparent border-r-transparent border-b-purple-900/90" />

        {/* Headphones band */}
        <div className="absolute top-1 left-5 right-5 h-3 rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600" />

        {/* Left headphone - LOWER (asymmetric!) */}
        <motion.div
          className="absolute top-8 -left-4 w-8 h-12 rounded-xl bg-gradient-to-b from-purple-500 to-purple-700 border-2 border-purple-400/50"
          animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <div className="absolute inset-1 rounded-lg bg-purple-300/10" />
          <motion.div
            className="absolute bottom-1 left-1 right-1 h-2 rounded bg-cyan-400/60"
            animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
          {/* Bass waves */}
          <motion.div
            className="absolute -left-2 top-1/2 -translate-y-1/2"
            animate={isPlaying ? { opacity: [0, 1, 0], x: [-5, -15, -5] } : { opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-0.5 h-3 bg-cyan-400 rounded-full" style={{ height: `${8 + i * 4}px` }} />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Right headphone - HIGHER (asymmetric!) */}
        <motion.div
          className="absolute top-5 -right-4 w-8 h-12 rounded-xl bg-gradient-to-b from-purple-500 to-purple-700 border-2 border-purple-400/50"
          animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
        >
          <div className="absolute inset-1 rounded-lg bg-purple-300/10" />
          <motion.div
            className="absolute bottom-1 left-1 right-1 h-2 rounded bg-pink-400/60"
            animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
            transition={{ duration: 0.4, repeat: Infinity, delay: 0.2 }}
          />
          {/* Treble waves */}
          <motion.div
            className="absolute -right-2 top-1/2 -translate-y-1/2"
            animate={isPlaying ? { opacity: [0, 1, 0], x: [5, 15, 5] } : { opacity: 0 }}
            transition={{ duration: 0.4, repeat: Infinity, delay: 0.1 }}
          >
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-0.5 bg-pink-400 rounded-full" style={{ height: `${12 - i * 3}px` }} />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Face container */}
        <div className="relative mt-6">
          {/* Facial disk ring */}
          <div className="absolute -inset-5 rounded-full border-2 border-purple-400/20" />

          {/* EYES - Big & Expressive */}
          <div className="flex gap-6 mb-3">
            {/* Left Eye */}
            <motion.div
              className="relative w-11 h-11 rounded-full overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #fef9c3, #fbbf24, #d97706)',
                boxShadow: `0 0 20px ${isPlaying ? '#fbbf24' : '#fbbf2480'}`,
              }}
              animate={
                isPlaying
                  ? { scale: [1, 1.1, 1] }
                  : blinkEye === 'left' || blinkEye === 'both'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: isPlaying ? 0.6 : 0.1, repeat: isPlaying ? Infinity : 0 }}
            >
              <motion.div
                className="absolute w-5 h-5 bg-black rounded-full"
                style={{ top: '50%', left: '50%', x: '-50%', y: '-50%' }}
                animate={isPlaying ? { scale: [1, 0.9, 1] } : {}}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full" />
              </motion.div>
            </motion.div>

            {/* Right Eye */}
            <motion.div
              className="relative w-11 h-11 rounded-full overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #fef9c3, #fbbf24, #d97706)',
                boxShadow: `0 0 20px ${isPlaying ? '#fbbf24' : '#fbbf2480'}`,
              }}
              animate={
                isPlaying
                  ? { scale: [1, 1.1, 1] }
                  : blinkEye === 'right' || blinkEye === 'both'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: isPlaying ? 0.6 : 0.1, repeat: isPlaying ? Infinity : 0, delay: 0.1 }}
            >
              <motion.div
                className="absolute w-5 h-5 bg-black rounded-full"
                style={{ top: '50%', left: '50%', x: '-50%', y: '-50%' }}
                animate={isPlaying ? { scale: [1, 0.9, 1] } : {}}
                transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
              >
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full" />
              </motion.div>
            </motion.div>
          </div>

          {/* Beak */}
          <motion.div
            className="flex flex-col items-center"
            animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[16px] border-l-transparent border-r-transparent border-t-orange-400" />
            <div className="w-6 h-2 bg-gradient-to-b from-orange-400 to-orange-500 rounded-b-full -mt-1" />
          </motion.div>
        </div>

        {/* Waveform / Music Visualizer at bottom */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
          {[...Array(11)].map((_, i) => (
            <motion.div
              key={i}
              className="w-2 rounded-full"
              style={{
                background: `linear-gradient(to top, #a855f7, #ec4899)`,
              }}
              animate={isPlaying ? {
                height: [6, 24 - Math.abs(i - 5) * 3, 6],
              } : { height: 4 }}
              transition={{
                duration: 0.35,
                repeat: Infinity,
                delay: i * 0.04
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* LIVE badge */}
      <motion.div
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-red-500 flex items-center gap-1.5"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full bg-white"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        <span className="text-white text-xs font-black">LIVE</span>
      </motion.div>

      {/* OYO DJ Label */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.2))',
          border: '1px solid rgba(168,85,247,0.4)',
        }}
      >
        <span className="text-purple-300 text-sm font-black tracking-wider">OYO DJ</span>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// FLOATING REACTIONS
// ============================================
const FloatingReactions = ({ reactions }: { reactions: FloatingReaction[] }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute text-2xl"
            style={{ left: `${reaction.x}%`, bottom: '30%' }}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{
              opacity: [1, 1, 0],
              y: -200,
              scale: [0.5, 1.2, 1],
              x: [0, reaction.xOffset1, reaction.xOffset2]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
          >
            {reaction.type === 'comment' ? (
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-white">
                {reaction.text}
              </div>
            ) : (
              <span className="drop-shadow-lg">{reaction.emoji}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// REACTION BUTTONS
// ============================================
interface ReactionButtonsProps {
  onReaction: (type: FloatingReaction['type'], emoji: string, text?: string) => void;
}

const ReactionButtons = ({ onReaction }: ReactionButtonsProps) => {
  const reactions = [
    { type: 'oye' as const, emoji: '⚡', label: 'OYÉ', color: 'from-yellow-500 to-orange-500' },
    { type: 'fire' as const, emoji: '🔥', label: 'FIRE', color: 'from-red-500 to-orange-500' },
    { type: 'love' as const, emoji: '❤️', label: 'LOVE', color: 'from-pink-500 to-red-500' },
    { type: 'zap' as const, emoji: '💥', label: 'MAD!', color: 'from-purple-500 to-blue-500' },
  ];

  return (
    <div className="flex justify-center gap-3">
      {reactions.map((r) => (
        <motion.button
          key={r.type}
          className={`px-4 py-2 rounded-full bg-gradient-to-r ${r.color} text-white font-bold text-sm flex items-center gap-1`}
          onClick={() => onReaction(r.type, r.emoji)}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
        >
          <span>{r.emoji}</span>
          <span>{r.label}</span>
        </motion.button>
      ))}
    </div>
  );
};

// ============================================
// LIVE COMMENTS SECTION
// ============================================
const LiveCommentsSection = ({ comments }: { comments: LiveComment[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-3 h-40 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="w-4 h-4 text-purple-400" />
        <span className="text-white/80 text-xs font-bold">LIVE CHAT</span>
        <span className="text-white/40 text-xs">• {comments.length} vibing</span>
      </div>

      <div ref={scrollRef} className="space-y-2 overflow-y-auto h-28 scrollbar-hide">
        <AnimatePresence>
          {comments.map((comment) => (
            <motion.div
              key={comment.id}
              className="flex gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-purple-400 text-xs font-bold">@{comment.user}</span>
              <span className="text-white/80 text-xs">{comment.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================
// TRACK INFO DISPLAY
// ============================================
const TrackInfoDisplay = () => {
  const { currentTrack, currentTime, duration, progress, isPlaying } = usePlayerStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  return (
    <motion.div
      className="bg-black/60 backdrop-blur-md rounded-2xl p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Session Title */}
      <div className="flex items-center gap-2 mb-2">
        <Radio className="w-4 h-4 text-purple-400" />
        <span className="text-purple-400 text-xs font-bold uppercase tracking-wider">Now Playing</span>
      </div>

      {/* Track Info */}
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <motion.div
          className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
          animate={isPlaying ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <img
            src={getYouTubeThumbnail(currentTrack.trackId, 'medium')}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm truncate">{currentTrack.title}</h3>
          <p className="text-white/60 text-xs truncate">{currentTrack.artist}</p>

          {/* Progress */}
          <div className="mt-2">
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// ENERGY METER
// ============================================
const EnergyMeter = ({ level }: { level: number }) => {
  return (
    <div className="flex items-center gap-2">
      <Flame className="w-4 h-4 text-orange-500" />
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"
          animate={{ width: `${level}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-orange-500 text-xs font-bold">{level}%</span>
    </div>
  );
};

// ============================================
// MAIN EXPORT - DJ SESSION MODE
// ============================================
export const DJSessionMode = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
  } = usePlayerStore();

  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [visibleComments, setVisibleComments] = useState<LiveComment[]>([]);
  const [energyLevel, setEnergyLevel] = useState(65);
  const commentIndexRef = useRef(0);

  // Auto-add comments when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (commentIndexRef.current < LIVE_COMMENTS.length) {
        setVisibleComments(prev => [...prev, LIVE_COMMENTS[commentIndexRef.current]]);
        commentIndexRef.current++;

        // Boost energy with comments
        setEnergyLevel(prev => Math.min(100, prev + 3));
      } else {
        // Reset and loop
        commentIndexRef.current = 0;
        setVisibleComments([]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-spawn reactions when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const emojis = ['🔥', '⚡', '❤️', '💥', '🎵', '🔊', '💜'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      handleReaction('fire', emoji);
    }, 2000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle user reactions
  const handleReaction = (type: FloatingReaction['type'], emoji: string, text?: string) => {
    const id = Date.now() + Math.random();
    const x = 10 + Math.random() * 80;
    // Pre-compute animation offsets
    const xOffset1 = (Math.random() - 0.5) * 50;
    const xOffset2 = (Math.random() - 0.5) * 80;

    setFloatingReactions(prev => [...prev, { id, type, emoji, text, x, xOffset1, xOffset2 }]);

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);

    // Boost energy
    setEnergyLevel(prev => Math.min(100, prev + 5));
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f]">
      {/* Floating Reactions Layer */}
      <FloatingReactions reactions={floatingReactions} />

      {/* TOP: Energy Meter */}
      <div className="px-4 py-3">
        <EnergyMeter level={energyLevel} />
      </div>

      {/* MIDDLE: DJ Character */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <OYODJCharacter isPlaying={isPlaying} />

        {/* Session Name */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h2 className="text-white font-black text-xl">
            VOYO <span className="text-purple-400">SESSION</span>
          </h2>
          <p className="text-white/50 text-sm">Afrobeats • Amapiano • Dancehall</p>
        </motion.div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <motion.button
            className="p-3 rounded-full bg-white/10"
            onClick={prevTrack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipBack className="w-5 h-5 text-white" />
          </motion.button>

          <motion.button
            className="p-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            onClick={togglePlay}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" fill="white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            )}
          </motion.button>

          <motion.button
            className="p-3 rounded-full bg-white/10"
            onClick={nextTrack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipForward className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* REACTIONS */}
      <div className="px-4 py-3">
        <ReactionButtons onReaction={handleReaction} />
      </div>

      {/* TRACK INFO */}
      <div className="px-4 py-2">
        <TrackInfoDisplay />
      </div>

      {/* LIVE COMMENTS */}
      <div className="px-4 pb-4">
        <LiveCommentsSection comments={visibleComments} />
      </div>
    </div>
  );
};

export default DJSessionMode;
