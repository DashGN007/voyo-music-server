/**
 * VOYO Music - Classic Mode: Home Feed
 * Reference: Classic Mode - When clicked on profile.jpg (Left phone)
 *
 * Features:
 * - Profile avatar top-left
 * - Search & notifications top-right
 * - Horizontal scrollable category pills
 * - Masonry grid of artist/album cards
 * - Cards show: Image, Name, Song count, Badges
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, TrendingUp, Award, Music } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail, TRACKS } from '../../data/tracks';
import { Track } from '../../types';

// Category pills
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New Releases' },
  { id: 'trending', label: 'Trending' },
  { id: 'afrobeats', label: 'Afrobeats' },
  { id: 'amapiano', label: 'Amapiano' },
  { id: 'hiphop', label: 'Hip Hop' },
];

// Group tracks by artist for artist cards
const getArtistCards = () => {
  const artistMap = new Map<string, { name: string; tracks: Track[]; image: string }>();

  TRACKS.forEach(track => {
    if (!artistMap.has(track.artist)) {
      artistMap.set(track.artist, {
        name: track.artist,
        tracks: [],
        image: getYouTubeThumbnail(track.youtubeVideoId, 'high'),
      });
    }
    artistMap.get(track.artist)!.tracks.push(track);
  });

  return Array.from(artistMap.values());
};

// Artist Card Component
const ArtistCard = ({
  artist,
  isLarge = false,
  badge,
  onClick
}: {
  artist: { name: string; tracks: Track[]; image: string };
  isLarge?: boolean;
  badge?: 'chart' | 'gold';
  onClick: () => void;
}) => (
  <motion.button
    className={`relative rounded-2xl overflow-hidden ${isLarge ? 'col-span-2 row-span-2' : ''}`}
    onClick={onClick}
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
  >
    <div className={`${isLarge ? 'aspect-square' : 'aspect-[3/4]'} relative`}>
      <img
        src={artist.image}
        alt={artist.name}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Badge */}
      {badge && (
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
          badge === 'chart'
            ? 'bg-orange-500/80 text-white'
            : 'bg-yellow-500/80 text-black'
        }`}>
          {badge === 'chart' ? (
            <>
              <TrendingUp className="w-3 h-3" />
              In Charts
            </>
          ) : (
            <>
              <Award className="w-3 h-3" />
              Gold Record
            </>
          )}
        </div>
      )}

      {/* Info */}
      <div className="absolute bottom-3 left-3 right-3">
        <p className="text-white font-bold text-lg truncate">{artist.name}</p>
        <p className="text-white/60 text-sm flex items-center gap-1">
          <Music className="w-3 h-3" />
          {artist.tracks.length} songs
        </p>
      </div>
    </div>
  </motion.button>
);

interface HomeFeedProps {
  onArtistClick: (artist: { name: string; tracks: Track[] }) => void;
  onSearch: () => void;
}

export const HomeFeed = ({ onArtistClick, onSearch }: HomeFeedProps) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const artists = getArtistCards();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        {/* Profile Avatar */}
        <motion.button
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          D
        </motion.button>

        {/* Search & Notifications */}
        <div className="flex items-center gap-2">
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={onSearch}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Search className="w-5 h-5 text-white/70" />
          </motion.button>
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 relative"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bell className="w-5 h-5 text-white/70" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </motion.button>
        </div>
      </header>

      {/* Greeting */}
      <div className="px-4 py-2">
        <h1 className="text-2xl font-bold text-white">Hello, Dash</h1>
        <p className="text-white/50 text-sm">What do you want to listen to?</p>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.id}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
            onClick={() => setActiveCategory(cat.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {cat.label}
          </motion.button>
        ))}
      </div>

      {/* Artist Grid (Masonry-style) */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {artists.map((artist, index) => (
            <ArtistCard
              key={artist.name}
              artist={artist}
              isLarge={index === 0 || index === 3}
              badge={index === 0 ? 'chart' : index === 3 ? 'gold' : undefined}
              onClick={() => onArtistClick(artist)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeFeed;
