/**
 * VOYO Portal Chat - Dimensional Portal Messages
 *
 * Features:
 * - Real-time chat within a portal session
 * - Each user gets a unique color based on their username
 * - Messages persist during portal session
 * - Smooth animations for new messages
 *
 * The vibe: You're in someone's musical dimension, chatting with other visitors
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, X, Users } from 'lucide-react';
import { haptics } from '../../utils/haptics';

// ============================================================================
// TYPES
// ============================================================================

export interface PortalMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  color: string;
}

interface PortalChatProps {
  portalOwner: string;          // Whose portal we're in
  currentUser: string;          // Who I am
  isPortalOpen: boolean;        // Is the portal active
  onClose?: () => void;         // Close chat overlay
}

// ============================================================================
// COLOR GENERATION - Unique color per user
// ============================================================================

// Predefined beautiful colors for portal dimensions
const PORTAL_COLORS = [
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#84CC16', // Lime
  '#A855F7', // Purple
  '#22D3EE', // Sky
  '#FB7185', // Rose
  '#4ADE80', // Green
  '#FACC15', // Yellow
];

/**
 * Generate a consistent color for a username
 * Same username always gets the same color
 */
function getUserColor(username: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use absolute value and mod to get index
  const index = Math.abs(hash) % PORTAL_COLORS.length;
  return PORTAL_COLORS[index];
}

// ============================================================================
// LOCAL STORAGE CHAT (Temporary until Supabase chat table)
// ============================================================================

function getChatKey(portalOwner: string): string {
  return `voyo_portal_chat_${portalOwner.toLowerCase()}`;
}

function loadMessages(portalOwner: string): PortalMessage[] {
  try {
    const stored = localStorage.getItem(getChatKey(portalOwner));
    if (!stored) return [];
    const messages = JSON.parse(stored);
    // Filter messages older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return messages.filter((m: PortalMessage) => m.timestamp > oneHourAgo);
  } catch {
    return [];
  }
}

function saveMessages(portalOwner: string, messages: PortalMessage[]): void {
  try {
    // Only keep last 100 messages
    const trimmed = messages.slice(-100);
    localStorage.setItem(getChatKey(portalOwner), JSON.stringify(trimmed));
  } catch {
    // Storage full, clear old data
    localStorage.removeItem(getChatKey(portalOwner));
  }
}

// ============================================================================
// CHAT MESSAGE COMPONENT
// ============================================================================

interface ChatMessageProps {
  message: PortalMessage;
  isOwnMessage: boolean;
}

const ChatMessage = memo(({ message, isOwnMessage }: ChatMessageProps) => {
  const timeAgo = getTimeAgo(message.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} mb-3`}
    >
      {/* Username with color */}
      <span
        className="text-xs font-medium mb-1"
        style={{ color: message.color }}
      >
        {message.username}
        <span className="text-white/30 ml-2 font-normal">{timeAgo}</span>
      </span>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
          isOwnMessage
            ? 'rounded-tr-sm'
            : 'rounded-tl-sm'
        }`}
        style={{
          background: isOwnMessage
            ? `linear-gradient(135deg, ${message.color}40 0%, ${message.color}20 100%)`
            : 'rgba(255,255,255,0.1)',
          borderLeft: isOwnMessage ? 'none' : `3px solid ${message.color}`,
        }}
      >
        <p className="text-white text-sm">{message.text}</p>
      </div>
    </motion.div>
  );
});
ChatMessage.displayName = 'ChatMessage';

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

// ============================================================================
// PORTAL CHAT COMPONENT
// ============================================================================

export const PortalChat = memo(({ portalOwner, currentUser, isPortalOpen, onClose }: PortalChatProps) => {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current user's color
  const userColor = getUserColor(currentUser);

  // Load messages on mount
  useEffect(() => {
    if (!isPortalOpen) return;

    const loaded = loadMessages(portalOwner);
    setMessages(loaded);

    // Poll for new messages (until we add Supabase realtime)
    const pollInterval = setInterval(() => {
      const fresh = loadMessages(portalOwner);
      setMessages(fresh);
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [portalOwner, isPortalOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Send message
  const handleSend = useCallback(() => {
    if (!inputText.trim() || !currentUser) return;

    const newMessage: PortalMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      username: currentUser,
      text: inputText.trim(),
      timestamp: Date.now(),
      color: userColor,
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    saveMessages(portalOwner, updatedMessages);
    setInputText('');
    haptics.light();
  }, [inputText, currentUser, userColor, messages, portalOwner]);

  // Handle enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!isPortalOpen) return null;

  // Minimized state - just a floating button
  if (isMinimized) {
    return (
      <motion.button
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${userColor} 0%, ${userColor}80 100%)`,
          boxShadow: `0 4px 20px ${userColor}40`,
        }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsMinimized(false);
          haptics.light();
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <MessageCircle size={24} className="text-white" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </motion.button>
    );
  }

  // Expanded chat view
  return (
    <motion.div
      className="fixed bottom-24 right-4 z-50 w-80 max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(20,20,30,0.98) 100%)',
        border: `1px solid ${userColor}30`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${userColor}20`,
      }}
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${userColor}20` }}
      >
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: userColor }} />
          <span className="text-white font-semibold text-sm">
            {portalOwner}'s Portal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
            onClick={() => setIsMinimized(true)}
          >
            <span className="text-white text-lg">−</span>
          </button>
          {onClose && (
            <button
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
              onClick={onClose}
            >
              <X size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Your color indicator */}
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: `${userColor}10` }}>
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: userColor, boxShadow: `0 0 8px ${userColor}` }}
        />
        <span className="text-white/60 text-xs">
          Your dimension: <span style={{ color: userColor }}>{currentUser}</span>
        </span>
      </div>

      {/* Messages area */}
      <div className="h-64 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageCircle size={40} className="text-white/20 mb-3" />
            <p className="text-white/40 text-sm">No messages yet</p>
            <p className="text-white/30 text-xs mt-1">
              Say hi to {portalOwner} and other visitors!
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isOwnMessage={msg.username === currentUser}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="p-3 flex gap-2"
        style={{ borderTop: `1px solid ${userColor}20` }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Message ${portalOwner}'s portal...`}
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          maxLength={200}
        />
        <motion.button
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: inputText.trim()
              ? `linear-gradient(135deg, ${userColor} 0%, ${userColor}80 100%)`
              : 'rgba(255,255,255,0.1)',
          }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!inputText.trim()}
        >
          <Send size={18} className="text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
});

PortalChat.displayName = 'PortalChat';

export default PortalChat;
