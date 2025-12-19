/**
 * FeedTransitions - Smooth Animation Helpers for Feed
 *
 * Provides smooth crossfade, scale, and parallax effects
 * for the vertical feed scroll experience.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';

// ============================================
// PARALLAX BACKGROUND
// ============================================
// Creates a subtle parallax effect on the background

interface ParallaxBackgroundProps {
  children: React.ReactNode;
  intensity?: number; // 0-1, how much parallax
}

export const ParallaxBackground = ({
  children,
  intensity = 0.3,
}: ParallaxBackgroundProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: ref });

  const y = useTransform(
    scrollY,
    [0, 1000],
    [0, -100 * intensity]
  );

  return (
    <motion.div ref={ref} className="relative overflow-hidden" style={{ y }}>
      {children}
    </motion.div>
  );
};

// ============================================
// CARD SCALE ON SCROLL
// ============================================
// Cards scale slightly based on distance from center

interface ScaleOnScrollProps {
  children: React.ReactNode;
  isActive: boolean;
  index: number;
  currentIndex: number;
}

export const ScaleOnScroll = ({
  children,
  isActive,
  index,
  currentIndex,
}: ScaleOnScrollProps) => {
  const distance = Math.abs(index - currentIndex);
  const scale = isActive ? 1 : Math.max(0.9, 1 - distance * 0.05);
  const opacity = isActive ? 1 : Math.max(0.3, 1 - distance * 0.4);

  return (
    <motion.div
      animate={{
        scale,
        opacity,
      }}
      transition={{
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

// ============================================
// SMOOTH SNAP SCROLL HOOK
// ============================================
// Enhanced scroll with momentum and smooth snapping

interface UseSmoothSnapScrollOptions {
  itemCount: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onIndexChange?: (index: number) => void;
}

export const useSmoothSnapScroll = ({
  itemCount,
  containerRef,
  onIndexChange,
}: UseSmoothSnapScrollOptions) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!containerRef.current) return;

    const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
    const itemHeight = containerRef.current.clientHeight;

    containerRef.current.scrollTo({
      top: clampedIndex * itemHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });

    setCurrentIndex(clampedIndex);
    onIndexChange?.(clampedIndex);
  }, [containerRef, itemCount, onIndexChange]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    setIsScrolling(true);

    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set new timeout for when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);

      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const itemHeight = containerRef.current.clientHeight;
      const newIndex = Math.round(scrollTop / itemHeight);

      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        onIndexChange?.(newIndex);
      }
    }, 100);
  }, [containerRef, currentIndex, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        scrollToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        scrollToIndex(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scrollToIndex]);

  return {
    currentIndex,
    isScrolling,
    scrollToIndex,
    handleScroll,
    scrollNext: () => scrollToIndex(currentIndex + 1),
    scrollPrev: () => scrollToIndex(currentIndex - 1),
  };
};

// ============================================
// CROSSFADE OVERLAY
// ============================================
// Smooth crossfade between cards during transition

interface CrossfadeOverlayProps {
  isTransitioning: boolean;
  direction: 'up' | 'down';
}

export const CrossfadeOverlay = ({
  isTransitioning,
  direction,
}: CrossfadeOverlayProps) => {
  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Gradient based on direction */}
          <div
            className={`absolute inset-0 ${
              direction === 'down'
                ? 'bg-gradient-to-b from-transparent via-black/30 to-black/60'
                : 'bg-gradient-to-t from-transparent via-black/30 to-black/60'
            }`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// PEEK PREVIEW
// ============================================
// Shows a preview of the next card peeking at the edge

interface PeekPreviewProps {
  thumbnail?: string;
  title?: string;
  position: 'top' | 'bottom';
  isVisible: boolean;
}

export const PeekPreview = ({
  thumbnail,
  title,
  position,
  isVisible,
}: PeekPreviewProps) => {
  return (
    <AnimatePresence>
      {isVisible && thumbnail && (
        <motion.div
          className={`absolute left-0 right-0 z-20 pointer-events-none ${
            position === 'bottom' ? 'bottom-0' : 'top-0'
          }`}
          initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
        >
          <div
            className={`h-16 ${
              position === 'bottom'
                ? 'bg-gradient-to-t from-black/80 to-transparent'
                : 'bg-gradient-to-b from-black/80 to-transparent'
            }`}
          >
            <div className="flex items-center gap-3 p-4">
              <img
                src={thumbnail}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
              />
              {title && (
                <span className="text-white/70 text-xs font-medium truncate">
                  {title}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// ENGAGEMENT TRACKER
// ============================================
// Tracks user engagement to trigger ContinuePlayingButton

interface UseEngagementTrackerOptions {
  trackId: string;
  isActive: boolean;
  isPlaying: boolean;
  watchTimeThreshold?: number; // Seconds before considered "engaged"
  onEngaged?: () => void;
}

export const useEngagementTracker = ({
  trackId,
  isActive,
  isPlaying,
  watchTimeThreshold = 8, // 8 seconds of watching = engaged
  onEngaged,
}: UseEngagementTrackerOptions) => {
  const [isEngaged, setIsEngaged] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const [hasReacted, setHasReacted] = useState(false);
  const watchTimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track watch time
  useEffect(() => {
    if (isActive && isPlaying) {
      watchTimeRef.current = setInterval(() => {
        setWatchTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (watchTimeRef.current) {
        clearInterval(watchTimeRef.current);
      }
    }

    return () => {
      if (watchTimeRef.current) {
        clearInterval(watchTimeRef.current);
      }
    };
  }, [isActive, isPlaying]);

  // Check engagement
  useEffect(() => {
    if (!isEngaged && (watchTime >= watchTimeThreshold || hasReacted)) {
      setIsEngaged(true);
      onEngaged?.();
    }
  }, [watchTime, hasReacted, watchTimeThreshold, isEngaged, onEngaged]);

  // Reset when track changes
  useEffect(() => {
    setIsEngaged(false);
    setWatchTime(0);
    setHasReacted(false);
  }, [trackId]);

  const markReacted = useCallback(() => {
    setHasReacted(true);
  }, []);

  return {
    isEngaged,
    watchTime,
    hasReacted,
    markReacted,
  };
};

export default {
  ParallaxBackground,
  ScaleOnScroll,
  useSmoothSnapScroll,
  CrossfadeOverlay,
  PeekPreview,
  useEngagementTracker,
};
