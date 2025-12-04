/**
 * VOYO Creator Upload - The Creator Economy Entry Point
 * Drop your vibe, share your energy with the OYO Nation
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Music2, Video, Camera, Sparkles, Zap, ChevronRight, Check } from 'lucide-react';
import { usePlayerStore } from '../../../store/playerStore';

interface CreatorUploadProps {
  onClose: () => void;
}

// Upload Step Types
type UploadStep = 'select' | 'preview' | 'details' | 'posting';

export const CreatorUpload = ({ onClose }: CreatorUploadProps) => {
  const { currentTrack } = usePlayerStore();
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedSound, setSelectedSound] = useState<string | null>(
    currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStep('preview');
    }
  };

  const handlePost = () => {
    setStep('posting');
    // Simulate posting
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 bg-[#0a0a0f] flex flex-col"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <motion.button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-6 h-6 text-white" />
        </motion.button>
        <span className="font-bold text-white text-lg">Create VOYO</span>
        <div className="w-10" />
      </div>

      {/* Content based on step */}
      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div
            key="select"
            className="flex-1 flex flex-col items-center justify-center p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Upload Circle */}
            <motion.button
              className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-dashed border-purple-500/50 flex items-center justify-center mb-8"
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.05, borderColor: 'rgba(168, 85, 247, 0.8)' }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Upload className="w-12 h-12 text-purple-400" />
              </motion.div>
              {/* Orbiting sparkles */}
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 text-yellow-400" />
              </motion.div>
            </motion.button>

            <h2 className="text-2xl font-bold text-white mb-2">Drop your Vibe</h2>
            <p className="text-white/50 text-center mb-8 max-w-xs">
              Share your energy with the OYO Nation. Videos up to 3 minutes.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex gap-4 mb-8">
              <motion.button
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10"
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
              >
                <Video className="w-6 h-6 text-purple-400" />
                <span className="text-xs text-white/70">Upload</span>
              </motion.button>

              <motion.button
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
              >
                <Camera className="w-6 h-6 text-pink-400" />
                <span className="text-xs text-white/70">Record</span>
              </motion.button>
            </div>

            {/* Currently Playing Suggestion */}
            {currentTrack && (
              <motion.div
                className="w-full max-w-sm p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Music2 className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-purple-300 mb-0.5">Use this sound?</p>
                    <p className="text-sm text-white font-medium truncate">
                      {currentTrack.title}
                    </p>
                    <p className="text-xs text-white/50 truncate">{currentTrack.artist}</p>
                  </div>
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
              </motion.div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>
        )}

        {step === 'preview' && previewUrl && (
          <motion.div
            key="preview"
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
          >
            {/* Video Preview */}
            <div className="flex-1 relative bg-black">
              <video
                src={previewUrl}
                className="w-full h-full object-contain"
                controls
                autoPlay
                loop
                muted
              />
            </div>

            {/* Next Button */}
            <div className="p-4">
              <motion.button
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white flex items-center justify-center gap-2"
                onClick={() => setStep('details')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 'details' && (
          <motion.div
            key="details"
            className="flex-1 flex flex-col p-4"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
          >
            {/* Caption Input */}
            <div className="mb-6">
              <label className="text-sm text-white/50 mb-2 block">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Describe your vibe... #OYE #AfricanVibes"
                className="w-full h-32 p-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-purple-500/50"
              />
              <p className="text-xs text-white/30 mt-2">{caption.length}/300</p>
            </div>

            {/* Sound Selection */}
            <div className="mb-6">
              <label className="text-sm text-white/50 mb-2 block">Sound</label>
              <motion.button
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Music2 className="w-5 h-5 text-purple-400" />
                <span className="flex-1 text-left text-white">
                  {selectedSound || 'Add sound'}
                </span>
                <ChevronRight className="w-5 h-5 text-white/30" />
              </motion.button>
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="text-sm text-white/50 mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {['#OYE', '#AfricanVibes', '#Dance', '#Music', '#Culture'].map((tag) => (
                  <motion.button
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70"
                    whileHover={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgba(168, 85, 247, 0.5)' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Post Button */}
            <motion.button
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white flex items-center justify-center gap-2"
              onClick={handlePost}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Zap className="w-5 h-5" />
              Post to VOYO
            </motion.button>
          </motion.div>
        )}

        {step === 'posting' && (
          <motion.div
            key="posting"
            className="flex-1 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-6"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Check className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Posting...</h2>
            <p className="text-white/50">Sharing your vibe with the world</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CreatorUpload;
