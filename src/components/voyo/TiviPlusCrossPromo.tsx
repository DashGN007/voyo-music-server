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

import { motion } from 'framer-motion';
import { Play, ExternalLink, Popcorn, Sparkles, Star, Tv, Music, Flame, Globe, Heart } from 'lucide-react';

// ============================================
// REAL CONTENT FROM DASH WEBTV (TIVI+)
// TMDB posters - Unique content not on YouTube
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
  streamId?: number | string;
}

// French Cinema = Unique content YouTube doesn't have
const FRENCH_EXCLUSIVES: TiviContent[] = [
  {
    id: 'french_77338',
    title: 'The Intouchables',
    subtitle: 'French Comedy-Drama',
    poster: 'https://image.tmdb.org/t/p/w500/i97FM40bOMKvKIo3hjQviETE5yf.jpg',
    type: 'movie',
    year: 2011,
    rating: '8.3',
    isExclusive: true,
    streamId: 'french_77338',
  },
  {
    id: 'french_101',
    title: 'Léon: The Professional',
    subtitle: 'French Action Thriller',
    poster: 'https://image.tmdb.org/t/p/w500/bxB2q91nKYp8JNzqE7t7TWBVupB.jpg',
    type: 'movie',
    year: 1994,
    rating: '8.3',
    isExclusive: true,
    streamId: 'french_101',
  },
  {
    id: 'french_531428',
    title: 'Portrait of a Lady on Fire',
    subtitle: 'French Romance',
    poster: 'https://image.tmdb.org/t/p/w500/2LquGwEhbg3soxSCs9VNyh5VJd9.jpg',
    type: 'movie',
    year: 2019,
    rating: '8.1',
    isExclusive: true,
    streamId: 'french_531428',
  },
  {
    id: 'french_46738',
    title: 'Incendies',
    subtitle: 'Canadian-French Drama',
    poster: 'https://image.tmdb.org/t/p/w500/yH6DAQVgbyj72S66gN4WWVoTjuf.jpg',
    type: 'movie',
    year: 2010,
    rating: '8.1',
    isExclusive: true,
    streamId: 'french_46738',
  },
  {
    id: 'french_265177',
    title: 'Mommy',
    subtitle: 'Quebec Drama',
    poster: 'https://image.tmdb.org/t/p/w500/uPDP0cHGOpkr47rdCdHWo4CyiPj.jpg',
    type: 'movie',
    year: 2014,
    rating: '8.2',
    isExclusive: true,
    streamId: 'french_265177',
  },
  {
    id: 'french_29259',
    title: 'Le Trou',
    subtitle: 'French Prison Drama',
    poster: 'https://image.tmdb.org/t/p/w500/xyZhiOz5NHVBUKlpioxjwajy7pm.jpg',
    type: 'movie',
    year: 1960,
    rating: '8.3',
    isExclusive: true,
    streamId: 'french_29259',
  },
];

// Blockbuster & Family content
const TRENDING_TIVI: TiviContent[] = [
  {
    id: '139211',
    title: 'Puss in Boots: The Last Wish',
    subtitle: 'Animated Adventure',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/kuf6dutpsT0vSVehic3EZIqkOBt.jpg',
    type: 'movie',
    year: 2022,
    rating: '8.6',
    streamId: 139211,
  },
  {
    id: '134971',
    title: 'The Dark Knight',
    subtitle: 'Action Thriller',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    type: 'movie',
    year: 2008,
    rating: '8.5',
    streamId: 134971,
  },
  {
    id: '184534',
    title: 'Spider-Man: Across the Spider-Verse',
    subtitle: 'Animated Action',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    type: 'movie',
    year: 2023,
    rating: '8.5',
    streamId: 184534,
  },
  {
    id: '30005',
    title: 'Life Is Beautiful',
    subtitle: 'Italian Drama',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/74hLDKjD5aGYOotO6esUVaeISa2.jpg',
    type: 'movie',
    year: 1997,
    rating: '8.5',
    streamId: 30005,
  },
  {
    id: '134956',
    title: 'LOTR: Return of the King',
    subtitle: 'Epic Fantasy',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
    type: 'movie',
    year: 2003,
    rating: '8.5',
    streamId: 134956,
  },
  {
    id: '23781',
    title: 'Raya and the Last Dragon',
    subtitle: 'Animated Adventure',
    poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/lPsD10PP4rgUGiGR4CCXA6iY0QQ.jpg',
    type: 'movie',
    year: 2021,
    rating: '8.7',
    streamId: 23781,
  },
];

