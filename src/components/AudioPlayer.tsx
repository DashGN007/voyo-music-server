/**
 * VOYO Music - Hybrid Audio Player
 *
 * FLOW:
 * 1. Track cached? → Play from Boost (cached audio) instantly
 * 2. Track NOT cached? → Stream via iframe, background boost starts
 * 3. Boost completes? → Hot-swap to cached audio seamlessly
 *
 * COORDINATION with YouTubeIframe:
 * - playbackSource === 'iframe' → Iframe handles audio (unmuted)
 * - playbackSource === 'cached' → Boost handles audio, iframe muted (video only)
 *
 * AUDIO ENHANCEMENT:
 * - Only applies to Boost (cached) audio
 * - 4 presets: Boosted, Calm, VOYEX, Xtreme
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { audioEngine } from '../services/audioEngine';
import { recordPoolEngagement } from '../services/personalization';
import { recordTrackInSession } from '../services/poolCurator';
import { recordPlay as djRecordPlay } from '../services/intelligentDJ';
import { onTrackPlay as oyoOnTrackPlay, onTrackComplete as oyoOnTrackComplete } from '../services/oyoDJ';
import { registerTrackPlay as viRegisterPlay } from '../services/videoIntelligence';
import { useMiniPiP } from '../hooks/useMiniPiP';

export type BoostPreset = 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Audio boost presets
const BOOST_PRESETS = {
  boosted: {
    gain: 1.15, bassFreq: 80, bassGain: 5, presenceFreq: 3000, presenceGain: 2,
    subBassFreq: 40, subBassGain: 2, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 1, harmonicAmount: 0,
    compressor: { threshold: -12, knee: 10, ratio: 4, attack: 0.003, release: 0.25 }
  },
  calm: {
    gain: 1.05, bassFreq: 80, bassGain: 3, presenceFreq: 3000, presenceGain: 1,
    subBassFreq: 50, subBassGain: 1, warmthFreq: 250, warmthGain: 2,
    airFreq: 8000, airGain: 2, harmonicAmount: 0,
    compressor: { threshold: -15, knee: 15, ratio: 3, attack: 0.005, release: 0.3 }
  },
  voyex: {
    gain: 1.25, bassFreq: 80, bassGain: 7, presenceFreq: 3000, presenceGain: 3,
    subBassFreq: 45, subBassGain: 5, warmthFreq: 250, warmthGain: 2,
    airFreq: 12000, airGain: 3, harmonicAmount: 15,
    compressor: { threshold: -8, knee: 6, ratio: 8, attack: 0.002, release: 0.15 }
  },
  xtreme: {
    gain: 1.35, bassFreq: 80, bassGain: 10, presenceFreq: 3000, presenceGain: 4,
    subBassFreq: 40, subBassGain: 7, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 2, harmonicAmount: 20,
    compressor: { threshold: -4, knee: 0, ratio: 20, attack: 0.001, release: 0.1 }
  }
};

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cachedUrlRef = useRef<string | null>(null);

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const presenceFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const subBassFilterRef = useRef<BiquadFilterNode | null>(null);
  const warmthFilterRef = useRef<BiquadFilterNode | null>(null);
  const airFilterRef = useRef<BiquadFilterNode | null>(null);
  const harmonicExciterRef = useRef<WaveShaperNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioEnhancedRef = useRef<boolean>(false);
  const currentProfileRef = useRef<BoostPreset>('boosted');

  // VOYEX Spatial Layer refs (dynamically controlled nodes only)
  const spatialEnhancedRef = useRef<boolean>(false);
  const crossfeedLeftGainRef = useRef<GainNode | null>(null);
  const crossfeedRightGainRef = useRef<GainNode | null>(null);
  const panDepthGainRef = useRef<GainNode | null>(null);
  const haasDelayRef = useRef<DelayNode | null>(null);
  const reverbDamping1Ref = useRef<BiquadFilterNode | null>(null);
  const reverbDamping2Ref = useRef<BiquadFilterNode | null>(null);
  const reverbDamping3Ref = useRef<BiquadFilterNode | null>(null);
  const reverbFeedback1Ref = useRef<GainNode | null>(null);
  const reverbFeedback2Ref = useRef<GainNode | null>(null);
  const reverbFeedback3Ref = useRef<GainNode | null>(null);
  const reverbWetGainRef = useRef<GainNode | null>(null);
  const subHarmonicGainRef = useRef<GainNode | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const previousTrackRef = useRef<Track | null>(null);
  const hasRecordedPlayRef = useRef<boolean>(false);
  const trackProgressRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const backgroundBoostingRef = useRef<string | null>(null);
  const hotSwapAbortRef = useRef<AbortController | null>(null);

  // Store state
  const {
    currentTrack, isPlaying, volume, seekPosition, playbackRate, boostProfile,
    currentTime: savedCurrentTime, playbackSource, voyexSpatial,
    setCurrentTime, setDuration, setProgress, clearSeekPosition, togglePlay,
    nextTrack, setBufferHealth, setPlaybackSource,
  } = usePlayerStore();

  const { startListenSession, endListenSession } = usePreferenceStore();
  const { initialize: initDownloads, checkCache, cacheTrack, lastBoostCompletion } = useDownloadStore();

  // Mini-PiP for background playback
  useMiniPiP();

  // Initialize downloads
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  // Background playback protection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && playbackSource === 'cached') {
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        if (audioRef.current && shouldPlay) {
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
          }
          audioRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [playbackSource]);

  // Wake lock
  useEffect(() => {
    const manageWakeLock = async () => {
      if (!isPlaying && wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        return;
      }
      if (isPlaying && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (e) { /* ignore */ }
      }
    };
    manageWakeLock();
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, [isPlaying]);

  // Harmonic exciter curve
  const makeHarmonicCurve = (amount: number): Float32Array<ArrayBuffer> => {
    const samples = 44100;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount / 100) * x * 20 * deg) / (Math.PI + (amount / 100) * Math.abs(x));
    }
    return curve;
  };

  // Setup audio enhancement
  const setupAudioEnhancement = useCallback((preset: BoostPreset = 'boosted') => {
    if (!audioRef.current || audioEnhancedRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const settings = BOOST_PRESETS[preset];
      currentProfileRef.current = preset;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      // EQ Chain
      const subBass = ctx.createBiquadFilter();
      subBass.type = 'lowshelf'; subBass.frequency.value = settings.subBassFreq; subBass.gain.value = settings.subBassGain;
      subBassFilterRef.current = subBass;

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf'; bass.frequency.value = settings.bassFreq; bass.gain.value = settings.bassGain;
      bassFilterRef.current = bass;

      const warmth = ctx.createBiquadFilter();
      warmth.type = 'peaking'; warmth.frequency.value = settings.warmthFreq; warmth.Q.value = 1.5; warmth.gain.value = settings.warmthGain;
      warmthFilterRef.current = warmth;

      const harmonic = ctx.createWaveShaper();
      if (settings.harmonicAmount > 0) {
        harmonic.curve = makeHarmonicCurve(settings.harmonicAmount);
        harmonic.oversample = '2x';
      }
      harmonicExciterRef.current = harmonic;

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking'; presence.frequency.value = settings.presenceFreq; presence.Q.value = 1; presence.gain.value = settings.presenceGain;
      presenceFilterRef.current = presence;

      const air = ctx.createBiquadFilter();
      air.type = 'highshelf'; air.frequency.value = settings.airFreq; air.gain.value = settings.airGain;
      airFilterRef.current = air;

      const gain = ctx.createGain();
      gain.gain.value = settings.gain;
      gainNodeRef.current = gain;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = settings.compressor.threshold;
      comp.knee.value = settings.compressor.knee;
      comp.ratio.value = settings.compressor.ratio;
      comp.attack.value = settings.compressor.attack;
      comp.release.value = settings.compressor.release;
      compressorRef.current = comp;

      // Connect EQ chain
      source.connect(subBass);
      subBass.connect(bass);
      bass.connect(warmth);
      warmth.connect(harmonic);
      harmonic.connect(presence);
      presence.connect(air);
      air.connect(gain);
      gain.connect(comp);

      // === VOYEX SPATIAL LAYER ===
      // Inserted after compressor. At slider=0, all nodes bypass (no coloring).

      // --- CROSSFEED SYSTEM ---
      const cfSplitter = ctx.createChannelSplitter(2);
      const cfMerger = ctx.createChannelMerger(2);

      const cfLeftDelay = ctx.createDelay(0.01);
      cfLeftDelay.delayTime.value = 0.0003;
      const cfLeftFilter = ctx.createBiquadFilter();
      cfLeftFilter.type = 'lowpass';
      cfLeftFilter.frequency.value = 6000;
      const cfLeftGain = ctx.createGain();
      cfLeftGain.gain.value = 0;
      crossfeedLeftGainRef.current = cfLeftGain;

      const cfRightDelay = ctx.createDelay(0.01);
      cfRightDelay.delayTime.value = 0.0003;
      const cfRightFilter = ctx.createBiquadFilter();
      cfRightFilter.type = 'lowpass';
      cfRightFilter.frequency.value = 6000;
      const cfRightGain = ctx.createGain();
      cfRightGain.gain.value = 0;
      crossfeedRightGainRef.current = cfRightGain;

      comp.connect(cfSplitter);
      cfSplitter.connect(cfMerger, 0, 0);
      cfSplitter.connect(cfMerger, 1, 1);
      cfSplitter.connect(cfLeftDelay, 0);
      cfLeftDelay.connect(cfLeftFilter);
      cfLeftFilter.connect(cfLeftGain);
      cfLeftGain.connect(cfMerger, 0, 1);
      cfSplitter.connect(cfRightDelay, 1);
      cfRightDelay.connect(cfRightFilter);
      cfRightFilter.connect(cfRightGain);
      cfRightGain.connect(cfMerger, 0, 0);

      // --- ORGANIC STEREO PANNER ---
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.037;
      const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.071;
      const lfo3 = ctx.createOscillator(); lfo3.type = 'sine'; lfo3.frequency.value = 0.113;
      const panDepth = ctx.createGain();
      panDepth.gain.value = 0;
      panDepthGainRef.current = panDepth;
      lfo1.connect(panDepth); lfo2.connect(panDepth); lfo3.connect(panDepth);
      panDepth.connect(panner.pan);
      lfo1.start(); lfo2.start(); lfo3.start();
      cfMerger.connect(panner);

      // --- HAAS WIDENER ---
      const hSplitter = ctx.createChannelSplitter(2);
      const hMerger = ctx.createChannelMerger(2);
      const hDelay = ctx.createDelay(0.02);
      hDelay.delayTime.value = 0;
      haasDelayRef.current = hDelay;
      panner.connect(hSplitter);
      hSplitter.connect(hMerger, 0, 0);
      hSplitter.connect(hDelay, 1);
      hDelay.connect(hMerger, 0, 1);
      hMerger.connect(ctx.destination);

      // --- REVERB NETWORK (parallel bus) ---
      const rvbInput = ctx.createGain();
      rvbInput.gain.value = 1;
      const rvbWet = ctx.createGain();
      rvbWet.gain.value = 0;
      reverbWetGainRef.current = rvbWet;
      const rvbTimes = [0.037, 0.047, 0.059];
      const rvbDampRefs = [reverbDamping1Ref, reverbDamping2Ref, reverbDamping3Ref];
      const rvbFbRefs = [reverbFeedback1Ref, reverbFeedback2Ref, reverbFeedback3Ref];
      for (let i = 0; i < 3; i++) {
        const dly = ctx.createDelay(0.1);
        dly.delayTime.value = rvbTimes[i];
        const damp = ctx.createBiquadFilter();
        damp.type = 'lowpass'; damp.frequency.value = 4000;
        const fb = ctx.createGain();
        fb.gain.value = 0;
        rvbInput.connect(dly);
        dly.connect(damp);
        damp.connect(fb);
        fb.connect(dly);
        damp.connect(rvbWet);
        rvbDampRefs[i].current = damp;
        rvbFbRefs[i].current = fb;
      }
      comp.connect(rvbInput);
      rvbWet.connect(ctx.destination);

      // --- SUB-HARMONIC GENERATOR (parallel bus) ---
      const subBP = ctx.createBiquadFilter();
      subBP.type = 'bandpass'; subBP.frequency.value = 90; subBP.Q.value = 1;
      const subShaper = ctx.createWaveShaper();
      const subCurve = new Float32Array(44100);
      for (let si = 0; si < 44100; si++) {
        const sx = (si * 2) / 44100 - 1;
        subCurve[si] = Math.tanh(sx * 3) * 0.8;
      }
      subShaper.curve = subCurve;
      subShaper.oversample = '2x';
      const subLP = ctx.createBiquadFilter();
      subLP.type = 'lowpass'; subLP.frequency.value = 80;
      const subMix = ctx.createGain();
      subMix.gain.value = 0;
      subHarmonicGainRef.current = subMix;
      comp.connect(subBP);
      subBP.connect(subShaper);
      subShaper.connect(subLP);
      subLP.connect(subMix);
      subMix.connect(ctx.destination);

      spatialEnhancedRef.current = true;
      audioEnhancedRef.current = true;
      console.log(`🎵 [VOYO] Boost EQ + Spatial Layer active: ${preset.toUpperCase()}`);
    } catch (e) {
      console.warn('[VOYO] Audio enhancement failed:', e);
    }
  }, []);

  // Update preset dynamically
  const updateBoostPreset = useCallback((preset: BoostPreset) => {
    if (!audioEnhancedRef.current) return;
    const s = BOOST_PRESETS[preset];
    currentProfileRef.current = preset;

    subBassFilterRef.current && (subBassFilterRef.current.gain.value = s.subBassGain);
    bassFilterRef.current && (bassFilterRef.current.gain.value = s.bassGain);
    warmthFilterRef.current && (warmthFilterRef.current.gain.value = s.warmthGain);
    presenceFilterRef.current && (presenceFilterRef.current.gain.value = s.presenceGain);
    airFilterRef.current && (airFilterRef.current.gain.value = s.airGain);
    gainNodeRef.current && (gainNodeRef.current.gain.value = s.gain);

    if (harmonicExciterRef.current) {
      harmonicExciterRef.current.curve = s.harmonicAmount > 0 ? makeHarmonicCurve(s.harmonicAmount) : null;
    }
    if (compressorRef.current) {
      compressorRef.current.threshold.value = s.compressor.threshold;
      compressorRef.current.ratio.value = s.compressor.ratio;
    }
    console.log(`🎵 [VOYO] Switched to ${preset.toUpperCase()}`);
  }, []);

  // Update VOYEX Spatial effects based on slider value (-100 to +100)
  const updateVoyexSpatial = useCallback((v: number) => {
    if (!spatialEnhancedRef.current) return;
    const val = Math.max(-100, Math.min(100, v));

    if (val === 0) {
      // BALANCE: full bypass
      if (crossfeedLeftGainRef.current) crossfeedLeftGainRef.current.gain.value = 0;
      if (crossfeedRightGainRef.current) crossfeedRightGainRef.current.gain.value = 0;
      if (panDepthGainRef.current) panDepthGainRef.current.gain.value = 0;
      if (haasDelayRef.current) haasDelayRef.current.delayTime.value = 0;
      if (reverbWetGainRef.current) reverbWetGainRef.current.gain.value = 0;
      if (reverbFeedback1Ref.current) reverbFeedback1Ref.current.gain.value = 0;
      if (reverbFeedback2Ref.current) reverbFeedback2Ref.current.gain.value = 0;
      if (reverbFeedback3Ref.current) reverbFeedback3Ref.current.gain.value = 0;
      if (subHarmonicGainRef.current) subHarmonicGainRef.current.gain.value = 0;
      return;
    }

    if (val < 0) {
      // DIVE: crossfeed + dark reverb + sub-harmonics
      const t = Math.abs(val) / 100;
      if (crossfeedLeftGainRef.current) crossfeedLeftGainRef.current.gain.value = t * 0.4;
      if (crossfeedRightGainRef.current) crossfeedRightGainRef.current.gain.value = t * 0.4;
      if (reverbWetGainRef.current) reverbWetGainRef.current.gain.value = t * 0.35;
      if (reverbFeedback1Ref.current) reverbFeedback1Ref.current.gain.value = 0.75;
      if (reverbFeedback2Ref.current) reverbFeedback2Ref.current.gain.value = 0.75;
      if (reverbFeedback3Ref.current) reverbFeedback3Ref.current.gain.value = 0.75;
      const dampCutoff = 4000 - (t * 2000);
      if (reverbDamping1Ref.current) reverbDamping1Ref.current.frequency.value = dampCutoff;
      if (reverbDamping2Ref.current) reverbDamping2Ref.current.frequency.value = dampCutoff;
      if (reverbDamping3Ref.current) reverbDamping3Ref.current.frequency.value = dampCutoff;
      if (subHarmonicGainRef.current) subHarmonicGainRef.current.gain.value = t * 0.2;
      // IMMERSE effects off
      if (panDepthGainRef.current) panDepthGainRef.current.gain.value = 0;
      if (haasDelayRef.current) haasDelayRef.current.delayTime.value = 0;
    } else {
      // IMMERSE: panning + haas + bright reverb
      const t = val / 100;
      if (panDepthGainRef.current) panDepthGainRef.current.gain.value = t * 0.3;
      if (haasDelayRef.current) haasDelayRef.current.delayTime.value = t * 0.004;
      if (reverbWetGainRef.current) reverbWetGainRef.current.gain.value = t * 0.25;
      if (reverbFeedback1Ref.current) reverbFeedback1Ref.current.gain.value = 0.6;
      if (reverbFeedback2Ref.current) reverbFeedback2Ref.current.gain.value = 0.6;
      if (reverbFeedback3Ref.current) reverbFeedback3Ref.current.gain.value = 0.6;
      const dampCutoff = 4000 + (t * 4000);
      if (reverbDamping1Ref.current) reverbDamping1Ref.current.frequency.value = dampCutoff;
      if (reverbDamping2Ref.current) reverbDamping2Ref.current.frequency.value = dampCutoff;
      if (reverbDamping3Ref.current) reverbDamping3Ref.current.frequency.value = dampCutoff;
      // DIVE effects off
      if (crossfeedLeftGainRef.current) crossfeedLeftGainRef.current.gain.value = 0;
      if (crossfeedRightGainRef.current) crossfeedRightGainRef.current.gain.value = 0;
      if (subHarmonicGainRef.current) subHarmonicGainRef.current.gain.value = 0;
    }
  }, []);

  // === MAIN TRACK LOADING LOGIC ===
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack?.trackId) return;

      const trackId = currentTrack.trackId;

      // Skip if same track
      if (lastTrackIdRef.current === trackId) return;

      // STOP old audio immediately before loading new track
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      }

      lastTrackIdRef.current = trackId;
      hasRecordedPlayRef.current = false;
      trackProgressRef.current = 0;

      // End previous session
      endListenSession(audioRef.current?.currentTime || 0, 0);
      startListenSession(currentTrack.id, currentTrack.duration || 0);

      // Check cache first
      const API_BASE = 'https://voyo-music-api.fly.dev';
      const { url: bestUrl, cached: fromCache } = audioEngine.getBestAudioUrl(trackId, API_BASE);
      const cachedUrl = fromCache ? bestUrl : await checkCache(trackId);

      if (cachedUrl) {
        // ⚡ BOOSTED - Play from cache instantly
        console.log('🎵 [VOYO] Playing BOOSTED');
        setPlaybackSource('cached');

        if (cachedUrlRef.current) URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = cachedUrl;

        const { boostProfile: profile } = usePlayerStore.getState();
        setupAudioEnhancement(profile);

        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.src = cachedUrl;
          audioRef.current.load();

          audioRef.current.oncanplaythrough = () => {
            if (!audioRef.current) return;

            if (isInitialLoadRef.current && savedCurrentTime > 5) {
              audioRef.current.currentTime = savedCurrentTime;
              isInitialLoadRef.current = false;
            }

            // FIX: Get fresh state to avoid stale closure bug
            // The isPlaying from closure might be outdated when callback fires
            const { isPlaying: shouldPlay } = usePlayerStore.getState();
            if (shouldPlay && audioRef.current.paused) {
              audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
              audioRef.current.play().then(() => {
                audioRef.current!.volume = 1.0;
                recordPlayEvent();
              }).catch(() => {});
            }
          };
        }
      } else {
        // 📡 NOT CACHED - Stream via iframe, boost in background
        console.log('🎵 [VOYO] Streaming via iframe, boosting in background...');
        setPlaybackSource('iframe');

        // REMOVED: Auto-toggle was causing refresh bug
        // On page refresh, this would set isPlaying=true even though browser blocks autoplay
        // User must tap play after refresh - don't auto-start

        // Start background boost (non-blocking)
        if (backgroundBoostingRef.current !== trackId) {
          backgroundBoostingRef.current = trackId;
          cacheTrack(
            trackId,
            currentTrack.title,
            currentTrack.artist,
            currentTrack.duration || 0,
            `${API_BASE}/cdn/art/${trackId}?quality=high`
          ).finally(() => {
            backgroundBoostingRef.current = null;
          });
        }
      }
    };

    loadTrack();

    return () => {
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    };
  }, [currentTrack?.trackId]);

  // Helper: Record play event
  const recordPlayEvent = useCallback(() => {
    if (hasRecordedPlayRef.current || !currentTrack) return;
    hasRecordedPlayRef.current = true;
    recordPoolEngagement(currentTrack.trackId, 'play');
    useTrackPoolStore.getState().recordPlay(currentTrack.trackId);
    recordTrackInSession(currentTrack, 0, false, false);
    djRecordPlay(currentTrack, false, false);
    oyoOnTrackPlay(currentTrack, previousTrackRef.current || undefined);
    viRegisterPlay(currentTrack.trackId, currentTrack.title, currentTrack.artist, 'user_play');
    previousTrackRef.current = currentTrack;
    console.log(`[VOYO] Recorded play: ${currentTrack.title}`);
  }, [currentTrack]);

  // === HOT-SWAP: When boost completes mid-stream ===
  // CRITICAL: Uses AbortController to prevent race conditions when track changes mid-swap
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;

    const completedId = lastBoostCompletion.trackId;
    const currentId = currentTrack.trackId.replace('VOYO_', '');
    const isCurrentTrackMatch = completedId === currentId || completedId === currentTrack.trackId;

    // Only hot-swap if currently streaming via iframe AND boost is for current track
    if (!isCurrentTrackMatch || playbackSource !== 'iframe') return;

    // Cancel any previous hot-swap operation to prevent race condition
    if (hotSwapAbortRef.current) {
      hotSwapAbortRef.current.abort();
      console.log('[VOYO] Cancelled previous hot-swap operation');
    }
    hotSwapAbortRef.current = new AbortController();
    const signal = hotSwapAbortRef.current.signal;
    const swapTrackId = currentTrack.trackId; // Capture at start

    console.log('🔄 [VOYO] Hot-swap: Boost complete, switching to cached audio...');

    const performHotSwap = async () => {
      // Check if aborted before starting
      if (signal.aborted) {
        console.log('[VOYO] Hot-swap aborted before start');
        return;
      }

      const cachedUrl = await checkCache(currentTrack.trackId);

      // Check AGAIN after async operation - track may have changed
      if (signal.aborted) {
        console.log('[VOYO] Hot-swap aborted after cache check');
        return;
      }

      // Double-verify we're still on the same track (belt and suspenders)
      const storeTrackId = usePlayerStore.getState().currentTrack?.trackId;
      if (storeTrackId !== swapTrackId) {
        console.log('[VOYO] Track changed during hot-swap, aborting. Expected:', swapTrackId, 'Got:', storeTrackId);
        return;
      }

      if (!cachedUrl || !audioRef.current) return;

      // Get current position from store (iframe was tracking it)
      const currentPos = usePlayerStore.getState().currentTime;

      // Switch to cached mode
      setPlaybackSource('cached');

      if (cachedUrlRef.current) URL.revokeObjectURL(cachedUrlRef.current);
      cachedUrlRef.current = cachedUrl;

      const { boostProfile: profile } = usePlayerStore.getState();
      setupAudioEnhancement(profile);

      audioRef.current.volume = 0;
      audioRef.current.src = cachedUrl;
      audioRef.current.load();

      audioRef.current.oncanplaythrough = () => {
        // Final check before applying - ensure we haven't been aborted
        if (signal.aborted) {
          console.log('[VOYO] Hot-swap aborted during canplaythrough');
          return;
        }
        if (!audioRef.current) return;

        // Resume from same position
        if (currentPos > 2) {
          audioRef.current.currentTime = currentPos;
        }

        if (isPlaying && audioRef.current.paused) {
          audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
          audioRef.current.play().then(() => {
            audioRef.current!.volume = 1.0;
            console.log('🔄 [VOYO] Hot-swap complete! Now playing boosted audio');
          }).catch(() => {});
        }
      };
    };

    performHotSwap();

    // Cleanup: abort on unmount or when dependencies change
    return () => {
      if (hotSwapAbortRef.current) {
        hotSwapAbortRef.current.abort();
      }
    };
  }, [lastBoostCompletion, currentTrack?.trackId, playbackSource, isPlaying, checkCache, setPlaybackSource, setupAudioEnhancement]);

  // Handle play/pause (only when cached mode)
  useEffect(() => {
    if (playbackSource !== 'cached' || !audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying && audio.paused && audio.src && audio.readyState >= 1) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, playbackSource]);

  // Handle volume (only when cached mode)
  useEffect(() => {
    if (playbackSource !== 'cached' || !audioRef.current) return;

    if (audioEnhancedRef.current && gainNodeRef.current) {
      const profileGain = BOOST_PRESETS[currentProfileRef.current].gain;
      audioRef.current.volume = 1.0;
      gainNodeRef.current.gain.value = profileGain * (volume / 100);
    } else {
      audioRef.current.volume = volume / 100;
    }
  }, [volume, playbackSource]);

  // Handle seek (only when cached mode)
  useEffect(() => {
    if (seekPosition === null || playbackSource !== 'cached' || !audioRef.current) return;
    audioRef.current.currentTime = seekPosition;
    clearSeekPosition();
  }, [seekPosition, playbackSource, clearSeekPosition]);

  // Handle playback rate
  useEffect(() => {
    if (playbackSource !== 'cached' || !audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, playbackSource]);

  // Handle boost preset changes
  useEffect(() => {
    if (playbackSource === 'cached' && audioEnhancedRef.current) {
      updateBoostPreset(boostProfile as BoostPreset);
    }
  }, [boostProfile, playbackSource, updateBoostPreset]);

  // Handle VOYEX Spatial slider changes
  useEffect(() => {
    if (playbackSource === 'cached' && boostProfile === 'voyex' && spatialEnhancedRef.current) {
      updateVoyexSpatial(voyexSpatial);
    }
  }, [voyexSpatial, playbackSource, boostProfile, updateVoyexSpatial]);

  // Reset spatial when switching away from VOYEX
  useEffect(() => {
    if (playbackSource === 'cached' && boostProfile !== 'voyex' && spatialEnhancedRef.current) {
      updateVoyexSpatial(0);
    }
  }, [boostProfile, playbackSource, updateVoyexSpatial]);

  // Media Session (only when cached mode)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || playbackSource !== 'cached') return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'VOYO Music',
      artwork: [{ src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`, sizes: '512x512', type: 'image/jpeg' }]
    });

    navigator.mediaSession.setActionHandler('play', () => !usePlayerStore.getState().isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prevTrack());
    navigator.mediaSession.setActionHandler('seekto', (d) => d.seekTime !== undefined && audioRef.current && (audioRef.current.currentTime = d.seekTime));

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying, playbackSource, togglePlay, nextTrack]);

  // Audio element handlers (only active when cached mode)
  const handleTimeUpdate = useCallback(() => {
    if (playbackSource !== 'cached' || !audioRef.current?.duration) return;
    const el = audioRef.current;
    const progress = (el.currentTime / el.duration) * 100;
    setCurrentTime(el.currentTime);
    setProgress(progress);
    trackProgressRef.current = progress;

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration, playbackRate: el.playbackRate, position: el.currentTime
        });
      } catch (e) {}
    }
  }, [playbackSource, setCurrentTime, setProgress]);

  const handleDurationChange = useCallback(() => {
    if (playbackSource !== 'cached' || !audioRef.current?.duration) return;
    setDuration(audioRef.current.duration);
  }, [playbackSource, setDuration]);

  const handleEnded = useCallback(() => {
    if (playbackSource !== 'cached') return;
    if (currentTrack) {
      endListenSession(audioRef.current?.currentTime || 0, 0);
      recordPoolEngagement(currentTrack.trackId, 'complete', { completionRate: trackProgressRef.current });
      useTrackPoolStore.getState().recordCompletion(currentTrack.trackId, trackProgressRef.current);
      oyoOnTrackComplete(currentTrack, audioRef.current?.currentTime || 0);
    }
    nextTrack();
  }, [playbackSource, currentTrack, nextTrack, endListenSession]);

  const handleProgress = useCallback(() => {
    if (playbackSource !== 'cached' || !audioRef.current?.buffered.length) return;
    const health = audioEngine.getBufferHealth(audioRef.current);
    setBufferHealth(health.percentage, health.status);
  }, [playbackSource, setBufferHealth]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      onTimeUpdate={handleTimeUpdate}
      onDurationChange={handleDurationChange}
      onEnded={handleEnded}
      onProgress={handleProgress}
      onPlaying={() => playbackSource === 'cached' && setBufferHealth(100, 'healthy')}
      onWaiting={() => playbackSource === 'cached' && setBufferHealth(50, 'warning')}
      onPause={() => {
        if (playbackSource !== 'cached') return;
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        const audio = audioRef.current;
        // Removed 100ms delay - play immediately if should be playing
        if (shouldPlay && audio?.src && audio.readyState >= 1) {
          audio.play().catch(() => {});
        }
      }}
      style={{ display: 'none' }}
    />
  );
};

export default AudioPlayer;
