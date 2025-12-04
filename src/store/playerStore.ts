// VOYO Music - Global Player State (Zustand)
import { create } from 'zustand';
import { Track, ViewMode, QueueItem, HistoryItem, MoodType, Reaction, VoyoTab } from '../types';
import { TRACKS, getRandomTracks, getHotTracks, getDiscoverTracks } from '../data/tracks';

interface PlayerStore {
  // Current Track State
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  viewMode: ViewMode;
  isVideoMode: boolean;

  // Queue & History
  queue: QueueItem[];
  history: HistoryItem[];

  // Recommendations
  hotTracks: Track[];
  aiPicks: Track[];
  discoverTracks: Track[];
  isAiMode: boolean;

  // Mood Tunnel
  currentMood: MoodType | null;

  // OYÉ Reactions
  reactions: Reaction[];
  oyeScore: number;

  // Roulette
  isRouletteMode: boolean;
  rouletteTracks: Track[];

  // VOYO Superapp Tab
  voyoActiveTab: VoyoTab;
  setVoyoTab: (tab: VoyoTab) => void;

  // Actions - Playback
  setCurrentTrack: (track: Track) => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // Actions - View Mode
  cycleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleVideoMode: () => void;

  // Actions - Queue
  addToQueue: (track: Track, position?: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // Actions - History
  addToHistory: (track: Track, duration: number) => void;

  // Actions - Recommendations
  refreshRecommendations: () => void;
  toggleAiMode: () => void;

  // Actions - Mood
  setMood: (mood: MoodType | null) => void;

  // Actions - Reactions
  addReaction: (reaction: Omit<Reaction, 'id' | 'createdAt'>) => void;
  multiplyReaction: (reactionId: string) => void;
  clearReactions: () => void;

  // Actions - Roulette
  startRoulette: () => void;
  stopRoulette: (track: Track) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // Initial State
  currentTrack: TRACKS[0],
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 80,
  viewMode: 'card',
  isVideoMode: false,

  queue: TRACKS.slice(1, 4).map((track) => ({
    track,
    addedAt: new Date().toISOString(),
    source: 'auto' as const,
  })),
  history: [],

  hotTracks: getHotTracks(),
  aiPicks: getRandomTracks(5),
  discoverTracks: getDiscoverTracks([]),
  isAiMode: true,

  currentMood: 'afro',

  reactions: [],
  oyeScore: 0,

  isRouletteMode: false,
  rouletteTracks: TRACKS,

  // VOYO Superapp Tab - Default to music
  voyoActiveTab: 'music',
  setVoyoTab: (tab) => set({ voyoActiveTab: tab }),

  // Playback Actions
  setCurrentTrack: (track) => {
    const state = get();
    // Add current track to history before switching
    if (state.currentTrack) {
      get().addToHistory(state.currentTrack, state.currentTime);
    }
    set({ currentTrack: track, isPlaying: true, progress: 0, currentTime: 0 });
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setProgress: (progress) => set({ progress }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  seekTo: (time) => set({ currentTime: time }),

  setVolume: (volume) => set({ volume }),

  nextTrack: () => {
    const state = get();
    if (state.queue.length > 0) {
      const [next, ...rest] = state.queue;
      if (state.currentTrack) {
        get().addToHistory(state.currentTrack, state.currentTime);
      }
      set({
        currentTrack: next.track,
        queue: rest,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
    }
  },

  prevTrack: () => {
    const state = get();
    if (state.history.length > 0) {
      const lastPlayed = state.history[state.history.length - 1];
      set({
        currentTrack: lastPlayed.track,
        history: state.history.slice(0, -1),
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
    }
  },

  // View Mode Actions
  cycleViewMode: () => {
    const modes: ViewMode[] = ['card', 'lyrics', 'video', 'feed'];
    set((state) => {
      const currentIndex = modes.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { viewMode: modes[nextIndex] };
    });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleVideoMode: () => set((state) => ({ isVideoMode: !state.isVideoMode })),

  // Queue Actions
  addToQueue: (track, position) => {
    set((state) => {
      const newItem: QueueItem = {
        track,
        addedAt: new Date().toISOString(),
        source: 'manual',
      };
      if (position !== undefined) {
        const newQueue = [...state.queue];
        newQueue.splice(position, 0, newItem);
        return { queue: newQueue };
      }
      return { queue: [...state.queue, newItem] };
    });
  },

  removeFromQueue: (index) => {
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index),
    }));
  },

  clearQueue: () => set({ queue: [] }),

  reorderQueue: (fromIndex, toIndex) => {
    set((state) => {
      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { queue: newQueue };
    });
  },

  // History Actions
  addToHistory: (track, duration) => {
    set((state) => ({
      history: [
        ...state.history,
        {
          track,
          playedAt: new Date().toISOString(),
          duration,
          oyeReactions: 0,
        },
      ],
    }));
  },

  // Recommendation Actions
  refreshRecommendations: () => {
    const state = get();
    const excludeIds = [
      state.currentTrack?.id,
      ...state.queue.map((q) => q.track.id),
      ...state.history.slice(-5).map((h) => h.track.id),
    ].filter(Boolean) as string[];

    set({
      hotTracks: getHotTracks(),
      aiPicks: getRandomTracks(5),
      discoverTracks: getDiscoverTracks(excludeIds),
    });
  },

  toggleAiMode: () => set((state) => ({ isAiMode: !state.isAiMode })),

  // Mood Actions
  setMood: (mood) => set({ currentMood: mood }),

  // Reaction Actions
  addReaction: (reaction) => {
    const newReaction: Reaction = {
      ...reaction,
      id: `reaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      reactions: [...state.reactions, newReaction],
      oyeScore: state.oyeScore + reaction.multiplier,
    }));

    // Auto-remove after animation (2s)
    setTimeout(() => {
      set((state) => ({
        reactions: state.reactions.filter((r) => r.id !== newReaction.id),
      }));
    }, 2000);
  },

  multiplyReaction: (reactionId) => {
    set((state) => ({
      reactions: state.reactions.map((r) =>
        r.id === reactionId ? { ...r, multiplier: r.multiplier * 2 } : r
      ),
      oyeScore: state.oyeScore + 1,
    }));
  },

  clearReactions: () => set({ reactions: [] }),

  // Roulette Actions
  startRoulette: () => set({ isRouletteMode: true }),

  stopRoulette: (track) => {
    set({ isRouletteMode: false });
    get().setCurrentTrack(track);
  },
}));
