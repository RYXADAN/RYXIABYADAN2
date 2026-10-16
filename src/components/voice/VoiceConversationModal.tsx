import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
  AudioWaveform,
  MessageSquare,
  Zap,
  Sliders,
  Check,
} from 'lucide-react';
import { VoiceLogo } from './VoiceLogo.tsx';
import { LiveVoiceName } from '../../types/index.ts';

interface VoiceConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToChat?: (transcript: { role: 'user' | 'assistant'; text: string }[]) => void;
}

const VOICES: { id: LiveVoiceName; label: string; desc: string; color: string }[] = [
  { id: 'Zephyr', label: 'Zephyr', desc: 'Équilibré, naturel & chaleureux (Recommandé)', color: 'from-amber-400 to-orange-500' },
  { id: 'Puck', label: 'Puck', desc: 'Vif, énergique & expressif', color: 'from-emerald-400 to-teal-500' },
  { id: 'Kore', label: 'Kore', desc: 'Doux, apaisant & posé', color: 'from-sky-400 to-blue-500' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Grave, profond & assuré', color: 'from-indigo-400 to-purple-500' },
  { id: 'Charon', label: 'Charon', desc: 'Réfléchi, analytique & structuré', color: 'from-violet-400 to-fuchsia-500' },
];

// Utility to resample microphone audio from any hardware sample rate to 16kHz PCM
function resampleTo16kHz(audioData: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const pcm16 = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }
  const ratio = inputSampleRate / 16000;
  const newLength = Math.max(1, Math.round(audioData.length / ratio));
  const pcm16 = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexFloor = Math.floor(origIndex);
    const indexCeil = Math.min(audioData.length - 1, Math.ceil(origIndex));
    const weight = origIndex - indexFloor;
    const sample = audioData[indexFloor] * (1 - weight) + audioData[indexCeil] * weight;
    const s = Math.max(-1, Math.min(1, sample));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

export const VoiceConversationModal: React.FC<VoiceConversationModalProps> = ({
  isOpen,
  onClose,
  onSaveToChat,
}) => {
  const [selectedVoice, setSelectedVoice] = useState<LiveVoiceName>('Zephyr');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'speaking' | 'listening' | 'interrupted' | 'error' | 'disconnected'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [userTextInput, setUserTextInput] = useState('');

  // Transcripts state
  const [transcript, setTranscript] = useState<
    { id: string; role: 'user' | 'assistant'; text: string; timestamp: string }[]
  >([]);

  // Refs for Web Audio & WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(false);
  const isSpeakerMutedRef = useRef(false);
  isMutedRef.current = isMuted;
  isSpeakerMutedRef.current = isSpeakerMuted;

  // Analyser nodes for visualizer
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-scroll transcript container
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Unlock AudioContext on user interaction
  const unlockAudio = async () => {
    try {
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state === 'suspended') {
        await inputAudioCtxRef.current.resume();
      }
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === 'suspended') {
        await outputAudioCtxRef.current.resume();
      }
    } catch {}
  };

  // Clean shutdown
  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop active audio output
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];

    // Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect script processor
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }

    // Close AudioContexts
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      try {
        outputAudioCtxRef.current.close();
      } catch {}
      outputAudioCtxRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  };

  const setupMicPipeline = (stream: MediaStream) => {
    try {
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Use default sampleRate to prevent NotSupportedError on varied sound hardware
      const inputCtx = new AudioCtx();
      inputAudioCtxRef.current = inputCtx;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;

      const micSource = inputCtx.createMediaStreamSource(stream);
      micSource.connect(inputAnalyser);

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      inputAnalyser.connect(processor);

      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (
          isMutedRef.current ||
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        const channelData = e.inputBuffer.getChannelData(0);
        // Resample safely to 16kHz PCM regardless of hardware rate (44.1kHz, 48kHz, etc.)
        const pcm16 = resampleTo16kHz(channelData, inputCtx.sampleRate);

        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              data: base64Data,
            })
          );
        } catch (err) {
          console.warn('[Live WS send audio failed]:', err);
        }
      };

      if (inputCtx.state === 'suspended') {
        inputCtx.resume().catch(() => {});
      }

      setMicPermissionState('granted');
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Microphone pipeline setup warning:', err);
      setMicPermissionState('denied');
      setErrorMessage('Impossible d\'initialiser l\'entrée audio sur ce périphérique.');
    }
  };

  const requestMicAccess = async () => {
    await unlockAudio();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionState('denied');
        setErrorMessage('Le microphone n\'est pas disponible dans ce navigateur.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setupMicPipeline(stream);
    } catch (err: any) {
      console.warn('Microphone permission request result:', err?.message || err);
      setMicPermissionState('denied');
      setErrorMessage('Microphone non autorisé : Le mode écoute est actif. Vous pouvez taper vos questions au clavier.');
    }
  };

  const startSession = async () => {
    cleanup();
    setErrorMessage(null);
    setConnectionStatus('connecting');

    try {
      // 1. Setup output AudioContext (24kHz for RYXIA Live Audio playback)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let outputCtx: AudioContext;
      try {
        outputCtx = new AudioCtx({ sampleRate: 24000 });
      } catch {
        outputCtx = new AudioCtx();
      }
      outputAudioCtxRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      // Setup output analyser for visualizer
      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;

      // 2. Open WebSocket connection to /api/live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${selectedVoice}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('listening');
        unlockAudio();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setConnectionStatus('listening');
          } else if (msg.type === 'audio' && msg.data) {
            setConnectionStatus('speaking');
            if (!isSpeakerMutedRef.current && outputAudioCtxRef.current) {
              playPcmChunk(msg.data);
            }
          } else if (msg.type === 'outputTranscription' || (msg.type === 'text' && msg.text)) {
            const textChunk = msg.text;
            if (textChunk) {
              setTranscript((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + textChunk },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      id: `tr_${Date.now()}`,
                      role: 'assistant',
                      text: textChunk,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ];
                }
              });
            }
          } else if (msg.type === 'inputTranscription' && msg.text) {
            const textChunk = msg.text;
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'user') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + textChunk },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: `tr_${Date.now()}`,
                    role: 'user',
                    text: textChunk,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ];
              }
            });
          } else if (msg.type === 'interrupted') {
            setConnectionStatus('interrupted');
            stopAudioPlayback();
            setTimeout(() => {
              setConnectionStatus('listening');
            }, 400);
          } else if (msg.type === 'turnComplete') {
            setConnectionStatus('listening');
          } else if (msg.type === 'error') {
            setConnectionStatus('error');
            setErrorMessage(msg.error || 'Erreur audio');
          } else if (msg.type === 'closed') {
            setConnectionStatus('disconnected');
          }
        } catch (err: any) {
          console.error('Error handling live message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket Live Error:', err);
        setConnectionStatus('error');
        setErrorMessage('La connexion vocale a rencontré une coupure réseau.');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };

      // 3. Gracefully attempt microphone access
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          setupMicPipeline(stream);
        } else {
          setMicPermissionState('denied');
        }
      } catch (micErr: any) {
        console.info('Microphone access on initial launch:', micErr?.message || micErr);
        setMicPermissionState('denied');
      }
    } catch (err: any) {
      console.error('Voice session connection error:', err);
      setConnectionStatus('error');
      setErrorMessage(err.message || 'Impossible de démarrer la session vocale.');
    }
  };

  const playPcmChunk = (base64Data: string) => {
    const ctx = outputAudioCtxRef.current;
    const analyser = outputAnalyserRef.current;
    if (!ctx || !analyser) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      // Prevent drift and gaps
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime + 0.02;
      }
      const startTime = nextPlayTimeRef.current;
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    } catch (e) {
      console.warn('Audio chunk decode warning:', e);
    }
  };

  const stopAudioPlayback = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  // Start on modal open
  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen, selectedVoice]);

  // Visualizer render loop
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine active audio intensity
      let intensity = 0;
      if (connectionStatus === 'speaking' && outputAnalyserRef.current) {
        const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        intensity = sum / data.length / 255;
      } else if (connectionStatus === 'listening' && inputAnalyserRef.current && !isMuted) {
        const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        intensity = sum / data.length / 255;
      }

      phase += 0.04 + intensity * 0.08;

      // Glow background halo
      const baseRadius = 60 + intensity * 40;
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        baseRadius * 1.8
      );

      if (connectionStatus === 'speaking') {
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
        gradient.addColorStop(0.5, 'rgba(217, 119, 6, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (connectionStatus === 'listening') {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (connectionStatus === 'interrupted') {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(100, 116, 139, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Draw dynamic multi-layer wave rings
      const rings = 4;
      for (let r = 0; r < rings; r++) {
        ctx.beginPath();
        const ringRadius = baseRadius + r * 14 + Math.sin(phase + r * 1.2) * (8 + intensity * 18);
        ctx.arc(centerX, centerY, Math.max(10, ringRadius), 0, Math.PI * 2);

        const ringAlpha = (1 - r / rings) * (0.3 + intensity * 0.6);
        if (connectionStatus === 'speaking') {
          ctx.strokeStyle = `rgba(245, 158, 11, ${ringAlpha})`;
        } else if (connectionStatus === 'listening') {
          ctx.strokeStyle = `rgba(52, 211, 153, ${ringAlpha})`;
        } else {
          ctx.strokeStyle = `rgba(148, 163, 184, ${ringAlpha})`;
        }
        ctx.lineWidth = 1.5 + r * 0.5;
        ctx.stroke();
      }

      // Center sphere
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(20, 36 + intensity * 16), 0, Math.PI * 2);
      const innerGrad = ctx.createLinearGradient(centerX - 30, centerY - 30, centerX + 30, centerY + 30);
      if (connectionStatus === 'speaking') {
        innerGrad.addColorStop(0, '#fbbf24');
        innerGrad.addColorStop(1, '#b45309');
      } else if (connectionStatus === 'listening') {
        innerGrad.addColorStop(0, '#34d399');
        innerGrad.addColorStop(1, '#047857');
      } else {
        innerGrad.addColorStop(0, '#94a3b8');
        innerGrad.addColorStop(1, '#334155');
      }
      ctx.fillStyle = innerGrad;
      ctx.shadowColor = connectionStatus === 'speaking' ? '#f59e0b' : '#10b981';
      ctx.shadowBlur = 15 + intensity * 25;
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, connectionStatus, isMuted]);

  const handleSendTextMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await unlockAudio();
    const text = userTextInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        text,
      })
    );

    setTranscript((prev) => [
      ...prev,
      {
        id: `tr_${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setUserTextInput('');
  };

  const handleSaveAndClose = () => {
    if (onSaveToChat && transcript.length > 0) {
      onSaveToChat(transcript.map((t) => ({ role: t.role, text: t.text })));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={unlockAudio}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in p-4 sm:p-6"
    >
      <div className="relative w-full max-w-2xl bg-[#0c0d14] border border-amber-500/20 rounded-3xl shadow-2xl shadow-amber-950/30 overflow-hidden flex flex-col h-[85vh] max-h-[780px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
              <VoiceLogo size="sm" className="text-white" animated />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white font-syne">
                  RYXIA LIVE
                </h2>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  RYXIA Audio
                </span>
              </div>
              <p className="text-xs text-stone-400">Conversation vocale en direct et temps réel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all ${
                showSettings
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10'
              }`}
              title="Paramètres de voix"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveAndClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-stone-200 transition-colors"
              title="Fermer la session"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Voice selector dropdown (drawer) */}
        {showSettings && (
          <div className="px-6 py-4 bg-[#10121b] border-b border-amber-500/20 transition-all animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Choix de la voix de RYXIA
              </span>
              <span className="text-[11px] text-stone-400">Changement instantané</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVoice(v.id);
                    setShowSettings(false);
                  }}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all ${
                    selectedVoice === v.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                      : 'bg-white/[0.03] border-white/5 text-stone-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full mt-0.5 bg-gradient-to-br ${v.color} flex-shrink-0 flex items-center justify-center`}
                  >
                    {selectedVoice === v.id && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{v.label}</div>
                    <div className="text-[11px] text-stone-400">{v.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Voice Center: Visualizer Canvas + Status */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          {/* Canvas visualizer */}
          <div className="relative flex items-center justify-center w-full max-w-[340px] aspect-square">
            <canvas
              ref={canvasRef}
              width={340}
              height={340}
              className="w-full h-full pointer-events-none drop-shadow-2xl"
            />
          </div>

          {/* Dynamic Status Pill */}
          <div className="mt-4 flex flex-col items-center gap-1.5 z-10">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'speaking'
                    ? 'bg-amber-400 animate-ping'
                    : connectionStatus === 'listening'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStatus === 'interrupted'
                    ? 'bg-red-400'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500 animate-spin'
                    : 'bg-stone-500'
                }`}
              />
              <span className="text-xs font-medium text-stone-200">
                {connectionStatus === 'connecting' && 'Connexion à RYXIA Live...'}
                {connectionStatus === 'listening' && (
                  micPermissionState === 'denied'
                    ? 'Mode Écoute active — Saisissez vos messages'
                    : isMuted
                    ? 'Microphone en pause'
                    : 'À votre écoute — Parlez'
                )}
                {connectionStatus === 'speaking' && `RYXIA parle (${selectedVoice})`}
                {connectionStatus === 'interrupted' && 'Interruption prise en compte'}
                {connectionStatus === 'error' && 'Erreur audio'}
                {connectionStatus === 'disconnected' && 'Session terminée'}
              </span>
            </div>

            {micPermissionState === 'denied' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 animate-in fade-in">
                <span>Mode écoute & texte actif</span>
                <span className="opacity-50">·</span>
                <button
                  type="button"
                  onClick={requestMicAccess}
                  className="font-semibold underline hover:text-amber-200 cursor-pointer"
                >
                  Activer le micro
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <p className="text-xs text-rose-400 max-w-sm text-center px-4 bg-rose-950/40 py-1 rounded-lg border border-rose-800/30">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSession();
                  }}
                  className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Réessayer la connexion</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Transcript Panel (Collapsible) */}
        {showTranscript && (
          <div className="mx-6 mb-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl max-h-36 overflow-y-auto flex flex-col gap-2 text-xs scrollbar-thin">
            {transcript.length === 0 ? (
              <div className="text-stone-500 text-center py-2 italic">
                La transcription de votre échange apparaîtra ici en temps réel...
              </div>
            ) : (
              transcript.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-0.5 ${
                    item.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[10px] text-stone-500 uppercase font-mono">
                    {item.role === 'user' ? 'Vous' : `RYXIA (${selectedVoice})`} • {item.timestamp}
                  </span>
                  <div
                    className={`px-3 py-1.5 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-tr-none'
                        : 'bg-white/5 text-stone-200 border border-white/10 rounded-tl-none'
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Text fallback input row */}
        <div className="px-6 pb-2">
          <form onSubmit={handleSendTextMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={userTextInput}
              onChange={(e) => setUserTextInput(e.target.value)}
              placeholder="Ou tapez un message pour la voix..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={!userTextInput.trim()}
              className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
            >
              Envoyer
            </button>
          </form>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-black/40">
          {/* Left: Transcript toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
              showTranscript
                ? 'bg-white/10 border-white/20 text-stone-200'
                : 'bg-white/5 border-white/5 text-stone-500 hover:text-stone-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Transcription</span>
          </button>

          {/* Center: Main audio controls */}
          <div className="flex items-center gap-3">
            {/* Microphone Mute/Unmute / Permission Request */}
            <button
              onClick={() => {
                if (micPermissionState === 'denied') {
                  requestMicAccess();
                } else {
                  setIsMuted(!isMuted);
                }
              }}
              className={`p-3.5 rounded-full border transition-all shadow-lg ${
                micPermissionState === 'denied'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  : isMuted
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
              }`}
              title={
                micPermissionState === 'denied'
                  ? 'Cliquer pour autoriser le microphone'
                  : isMuted
                  ? 'Activer le micro'
                  : 'Couper le micro'
              }
            >
              {micPermissionState === 'denied' ? (
                <Mic className="w-5 h-5 opacity-70" />
              ) : isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Speaker Mute/Unmute */}
            <button
              onClick={() => {
                if (!isSpeakerMuted) {
                  stopAudioPlayback();
                }
                setIsSpeakerMuted(!isSpeakerMuted);
              }}
              className={`p-3 rounded-full border transition-all ${
                isSpeakerMuted
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
              }`}
              title={isSpeakerMuted ? 'Activer le haut-parleur' : 'Couper le son de RYXIA'}
            >
              {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Reconnect / Refresh */}
            <button
              onClick={startSession}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 transition-colors"
              title="Redémarrer la session"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: End call button */}
          <button
            onClick={handleSaveAndClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Quitter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
