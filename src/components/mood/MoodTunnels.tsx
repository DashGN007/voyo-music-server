// VOYO Music - Mood Tunnel Navigation
// Emotional navigation instead of genres
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { MOOD_TUNNELS } from '../../data/tracks';
import { MoodType } from '../../types';

export const MoodTunnels = () => {
  const { currentMood, setMood } = usePlayerStore();

  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Mood Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {MOOD_TUNNELS.map((mood) => (
            <motion.button
              key={mood.id}
              className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                transition-all duration-300
                ${
                  currentMood === mood.id
                    ? `bg-gradient-to-r ${mood.gradient} text-white shadow-lg`
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
              onClick={() => setMood(mood.id as MoodType)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="mr-1">{mood.icon}</span>
              {mood.name}
            </motion.button>
          ))}

          {/* Add More Button */}
          <motion.button
            className="p-2 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Search Button */}
        <motion.button
          className="ml-4 p-2 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Search className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Active Mood Indicator */}
      {currentMood && (
        <motion.div
          className="mt-3 flex items-center gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className={`w-2 h-2 rounded-full bg-gradient-to-r ${
              MOOD_TUNNELS.find((m) => m.id === currentMood)?.gradient
            }`}
          />
          <span className="text-xs text-white/50">
            Tunneling through{' '}
            <span className="text-white/70 font-medium">
              {MOOD_TUNNELS.find((m) => m.id === currentMood)?.name}
            </span>{' '}
            vibes
          </span>
        </motion.div>
      )}
    </div>
  );
};