// Featured teaser - Spider-Verse (Perfect for family break)
const FEATURED_TEASER = {
  id: '184534',
  title: 'Spider-Man: Across the Spider-Verse',
  subtitle: 'The Multiverse Awaits - Stream Now on TIVI+',
  description: 'Miles Morales returns for the next chapter of the Spider-Verse saga. An epic adventure across infinite dimensions with stunning animation.',
  poster: 'https://image.tmdb.org/t/p/w1280/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
  backdropUrl: 'https://image.tmdb.org/t/p/w1280/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',
  streamId: 184534,
  isExclusive: true,
};

// ============================================
// MUSIC CONTENT - "Back to the Music" sections
// ============================================

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  youtubeId: string;
  duration?: string;
  isNew?: boolean;
}

// New Releases - Hot tracks right now
const NEW_RELEASES: MusicTrack[] = [
  {
    id: 'nr-1',
    title: 'Jerusalema',
    artist: 'Master KG ft Nomcebo',
    thumbnail: 'https://i.ytimg.com/vi/fUjLXk3Gvqo/maxresdefault.jpg',
    youtubeId: 'fUjLXk3Gvqo',
    isNew: true,
  },
  {
    id: 'nr-2',
    title: 'Ameno Amapiano',
    artist: 'Goya Menor',
    thumbnail: 'https://i.ytimg.com/vi/OZOP4SmQzNU/maxresdefault.jpg',
    youtubeId: 'OZOP4SmQzNU',
    isNew: true,
  },
  {
    id: 'nr-3',
    title: 'Essence',
    artist: 'Wizkid ft Tems',
    thumbnail: 'https://i.ytimg.com/vi/zLspGFCf-f4/maxresdefault.jpg',
    youtubeId: 'zLspGFCf-f4',
    isNew: true,
  },
  {
    id: 'nr-4',
    title: 'Water',
    artist: 'Tyla',
    thumbnail: 'https://i.ytimg.com/vi/FBsD0LD8ohs/maxresdefault.jpg',
    youtubeId: 'FBsD0LD8ohs',
    isNew: true,
  },
  {
    id: 'nr-5',
    title: 'Unavailable',
    artist: 'Davido ft Musa Keys',
    thumbnail: 'https://i.ytimg.com/vi/1M9ApWbI8sE/maxresdefault.jpg',
    youtubeId: '1M9ApWbI8sE',
    isNew: true,
  },
];

// All Time Classics - Timeless African hits
const ALL_TIME_CLASSICS: MusicTrack[] = [
  {
    id: 'atc-1',
    title: 'Yeke Yeke',
    artist: 'Mory Kanté',
    thumbnail: 'https://i.ytimg.com/vi/xKELnaxRjR4/maxresdefault.jpg',
    youtubeId: 'xKELnaxRjR4',
  },
  {
    id: 'atc-2',
    title: 'Africa',
    artist: 'Salif Keita',
    thumbnail: 'https://i.ytimg.com/vi/7Swa3hXE6hs/maxresdefault.jpg',
    youtubeId: '7Swa3hXE6hs',
  },
  {
    id: 'atc-3',
    title: '7 Seconds',
    artist: 'Youssou N\'Dour ft Neneh Cherry',
    thumbnail: 'https://i.ytimg.com/vi/wqCpjFMvz-k/maxresdefault.jpg',
    youtubeId: 'wqCpjFMvz-k',
  },
  {
    id: 'atc-4',
    title: 'Pata Pata',
    artist: 'Miriam Makeba',
    thumbnail: 'https://i.ytimg.com/vi/lNeP3AXS4Ks/maxresdefault.jpg',
    youtubeId: 'lNeP3AXS4Ks',
  },
  {
    id: 'atc-5',
    title: 'Sweet Mother',
    artist: 'Prince Nico Mbarga',
    thumbnail: 'https://i.ytimg.com/vi/1Yxd9cnH-8A/maxresdefault.jpg',
    youtubeId: '1Yxd9cnH-8A',
  },
];

