/**
 * VOYO Music - Search Overlay Component
 * Uses Piped API for searching (no API key needed!)
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, TrendingUp, Music2 } from 'lucide-react';
import { usePipedSearch } from '../../hooks/usePipedSearch';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchOverlay = ({ isOpen, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isSearching, error, search, loadTrending, clearResults } = usePipedSearch();
  const { setCurrentTrack, addToQueue } = usePlayerStore();

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load trending on mount
  useEffect(() => {
    if (isOpen && results.length === 0 && !query) {
      loadTrending('NG'); // Nigeria trending
    }
  }, [isOpen]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      search(value);
    } else {
      clearResults();
      loadTrending('NG');
    }
  };

  const handleSelectTrack = (result: any) => {
    // Convert Piped result to VOYO Track format
    const track: Track = {
      id: result.youtubeVideoId,
      title: result.title,
      artist: result.artist,
      album: 'YouTube',
      youtubeVideoId: result.youtubeVideoId,
      coverUrl: result.coverUrl,
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

  const handleAddToQueue = (result: any, e: React.MouseEvent) => {
    e.stopPropagation();

    const track: Track = {
      id: result.youtubeVideoId,
      title: result.title,
      artist: result.artist,
      album: 'YouTube',
      youtubeVideoId: result.youtubeVideoId,
      coverUrl: result.coverUrl,
      duration: result.duration,
      tags: ['search'],
      mood: 'afro',
      region: 'NG',
      oyeScore: result.views || 0,
      createdAt: new Date().toISOString(),
    };

    addToQueue(track);
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
        <motion.div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header with Search Input */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black/95 to-transparent pb-4">
            <div className="flex items-center gap-3 p-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for music..."
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                />
                {isSearching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 animate-spin" />
                )}
              </div>
              <motion.button
                className="p-3 rounded-full bg-white/10 hover:bg-white/20"
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Section Label */}
            <div className="px-4 flex items-center gap-2 text-sm text-white/50">
              {query ? (
                <>
                  <Music2 className="w-4 h-4" />
                  <span>Search Results</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Trending in Nigeria</span>
                </>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="px-4 pb-20 max-h-[calc(100vh-120px)] overflow-y-auto">
            {error && (
              <div className="text-center py-8 text-red-400">
                <p>{error}</p>
                <button
                  className="mt-4 px-4 py-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  onClick={() => search(query)}
                >
                  Try Again
                </button>
              </div>
            )}

            {!error && results.length === 0 && !isSearching && query && (
              <div className="text-center py-12 text-white/50">
                <p>No results found for "{query}"</p>
              </div>
            )}

            <div className="space-y-2">
              {results.map((result, index) => (
                <motion.div
                  key={result.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectTrack(result)}
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={result.coverUrl}
                      alt={result.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${result.youtubeVideoId}/hqdefault.jpg`;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-8 border-l-white border-y-4 border-y-transparent ml-1" />
                      </div>
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{result.title}</h4>
                    <p className="text-white/50 text-sm truncate">{result.artist}</p>
                    <div className="flex items-center gap-2 text-xs text-white/30 mt-1">
                      <span>{formatDuration(result.duration)}</span>
                      {result.views > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatViews(result.views)} views</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add to Queue Button */}
                  <motion.button
                    className="p-2 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleAddToQueue(result, e)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Add to Queue"
                  >
                    <span className="text-lg">+</span>
                  </motion.button>
                </motion.div>
              ))}
            </div>

            {/* Loading Skeleton */}
            {isSearching && results.length === 0 && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
                    <div className="w-14 h-14 rounded-lg bg-white/10" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Powered by Piped */}
          <div className="fixed bottom-4 left-0 right-0 text-center">
            <span className="text-xs text-white/20">Powered by Piped API - No API key needed</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
