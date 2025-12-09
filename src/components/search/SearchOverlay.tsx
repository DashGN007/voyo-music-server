/**
 * VOYO Music - Search Overlay Component
 * Premium glassmorphism design - floaty, modern, clean
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Search, X, Loader2, Music2, Clock, Play, Plus, Check, Sparkles, ListPlus } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { searchMusic, SearchResult } from '../../services/api';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Swipeable Track Item with Light Beam Animation
interface SwipeableTrackProps {
  result: SearchResult;
  index: number;
  onSelect: (result: SearchResult) => void;
  onAddToQueue: (result: SearchResult) => void;
  isAddedToQueue: boolean;
  formatDuration: (seconds: number) => string;
  formatViews: (views: number) => string;
}

const SWIPE_THRESHOLD = 60; // pixels to trigger queue add

const SwipeableTrackItem = ({
  result,
  index,
  onSelect,
  onAddToQueue,
  isAddedToQueue,
  formatDuration,
  formatViews,
}: SwipeableTrackProps) => {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showQueueHint, setShowQueueHint] = useState(false);

  // Light beam opacity based on drag distance
  const lightBeamOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const lightBeamScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const queueTextOpacity = useTransform(x, [SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD], [0, 1]);

  const handleDragEnd = (_: never, info: PanInfo) => {
    setIsDragging(false);
    setShowQueueHint(false);

    if (info.offset.x > SWIPE_THRESHOLD) {
      // Add to queue with haptic-like feedback
      onAddToQueue(result);
    }
  };

  const handleDrag = (_: never, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD * 0.5) {
      setShowQueueHint(true);
    } else {
      setShowQueueHint(false);
    }
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Light Beam Background - reveals on swipe */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: lightBeamOpacity,
          background: 'linear-gradient(90deg, rgba(139,92,246,0.4) 0%, rgba(168,85,247,0.2) 50%, transparent 100%)',
          boxShadow: 'inset 0 0 30px rgba(139,92,246,0.3)',
        }}
      />

      {/* Queue Icon - appears on swipe */}
      <motion.div
        className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none"
        style={{
          opacity: queueTextOpacity,
          scale: lightBeamScale,
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
            boxShadow: '0 0 20px rgba(139,92,246,0.6)',
          }}
        >
          <ListPlus className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-semibold">QUEUE</span>
        </div>
      </motion.div>

      {/* Swipeable Track Card */}
      <motion.div
        className="flex items-center gap-3 p-3 cursor-pointer group relative"
        style={{
          x,
          background: isDragging ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 100 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => !isDragging && onSelect(result)}
        whileHover={!isDragging ? { background: 'rgba(255,255,255,0.08)' } : {}}
      >
        {/* Thumbnail */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.background = 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)';
              (e.target as HTMLImageElement).src = '';
            }}
          />
          <motion.div
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="w-5 h-5 text-white" fill="white" />
          </motion.div>
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white/90 font-medium truncate text-sm">{result.title}</h4>
          <p className="text-white/40 text-xs truncate">{result.artist}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/25 mt-0.5">
            <span>{formatDuration(result.duration)}</span>
            {result.views > 0 && (
              <>
                <span>•</span>
                <span>{formatViews(result.views)}</span>
              </>
            )}
          </div>
        </div>

        {/* Add to Queue Button (also visible on hover) */}
        <motion.button
          className={`p-2 rounded-full transition-all flex-shrink-0 ${
            isAddedToQueue
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            background: isAddedToQueue
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
              : 'rgba(255,255,255,0.1)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onAddToQueue(result);
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Add to Queue"
        >
          {isAddedToQueue ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <Plus className="w-4 h-4 text-white/70" />
          )}
        </motion.button>
      </motion.div>

      {/* Swipe Hint - shows briefly on first result */}
      {index === 0 && !isDragging && (
        <motion.div
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-[10px] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ delay: 1, duration: 2, repeat: 1 }}
        >
          ← swipe to queue
        </motion.div>
      )}
    </motion.div>
  );
};

const SEARCH_HISTORY_KEY = 'voyo_search_history';
const MAX_HISTORY = 10;

export const SearchOverlay = ({ isOpen, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [addedToQueue, setAddedToQueue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setCurrentTrack, addToQueue } = usePlayerStore();

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Save search to history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((q) => q !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Remove from history
  const removeFromHistory = (searchQuery: string) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((q) => q !== searchQuery);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setResults([]);
      setQuery('');
      setError(null);
    }
  }, [isOpen]);

  // Search function with debouncing
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchResults = await searchMusic(searchQuery, 15);
      setResults(searchResults);
      saveToHistory(searchQuery);
    } catch (err) {
      console.error('[SearchOverlay] Search error:', err);
      setError('Search failed. Check your connection.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleSelectTrack = (result: SearchResult) => {
    const track: Track = {
      id: result.voyoId,
      title: result.title,
      artist: result.artist,
      album: 'VOYO',
      trackId: result.voyoId,
      coverUrl: result.thumbnail,
      duration: result.duration,
      tags: ['search'],
      mood: 'afro',
      region: 'NG',
      oyeScore: result.views || 0,
      createdAt: new Date().toISOString(),
    };
    setCurrentTrack(track);
    onClose();
  };

  const handleAddToQueue = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const track: Track = {
      id: result.voyoId,
      title: result.title,
      artist: result.artist,
      album: 'VOYO',
      trackId: result.voyoId,
      coverUrl: result.thumbnail,
      duration: result.duration,
      tags: ['search'],
      mood: 'afro',
      region: 'NG',
      oyeScore: result.views || 0,
      createdAt: new Date().toISOString(),
    };
    addToQueue(track);
    setAddedToQueue(result.voyoId);
    setTimeout(() => setAddedToQueue(null), 1500);
  };

  const handlePlayAll = () => {
    if (results.length === 0) return;
    const tracks: Track[] = results.map((result) => ({
      id: result.voyoId,
      title: result.title,
      artist: result.artist,
      album: 'VOYO',
      trackId: result.voyoId,
      coverUrl: result.thumbnail,
      duration: result.duration,
      tags: ['search'],
      mood: 'afro',
      region: 'NG',
      oyeScore: result.views || 0,
      createdAt: new Date().toISOString(),
    }));
    setCurrentTrack(tracks[0]);
    tracks.slice(1).forEach((track) => addToQueue(track));
    onClose();
  };

  const handleRecentSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    performSearch(searchQuery);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
    return views.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - blurred background */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
            }}
          />

          {/* Floating Search Container */}
          <motion.div
            className="fixed inset-x-4 top-8 bottom-8 z-50 flex flex-col"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Glassmorphic Card */}
            <div
              className="flex-1 rounded-3xl overflow-hidden flex flex-col"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
              }}
            >
              {/* Header - Floating Search Bar */}
              <div className="p-4 pb-2">
                {/* Close Button - Top Right */}
                <div className="flex justify-end mb-3">
                  <motion.button
                    className="p-2 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onClick={onClose}
                    whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.15)' }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-white/70" />
                  </motion.button>
                </div>

                {/* Search Input - Glassmorphic */}
                <div className="relative">
                  <div
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search songs, artists..."
                      value={query}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none text-lg"
                    />
                    {isSearching && (
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Results Header */}
                {results.length > 0 && query && (
                  <motion.div
                    className="flex items-center justify-between mt-4 px-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>{results.length} results</span>
                    </div>
                    <motion.button
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium"
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                      }}
                      onClick={handlePlayAll}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Play className="w-4 h-4" fill="white" />
                      Play All
                    </motion.button>
                  </motion.div>
                )}
              </div>

              {/* Scrollable Results */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {/* Error State */}
                {error && (
                  <motion.div
                    className="text-center py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-red-400/80 mb-3">{error}</p>
                    <motion.button
                      className="px-4 py-2 rounded-full text-sm"
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                      onClick={() => performSearch(query)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Try Again
                    </motion.button>
                  </motion.div>
                )}

                {/* No Results */}
                {!error && results.length === 0 && !isSearching && query && (
                  <div className="text-center py-12 text-white/40">
                    <p>No results for "{query}"</p>
                  </div>
                )}

                {/* Empty State - Recent Searches or Prompt */}
                {!query && !isSearching && (
                  <>
                    {searchHistory.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 text-sm text-white/40">
                            <Clock className="w-4 h-4" />
                            <span>Recent</span>
                          </div>
                          <button
                            className="text-xs text-white/30 hover:text-white/50 transition-colors"
                            onClick={clearHistory}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="space-y-1">
                          {searchHistory.map((search, index) => (
                            <motion.div
                              key={search}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer group"
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                              }}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03 }}
                              onClick={() => handleRecentSearch(search)}
                              whileHover={{ background: 'rgba(255,255,255,0.08)' }}
                            >
                              <Clock className="w-4 h-4 text-white/30 flex-shrink-0" />
                              <span className="flex-1 text-white/70 text-sm">{search}</span>
                              <motion.button
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromHistory(search);
                                }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <X className="w-3 h-3 text-white/40" />
                              </motion.button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          <div
                            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                            style={{
                              background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(168,85,247,0.1) 100%)',
                              border: '1px solid rgba(139,92,246,0.2)',
                            }}
                          >
                            <Music2 className="w-10 h-10 text-purple-400/60" />
                          </div>
                          <p className="text-white/30 text-sm">Search for any song or artist</p>
                        </motion.div>
                      </div>
                    )}
                  </>
                )}

                {/* Results List - Swipeable tracks with light beam */}
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <SwipeableTrackItem
                      key={result.voyoId}
                      result={result}
                      index={index}
                      onSelect={handleSelectTrack}
                      onAddToQueue={(r) => {
                        const track: Track = {
                          id: r.voyoId,
                          title: r.title,
                          artist: r.artist,
                          album: 'VOYO',
                          trackId: r.voyoId,
                          coverUrl: r.thumbnail,
                          duration: r.duration,
                          tags: ['search'],
                          mood: 'afro',
                          region: 'NG',
                          oyeScore: r.views || 0,
                          createdAt: new Date().toISOString(),
                        };
                        addToQueue(track);
                        setAddedToQueue(r.voyoId);
                        setTimeout(() => setAddedToQueue(null), 1500);
                      }}
                      isAddedToQueue={addedToQueue === result.voyoId}
                      formatDuration={formatDuration}
                      formatViews={formatViews}
                    />
                  ))}
                </div>

                {/* Loading Skeleton */}
                {isSearching && results.length === 0 && (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="w-12 h-12 rounded-lg bg-white/5" />
                        <div className="flex-1">
                          <div className="h-3 w-3/4 bg-white/5 rounded mb-2" />
                          <div className="h-2 w-1/2 bg-white/5 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