// West African Hits - Local favorites from Guinea, Senegal, Mali
const WEST_AFRICAN_HITS: MusicTrack[] = [
  {
    id: 'wah-1',
    title: 'Nanfulen',
    artist: 'Sékouba Bambino',
    thumbnail: 'https://i.ytimg.com/vi/QF0QYXL7nnA/maxresdefault.jpg',
    youtubeId: 'QF0QYXL7nnA',
  },
  {
    id: 'wah-2',
    title: 'Diaraby Nene',
    artist: 'Oumou Sangaré',
    thumbnail: 'https://i.ytimg.com/vi/kqST5Y39H7I/maxresdefault.jpg',
    youtubeId: 'kqST5Y39H7I',
  },
  {
    id: 'wah-3',
    title: 'Djadja',
    artist: 'Aya Nakamura',
    thumbnail: 'https://i.ytimg.com/vi/iPGgnzc34tY/maxresdefault.jpg',
    youtubeId: 'iPGgnzc34tY',
  },
  {
    id: 'wah-4',
    title: 'Fatou',
    artist: 'Fatoumata Diawara',
    thumbnail: 'https://i.ytimg.com/vi/SRG5-FvV4J4/maxresdefault.jpg',
    youtubeId: 'SRG5-FvV4J4',
  },
  {
    id: 'wah-5',
    title: 'Kelen',
    artist: 'Petit Poucet',
    thumbnail: 'https://i.ytimg.com/vi/8QxIIz1yEsA/maxresdefault.jpg',
    youtubeId: '8QxIIz1yEsA',
  },
];

// ============================================
// COMPONENTS
// ============================================

