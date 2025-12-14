/**
 * VOYO Music - Offline Mode Indicator
 * Shows when user loses network connectivity
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      // Clear previous timeout and set new one
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg shadow-orange-500/30 flex items-center gap-2"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <WifiOff size={14} />
          <span className="text-xs font-bold">Offline Mode</span>
        </motion.div>
      )}

      {showReconnected && !isOffline && (
        <motion.div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-4 py-2 rounded-full shadow-lg shadow-green-500/30 flex items-center gap-2"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <Wifi size={14} />
          <span className="text-xs font-bold">Back Online</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
