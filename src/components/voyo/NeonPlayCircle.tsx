/**
 * VOYO Music - Neon Play Circle
 * CENTER: Big glowing neon circle with pause/play icon and waveform animation
 * Reference: VOYO - Portrait mode Mobile.jpg
 *
 * The signature VOYO player - a mesmerizing neon circle that pulses with the music
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

// Waveform bars inside the play circle
const Waveform = ({ isPlaying }: { isPlaying: boolean }) => {
  const bars = 12;

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = i * 0.05;
        const baseHeight = Math.sin((i / bars) * Math.PI) * 24 + 8;

        return (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-purple-400 to-pink-400"
            animate={isPlaying ? {
              height: [baseHeight * 0.3, baseHeight, baseHeight * 0.5, baseHeight * 0.8, baseHeight * 0.3],
            } : {
              height: baseHeight * 0.3,
            }}
            transition={isPlaying ? {
              duration: 0.8,
              repeat: Infinity,
              delay,
              ease: "easeInOut",
            } : {
              duration: 0.3,
            }}
          />
        );
      })}
    </div>
  );
};

// Neon glow ring animation
const GlowRing = ({ size, delay = 0, intensity = 1 }: { size: number; delay?: number; intensity?: number }) => {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, transparent 60%, rgba(168, 85, 247, ${0.1 * intensity}) 70%, transparent 80%)`,
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3 * intensity, 0.7 * intensity, 0.3 * intensity],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
};

export const NeonPlayCircle = () => {
  const { isPlaying, togglePlay, nextTrack, prevTrack, currentTrack, progress } = usePlayerStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Audio visualizer effect on canvas (simulated for now)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        // Draw pulsing circle
        const time = Date.now() / 1000;
        const pulseRadius = radius + Math.sin(time * 3) * 5;

        // Outer glow
        const gradient = ctx.createRadialGradient(
          centerX, centerY, pulseRadius * 0.8,
          centerX, centerY, pulseRadius * 1.3
        );
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
        gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Progress ring
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          centerX, centerY, radius + 15,
          -Math.PI / 2,
          -Math.PI / 2 + (progress / 100) * Math.PI * 2
        );
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, progress]);

  return (
    <div className="relative flex items-center justify-center py-8">
      {/* Skip Previous Button */}
      <motion.button
        className="absolute left-8 p-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        onClick={prevTrack}
        whileHover={{ scale: 1.1, x: -5 }}
        whileTap={{ scale: 0.9 }}
      >
        <SkipBack className="w-6 h-6 text-white/70" fill="currentColor" />
      </motion.button>

      {/* Main Neon Circle */}
      <div className="relative flex items-center justify-center">
        {/* Canvas for glow effects */}
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          className="absolute pointer-events-none"
        />

        {/* Multiple glow rings */}
        <GlowRing size={200} delay={0} intensity={isPlaying ? 1 : 0.3} />
        <GlowRing size={220} delay={0.5} intensity={isPlaying ? 0.8 : 0.2} />
        <GlowRing size={240} delay={1} intensity={isPlaying ? 0.5 : 0.1} />

        {/* Main Circle Button */}
        <motion.button
          className={`
            relative w-40 h-40 rounded-full flex flex-col items-center justify-center gap-3
            bg-gradient-to-br from-purple-900/80 via-purple-800/60 to-pink-900/80
            border-2 border-purple-500/50
            shadow-[0_0_60px_rgba(168,85,247,0.5),inset_0_0_30px_rgba(168,85,247,0.2)]
            transition-all duration-300
            ${isPlaying ? 'shadow-[0_0_80px_rgba(168,85,247,0.7),inset_0_0_40px_rgba(168,85,247,0.3)]' : ''}
          `}
          onClick={togglePlay}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={isPlaying ? {
            boxShadow: [
              '0 0 60px rgba(168,85,247,0.5), inset 0 0 30px rgba(168,85,247,0.2)',
              '0 0 80px rgba(168,85,247,0.7), inset 0 0 40px rgba(168,85,247,0.3)',
              '0 0 60px rgba(168,85,247,0.5), inset 0 0 30px rgba(168,85,247,0.2)',
            ],
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Inner glow gradient */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-t from-purple-900/50 to-transparent" />

          {/* Play/Pause Icon */}
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative z-10"
              >
                <Pause className="w-12 h-12 text-white" fill="white" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative z-10"
              >
                <Play className="w-12 h-12 text-white ml-2" fill="white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Waveform below icon */}
          <div className="relative z-10 opacity-80">
            <Waveform isPlaying={isPlaying} />
          </div>
        </motion.button>

        {/* Track Info below circle */}
        {currentTrack && (
          <motion.div
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-lg font-bold text-white truncate max-w-48">
              {currentTrack.title}
            </h3>
            <p className="text-sm text-white/60 truncate max-w-40">
              {currentTrack.artist}
            </p>
          </motion.div>
        )}
      </div>

      {/* Skip Next Button */}
      <motion.button
        className="absolute right-8 p-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        onClick={nextTrack}
        whileHover={{ scale: 1.1, x: 5 }}
        whileTap={{ scale: 0.9 }}
      >
        <SkipForward className="w-6 h-6 text-white/70" fill="currentColor" />
      </motion.button>
    </div>
  );
};
