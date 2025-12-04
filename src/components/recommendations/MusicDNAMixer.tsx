// VOYO Music - Music DNA Mixer
// The ultimate recommendation system - like a DJ mixing board
// LEFT (HOT) ↕ | CENTER (AI Mix) ↔ | RIGHT (DISCOVER) ↕
// Horizontal swipe on center blends the two sides like DNA strands

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Flame, Sparkles, Brain, ChevronUp, Shuffle } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getYouTubeThumbnail, MOOD_TUNNELS } from '../../data/tracks';

// DNA String particle effect
const DNAString = ({
  from,
  to,
  color,
  delay = 0,
  direction = 'right'
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  delay?: number;
  direction?: 'left' | 'right';
}) => {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: from.x, top: from.y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 1, 0.5],
        x: [0, (to.x - from.x) * 0.33, (to.x - from.x) * 0.66, to.x - from.x],
        y: [0, -20, 20, to.y - from.y],
      }}
      transition={{
        duration: 1.5,
        delay,
        ease: "easeInOut",
      }}
    >
      <div
        className="w-3 h-3 rounded-full blur-sm"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
      />
    </motion.div>
  );
};

// Circular track thumbnail
const TrackCircle = ({
  track,
  size = 56,
  isSelected = false,
  accentColor,
  onClick,
  showTitle = false,
}: {
  track: Track;
  size?: number;
  isSelected?: boolean;
  accentColor: string;
  onClick: () => void;
  showTitle?: boolean;
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.button
      className="relative flex-shrink-0"
      onClick={onClick}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className={`rounded-full overflow-hidden transition-all duration-200 ${
          isSelected ? 'ring-2 shadow-lg' : 'ring-1 ring-white/20'
        }`}
        style={{
          width: size,
          height: size,
          outlineColor: isSelected ? accentColor : undefined,
          boxShadow: isSelected ? `0 0 20px ${accentColor}50, 0 0 0 2px ${accentColor}` : undefined,
        }}
      >
        <img
          src={imgError
            ? getYouTubeThumbnail(track.youtubeVideoId, 'medium')
            : getYouTubeThumbnail(track.youtubeVideoId, 'high')
          }
          alt={track.title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
            </div>
          </div>
        )}
      </div>
      {showTitle && (
        <p className="text-[9px] text-white/60 mt-1 text-center truncate w-14">
          {track.title}
        </p>
      )}
    </motion.button>
  );
};