// Music Track Card - Square format for music
const MusicCard = ({ track, onClick }: { track: MusicTrack; onClick?: () => void }) => (
  <motion.button
    className="flex-shrink-0 relative rounded-xl overflow-hidden group"
    style={{ width: 130, height: 130 }}
    whileHover={{ scale: 1.05, y: -3 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
  >
    {/* Thumbnail */}
    <img
      src={track.thumbnail}
      alt={track.title}
      className="w-full h-full object-cover"
      loading="lazy"
    />

    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

    {/* New badge */}
    {track.isNew && (
      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded text-[7px] font-bold text-white">
        NEW
      </div>
    )}

    {/* Info */}
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <p className="text-[10px] font-bold text-white truncate">{track.title}</p>
      <p className="text-[8px] text-white/60 truncate">{track.artist}</p>
    </div>

    {/* Hover play button */}
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Play className="w-5 h-5 text-white fill-white" />
      </div>
    </motion.div>
  </motion.button>
);

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

    {/* Rating badge */}
    {content.rating && (
      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
        <span className="text-amber-500">★</span> {content.rating}
      </div>
    )}

    {/* Exclusive badge */}
    {content.isExclusive && (
      <div className="absolute top-2 right-2 px-1 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded text-[7px] font-bold text-black">
        TIVI+
      </div>
    )}

    {/* Info */}
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <p className="text-[10px] font-bold text-white truncate">{content.title}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {content.year && (
          <span className="text-[8px] text-white/50">{content.year}</span>
        )}
        {content.subtitle && (
          <span className="text-[8px] text-white/40 truncate">• {content.subtitle}</span>
        )}
      </div>
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

// TIVI+ App deep link URL
const TIVI_PLUS_BASE = 'https://dash-webtv.vercel.app';

export const TiviPlusCrossPromo = () => {
  const handleContentClick = (content: TiviContent) => {
    // Deep link to TIVI+ with stream ID
    const tiviPlusUrl = content.streamId
      ? `${TIVI_PLUS_BASE}/watch/${content.streamId}`
      : `${TIVI_PLUS_BASE}/browse`;
    window.open(tiviPlusUrl, '_blank');
  };

  const handleTeaserClick = () => {
    // Deep link to featured movie
    const tiviPlusUrl = `${TIVI_PLUS_BASE}/watch/${FEATURED_TEASER.streamId}`;
    window.open(tiviPlusUrl, '_blank');
  };

  const handleMusicClick = (track: MusicTrack) => {
    // Dispatch event to play this track in VOYO
    // Uses the existing player system
    window.dispatchEvent(new CustomEvent('voyo:playTrack', {
      detail: {
        youtubeId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
      }
    }));
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

      {/* French Cinema Exclusives */}
      <div className="mb-6">
        <SectionHeader
          icon={Sparkles}
          title="French Cinema"
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
          onSeeAll={() => window.open(`${TIVI_PLUS_BASE}/browse?category=french`, '_blank')}
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {FRENCH_EXCLUSIVES.map(content => (
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
          onSeeAll={() => window.open(`${TIVI_PLUS_BASE}/browse`, '_blank')}
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

      {/* Featured Teaser - Widescreen Banner */}
      <motion.button
        className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 group"
        onClick={handleTeaserClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Background - Use backdrop for cinematic look */}
        <img
          src={FEATURED_TEASER.backdropUrl}
          alt={FEATURED_TEASER.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[9px] font-bold text-black flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            TIVI+ EXCLUSIVE
          </div>
          <div className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-[9px] font-bold text-amber-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400" />
            8.5
          </div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-16 p-4">
          <h3 className="text-xl font-black text-white mb-1 drop-shadow-lg">{FEATURED_TEASER.title}</h3>
          <p className="text-xs text-amber-300 font-medium mb-2">{FEATURED_TEASER.subtitle}</p>
          <p className="text-[10px] text-white/80 line-clamp-2 max-w-[80%]">{FEATURED_TEASER.description}</p>
        </div>

        {/* Play button - Bigger and more prominent */}
        <motion.div
          className="absolute right-4 bottom-4"
          whileHover={{ scale: 1.1 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 flex items-center justify-center">
            <Play className="w-7 h-7 text-black fill-black ml-1" />
          </div>
        </motion.div>

        {/* "Watch on TIVI+" CTA */}
        <div className="absolute right-4 top-3 flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-[8px] text-white/70">
          <span>Watch on</span>
          <span className="font-bold text-amber-400">TIVI+</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </div>

        {/* Subtle animated glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              'inset 0 0 0 1px rgba(245,158,11,0)',
              'inset 0 0 0 1px rgba(245,158,11,0.3)',
              'inset 0 0 0 1px rgba(245,158,11,0)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </motion.button>

      {/* Back to Music divider */}
      <div className="flex items-center gap-3 mt-6 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <motion.div
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        >
          <Music className="w-4 h-4 text-purple-400" />
          <span className="text-[10px] font-bold text-purple-300 tracking-wider">
            BACK TO THE MUSIC
          </span>
        </motion.div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* New Releases */}
      <div className="mb-6">
        <SectionHeader
          icon={Flame}
          title="New Releases"
          accent="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {NEW_RELEASES.map(track => (
            <MusicCard
              key={track.id}
              track={track}
              onClick={() => handleMusicClick(track)}
            />
          ))}
        </div>
      </div>

      {/* All Time Classics */}
      <div className="mb-6">
        <SectionHeader
          icon={Heart}
          title="All Time Classics"
          accent="bg-gradient-to-br from-rose-500 to-red-600"
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {ALL_TIME_CLASSICS.map(track => (
            <MusicCard
              key={track.id}
              track={track}
              onClick={() => handleMusicClick(track)}
            />
          ))}
        </div>
        <p className="text-[9px] text-white/40 mt-2 italic">
          Timeless African hits that defined generations
        </p>
      </div>

      {/* West African Hits */}
      <div className="mb-6">
        <SectionHeader
          icon={Globe}
          title="West African Hits"
          accent="bg-gradient-to-br from-yellow-500 to-orange-600"
        />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {WEST_AFRICAN_HITS.map(track => (
            <MusicCard
              key={track.id}
              track={track}
              onClick={() => handleMusicClick(track)}
            />
          ))}
        </div>
        <p className="text-[9px] text-white/40 mt-2 italic">
          From Guinea to Senegal - your local favorites
        </p>
      </div>
    </motion.div>
  );
};

export default TiviPlusCrossPromo;
