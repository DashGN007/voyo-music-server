/**
 * VOYO Universe Store
 *
 * The CORE of voyomusic.com/username architecture
 *
 * Philosophy:
 * - Your browser IS your server
 * - localStorage IS your database
 * - Your URL IS your portal
 *
 * This store manages:
 * - Universe export/import (backup/restore)
 * - Passphrase-based encrypted backup
 * - P2P portal sharing (WebRTC)
 * - Universe sync between devices
 */

import { create } from 'zustand';
import { usePreferenceStore } from './preferenceStore';
import { useAccountStore } from './accountStore';
import { usePlayerStore } from './playerStore';

// ============================================
// TYPES
// ============================================

export interface UniverseData {
  version: string;
  exportedAt: string;
  username: string;

  // Account data
  account: {
    id: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    subscription: string;
    friendIds: string[];
    totalListeningHours: number;
    totalOyeGiven: number;
    totalOyeReceived: number;
    createdAt: string;
  } | null;

  // Music preferences (this is the gold - user's taste DNA)
  preferences: {
    trackPreferences: Record<string, any>;
    artistPreferences: Record<string, any>;
    tagPreferences: Record<string, any>;
    moodPreferences: Record<string, any>;
  };

  // Player state
  player: {
    currentTrackId?: string;
    currentTime?: number;
    volume: number;
    boostProfile: string;
    shuffleMode: boolean;
    repeatMode: string;
  };

  // Boosted tracks (HD cache metadata - actual files stay in browser cache)
  boostedTracks: string[]; // trackIds that have been boosted

  // Custom playlists
  playlists: {
    id: string;
    name: string;
    trackIds: string[];
    createdAt: string;
  }[];

  // Listen history (last 100)
  history: {
    trackId: string;
    playedAt: string;
    duration: number;
  }[];
}

export interface PortalSession {
  id: string;
  hostUsername: string;
  isHost: boolean;
  connectedPeers: string[];
  isLive: boolean;
  startedAt: string;
}

interface UniverseStore {
  // State
  isExporting: boolean;
  isImporting: boolean;
  lastBackupAt: string | null;

  // Portal (P2P sharing)
  portalSession: PortalSession | null;
  isPortalOpen: boolean;

  // Actions - Export/Import
  exportUniverse: () => UniverseData;
  importUniverse: (data: UniverseData) => Promise<boolean>;
  exportToJSON: () => string;
  downloadBackup: () => void;

  // Actions - Passphrase Backup (Web3 style)
  generatePassphrase: () => string;
  encryptUniverse: (passphrase: string) => Promise<string>;
  decryptUniverse: (encrypted: string, passphrase: string) => Promise<UniverseData | null>;
  saveToCloud: (passphrase: string) => Promise<boolean>;
  restoreFromCloud: (passphrase: string) => Promise<boolean>;

  // Actions - Portal (P2P)
  openPortal: () => Promise<string>; // Returns portal URL
  closePortal: () => void;
  joinPortal: (portalUrl: string) => Promise<boolean>;
  leavePortal: () => void;

  // Sync
  syncToPortal: () => void;
}

// ============================================
// WORD LIST FOR PASSPHRASE GENERATION
// (African-inspired words for VOYO flavor)
// ============================================
const PASSPHRASE_WORDS = [
  // Nature
  'mango', 'baobab', 'savanna', 'sunset', 'ocean', 'river', 'mountain', 'desert',
  'jungle', 'forest', 'sunrise', 'thunder', 'rain', 'wind', 'fire', 'earth',
  // Music
  'rhythm', 'melody', 'drum', 'bass', 'guitar', 'voice', 'harmony', 'beat',
  'groove', 'vibe', 'soul', 'spirit', 'dance', 'flow', 'wave', 'pulse',
  // African
  'africa', 'guinea', 'lagos', 'accra', 'dakar', 'nairobi', 'abuja', 'conakry',
  'freetown', 'bamako', 'kinshasa', 'addis', 'cairo', 'tunis', 'algiers', 'rabat',
  // Culture
  'kente', 'dashiki', 'ankara', 'gele', 'beads', 'gold', 'bronze', 'ivory',
  'jollof', 'fufu', 'suya', 'palm', 'coconut', 'pepper', 'spice', 'honey',
  // Vibes
  'peace', 'love', 'unity', 'power', 'wisdom', 'truth', 'light', 'hope',
  'dream', 'magic', 'star', 'moon', 'sun', 'sky', 'cloud', 'rainbow'
];

// ============================================
// HELPERS
// ============================================

function generateRandomWord(): string {
  return PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
}

function generatePassphrase(): string {
  // Generate 4-word passphrase + year (easy to remember)
  const words = [
    generateRandomWord(),
    generateRandomWord(),
    generateRandomWord(),
    generateRandomWord()
  ];
  const year = new Date().getFullYear();
  return `${words.join(' ')} ${year}`;
}

