/**
 * VOYO Boost Indicator - Shows playback source quality
 *
 * Cached = Boosted (highest quality, offline-ready)
 * Direct = High quality stream
 * IFrame = Standard quality (being boosted in background)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Download, Wifi } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useDownloadStore } from '../../store/downloadStore';

export const BoostIndicator = () => {
  const playbackSource = usePlayerStore((state) => state.playbackSource);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const downloads = useDownloadStore((state) => state.downloads);

  if (!playbackSource || !currentTrack) return null;

  // Check if current track is being downloaded
  const downloadStatus = downloads.get(currentTrack.trackId);
  const isDownloading = downloadStatus?.status === 'downloading';
  const downloadProgress = downloadStatus?.progress || 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={playbackSource}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex items-center gap-1.5"
      >
        {playbackSource === 'cached' && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Zap size={12} className="text-purple-400" />
            <span className="text-[10px] font-medium text-purple-300 uppercase tracking-wider">
              Boosted
            </span>
          </div>
        )}

        {playbackSource === 'direct' && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
            <Wifi size={12} className="text-green-400" />
            <span className="text-[10px] font-medium text-green-300 uppercase tracking-wider">
              HQ Stream
            </span>
          </div>
        )}

        {playbackSource === 'iframe' && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            {isDownloading ? (
              <>
                <Download size={12} className="text-amber-400 animate-pulse" />
                <span className="text-[10px] font-medium text-amber-300 uppercase tracking-wider">
                  Boosting {downloadProgress}%
                </span>
              </>
            ) : (
              <>
                <Download size={12} className="text-amber-400" />
                <span className="text-[10px] font-medium text-amber-300 uppercase tracking-wider">
                  Standard
                </span>
              </>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Compact version for tight spaces
 */
export const BoostIndicatorCompact = () => {
  const playbackSource = usePlayerStore((state) => state.playbackSource);

  if (!playbackSource) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center"
    >
      {playbackSource === 'cached' && (
        <span title="Boosted - Playing from cache">
          <Zap size={14} className="text-purple-400" />
        </span>
      )}
      {playbackSource === 'direct' && (
        <span title="High quality stream">
          <Wifi size={14} className="text-green-400" />
        </span>
      )}
      {playbackSource === 'iframe' && (
        <span title="Standard quality - Boost pending">
          <Download size={14} className="text-amber-400" />
        </span>
      )}
    </motion.div>
  );
};

export default BoostIndicator;
