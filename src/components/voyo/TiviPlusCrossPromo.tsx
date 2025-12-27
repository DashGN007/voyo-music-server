/**
 * TIVI+ Cross-Promo Section
 *
 * "Take a Break with Family" - Cross-ecosystem promotion
 * Shows content that YouTube doesn't have = breaks the illusion
 *
 * Sections:
 * 1. African Stories (Movies Carousel) - Exclusive content
 * 2. Trending on TIVI+ (Shows/Movies) - Cross-promo
 * 3. Big Teaser Video - Full-width preview
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, ExternalLink, Popcorn, Film, Tv, Sparkles } from 'lucide-react';

// ============================================
// MOCK DATA - Replace with real TIVI+ API
// ============================================

interface TiviContent {
  id: string;
  title: string;
  subtitle?: string;
  poster: string;
  type: 'movie' | 'series' | 'documentary';
  year?: number;
  rating?: string;
  isExclusive?: boolean;
  tiviPlusUrl?: string;
}

const AFRICAN_STORIES: TiviContent[] = [
  {
    id: 'as-1',
    title: 'Sakho et Mangane',
    subtitle: 'Senegalese Detective Thriller',
    poster: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=450&fit=crop',
    type: 'series',
    year: 2023,
    rating: 'TV-MA',
    isExclusive: true,
  },
  {
    id: 'as-2',
    title: 'The Milkmaid',
    subtitle: 'Nigerian Drama',
    poster: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2020,
    rating: 'PG-13',
    isExclusive: true,
  },
  {
    id: 'as-3',
    title: 'Eyimofe',
    subtitle: 'Lagos Dreams',
    poster: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a064?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2020,
    rating: 'R',
    isExclusive: true,
  },
  {
    id: 'as-4',
    title: 'Atlantics',
    subtitle: 'Senegalese Supernatural',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2019,
    rating: 'PG-13',
    isExclusive: true,
  },
  {
    id: 'as-5',
    title: 'Omo Ghetto: The Saga',
    subtitle: 'Nollywood Comedy',
    poster: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2020,
    isExclusive: true,
  },
];

const TRENDING_TIVI: TiviContent[] = [
  {
    id: 'tr-1',
    title: 'Blood & Water',
    subtitle: 'South African Mystery',
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=450&fit=crop',
    type: 'series',
    year: 2024,
  },
  {
    id: 'tr-2',
    title: 'Gangs of Lagos',
    subtitle: 'Nigerian Action',
    poster: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2023,
  },
  {
    id: 'tr-3',
    title: 'Mami Wata',
    subtitle: 'Mythological Drama',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=450&fit=crop',
    type: 'movie',
    year: 2023,
  },
  {
    id: 'tr-4',
    title: 'Far from Home',
    subtitle: 'Nigerian Teen Drama',
    poster: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=450&fit=crop',
    type: 'series',
    year: 2024,
  },
];

const FEATURED_TEASER = {
  id: 'featured-1',
  title: 'The Legend of Sundiate Keita',
  subtitle: 'The Greatest African Epic - Coming 2025',
  description: 'The untold story of the founder of the Mali Empire. A tale of courage, destiny, and the rise of one of history\'s greatest leaders.',
  poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=600&fit=crop',
  trailerUrl: 'https://tiviplus.com/watch/sundiate-trailer',
  isExclusive: true,
};

// ============================================
// COMPONENTS
// ============================================

const ContentCard = ({ content, onClick }: { content: TiviContent; onClick?: () => void }) => (
  <motion.button
    className="flex-shrink-0 relative rounded-xl overflow-hidden group"
    style={{ width: 120, height: 180 }}
    whileHover={{ scale: 1.05, y: -5 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
  >
    {/* Poster */}
    <img
      src={content.poster}
      alt={content.title}
      className="w-full h-full object-cover"
      loading="lazy"
    />

    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

    {/* Exclusive badge */}
    {content.isExclusive && (
      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded text-[8px] font-bold text-black">
        TIVI+ EXCLUSIVE
      </div>
    )}

    {/* Type badge */}
    <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full">
      {content.type === 'series' ? (
        <Tv className="w-3 h-3 text-white/80" />
      ) : (
        <Film className="w-3 h-3 text-white/80" />
      )}
    </div>

    {/* Info */}
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <p className="text-[10px] font-bold text-white truncate">{content.title}</p>
      {content.subtitle && (
        <p className="text-[8px] text-white/60 truncate">{content.subtitle}</p>
      )}
    </div>

    {/* Hover play button */}
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Play className="w-5 h-5 text-white fill-white" />
      </div>
    </motion.div>
  </motion.button>
);

