/**
 * VOYO Music - Classic Mode: Your Library
 * Reference: Classic Mode - When clicked on profile.jpg (Middle phone)
 *
 * Features:
 * - Search within library
 * - Filter tabs: All, Liked songs, Saved songs
 * - Song list with thumbnail, title, artist, duration
 * - Tap to play, opens Classic Now Playing
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Heart, Music, Clock, MoreVertical } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail, TRACKS } from '../../data/tracks';
import { Track } from '../../types';

// Filter tabs
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
  { id: 'saved', label: 'Saved songs' },
  { id: 'recent', label: 'Recent' },
];

// Song Row Component
const SongRow = ({
  track,
  index,
  isLiked = false,
  onClick,
  onLike
}: {
  track: Track;
  index: number;
  isLiked?: boolean;
  onClick: () => void;
  onLike: () => void;
}) => (
  <motion.div
    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors rounded-xl"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.03 }}
  >
    {/* Thumbnail */}
    <motion.button
      className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <img
        src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
        alt={track.title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <Music className="w-5 h-5 text-white" />
      </div>
    </motion.button>

    {/* Info */}
    <button
      className="flex-1 min-w-0 text-left"
      onClick={onClick}
    >
      <p className="text-white font-medium truncate">{track.title}</p>
      <p className="text-white/50 text-sm truncate">{track.artist}</p>
    </button>

    {/* Duration */}
    <div className="flex items-center gap-1 text-white/40 text-sm">
      <Clock className="w-3 h-3" />
      <span>{track.duration || '3:45'}</span>
    </div>

    {/* Like Button */}
    <motion.button
      className="p-2"
      onClick={(e) => { e.stopPropagation(); onLike(); }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
    >
      <Heart
        className={`w-5 h-5 ${isLiked ? 'text-pink-500 fill-pink-500' : 'text-white/40'}`}
      />
    </motion.button>

    {/* More Options */}
    <motion.button
      className="p-2"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <MoreVertical className="w-5 h-5 text-white/40" />
    </motion.button>
  </motion.div>
);

interface LibraryProps {
  onTrackClick: (track: Track) => void;
}

export const Library = ({ onTrackClick }: LibraryProps) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const { setCurrentTrack } = usePlayerStore();

  // Filter tracks based on active filter and search
  const filteredTracks = TRACKS.filter(track => {
    const matchesSearch = !searchQuery ||
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeFilter) {
      case 'liked':
        return likedTracks.has(track.id);
      case 'saved':
        return true; // All tracks are "saved" for now
      case 'recent':
        return true; // Show all for now
      default:
        return true;
    }
  });

  const handleTrackClick = (track: Track) => {
    setCurrentTrack(track);
    onTrackClick(track);
  };

  const handleLike = (trackId: string) => {
    setLikedTracks(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-4">
        <h1 className="text-2xl font-bold text-white">Your Library</h1>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in library..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((filter) => (
          <motion.button
            key={filter.id}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter.id
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
            onClick={() => setActiveFilter(filter.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {filter.label}
          </motion.button>
        ))}
      </div>

      {/* Song Count */}
      <div className="px-4 py-2">
        <p className="text-white/40 text-sm">{filteredTracks.length} songs</p>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filteredTracks.length > 0 ? (
          filteredTracks.map((track, index) => (
            <SongRow
              key={track.id}
              track={track}
              index={index}
              isLiked={likedTracks.has(track.id)}
              onClick={() => handleTrackClick(track)}
              onLike={() => handleLike(track.id)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-white/40">
            <Music className="w-12 h-12 mb-2" />
            <p>No songs found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
