/**
 * PlaybackControls Usage Examples
 *
 * Import the component and use it anywhere in your VOYO app.
 */

import { PlaybackControls } from './PlaybackControls';

// Example 1: Full controls with labels (default)
export const FullControls = () => {
  return (
    <div className="p-4">
      <PlaybackControls />
    </div>
  );
};

// Example 2: Compact mode (icons only)
export const CompactControls = () => {
  return (
    <div className="p-4">
      <PlaybackControls compact />
    </div>
  );
};

// Example 3: Custom styling with className
export const CustomStyledControls = () => {
  return (
    <div className="p-4">
      <PlaybackControls
        className="border-2 border-purple-500/20"
      />
    </div>
  );
};

// Example 4: Integrate into existing player UI
export const PlayerWithControls = () => {
  return (
    <div className="flex flex-col gap-4 p-6 bg-black/20 rounded-2xl">
      {/* Main playback controls (play/pause/next/prev) */}
      <div className="flex items-center justify-center gap-6">
        {/* ... your existing play/pause buttons ... */}
      </div>

      {/* Add playback controls below */}
      <PlaybackControls className="justify-center" />
    </div>
  );
};

// Example 5: Bottom bar with controls
export const BottomBarWithControls = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Track info on left */}
        <div className="flex items-center gap-3">
          {/* ... track info ... */}
        </div>

        {/* Playback controls in center */}
        <PlaybackControls compact />

        {/* Additional controls on right */}
        <div className="flex items-center gap-3">
          {/* ... queue, lyrics buttons ... */}
        </div>
      </div>
    </div>
  );
};

/**
 * Features:
 *
 * 1. SHUFFLE MODE:
 *    - Click to toggle shuffle on/off
 *    - When activated: purple glow + spinning animation (ROULETTE effect)
 *    - When active: tracks play in random order
 *    - Visual feedback: purple color + glow when active
 *
 * 2. REPEAT MODE (cycles through 3 states):
 *    - OFF: No repeat (default)
 *    - ALL: When queue ends, restart from beginning
 *    - ONE: Replay current track continuously
 *    - Icon changes: Repeat icon for off/all, Repeat1 icon for one
 *    - Visual feedback: purple color + glow when active
 *
 * 3. VOLUME CONTROL:
 *    - Horizontal slider (0-100%)
 *    - Click anywhere on bar to jump to that volume
 *    - Click volume icon to toggle mute/unmute
 *    - Shows VolumeX icon when muted
 *    - Hover to reveal slider (in compact mode)
 *    - Purple gradient fill on active portion
 *
 * Props:
 * - className?: Additional CSS classes
 * - compact?: true = icons only, false = icons + labels (default: false)
 */
