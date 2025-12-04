// VOYO Music - Music Roulette Component
// Curved circular track selector like music notes swirling around a treble clef
import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Flame, Sparkles } from 'lucide-react';
import { Track } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';

interface MusicRouletteProps {
  tracks: Track[];
  side: 'left' | 'right';
  label: string;
  icon: 'hot' | 'discover';
  accentColor: string;
}

export const MusicRoulette = ({ tracks, side, label, icon, accentColor }: MusicRouletteProps) => {
  const { setCurrentTrack } = usePlayerStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const rotation = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate positions for tracks in a semi-circle arc
  const getTrackPosition = (index: number, total: number) => {
    // Arc spans from -60deg to +60deg (120 degree arc)
    const arcStart = side === 'left' ? -70 : -70;
    const arcEnd = side === 'left' ? 70 : 70;
    const arcRange = arcEnd - arcStart;

    const angleStep = arcRange / (total - 1 || 1);
    const angle = arcStart + (index * angleStep);
    const angleRad = (angle * Math.PI) / 180;

    // Radius of the arc
    const radius = 180;

    // Calculate x, y based on which side
    const x = side === 'left'
      ? -radius + Math.cos(angleRad) * radius
      : radius - Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;

    // Scale based on position (center = bigger)
    const distanceFromCenter = Math.abs(angle);
    const scale = 1 - (distanceFromCenter / 100) * 0.4;
    const opacity = 1 - (distanceFromCenter / 100) * 0.5;
    const zIndex = Math.round((1 - distanceFromCenter / 70) * 10);

    return { x, y, scale, opacity, zIndex, angle };
  };

  // Handle drag to rotate
  const handleDrag = (event: any, info: any) => {
    const delta = info.delta.y;
    rotation.set(rotation.get() + delta * 0.5);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Snap to nearest track
    const currentRotation = rotation.get();
    const trackAngle = 25; // degrees per track
    const snappedRotation = Math.round(currentRotation / trackAngle) * trackAngle;
    const newIndex = Math.abs(Math.round(snappedRotation / trackAngle)) % tracks.length;

    animate(rotation, snappedRotation, { type: 'spring', stiffness: 300, damping: 30 });
    setSelectedIndex(Math.abs(newIndex));
  };

  const handleTrackClick = (track: Track, index: number) => {
    setCurrentTrack(track);
    setSelectedIndex(index);
  };

  // Rotate to specific track
  const rotateToTrack = (index: number) => {
    const targetRotation = -index * 25;
    animate(rotation, targetRotation, { type: 'spring', stiffness: 200, damping: 25 });
    setSelectedIndex(index);
  };

  const rotatedIndex = useTransform(rotation, (r) => {
    const idx = Math.round(-r / 25) % tracks.length;
    return idx < 0 ? tracks.length + idx : idx;
  });

  return (
    <div
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-20`}
      ref={containerRef}
    >
      {/* Label */}
      <div className={`absolute ${side === 'left' ? '-right-16' : '-left-16'} top-1/2 -translate-y-1/2`}>
        <div className="flex flex-col items-center gap-2">
          <motion.div
            className={`w-12 h-12 rounded-full flex items-center justify-center`}
            style={{
              background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
              border: `2px solid ${accentColor}60`
            }}
            whileHover={{ scale: 1.1 }}
          >
            {icon === 'hot' ? (
              <Flame className="w-6 h-6" style={{ color: accentColor }} />
            ) : (
              <Sparkles className="w-6 h-6" style={{ color: accentColor }} />
            )}
          </motion.div>
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Roulette Arc */}
      <motion.div
        className="relative w-48 h-96 cursor-grab active:cursor-grabbing"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x: side === 'left' ? -80 : 80 }}
      >
        {/* Arc guide line */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
          viewBox="-200 -200 400 400"
        >
          <path
            d={side === 'left'
              ? "M -180 -120 Q -180 0 -180 120"
              : "M 180 -120 Q 180 0 180 120"
            }
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>

        {/* Track circles */}
        {tracks.slice(0, 7).map((track, index) => {
          const pos = getTrackPosition(index, Math.min(tracks.length, 7));
          const isSelected = index === selectedIndex;

          return (
            <motion.div
              key={track.id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                x: pos.x,
                y: pos.y,
                scale: pos.scale,
                opacity: pos.opacity,
                zIndex: pos.zIndex,
              }}
              animate={{
                x: pos.x,
                y: pos.y,
                scale: isSelected ? pos.scale * 1.2 : pos.scale,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <motion.button
                className={`
                  relative w-16 h-16 rounded-full overflow-hidden
                  ${isSelected
                    ? 'shadow-lg'
                    : 'ring-1 ring-white/20'
                  }
                `}
                style={{
                  boxShadow: isSelected ? `0 0 20px ${accentColor}60, 0 0 0 2px ${accentColor}` : undefined,
                }}
                onClick={() => handleTrackClick(track, index)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={getYouTubeThumbnail(track.youtubeVideoId, 'high')}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center bg-black/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}
                    >
                      <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent ml-0.5" />
                    </div>
                  </motion.div>
                )}
              </motion.button>

              {/* Track title tooltip on hover */}
              <motion.div
                className={`
                  absolute ${side === 'left' ? 'left-full ml-2' : 'right-full mr-2'}
                  top-1/2 -translate-y-1/2 whitespace-nowrap
                  px-2 py-1 rounded-lg bg-black/80 backdrop-blur-sm text-xs
                  pointer-events-none opacity-0 group-hover:opacity-100
                `}
                initial={{ opacity: 0, x: side === 'left' ? -10 : 10 }}
                whileHover={{ opacity: 1, x: 0 }}
              >
                <p className="font-medium truncate max-w-24">{track.title}</p>
                <p className="text-white/60 text-[10px] truncate">{track.artist}</p>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className={`absolute ${side === 'left' ? 'right-0' : 'left-0'} bottom-0 text-[10px] text-white/40`}
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        drag to spin
      </motion.div>
    </div>
  );
};