// Simple encryption using Web Crypto API
async function encryptData(data: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Derive key from passphrase
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encrypted: string, passphrase: string): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    // Extract salt, iv, and data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return decoder.decode(decrypted);
  } catch {
    return null;
  }
}

// Get boosted track IDs from download store
function getBoostedTrackIds(): string[] {
  try {
    const downloadStore = localStorage.getItem('voyo-downloads');
    if (!downloadStore) return [];
    const parsed = JSON.parse(downloadStore);
    return Object.keys(parsed.state?.downloads || {});
  } catch {
    return [];
  }
}

// ============================================
// STORE
// ============================================

export const useUniverseStore = create<UniverseStore>((set, get) => ({
  // Initial state
  isExporting: false,
  isImporting: false,
  lastBackupAt: localStorage.getItem('voyo-last-backup'),
  portalSession: null,
  isPortalOpen: false,

  // ========================================
  // EXPORT UNIVERSE
  // Collect all user data into one object
  // ========================================
  exportUniverse: (): UniverseData => {
    const account = useAccountStore.getState().currentAccount;
    const preferences = usePreferenceStore.getState();
    const player = usePlayerStore.getState();

    // Get history from player store
    const history = player.history.slice(-100).map(h => ({
      trackId: h.track.trackId || h.track.id,
      playedAt: h.playedAt,
      duration: h.duration
    }));

    const universe: UniverseData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      username: account?.username || 'anonymous',

      account: account ? {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        bio: account.bio,
        avatarUrl: account.avatarUrl,
        subscription: account.subscription,
        friendIds: account.friendIds,
        totalListeningHours: account.totalListeningHours,
        totalOyeGiven: account.totalOyeGiven,
        totalOyeReceived: account.totalOyeReceived,
        createdAt: account.createdAt
      } : null,

      preferences: {
        trackPreferences: preferences.trackPreferences,
        artistPreferences: preferences.artistPreferences,
        tagPreferences: preferences.tagPreferences,
        moodPreferences: preferences.moodPreferences
      },

      player: {
        currentTrackId: player.currentTrack?.trackId || player.currentTrack?.id,
        currentTime: player.currentTime,
        volume: player.volume,
        boostProfile: player.boostProfile,
        shuffleMode: player.shuffleMode,
        repeatMode: player.repeatMode
      },

      boostedTracks: getBoostedTrackIds(),

      playlists: [], // TODO: Add playlist store

      history
    };

    return universe;
  },

  // ========================================
  // IMPORT UNIVERSE
  // Restore user data from backup
  // ========================================
  importUniverse: async (data: UniverseData): Promise<boolean> => {
    set({ isImporting: true });

    try {
      // Validate version
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid universe data');
      }

      // Restore preferences
      const prefStore = usePreferenceStore.getState();
      // Use zustand's internal setState if available, or manually set localStorage
      localStorage.setItem('voyo-preferences', JSON.stringify({
        state: {
          trackPreferences: data.preferences.trackPreferences,
          artistPreferences: data.preferences.artistPreferences,
          tagPreferences: data.preferences.tagPreferences,
          moodPreferences: data.preferences.moodPreferences,
          currentSession: null
        },
        version: 1
      }));

      // Restore player state
      localStorage.setItem('voyo-player-state', JSON.stringify({
        currentTrackId: data.player.currentTrackId,
        currentTime: data.player.currentTime
      }));
      localStorage.setItem('voyo-volume', String(data.player.volume));

      // Restore account (if present)
      if (data.account) {
        localStorage.setItem('voyo-account', JSON.stringify({
          account: {
            ...data.account,
            whatsapp: '', // Don't restore sensitive data
            pin: '',
            stories: [],
            lastSeenAt: new Date().toISOString()
          }
        }));
      }

      set({ isImporting: false });

      // Reload to apply changes
      window.location.reload();

      return true;
    } catch (error) {
      console.error('[VOYO Universe] Import failed:', error);
      set({ isImporting: false });
      return false;
    }
  },

  // ========================================
  // EXPORT TO JSON STRING
  // ========================================
  exportToJSON: (): string => {
    const universe = get().exportUniverse();
    return JSON.stringify(universe, null, 2);
  },

  // ========================================
  // DOWNLOAD BACKUP FILE
  // ========================================
  downloadBackup: () => {
    set({ isExporting: true });

    const universe = get().exportUniverse();
    const json = JSON.stringify(universe, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `voyo-universe-${universe.username}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update last backup time
    const now = new Date().toISOString();
    localStorage.setItem('voyo-last-backup', now);
    set({ isExporting: false, lastBackupAt: now });
  },

  // ========================================
  // PASSPHRASE BACKUP SYSTEM
  // ========================================
  generatePassphrase: () => {
    return generatePassphrase();
  },

  encryptUniverse: async (passphrase: string): Promise<string> => {
    const universe = get().exportUniverse();
    const json = JSON.stringify(universe);
    return encryptData(json, passphrase);
  },

  decryptUniverse: async (encrypted: string, passphrase: string): Promise<UniverseData | null> => {
    const decrypted = await decryptData(encrypted, passphrase);
    if (!decrypted) return null;

    try {
      return JSON.parse(decrypted) as UniverseData;
    } catch {
      return null;
    }
  },

  // Save encrypted universe to edge storage (Cloudflare KV in production)
  saveToCloud: async (passphrase: string): Promise<boolean> => {
    try {
      const encrypted = await get().encryptUniverse(passphrase);

      // Create a hash of the passphrase for the storage key
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(passphrase));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // In production: POST to Cloudflare KV via API
      // For now: Store in localStorage as proof of concept
      localStorage.setItem(`voyo-cloud-backup-${hashHex.slice(0, 16)}`, encrypted);

      console.log('[VOYO Universe] Saved to cloud with key:', hashHex.slice(0, 16));

      const now = new Date().toISOString();
      localStorage.setItem('voyo-last-backup', now);
      set({ lastBackupAt: now });

      return true;
    } catch (error) {
      console.error('[VOYO Universe] Cloud save failed:', error);
      return false;
    }
  },

  restoreFromCloud: async (passphrase: string): Promise<boolean> => {
    try {
      // Create hash for lookup
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(passphrase));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // In production: GET from Cloudflare KV via API
      const encrypted = localStorage.getItem(`voyo-cloud-backup-${hashHex.slice(0, 16)}`);

      if (!encrypted) {
        console.error('[VOYO Universe] No backup found for this passphrase');
        return false;
      }

      const universe = await get().decryptUniverse(encrypted, passphrase);
      if (!universe) {
        console.error('[VOYO Universe] Decryption failed');
        return false;
      }

      return get().importUniverse(universe);
    } catch (error) {
      console.error('[VOYO Universe] Cloud restore failed:', error);
      return false;
    }
  },

  // ========================================
  // P2P PORTAL SYSTEM (WebRTC)
  // ========================================
  openPortal: async (): Promise<string> => {
    const account = useAccountStore.getState().currentAccount;
    const username = account?.username || 'anonymous';

    // Generate portal session
    const sessionId = `portal-${username}-${Date.now()}`;

    set({
      portalSession: {
        id: sessionId,
        hostUsername: username,
        isHost: true,
        connectedPeers: [],
        isLive: true,
        startedAt: new Date().toISOString()
      },
      isPortalOpen: true
    });

    // In production: This would set up WebRTC signaling
    // For now: Return the portal URL
    const portalUrl = `${window.location.origin}/${username}?session=${sessionId}`;

    console.log('[VOYO Portal] Opened:', portalUrl);

    return portalUrl;
  },

  closePortal: () => {
    // In production: Close WebRTC connections
    set({
      portalSession: null,
      isPortalOpen: false
    });
    console.log('[VOYO Portal] Closed');
  },

  joinPortal: async (portalUrl: string): Promise<boolean> => {
    try {
      // Parse portal URL
      const url = new URL(portalUrl);
      const username = url.pathname.slice(1);
      const sessionId = url.searchParams.get('session');

      if (!sessionId) {
        console.error('[VOYO Portal] Invalid portal URL');
        return false;
      }

      // In production: Connect via WebRTC
      set({
        portalSession: {
          id: sessionId,
          hostUsername: username,
          isHost: false,
          connectedPeers: [],
          isLive: true,
          startedAt: new Date().toISOString()
        },
        isPortalOpen: true
      });

      console.log('[VOYO Portal] Joined:', username);

      return true;
    } catch (error) {
      console.error('[VOYO Portal] Join failed:', error);
      return false;
    }
  },

  leavePortal: () => {
    // In production: Disconnect from WebRTC
    set({
      portalSession: null,
      isPortalOpen: false
    });
    console.log('[VOYO Portal] Left');
  },

  // Sync current state to connected peers
  syncToPortal: () => {
    const { portalSession, isPortalOpen } = get();
    if (!isPortalOpen || !portalSession?.isHost) return;

    // In production: Send state update via WebRTC data channel
    const currentTrack = usePlayerStore.getState().currentTrack;
    const currentTime = usePlayerStore.getState().currentTime;
    const isPlaying = usePlayerStore.getState().isPlaying;

    console.log('[VOYO Portal] Sync:', {
      track: currentTrack?.title,
      time: currentTime,
      playing: isPlaying
    });
  }
}));

export default useUniverseStore;
