/**
 * VOYO Universe Panel
 *
 * voyomusic.com/username management
 *
 * Features:
 * - Universe stats (likes, listens, etc.)
 * - Backup to JSON file
 * - Passphrase backup (Web3 style)
 * - Portal sharing (P2P)
 * - QR Code for portal
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Upload,
  Key,
  QrCode,
  Users,
  Music,
  Heart,
  Clock,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Globe,
  Smartphone
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import { useAccountStore } from '../../store/accountStore';
import { usePreferenceStore } from '../../store/preferenceStore';

interface UniversePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversePanel = ({ isOpen, onClose }: UniversePanelProps) => {
  const {
    exportUniverse,
    downloadBackup,
    generatePassphrase,
    saveToCloud,
    restoreFromCloud,
    openPortal,
    closePortal,
    portalSession,
    isPortalOpen,
    lastBackupAt
  } = useUniverseStore();

  const { currentAccount } = useAccountStore();
  const { trackPreferences } = usePreferenceStore();

  const [activeTab, setActiveTab] = useState<'stats' | 'backup' | 'portal'>('stats');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculate stats from preferences
  const stats = {
    tracksPlayed: Object.keys(trackPreferences).length,
    totalListens: Object.values(trackPreferences).reduce((sum, p) => sum + p.totalListens, 0),
    totalReactions: Object.values(trackPreferences).reduce((sum, p) => sum + p.reactions, 0),
    likedTracks: Object.values(trackPreferences).filter(p => p.explicitLike === true).length,
    completions: Object.values(trackPreferences).reduce((sum, p) => sum + p.completions, 0),
    skips: Object.values(trackPreferences).reduce((sum, p) => sum + p.skips, 0),
    totalMinutes: Math.round(Object.values(trackPreferences).reduce((sum, p) => sum + p.totalDuration, 0) / 60)
  };

  // Generate new passphrase
  const handleGeneratePassphrase = () => {
    const newPassphrase = generatePassphrase();
    setPassphrase(newPassphrase);
    setMessage({ type: 'success', text: 'New passphrase generated! Save it somewhere safe.' });
  };

  // Save to cloud
  const handleSaveToCloud = async () => {
    if (!passphrase) {
      setMessage({ type: 'error', text: 'Generate a passphrase first' });
      return;
    }

    setIsSaving(true);
    const success = await saveToCloud(passphrase);
    setIsSaving(false);

    if (success) {
      setMessage({ type: 'success', text: 'Universe saved! Remember your passphrase.' });
    } else {
      setMessage({ type: 'error', text: 'Failed to save. Try again.' });
    }
  };

  // Restore from cloud
  const handleRestoreFromCloud = async () => {
    if (!passphraseInput) {
      setMessage({ type: 'error', text: 'Enter your passphrase' });
      return;
    }

    setIsRestoring(true);
    const success = await restoreFromCloud(passphraseInput);
    setIsRestoring(false);

    if (success) {
      setMessage({ type: 'success', text: 'Universe restored! Reloading...' });
    } else {
      setMessage({ type: 'error', text: 'Invalid passphrase or no backup found.' });
    }
  };

  // Open portal
  const handleOpenPortal = async () => {
    const url = await openPortal();
    setPortalUrl(url);
    setMessage({ type: 'success', text: 'Portal opened! Share the link.' });
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const username = currentAccount?.username || 'anonymous';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] rounded-3xl overflow-hidden border border-white/10"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-white/10">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">My Universe</h2>
                  <p className="text-white/50 text-sm">voyomusic.com/{username}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'stats', icon: Music, label: 'Stats' },
                { id: 'backup', icon: Shield, label: 'Backup' },
                { id: 'portal', icon: Users, label: 'Portal' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white border-b-2 border-purple-500'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Message Toast */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    className={`mb-4 p-3 rounded-xl text-sm ${
                      message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-purple-400 mb-2">
                        <Music className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Tracks</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.tracksPlayed}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-pink-400 mb-2">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Liked</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.likedTracks}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Minutes</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.totalMinutes}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">OYEs</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.totalReactions}</p>
                    </div>
                  </div>

                  {/* Completion Rate */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70 text-sm">Completion Rate</span>
                      <span className="text-white font-bold">
                        {stats.totalListens > 0
                          ? Math.round((stats.completions / stats.totalListens) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{
                          width: `${stats.totalListens > 0
                            ? (stats.completions / stats.totalListens) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Tab */}
              {activeTab === 'backup' && (
                <div className="space-y-4">
                  {/* Last Backup */}
                  {lastBackupAt && (
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                      Last backup: {new Date(lastBackupAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Download Backup */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Download Backup</h3>
                    <p className="text-white/50 text-sm mb-3">
                      Export your entire universe as a JSON file
                    </p>
                    <button
                      onClick={downloadBackup}
                      className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Download Universe
                    </button>
                  </div>

                  {/* Passphrase Backup */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Passphrase Backup</h3>
                    <p className="text-white/50 text-sm mb-3">
                      Encrypt your universe with a memorable passphrase
                    </p>

                    {/* Generate Passphrase */}
                    {!passphrase ? (
                      <button
                        onClick={handleGeneratePassphrase}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                      >
                        <Key className="w-5 h-5" />
                        Generate Passphrase
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {/* Show Passphrase */}
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/50 text-xs">YOUR PASSPHRASE</span>
                            <button
                              onClick={() => handleCopy(passphrase)}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-white font-mono text-sm">{passphrase}</p>
                        </div>

                        {/* Save to Cloud */}
                        <button
                          onClick={handleSaveToCloud}
                          disabled={isSaving}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Shield className="w-5 h-5" />
                          )}
                          {isSaving ? 'Saving...' : 'Save to Cloud'}
                        </button>

                        {/* New Passphrase */}
                        <button
                          onClick={handleGeneratePassphrase}
                          className="w-full py-2 text-white/50 text-sm hover:text-white/70"
                        >
                          Generate New Passphrase
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Restore */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Restore Universe</h3>
                    <p className="text-white/50 text-sm mb-3">
                      Enter your passphrase to restore your universe
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={passphraseInput}
                        onChange={(e) => setPassphraseInput(e.target.value)}
                        placeholder="Enter passphrase..."
                        className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                      />
                      <button
                        onClick={handleRestoreFromCloud}
                        disabled={isRestoring}
                        className="px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        {isRestoring ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Portal Tab */}
              {activeTab === 'portal' && (
                <div className="space-y-4">
                  {/* Portal Info */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <h3 className="text-white font-semibold mb-2">What is a Portal?</h3>
                    <p className="text-white/70 text-sm">
                      Open your portal to let friends join your listening session.
                      They'll hear what you hear, in real-time.
                    </p>
                  </div>

                  {/* Portal Status */}
                  {isPortalOpen ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-green-400 font-semibold">Portal Open</span>
                        </div>
                        <button
                          onClick={closePortal}
                          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
                        >
                          Close
                        </button>
                      </div>

                      {/* Portal URL */}
                      {portalUrl && (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/50 text-xs">PORTAL LINK</span>
                            <button
                              onClick={() => handleCopy(portalUrl)}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-white text-sm truncate">{portalUrl}</p>
                        </div>
                      )}

                      {/* Connected Peers */}
                      {portalSession && (
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                          <Users className="w-4 h-4" />
                          <span>{portalSession.connectedPeers.length} listeners</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleOpenPortal}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center gap-2"
                    >
                      <Globe className="w-5 h-5" />
                      Open My Portal
                    </button>
                  )}

                  {/* QR Code placeholder */}
                  {isPortalOpen && portalUrl && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                      <div className="w-32 h-32 mx-auto bg-white rounded-xl flex items-center justify-center mb-3">
                        <QrCode className="w-16 h-16 text-black/50" />
                      </div>
                      <p className="text-white/50 text-sm">
                        Scan to join portal
                      </p>
                    </div>
                  )}

                  {/* Share Options */}
                  {isPortalOpen && portalUrl && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: `Join my VOYO`,
                              text: `Listen with me on VOYO`,
                              url: portalUrl
                            });
                          }
                        }}
                        className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10"
                      >
                        <Smartphone className="w-4 h-4" />
                        Share
                      </button>
                      <button
                        onClick={() => handleCopy(portalUrl)}
                        className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UniversePanel;