const SectionHeader = ({
  icon: Icon,
  title,
  accent,
  onSeeAll,
}: {
  icon: React.ElementType;
  title: string;
  accent: string;
  onSeeAll?: () => void;
}) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${accent}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm font-bold text-white">{title}</span>
    </div>
    {onSeeAll && (
      <button
        onClick={onSeeAll}
        className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80 transition-colors"
      >
        <span>See all on TIVI+</span>
        <ExternalLink className="w-3 h-3" />
      </button>
    )}
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const TiviPlusCrossPromo = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleContentClick = (content: TiviContent) => {
    // If user has TIVI+ account, deep link
    // Otherwise, show teaser/signup prompt
    const tiviPlusUrl = `https://tiviplus.com/watch/${content.id}`;
    window.open(tiviPlusUrl, '_blank');
  };

  const handleTeaserClick = () => {
    window.open(FEATURED_TEASER.trailerUrl, '_blank');
  };

  return (
    <motion.div
      className="mt-6 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Section Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <motion.div
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Popcorn className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-300 tracking-wider">
            TAKE A BREAK WITH FAMILY
          </span>
        </motion.div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* African Stories Section */}
      <div className="mb-6">
        <SectionHeader
          icon={Sparkles}
          title="African Stories"
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
          onSeeAll={() => window.open('https://tiviplus.com/african-stories', '_blank')}
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {AFRICAN_STORIES.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              onClick={() => handleContentClick(content)}
            />
          ))}
        </div>
        <p className="text-[9px] text-white/40 mt-2 italic">
          Content not available on YouTube - Exclusive to TIVI+
        </p>
      </div>

      {/* Trending on TIVI+ */}
      <div className="mb-6">
        <SectionHeader
          icon={Tv}
          title="Trending on TIVI+"
          accent="bg-gradient-to-br from-purple-500 to-pink-600"
          onSeeAll={() => window.open('https://tiviplus.com/trending', '_blank')}
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {TRENDING_TIVI.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              onClick={() => handleContentClick(content)}
            />
          ))}
        </div>
      </div>

      {/* Featured Teaser */}
      <motion.button
        className="relative w-full h-40 rounded-2xl overflow-hidden mb-4 group"
        onClick={handleTeaserClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Background image */}
        <img
          src={FEATURED_TEASER.poster}
          alt={FEATURED_TEASER.title}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Exclusive badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[9px] font-bold text-black flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          TIVI+ EXCLUSIVE
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-black text-white mb-1">{FEATURED_TEASER.title}</h3>
          <p className="text-xs text-amber-300 font-medium mb-2">{FEATURED_TEASER.subtitle}</p>
          <p className="text-[10px] text-white/70 line-clamp-2">{FEATURED_TEASER.description}</p>
        </div>

        {/* Play button */}
        <motion.div
          className="absolute right-4 top-1/2 -translate-y-1/2"
          whileHover={{ scale: 1.1 }}
        >
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </div>
        </motion.div>

        {/* Animated border */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-amber-500/0 group-hover:border-amber-500/50 transition-colors"
          animate={{
            boxShadow: ['0 0 0 rgba(245,158,11,0)', '0 0 20px rgba(245,158,11,0.3)', '0 0 0 rgba(245,158,11,0)'],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </motion.button>

      {/* Back to Music divider */}
      <div className="flex items-center gap-3 mt-6 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="text-[10px] font-bold text-white/30 tracking-wider">
          BACK TO THE MUSIC
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </motion.div>
  );
};

export default TiviPlusCrossPromo;
