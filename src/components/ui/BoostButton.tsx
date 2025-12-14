/**
 * VOYO Boost Button - Lightning Power
 *
 * One button = Download HD + Audio Enhancement
 * Lightning bolt glows when boosted, pulses when charging
 *
 * Variants:
 * - toolbar: Matches RightToolbar button style (40x40, fits with Like/Settings)
 * - floating: Standalone ergonomic thumb position
 * - mini: Compact for tight spaces
 * - inline: Text + icon horizontal
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { useDownloadStore } from '../../store/downloadStore';
import { getThumbnailUrl } from '../../utils/imageHelpers';

interface BoostButtonProps {
  variant?: 'toolbar' | 'floating' | 'mini' | 'inline';
  className?: string;
}

// Clean Lightning Bolt SVG Icon
const LightningIcon = ({ isGlowing, isCharging, size = 14 }: { isGlowing: boolean; isCharging: boolean; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="relative"
  >
    {/* Outer glow when boosted */}
    {isGlowing && (
      <motion.path
        d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
        fill="url(#lightningGlow)"
        filter="blur(4px)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    )}

    {/* Main lightning bolt */}
    <motion.path
      d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
      fill={isGlowing ? "url(#lightningGradient)" : "#6b6b7a"}
      stroke={isGlowing ? "#fbbf24" : "transparent"}
      strokeWidth="0.5"
      animate={isCharging ? {
        opacity: [1, 0.6, 1],
        scale: [1, 1.1, 1]
      } : {}}
      transition={{ duration: 0.4, repeat: isCharging ? Infinity : 0 }}
    />

    {/* Gradients */}
    <defs>
      <linearGradient id="lightningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
      <linearGradient id="lightningGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde047" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
      </linearGradient>
    </defs>
  </svg>
);

// Circular progress ring with priming animation
// Phase 1: 2 full spins (priming) → Phase 2: actual progress
const ProgressRing = ({ progress, isStarting, size = 44 }: { progress: number; isStarting: boolean; size?: number }) => {
  const [phase, setPhase] = useState<'priming' | 'progress'>('priming');
  const [primingRound, setPrimingRound] = useState(0);

  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Handle priming animation (2 full rounds)
  useEffect(() => {
    if (!isStarting) {
      setPhase('priming');
      setPrimingRound(0);
      return;
    }

    // If we have real progress > 10%, skip to progress phase
    if (progress > 10) {
      setPhase('progress');
      return;
    }

    // Priming: 2 rounds of ~400ms each
    if (phase === 'priming' && primingRound < 2) {
      const timer = setTimeout(() => {
        setPrimingRound(prev => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }

    // After 2 rounds, switch to progress phase
    if (primingRound >= 2) {
      setPhase('progress');
    }
  }, [isStarting, progress, phase, primingRound]);

  // Reset when not downloading
  useEffect(() => {
    if (!isStarting) {
      setPhase('priming');
      setPrimingRound(0);
    }
  }, [isStarting]);

  // Calculate stroke offset based on phase
  const getStrokeOffset = () => {
    if (phase === 'priming') {
      // Animate full circle based on priming round
      return 0; // Full circle during priming animation
    }
    // Real progress
    return circumference - (circumference * progress) / 100;
  };

  return (
    <svg
      className="absolute inset-0 -rotate-90 pointer-events-none"
      width={size}
      height={size}
      style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))' }}
    >
      {/* Background ring (dim) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(251, 191, 36, 0.15)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#boostGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={phase === 'priming' ? {
          // Priming: fill up completely, then reset
          strokeDashoffset: [circumference, 0, circumference, 0],
        } : {
          // Progress: show actual progress
          strokeDashoffset: getStrokeOffset(),
        }}
        transition={phase === 'priming' ? {
          duration: 0.8,
          times: [0, 0.45, 0.5, 1],
          ease: 'easeInOut',
        } : {
          duration: 0.3,
          ease: 'easeOut',
        }}
      />
      {/* Gradient definition */}
      <defs>
        <linearGradient id="boostGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Completion burst animation
const CompletionBurst = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 rounded-full pointer-events-none"
      initial={{ scale: 1, opacity: 1 }}
      animate={{
        scale: [1, 1.8, 2.2],
        opacity: [1, 0.6, 0],
        background: ['rgba(251,191,36,0.6)', 'rgba(249,115,22,0.4)', 'rgba(249,115,22,0)']
      }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  );
};

// Spark particles when boosting
const BoostSparks = () => (
  <div className="absolute inset-0 pointer-events-none overflow-visible">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-yellow-400 rounded-full"
        style={{
          left: '50%',
          top: '50%',
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 1, 0],
          scale: [0, 1, 0],
          x: [0, (Math.random() - 0.5) * 40],
          y: [0, (Math.random() - 0.5) * 40],
        }}
        transition={{
          duration: 0.6,
          delay: i * 0.1,
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
    ))}
  </div>
);

export const BoostButton = ({ variant = 'toolbar', className = '' }: BoostButtonProps) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playbackSource = usePlayerStore((state) => state.playbackSource);

  const {
    boostTrack,
    getDownloadStatus,
    downloads,
    isTrackBoosted,
  } = useDownloadStore();

  const [isBoosted, setIsBoosted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showSparks, setShowSparks] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  // Check if current track is already boosted
  useEffect(() => {
    const checkBoosted = async () => {
      if (!currentTrack?.trackId) {
        setIsBoosted(false);
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      const boosted = await isTrackBoosted(currentTrack.trackId);
      setIsBoosted(boosted);
      setIsChecking(false);
    };

    checkBoosted();
  }, [currentTrack?.trackId, isTrackBoosted]);

  // Update when downloads complete
  useEffect(() => {
    if (!currentTrack?.trackId) return;

    const status = downloads.get(currentTrack.trackId);
    if (status?.status === 'complete') {
      // Trigger completion burst, then show boosted state
      setShowBurst(true);
      setShowSparks(true);
      setTimeout(() => {
        setIsBoosted(true);
        setShowSparks(false);
      }, 800);
    }
  }, [downloads, currentTrack?.trackId]);

  if (!currentTrack?.trackId) return null;

  const downloadStatus = getDownloadStatus(currentTrack.trackId);
  const isDownloading = downloadStatus?.status === 'downloading';
  const isQueued = downloadStatus?.status === 'queued';
  const progress = downloadStatus?.progress || 0;
  const isActive = isBoosted || playbackSource === 'cached';

  const handleBoost = () => {
    if (isDownloading || isQueued || isBoosted) return;

    setShowSparks(true);
    boostTrack(
      currentTrack.trackId,
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration || 0,
      getThumbnailUrl(currentTrack.trackId, 'medium')
    );
  };

  // ============================================
  // TOOLBAR VARIANT - Premium floating style (matches Like/Settings buttons)
  // ============================================
  if (variant === 'toolbar') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued || isActive}
        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 relative ${
          isActive
            ? 'bg-yellow-500/30 border border-yellow-400/60 shadow-yellow-500/30'
            : 'bg-black/40 border border-white/10 hover:bg-black/50 hover:border-white/20'
        } ${className}`}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.9 }}
        title={isActive ? 'Boosted' : isDownloading ? `Boosting ${progress}%` : 'Boost (HD + Enhanced Audio)'}
      >
        {/* Glow effect when boosted */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full bg-yellow-500/20 blur-md -z-10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Completion burst when boost finishes */}
        {showBurst && <CompletionBurst onComplete={() => setShowBurst(false)} />}

        {/* Progress ring - fills around the button edge */}
        {(isDownloading || isQueued) && <ProgressRing progress={progress} isStarting={isDownloading || isQueued} size={44} />}

        {/* Lightning icon */}
        <LightningIcon isGlowing={isActive} isCharging={isDownloading || isQueued} size={16} />
        {showSparks && <BoostSparks />}
      </motion.button>
    );
  }

  // ============================================
  // FLOATING VARIANT - Standalone ergonomic position
  // ============================================
  if (variant === 'floating') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued || isActive}
        className={`relative ${className}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)', filter: 'blur(8px)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          isActive ? 'bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border border-yellow-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
        }`}>
          {(isDownloading || isQueued) && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(251,191,36,0.2)" strokeWidth="2" />
              <motion.circle cx="24" cy="24" r="22" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeDasharray={138} strokeDashoffset={138 - (138 * progress) / 100} />
            </svg>
          )}
          <LightningIcon isGlowing={isActive} isCharging={isDownloading || isQueued} size={20} />
          {showSparks && <BoostSparks />}
        </div>
      </motion.button>
    );
  }

  // ============================================
  // MINI VARIANT - For tight spaces
  // ============================================
  if (variant === 'mini') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued || isActive}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-yellow-500/20' : 'bg-white/5 hover:bg-white/10'} ${className}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <LightningIcon isGlowing={isActive} isCharging={isDownloading} size={12} />
      </motion.button>
    );
  }

  // ============================================
  // INLINE VARIANT - Text with icon
  // ============================================
  return (
    <motion.button
      onClick={handleBoost}
      disabled={isDownloading || isQueued || isActive}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isActive ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <LightningIcon isGlowing={isActive} isCharging={isDownloading} size={14} />
      <span className={`text-xs font-medium ${isActive ? 'text-yellow-400' : 'text-white/60'}`}>
        {isActive ? 'Boosted' : isDownloading ? `${progress}%` : 'Boost'}
      </span>
    </motion.button>
  );
};

export default BoostButton;
