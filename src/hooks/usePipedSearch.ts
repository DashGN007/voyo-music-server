/**
 * VOYO Music - Piped Search Hook
 *
 * Search for music using Piped API (no API key needed!)
 * Includes debouncing and caching for optimal UX
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { searchVideos, getTrending, getRelatedVideos, VoyoTrackFromSearch } from '../services/piped';

interface UsePipedSearchOptions {
  debounceMs?: number;
  cacheResults?: boolean;
  maxCacheSize?: number;
}

interface UsePipedSearchReturn {
  // State
  results: VoyoTrackFromSearch[];
  isSearching: boolean;
  error: string | null;

  // Actions
  search: (query: string) => Promise<void>;
  searchInstant: (query: string) => Promise<VoyoTrackFromSearch[]>;
  loadTrending: (region?: string) => Promise<void>;
  loadRelated: (videoId: string) => Promise<void>;
  clearResults: () => void;

  // Query state
  currentQuery: string;
}

export function usePipedSearch(options: UsePipedSearchOptions = {}): UsePipedSearchReturn {
  const { debounceMs = 300, cacheResults = true, maxCacheSize = 50 } = options;

  // State
  const [results, setResults] = useState<VoyoTrackFromSearch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');

  // Cache
  const cacheRef = useRef<Map<string, VoyoTrackFromSearch[]>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add to cache
  const addToCache = useCallback(
    (key: string, data: VoyoTrackFromSearch[]) => {
      if (!cacheResults) return;

      const cache = cacheRef.current;

      // Remove oldest if at max size
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value as string;
        if (firstKey) cache.delete(firstKey);
      }

      cache.set(key, data);
    },
    [cacheResults, maxCacheSize]
  );

  // Get from cache
  const getFromCache = useCallback(
    (key: string): VoyoTrackFromSearch[] | null => {
      if (!cacheResults) return null;
      return cacheRef.current.get(key) || null;
    },
    [cacheResults]
  );

  // Instant search (no debounce)
  const searchInstant = useCallback(
    async (query: string): Promise<VoyoTrackFromSearch[]> => {
      if (!query.trim()) return [];

      const cacheKey = `search:${query.toLowerCase()}`;
      const cached = getFromCache(cacheKey);
      if (cached) return cached;

      try {
        const searchResults = await searchVideos(query, 'music_songs');
        addToCache(cacheKey, searchResults);
        return searchResults;
      } catch (err) {
        console.error('[usePipedSearch] Search error:', err);
        throw err;
      }
    },
    [getFromCache, addToCache]
  );

  // Debounced search
  const search = useCallback(
    async (query: string) => {
      setCurrentQuery(query);

      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Empty query
      if (!query.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      // Check cache first
      const cacheKey = `search:${query.toLowerCase()}`;
      const cached = getFromCache(cacheKey);
      if (cached) {
        setResults(cached);
        return;
      }

      // Debounce the actual search
      debounceTimerRef.current = setTimeout(async () => {
        setIsSearching(true);
        setError(null);

        try {
          const searchResults = await searchVideos(query, 'music_songs');
          addToCache(cacheKey, searchResults);
          setResults(searchResults);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Search failed';
          setError(message);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [debounceMs, getFromCache, addToCache]
  );

  // Load trending
  const loadTrending = useCallback(
    async (region: string = 'NG') => {
      const cacheKey = `trending:${region}`;
      const cached = getFromCache(cacheKey);
      if (cached) {
        setResults(cached);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const trending = await getTrending(region);
        addToCache(cacheKey, trending);
        setResults(trending);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load trending';
        setError(message);
      } finally {
        setIsSearching(false);
      }
    },
    [getFromCache, addToCache]
  );

  // Load related videos
  const loadRelated = useCallback(
    async (videoId: string) => {
      const cacheKey = `related:${videoId}`;
      const cached = getFromCache(cacheKey);
      if (cached) {
        setResults(cached);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const related = await getRelatedVideos(videoId);
        addToCache(cacheKey, related);
        setResults(related);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load related';
        setError(message);
      } finally {
        setIsSearching(false);
      }
    },
    [getFromCache, addToCache]
  );

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentQuery('');
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    searchInstant,
    loadTrending,
    loadRelated,
    clearResults,
    currentQuery,
  };
}

export default usePipedSearch;
