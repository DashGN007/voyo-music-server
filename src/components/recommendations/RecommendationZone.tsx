// VOYO Music - Curved Roulette Recommendation Zone
// Two half-circle arcs like music notes swirling - HOT on left, DISCOVER on right
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { Flame, Sparkles, ChevronUp } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getYouTubeThumbnail } from '../../data/tracks';

// Single circular track item
const RouletteTrack = ({
  track,
  index,
  totalTracks,
  rotation,
  radius,
  isLeft,
  accentColor,
  onSelect,
}: {
  track: Track;
  index: number;
  totalTracks: number;
  rotation: number;
  radius: number;
  isLeft: boolean;
  accentColor: string;
  onSelect: (track: Track) => void;
}) => {
  // Calculate position on the arc
  const arcSpan = 140; // degrees
  const startAngle = isLeft ? 200 : -20; // Starting angle for left/right
  const anglePerTrack = arcSpan / Math.max(totalTracks - 1, 1);
  const baseAngle = startAngle + (index * anglePerTrack) + rotation;
  const angleRad = (baseAngle * Math.PI) / 180;

  // Position on circle
  const x = Math.cos(angleRad) * radius;
  const y = Math.sin(angleRad) * radius;

  // Scale based on position (items at center of arc are bigger)
  const normalizedAngle = ((baseAngle % 360) + 360) % 360;
  const centerAngle = isLeft ? 270 : 270;
  const distanceFromCenter = Math.abs(normalizedAngle - centerAngle);
  const scale = Math.max(0.5, 1 - (distanceFromCenter / 100) * 0.5);
  const opacity = Math.max(0.3, 1 - (distanceFromCenter / 100) * 0.7);
  const zIndex = Math.round((1 - distanceFromCenter / 70) * 10);

  // Is this the "selected" one (closest to center)?
  const isSelected = distanceFromCenter < 20;

  return (
    <motion.button
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        x: x - 28, // center the 56px circle
        y: y - 28,
        scale,
        opacity,
        zIndex,
      }}
      onClick={() => onSelect(track)}
      whileHover={{ scale: scale * 1.2 }}
      whileTap={{ scale: scale * 0.9 }}
    >
      <div
        className={`
          w-14 h-14 rounded-full overflow-hidden transition-all duration-200
          ${isSelected ? 'shadow-lg' : 'ring-1 ring-white/20'}
        `}
        style={{
          boxShadow: isSelected ? `0 0 20px ${accentColor}50, 0 0 0 2px ${accentColor}` : undefined,
        }}
      >
        <img
          src={getYouTubeThumbnail(track.youtubeVideoId, 'high')}
          alt={track.title}
          className="w-full h-full object-cover"
        />
        {isSelected && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
            </div>
          </div>
        )}
      </div>
    </motion.button>
  );
};

// Curved Roulette Arc
const CurvedRoulette = ({
  tracks,
  isLeft,
  label,
  accentColor,
  onTrackSelect,
}: {
  tracks: Track[];
  isLeft: boolean;
  label: string;
  accentColor: string;
  onTrackSelect: (track: Track) => void;
}) => {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastY = useRef(0);
  const velocity = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);

  const radius = 120;

  // Handle drag
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastY.current = e.clientY;
    velocity.current = 0;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - lastY.current;
    velocity.current = deltaY;
    setRotation((r) => r + deltaY * 0.5);
    lastY.current = e.clientY;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Apply momentum
    const decelerate = () => {
      velocity.current *= 0.95;
      if (Math.abs(velocity.current) > 0.5) {
        setRotation((r) => r + velocity.current * 0.3);
        animationRef.current = requestAnimationFrame(decelerate);
      }
    };
    decelerate();
  };

  return (
    <div
      className={`relative ${isLeft ? 'mr-auto' : 'ml-auto'}`}
      style={{ width: 200, height: 200 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Label */}
      <div
        className={`absolute ${isLeft ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 flex flex-col items-center gap-1`}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
            border: `1px solid ${accentColor}40`,
          }}
        >
          {isLeft ? (
            <Flame className="w-5 h-5" style={{ color: accentColor }} />
          ) : (
            <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
          )}
        </div>
        <span className="text-[10px] font-bold uppercase" style={{ color: accentColor }}>
          {label}
        </span>
      </div>

      {/* Arc visual guide */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-10"
        viewBox="-100 -100 200 200"
      >
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      </svg>

      {/* Track circles */}
      {tracks.slice(0, 7).map((track, index) => (
        <RouletteTrack
          key={track.id}
          track={track}
          index={index}
          totalTracks={Math.min(tracks.length, 7)}
          rotation={rotation}
          radius={radius}
          isLeft={isLeft}
          accentColor={accentColor}
          onSelect={onTrackSelect}
        />
      ))}

      {/* Drag hint */}
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white/30"
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        drag to spin
      </motion.div>
    </div>
  );
};

export const RecommendationZone = () => {
  const {
    hotTracks,
    discoverTracks,
    setCurrentTrack,
  } = usePlayerStore();

  const [isExpanded, setIsExpanded] = useState(false);

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
  };

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-30"
      initial={{ y: '100%' }}
      animate={{ y: isExpanded ? '0%' : 'calc(100% - 60px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Pull Handle */}
      <div
        className="flex items-center justify-center py-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-white/50">
          <motion.div
            animate={{ y: isExpanded ? 3 : -3 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
          >
            <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </motion.div>
          <span className="text-[10px] uppercase tracking-wider">
            {isExpanded ? 'Collapse' : 'Music Roulettes'}
          </span>
          <motion.div
            animate={{ y: isExpanded ? 3 : -3 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
          >
            <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </motion.div>
        </div>
      </div>

      {/* Main Content - Two Curved Roulettes */}
      <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-8 max-w-2xl mx-auto">
          {/* HOT Roulette - Left */}
          <CurvedRoulette
            tracks={hotTracks}
            isLeft={true}
            label="HOT"
            accentColor="#ef4444"
            onTrackSelect={handleTrackSelect}
          />

          {/* Center divider with musical note aesthetic */}
          <div className="flex flex-col items-center gap-2 opacity-30">
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
            <span className="text-2xl">♪</span>
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          </div>

          {/* DISCOVER Roulette - Right */}
          <CurvedRoulette
            tracks={discoverTracks}
            isLeft={false}
            label="DISCOVER"
            accentColor="#a855f7"
            onTrackSelect={handleTrackSelect}
          />
        </div>

        {/* Zone descriptions */}
        <div className="flex justify-between mt-4 px-8 max-w-2xl mx-auto">
          <span className="text-[10px] text-red-400/60">Tracks you love</span>
          <span className="text-[10px] text-purple-400/60">New discoveries</span>
        </div>
      </div>
    </motion.div>
  );
};