// Vertical Roulette (HOT or DISCOVER)
const VerticalRoulette = ({
  tracks,
  label,
  icon: Icon,
  accentColor,
  onTrackSelect,
  selectedMood,
  onMoodChange,
  side,
}: {
  tracks: Track[];
  label: string;
  icon: typeof Flame;
  accentColor: string;
  onTrackSelect: (track: Track) => void;
  selectedMood: string | null;
  onMoodChange: (mood: string | null) => void;
  side: 'left' | 'right';
}) => {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter tracks by mood
  const filteredTracks = selectedMood
    ? tracks.filter(t => t.mood === selectedMood || t.tags?.includes(selectedMood))
    : tracks;

  const displayTracks = filteredTracks.length > 0 ? filteredTracks : tracks;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label & Icon */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
            border: `1px solid ${accentColor}50`,
          }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <span className="text-xs font-bold uppercase" style={{ color: accentColor }}>
          {label}
        </span>
      </div>

      {/* Mood Filter Chips */}
      <div className="flex gap-1 flex-wrap justify-center max-w-32">
        {MOOD_TUNNELS.slice(0, 4).map((mood) => (
          <button
            key={mood.id}
            className={`px-2 py-0.5 rounded-full text-[8px] transition-all ${
              selectedMood === mood.id
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
            onClick={() => onMoodChange(selectedMood === mood.id ? null : mood.id)}
          >
            {mood.icon}
          </button>
        ))}
      </div>

      {/* Vertical Track Scroll */}
      <div
        ref={containerRef}
        className="relative h-48 w-16 overflow-hidden"
      >
        {/* Fade gradients */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

        {/* Scrollable tracks */}
        <motion.div
          className="flex flex-col items-center gap-3 py-8"
          drag="y"
          dragConstraints={{ top: -((displayTracks.length - 3) * 68), bottom: 0 }}
          dragElastic={0.1}
          onDrag={(_, info) => setScrollY(-info.point.y)}
        >
          {displayTracks.slice(0, 7).map((track, index) => {
            const isCenter = Math.abs(index - Math.floor(scrollY / 68)) < 1;
            return (
              <TrackCircle
                key={track.id}
                track={track}
                size={isCenter ? 56 : 48}
                isSelected={isCenter}
                accentColor={accentColor}
                onClick={() => onTrackSelect(track)}
              />
            );
          })}
        </motion.div>
      </div>

      <span className="text-[8px] text-white/30">↕ scroll</span>
    </div>
  );
};

// Center AI Mixer (horizontal)
const CenterMixer = ({
  aiTracks,
  hotTracks,
  discoverTracks,
  onTrackSelect,
  onMixDirection,
}: {
  aiTracks: Track[];
  hotTracks: Track[];
  discoverTracks: Track[];
  onTrackSelect: (track: Track) => void;
  onMixDirection: (direction: 'left' | 'right') => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dnaParticles, setDnaParticles] = useState<Array<{id: number; direction: 'left' | 'right'}>>([]);
  const scrollX = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger DNA particles on swipe
  const triggerDNA = (direction: 'left' | 'right') => {
    const newParticles = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i,
      direction,
    }));
    setDnaParticles(prev => [...prev, ...newParticles]);

    // Clean up after animation
    setTimeout(() => {
      setDnaParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 2000);

    onMixDirection(direction);
  };

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50;
    if (info.offset.x > threshold || info.velocity.x > 500) {
      // Swiped RIGHT → Hot influence (right to left flow)
      triggerDNA('right');
      setCurrentIndex(i => Math.max(0, i - 1));
    } else if (info.offset.x < -threshold || info.velocity.x < -500) {
      // Swiped LEFT → Discover influence (left to right flow)
      triggerDNA('left');
      setCurrentIndex(i => Math.min(aiTracks.length - 1, i + 1));
    }
    animate(scrollX, 0, { type: 'spring', stiffness: 300, damping: 30 });
  };

  return (
    <div className="flex flex-col items-center gap-3 relative">
      {/* DNA Particles */}
      <AnimatePresence>
        {dnaParticles.map((particle) => (
          <DNAString
            key={particle.id}
            from={particle.direction === 'left' ? { x: 100, y: 80 } : { x: -100, y: 80 }}
            to={particle.direction === 'left' ? { x: -100, y: 80 } : { x: 100, y: 80 }}
            color={particle.direction === 'left' ? '#a855f7' : '#ef4444'}
            direction={particle.direction}
          />
        ))}
      </AnimatePresence>

      {/* AI Brain Icon */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/50">
          <Brain className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      <span className="text-[10px] text-blue-400 font-bold uppercase">AI MIX</span>

      {/* Horizontal scroll container */}
      <div
        ref={containerRef}
        className="relative w-40 h-24 overflow-hidden"
      >
        {/* DNA String decorations */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <linearGradient id="dnaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path
            d="M 0 40 Q 40 20 80 40 Q 120 60 160 40"
            fill="none"
            stroke="url(#dnaGradient)"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
          <path
            d="M 0 50 Q 40 70 80 50 Q 120 30 160 50"
            fill="none"
            stroke="url(#dnaGradient)"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
        </svg>

        {/* Swipeable track row */}
        <motion.div
          className="flex items-center justify-center gap-3 h-full cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          style={{ x: scrollX }}
          onDragEnd={handleDragEnd}
        >
          {/* Direction indicators */}
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 text-purple-400/50"
            animate={{ x: [-5, 0, -5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ←
          </motion.div>

          {aiTracks.slice(currentIndex, currentIndex + 3).map((track, index) => (
            <TrackCircle
              key={track.id}
              track={track}
              size={index === 1 ? 64 : 48}
              isSelected={index === 1}
              accentColor="#3b82f6"
              onClick={() => onTrackSelect(track)}
              showTitle={index === 1}
            />
          ))}

          <motion.div
            className="absolute right-0 top-1/2 -translate-y-1/2 text-red-400/50"
            animate={{ x: [5, 0, 5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            →
          </motion.div>
        </motion.div>
      </div>

      {/* Swipe hints */}
      <div className="flex justify-between w-full text-[8px] px-2">
        <span className="text-purple-400/60">← discover</span>
        <span className="text-red-400/60">hot →</span>
      </div>

      <span className="text-[8px] text-white/30">↔ swipe to mix</span>
    </div>
  );
};

// Main Export
export const MusicDNAMixer = () => {
  const {
    hotTracks,
    aiPicks,
    discoverTracks,
    queue,
    setCurrentTrack,
    addToQueue,
    refreshRecommendations,
  } = usePlayerStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [hotMood, setHotMood] = useState<string | null>(null);
  const [discoverMood, setDiscoverMood] = useState<string | null>(null);
  const [mixedTracks, setMixedTracks] = useState<Track[]>(aiPicks);
  const [showDNAEffect, setShowDNAEffect] = useState(false);

  // Update mixed tracks when ai picks change
  useEffect(() => {
    setMixedTracks(aiPicks);
  }, [aiPicks]);

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
  };

  const handleMixDirection = (direction: 'left' | 'right') => {
    setShowDNAEffect(true);
    setTimeout(() => setShowDNAEffect(false), 1500);

    if (direction === 'left') {
      // More discovery influence - blend discover into mix
      const newMix = [...mixedTracks];
      if (discoverTracks.length > 0) {
        const randomDiscover = discoverTracks[Math.floor(Math.random() * discoverTracks.length)];
        newMix.unshift(randomDiscover);
        if (newMix.length > 5) newMix.pop();
      }
      setMixedTracks(newMix);
    } else {
      // More hot influence - blend hot into mix
      const newMix = [...mixedTracks];
      if (hotTracks.length > 0) {
        const randomHot = hotTracks[Math.floor(Math.random() * hotTracks.length)];
        newMix.push(randomHot);
        if (newMix.length > 5) newMix.shift();
      }
      setMixedTracks(newMix);

      // If queue is empty, hot tracks fill it
      if (queue.length === 0 && hotTracks.length > 0) {
        hotTracks.slice(0, 3).forEach(track => addToQueue(track));
      }
    }
  };

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-30"
      initial={{ y: '100%' }}
      animate={{ y: isExpanded ? '0%' : 'calc(100% - 50px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Pull Handle */}
      <div
        className="flex items-center justify-center py-2 cursor-pointer bg-gradient-to-t from-[#0a0a0f] to-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 text-white/50">
          <motion.div
            animate={{ y: isExpanded ? 2 : -2 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.8 }}
          >
            <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </motion.div>

          {/* DNA helix preview when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-1">
              <motion.span
                className="text-red-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ●
              </motion.span>
              <span className="text-[10px] uppercase tracking-wider">Music DNA</span>
              <motion.span
                className="text-purple-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              >
                ●
              </motion.span>
            </div>
          )}

          <motion.div
            animate={{ y: isExpanded ? 2 : -2 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.8 }}
          >
            <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#0a0a0f]/98 backdrop-blur-xl border-t border-white/10 rounded-t-3xl">
        {/* DNA Effect Overlay */}
        <AnimatePresence>
          {showDNAEffect && (
            <motion.div
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-t-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Animated DNA strands */}
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${10 + i * 10}%`,
                    background: i % 2 === 0 ? '#ef4444' : '#a855f7',
                    boxShadow: `0 0 10px ${i % 2 === 0 ? '#ef4444' : '#a855f7'}`,
                  }}
                  animate={{
                    y: [100, -100],
                    x: [0, Math.sin(i) * 30, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.1,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Three-column layout */}
        <div className="flex items-start justify-between gap-4 px-4 py-6">
          {/* LEFT: HOT Roulette */}
          <VerticalRoulette
            tracks={hotTracks}
            label="HOT"
            icon={Flame}
            accentColor="#ef4444"
            onTrackSelect={handleTrackSelect}
            selectedMood={hotMood}
            onMoodChange={setHotMood}
            side="left"
          />

          {/* CENTER: AI Mixer */}
          <CenterMixer
            aiTracks={mixedTracks}
            hotTracks={hotTracks}
            discoverTracks={discoverTracks}
            onTrackSelect={handleTrackSelect}
            onMixDirection={handleMixDirection}
          />

          {/* RIGHT: DISCOVER Roulette */}
          <VerticalRoulette
            tracks={discoverTracks}
            label="DISCOVER"
            icon={Sparkles}
            accentColor="#a855f7"
            onTrackSelect={handleTrackSelect}
            selectedMood={discoverMood}
            onMoodChange={setDiscoverMood}
            side="right"
          />
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <motion.button
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
            onClick={refreshRecommendations}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Shuffle className="w-3 h-3" />
            Refresh Mix
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
