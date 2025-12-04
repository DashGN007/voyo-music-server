/**
 * VOYO Music - DJ Chat Modal
 * "Wazzguán" = "What's good?" = Talk to the DJ!
 *
 * The App IS the DJ. Users can request:
 * - "More songs like this"
 * - "Something different"
 * - "More energy"
 * - "Chill vibes"
 *
 * DJ responds and adapts recommendations accordingly!
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

interface Message {
  id: string;
  type: 'user' | 'dj';
  text: string;
  timestamp: Date;
}

// Quick request buttons
const QUICK_REQUESTS = [
  { id: 'more-like-this', text: 'More like this 🔥', response: 'Got you fam! Adding similar vibes to your queue...' },
  { id: 'something-different', text: 'Something different', response: 'Say less! Let me switch up the vibe...' },
  { id: 'more-energy', text: 'More energy ⚡', response: 'AYEEE! Turning up the energy for you!' },
  { id: 'chill-vibes', text: 'Chill vibes 🌙', response: 'Cooling it down... smooth vibes incoming.' },
  { id: 'afrobeats', text: 'Afrobeats only 🌍', response: 'African heat only! I got you covered.' },
  { id: 'throwback', text: 'Throwback hits', response: 'Time machine activated! Classic bangers coming up.' },
];

interface DJChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DJChat = ({ isOpen, onClose }: DJChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'dj',
      text: "Wazzguán! I'm your DJ for tonight. What you feeling? 🎧",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMusicFaded, setIsMusicFaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { refreshRecommendations, currentTrack, setVolume, volume } = usePlayerStore();

  // Store original volume when fading
  const originalVolumeRef = useRef(volume);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fade music when chat opens
  useEffect(() => {
    if (isOpen && !isMusicFaded) {
      originalVolumeRef.current = volume;
      setVolume(Math.max(10, volume * 0.3)); // Fade to 30%
      setIsMusicFaded(true);
    } else if (!isOpen && isMusicFaded) {
      setVolume(originalVolumeRef.current); // Restore
      setIsMusicFaded(false);
    }
  }, [isOpen]);

  const addMessage = (type: 'user' | 'dj', text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
    }]);
  };

  const handleQuickRequest = (request: typeof QUICK_REQUESTS[0]) => {
    addMessage('user', request.text);

    // DJ responds after a short delay
    setTimeout(() => {
      addMessage('dj', request.response);

      // Trigger recommendation refresh based on request
      setTimeout(() => {
        refreshRecommendations();
      }, 500);
    }, 800);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    addMessage('user', inputText);
    setInputText('');

    // DJ responds
    setTimeout(() => {
      const responses = [
        "I hear you! Let me work my magic... 🎵",
        "Say less, fam! Adjusting the vibe now...",
        "Got you! Check the queue in a sec...",
        "That's what I'm talking about! Coming right up!",
        "OYÉ! Perfect choice, adding it to the mix!",
      ];
      addMessage('dj', responses[Math.floor(Math.random() * responses.length)]);
      refreshRecommendations();
    }, 1000);
  };

  const toggleVoiceMode = () => {
    setIsListening(!isListening);

    if (!isListening) {
      // Start listening - fade music more
      setVolume(5);
      addMessage('dj', "I'm listening... speak your request!");
    } else {
      // Stop listening - restore
      setVolume(Math.max(10, originalVolumeRef.current * 0.3));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Chat Modal */}
          <motion.div
            className="relative w-full max-w-lg bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] rounded-t-3xl border-t border-purple-500/30 overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold">DJ VOYO</h3>
                  <p className="text-green-400 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Live & Ready
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Volume indicator */}
                <button
                  className="p-2 rounded-full bg-white/5 text-white/50"
                  onClick={() => setVolume(isMusicFaded ? originalVolumeRef.current : 10)}
                >
                  {isMusicFaded ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={onClose}
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {/* Currently Playing */}
            {currentTrack && (
              <div className="px-6 py-3 bg-white/5 border-b border-white/5">
                <p className="text-xs text-white/40">Now Playing:</p>
                <p className="text-sm text-white font-medium truncate">
                  {currentTrack.title} - {currentTrack.artist}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="h-64 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className={`
                      max-w-[80%] px-4 py-3 rounded-2xl
                      ${msg.type === 'user'
                        ? 'bg-purple-500 text-white rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm'
                      }
                    `}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Requests */}
            <div className="px-6 py-3 border-t border-white/10">
              <p className="text-xs text-white/40 mb-2">Quick requests:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REQUESTS.map((req) => (
                  <motion.button
                    key={req.id}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => handleQuickRequest(req)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {req.text}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10">
              {/* Voice Mode Button */}
              <motion.button
                className={`p-3 rounded-full transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
                onClick={toggleVoiceMode}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </motion.button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Talk to your DJ..."
                className="flex-1 px-4 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
              />

              {/* Send Button */}
              <motion.button
                className="p-3 rounded-full bg-purple-500 text-white"
                onClick={handleSendMessage}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
