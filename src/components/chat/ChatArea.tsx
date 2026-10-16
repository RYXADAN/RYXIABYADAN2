import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  ArrowUp,
  Square,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Terminal,
  BookOpen,
  Lightbulb,
  PanelLeft,
  SquarePen,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Camera,
  FileText,
  File,
  Sun,
  Moon,
  Globe,
  MapPin,
  ExternalLink,
  Zap,
  Wand2,
  Image as ImageIcon,
  Layers,
  Download,
  Maximize2,
  X,
  Mic,
} from 'lucide-react';
import { Conversation, Message, RyxiaMode, FileAttachment } from '../../types/index.ts';
import { RYXIA_MODES } from '../../lib/modes.ts';

interface ChatAreaProps {
  conversation: Conversation | null;
  activeMode?: RyxiaMode;
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  onSendMessage: (
    text: string,
    groundingPreference?: 'auto' | 'search' | 'maps',
    latLng?: { latitude: number; longitude: number },
    speedMode?: 'turbo' | 'balanced' | 'deep',
    attachment?: FileAttachment,
    attachments?: FileAttachment[]
  ) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
  onChangeMode: (mode: RyxiaMode) => void;
  onNewConversation: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  enterSends?: boolean;
  speedMode?: 'turbo' | 'balanced' | 'deep';
  onToggleSpeedMode?: (speedMode: 'turbo' | 'balanced' | 'deep') => void;
  theme?: 'dark' | 'light' | 'obsidian' | 'midnight';
  onToggleTheme?: () => void;
  onOpenImageStudio?: (mode?: 'create' | 'edit', initialImage?: string) => void;
  onOpenVoiceConversation?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  activeMode: propActiveMode,
  messages,
  isStreaming,
  streamingText,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
  onChangeMode,
  onNewConversation,
  onToggleSidebar,
  isSidebarOpen,
  enterSends = true,
  speedMode = 'balanced',
  onToggleSpeedMode,
  theme = 'dark',
  onToggleTheme,
  onOpenImageStudio,
  onOpenVoiceConversation,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const attachedFile = attachedFiles[0] || null;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [groundingMode, setGroundingMode] = useState<'auto' | 'search' | 'maps'>('auto');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isLight = theme === 'light';
  const activeMode: RyxiaMode = propActiveMode || (conversation ? conversation.mode : 'general');
  const modeConfig = RYXIA_MODES[activeMode] || RYXIA_MODES.general;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    const remainingSlots = Math.max(0, 4 - attachedFiles.length);
    if (remainingSlots === 0) {
      alert("Vous avez déjà atteint la limite maximale de 4 images.");
      return;
    }

    imageItems.slice(0, remainingSlots).forEach((item) => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];
        setAttachedFiles((prev) => {
          if (prev.length >= 4) return prev;
          return [
            ...prev,
            {
              name: `Image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
              type: file.type || 'image/png',
              size: file.size,
              dataUrl,
              base64Data,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 4 - attachedFiles.length);
    if (remainingSlots <= 0) {
      alert("Vous pouvez joindre jusqu'à 4 images au maximum.");
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Seules les ${remainingSlots} premières images ont été ajoutées (limite max: 4 images).`);
    }

    filesToProcess.forEach((file) => {
      if (file.size > 20 * 1024 * 1024) {
        alert(`Le fichier "${file.name}" est trop volumineux (limite max: 20 Mo).`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText = file.type.startsWith('text/') ||
        Boolean(file.name.match(/\.(txt|md|csv|json|js|ts|py|html|css|cpp|c|java|kt|swift|sql)$/i));

      const reader = new FileReader();

      if (isImage || isPdf) {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          setAttachedFiles((prev) => {
            if (prev.length >= 4) return prev;
            return [
              ...prev,
              {
                name: file.name,
                type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
                size: file.size,
                dataUrl: isImage ? dataUrl : undefined,
                base64Data,
              },
            ];
          });
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        reader.onload = () => {
          const textContent = reader.result as string;
          setAttachedFiles((prev) => {
            if (prev.length >= 4) return prev;
            return [
              ...prev,
              {
                name: file.name,
                type: file.type || 'text/plain',
                size: file.size,
                textContent,
              },
            ];
          });
        };
        reader.readAsText(file);
      } else {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          setAttachedFiles((prev) => {
            if (prev.length >= 4) return prev;
            return [
              ...prev,
              {
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                base64Data,
              },
            ];
          });
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset so same file can be selected again
    e.target.value = '';
  };

  // Auto-scroll to bottom on streaming or new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isStreaming]);

  // Auto-expand textarea like ChatGPT
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Close model menu on Escape
  useEffect(() => {
    if (!showModelMenu) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModelMenu(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModelMenu]);

  // Auto-focus textarea on conversation change or new chat
  useEffect(() => {
    if (!conversation) {
      textareaRef.current?.focus();
    }
  }, [conversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (enterSends && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isStreaming) return;
    const text = inputText.trim() || (attachedFiles.length > 0 ? (
      attachedFiles.length === 1
        ? "Analyse attentivement cette image ou ce document joint et explique son contenu avec rigueur et clarté."
        : `Analyse attentivement ces ${attachedFiles.length} images / documents joints et explique leur contenu de manière détaillée.`
    ) : "");
    const filesToSend = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (groundingMode === 'maps' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSendMessage(
            text,
            'maps',
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            },
            speedMode,
            filesToSend[0],
            filesToSend
          );
        },
        () => {
          onSendMessage(text, groundingMode, undefined, speedMode, filesToSend[0], filesToSend);
        },
        { timeout: 3000 }
      );
    } else {
      onSendMessage(text, groundingMode, undefined, speedMode, filesToSend[0], filesToSend);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createMarkdownComponents = (msgId?: string) => ({
    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !String(children).includes('\n');
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded font-mono text-sm font-medium"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: isLight ? '#b45309' : '#fde68a',
            }}
            {...props}
          >
            {children}
          </code>
        );
      }
      const codeString = String(children).replace(/\n$/, '');
      const codeKey = msgId ? `code_${msgId}` : 'streaming_code';
      return (
        <div
          className="relative my-4 rounded-xl overflow-hidden shadow-xs"
          style={{
            backgroundColor: 'var(--code-bg)',
            border: '1px solid var(--code-border)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 text-xs font-mono"
            style={{
              backgroundColor: 'var(--code-header)',
              borderBottom: '1px solid var(--code-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <span>{match ? match[1] : 'code'}</span>
            <button
              onClick={() => copyToClipboard(codeString, codeKey)}
              className="flex items-center gap-1.5 hover:opacity-100 transition-opacity"
            >
              {copiedId === codeKey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le code</span>
                </>
              )}
            </button>
          </div>
          <pre
            className="p-4 text-sm overflow-x-auto font-mono leading-relaxed"
            style={{ color: 'var(--code-text)' }}
          >
            <code>{children}</code>
          </pre>
        </div>
      );
    },
    h2({ children }: any) {
      return (
        <h2
          className="text-lg sm:text-xl font-bold tracking-tight mt-6 mb-2.5 font-display border-b pb-1.5 flex items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {children}
        </h2>
      );
    },
    h3({ children }: any) {
      return (
        <h3
          className="text-base font-semibold tracking-tight mt-4 mb-2 font-display"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </h3>
      );
    },
    p({ children }: any) {
      return <p className="mb-3 leading-relaxed">{children}</p>;
    },
    ul({ children }: any) {
      return <ul className="my-3 ml-4 list-disc space-y-1.5">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="my-3 ml-4 list-decimal space-y-1.5">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="leading-relaxed">{children}</li>;
    },
    table({ children }: any) {
      return (
        <div
          className="my-4 overflow-x-auto rounded-xl border shadow-xs"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
        >
          <table className="min-w-full text-left text-sm divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: any) {
      return (
        <thead className="text-xs font-semibold uppercase tracking-wider bg-black/10 dark:bg-white/5">
          {children}
        </thead>
      );
    },
    th({ children }: any) {
      return <th className="px-4 py-2.5 font-semibold text-xs">{children}</th>;
    },
    td({ children }: any) {
      return (
        <td className="px-4 py-2.5 border-t text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          {children}
        </td>
      );
    },
    strong({ children }: any) {
      return <strong className="font-semibold text-amber-500/95 dark:text-amber-400">{children}</strong>;
    },
    blockquote({ children }: any) {
      return (
        <blockquote className="my-3 pl-4 border-l-2 border-amber-500/50 italic opacity-85">
          {children}
        </blockquote>
      );
    },
    img({ src, alt }: any) {
      return (
        <div
          className="my-3.5 rounded-2xl overflow-hidden border shadow-lg max-w-lg cursor-pointer group relative"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
          onClick={() => setZoomImageUrl(src)}
        >
          <img
            src={src}
            alt={alt || 'Image générée'}
            referrerPolicy="no-referrer"
            className="w-full max-h-[440px] object-contain rounded-t-2xl"
          />
          <div
            className="px-3.5 py-2 flex items-center justify-between border-t text-xs"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-mono text-[11px] opacity-75 truncate">{alt || 'Image'}</span>
            <Maximize2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    },
  });

  const getModeIcon = (mode: RyxiaMode) => {
    switch (mode) {
      case 'fast':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'code':
        return <Terminal className="w-4 h-4 text-emerald-500" />;
      case 'study':
        return <BookOpen className="w-4 h-4 text-sky-500" />;
      case 'creative':
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-neutral-400" />;
    }
  };

  const hasMessages = messages.length > 0 || (isStreaming && Boolean(streamingText));

  return (
    <div
      className="chat-main flex-1 flex flex-col h-screen relative overflow-hidden select-text transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
    >
      {/* Stylish Subtle Ambient Background Layer */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
        {/* Soft Warm Amber Ambient Aura */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[520px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, var(--glow-amber) 0%, transparent 70%)' }}
        />
        
        {/* Subtle Cool Indigo Counterbalance */}
        <div
          className="absolute top-1/3 -right-24 w-[500px] h-[500px] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, var(--glow-indigo) 0%, transparent 70%)' }}
        />
        
        {/* Micro-dot grid with radial decay */}
        <div className="absolute inset-0 bg-ambient-grid opacity-80" />
      </div>

      {/* Top Header Bar - Minimalist ChatGPT style */}
      <header
        className="chat-header h-14 px-4 flex items-center justify-between z-20 shrink-0 relative transition-colors duration-200"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          {/* Sidebar Toggle */}
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={isSidebarOpen ? 'Fermer la barre latérale' : 'Ouvrir la barre latérale'}
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          {/* RYXIA Mode Switcher Dropdown (5 modes) - Compact */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-all border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs shadow-xs select-none cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              title="Changer de mode RYXIA (5 modes disponibles)"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 flex items-center scale-85">
                  {getModeIcon(activeMode)}
                </span>
                <span className="font-display font-semibold text-xs tracking-tight">RYXIA Mode</span>
                <span className="text-[10px] opacity-40">·</span>
                <span className="text-[11px] font-semibold text-amber-500 truncate max-w-[75px]">
                  {modeConfig.name}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 shrink-0 ${
                  showModelMenu ? 'rotate-180 text-amber-500' : ''
                }`}
              />
            </button>

            {showModelMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowModelMenu(false)}
                />
                <div
                  className="absolute left-0 mt-1.5 w-72 rounded-xl shadow-2xl p-1.5 z-40 space-y-1 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    className="px-2.5 py-1.5 flex items-center justify-between border-b pb-1.5 mb-1"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span className="font-display font-bold text-[11px]">Modes RYXIA</span>
                    </div>
                    <span className="text-[9.5px] text-amber-500 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded-full border border-amber-500/20">
                      5 modes
                    </span>
                  </div>

                  {(['general', 'fast', 'code', 'study', 'creative'] as RyxiaMode[]).map((mKey) => {
                    const m = RYXIA_MODES[mKey];
                    const isSelected = mKey === activeMode;
                    return (
                      <button
                        key={mKey}
                        onClick={() => {
                          onChangeMode(mKey);
                          setShowModelMenu(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium ring-1 ring-amber-500/30'
                            : 'hover:bg-[var(--bg-surface-hover)]'
                        }`}
                        style={{
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        <div className={`mt-0.5 p-1 rounded-md ${isSelected ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400'} scale-90`}>
                          {getModeIcon(mKey)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold flex items-center justify-between">
                            <span className={isSelected ? 'text-amber-500' : ''}>{m.name}</span>
                            <span className="text-[9px] opacity-70 font-mono bg-black/20 dark:bg-white/10 px-1 py-0.2 rounded">
                              {m.badge}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-75 line-clamp-1 mt-0.5 leading-snug">
                            {m.description}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Spacer */}
        <div className="flex-1" />

        {/* Top Right: Theme Switcher + New Chat Shortcut (Voice Direct button removed from header as requested) */}
        <div className="flex items-center gap-1.5">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={isLight ? 'Passer au mode sombre' : 'Passer au mode clair'}
            >
              {isLight ? (
                <Moon className="w-5 h-5 text-indigo-500" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400" />
              )}
            </button>
          )}

          <button
            onClick={onNewConversation}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Nouvelle conversation"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="chat-scroll-area flex-1 overflow-y-auto px-4 md:px-0 relative z-10">
        <div className="max-w-3xl mx-auto h-full flex flex-col">
          {/* ChatGPT-style Welcome Screen if no messages */}
          {!hasMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center pb-24 px-4 select-none">
              {/* Distinctive Brand Lockup */}
              <div className="flex flex-col items-center mb-6">
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-display">
                  RYXIA
                </h1>

                <div
                  className="mt-3 flex items-center gap-2.5 px-3.5 py-1 rounded-full border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <span className="text-sm font-semibold text-amber-500 tracking-wide font-display">
                    by Adan
                  </span>
                  <span className="opacity-40 text-xs">·</span>
                  <span className="text-xs opacity-75 font-medium">
                    Your AI. Your way.
                  </span>
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-medium opacity-75 tracking-tight">
                Que puis-je faire pour vous ?
              </h2>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">

                {onOpenVoiceConversation && (
                  <button
                    onClick={onOpenVoiceConversation}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-semibold transition-all shadow-sm group cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                      <Mic className="w-3 h-3" />
                    </div>
                    <span>Conversation Vocale</span>
                    <span className="text-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full font-mono">
                      Voix Directe
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Messages Stream */
            <div className="chat-messages-container space-y-6 pt-4 pb-36">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isLast = index === messages.length - 1;

                if (isUser) {
                  return (
                    <div
                      key={msg.id}
                      className="flex flex-col items-end"
                    >
                      {/* Attached Images & Documents (supports up to 4 attachments) */}
                      {(() => {
                        const msgAtts = (msg.attachments && msg.attachments.length > 0)
                          ? msg.attachments
                          : (msg.attachment ? [msg.attachment] : []);
                        if (msgAtts.length === 0) return null;

                        if (msgAtts.length === 1) {
                          const att = msgAtts[0];
                          return (
                            <div className="mb-2 max-w-[85%] sm:max-w-[75%]">
                              {att.dataUrl ? (
                                <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-md bg-black/20">
                                  <img
                                    src={att.dataUrl}
                                    alt={att.name}
                                    className="max-h-72 w-auto object-contain rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                                    onClick={() => setZoomImageUrl(att.dataUrl!)}
                                  />
                                  <div className="px-3 py-1.5 bg-black/60 backdrop-blur-xs text-[11px] text-white flex items-center justify-between gap-2">
                                    <span className="truncate max-w-[200px]">{att.name}</span>
                                    <span className="opacity-70 text-[10px] shrink-0">{formatFileSize(att.size)}</span>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border text-xs shadow-xs"
                                  style={{
                                    backgroundColor: 'var(--user-bubble)',
                                    borderColor: 'var(--border-color)',
                                    color: 'var(--user-bubble-text)',
                                  }}
                                >
                                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
                                    {att.type === 'application/pdf' ? (
                                      <span className="font-bold text-[10px]">PDF</span>
                                    ) : (
                                      <FileText className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate max-w-[220px]">{att.name}</p>
                                    <p className="text-[10px] opacity-70">{formatFileSize(att.size)}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Multi-attachment grid (2 to 4 items)
                        return (
                          <div className="mb-2 max-w-[85%] sm:max-w-[75%]">
                            <div className={`grid gap-2 ${msgAtts.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-2'}`}>
                              {msgAtts.map((att, attIdx) => (
                                <div key={attIdx} className="relative group rounded-xl overflow-hidden border border-white/10 shadow-sm bg-black/20">
                                  {att.dataUrl ? (
                                    <>
                                      <img
                                        src={att.dataUrl}
                                        alt={att.name}
                                        className="h-32 sm:h-36 w-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                        onClick={() => setZoomImageUrl(att.dataUrl!)}
                                      />
                                      <div className="px-2 py-1 bg-black/60 backdrop-blur-xs text-[10px] text-white flex items-center justify-between gap-1 truncate">
                                        <span className="truncate">{att.name}</span>
                                        <span className="opacity-60 shrink-0 text-[9px]">{attIdx + 1}/{msgAtts.length}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div
                                      className="p-3 flex items-center gap-2 text-xs"
                                      style={{
                                        backgroundColor: 'var(--user-bubble)',
                                        color: 'var(--user-bubble-text)',
                                      }}
                                    >
                                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
                                        <FileText className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0 truncate">
                                        <p className="font-medium truncate text-[11px]">{att.name}</p>
                                        <p className="text-[9px] opacity-70">{formatFileSize(att.size)}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {msg.content && (
                        <div
                          className="max-w-[85%] sm:max-w-[75%] rounded-3xl px-5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-xs"
                          style={{
                            backgroundColor: 'var(--user-bubble)',
                            color: 'var(--user-bubble-text)',
                            border: isLight ? '1px solid var(--border-color)' : 'none',
                          }}
                        >
                          {msg.content}
                        </div>
                      )}
                    </div>
                  );
                }

                // Assistant Message
                return (
                  <div
                    key={msg.id}
                    className="group relative text-[15px] leading-relaxed"
                  >
                    {/* Brand Identifier (clean RYXIA — by Adan without R badge) */}
                    <div className="flex items-center gap-2 mb-2 select-none">
                      <span className="font-display font-bold text-xs">RYXIA</span>
                      <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        by Adan
                      </span>
                    </div>

                    <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={createMarkdownComponents(msg.id)}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Google Search & Google Maps Grounding Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div
                        className="mt-3.5 pt-3 border-t text-xs space-y-2"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs opacity-75">
                          {msg.sources.some((s) => s.type === 'maps') ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Lieux vérifiés Google Maps</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3.5 h-3.5 text-sky-500" />
                              <span>Sources vérifiées Google Search</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all hover:scale-102 shadow-xs group"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                              }}
                              title={src.title}
                            >
                              {src.type === 'maps' ? (
                                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              )}
                              <span className="max-w-[220px] truncate text-[11px] font-medium group-hover:text-amber-500 transition-colors">
                                {src.title}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-40 shrink-0 group-hover:opacity-100" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated or Edited Image Card */}
                    {msg.imageUrl && (
                      <div
                        className="my-3.5 rounded-2xl overflow-hidden border shadow-lg max-w-lg transition-all"
                        style={{
                          borderColor: 'var(--border-color)',
                          backgroundColor: 'var(--bg-surface)',
                        }}
                      >
                        <div className="relative group bg-black/20">
                          <img
                            src={msg.imageUrl}
                            alt={msg.imagePrompt || 'Image générée par RYXIA'}
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[440px] object-contain cursor-pointer"
                            onClick={() => setZoomImageUrl(msg.imageUrl!)}
                          />
                          <button
                            type="button"
                            onClick={() => setZoomImageUrl(msg.imageUrl!)}
                            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Agrandir en plein écran"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div
                          className="px-3.5 py-2.5 flex items-center justify-between border-t text-xs"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-[11px] opacity-75 truncate block">
                              {msg.imagePrompt || 'Générée avec RYXIA Studio'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onOpenImageStudio && (
                              <button
                                type="button"
                                onClick={() => onOpenImageStudio('edit', msg.imageUrl)}
                                className="px-2.5 py-1 rounded-lg border border-amber-500/30 hover:border-amber-500 text-amber-500 font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs"
                                title="Modifier cette image dans le Studio Image"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                                <span>Modifier</span>
                              </button>
                            )}
                            <a
                              href={msg.imageUrl}
                              download={`ryxia_${Date.now()}.png`}
                              className="p-1.5 rounded-lg border hover:bg-[var(--bg-surface-hover)] transition-colors opacity-80 hover:opacity-100"
                              title="Télécharger l'image"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assistant Action Bar */}
                    <div className="flex items-center gap-2 mt-3" style={{ color: 'var(--text-muted)' }}>
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors hover:text-[var(--text-primary)]"
                        title="Copier la réponse"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => setFeedback(prev => ({ ...prev, [msg.id]: 'up' }))}
                        className={`p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors ${
                          feedback[msg.id] === 'up' ? 'text-emerald-500' : 'hover:text-[var(--text-primary)]'
                        }`}
                        title="Bonne réponse"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setFeedback(prev => ({ ...prev, [msg.id]: 'down' }))}
                        className={`p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors ${
                          feedback[msg.id] === 'down' ? 'text-red-500' : 'hover:text-[var(--text-primary)]'
                        }`}
                        title="Mauvaise réponse"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>

                      {isLast && !isStreaming && (
                        <button
                          onClick={onRegenerate}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors hover:text-[var(--text-primary)]"
                          title="Régénérer la réponse"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming Indicator with Live Typing Effect & Wave Animation */}
              {isStreaming && (
                <div className="text-[15px] leading-relaxed">
                  <div className="flex items-center gap-2 mb-2 select-none">
                    <span className="font-display font-bold text-xs">RYXIA</span>
                    <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      by Adan
                    </span>
                    <span className="text-[11px] font-medium opacity-60">· {modeConfig.name}</span>
                  </div>

                  {streamingText ? (
                    <div className="space-y-2">
                      <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={createMarkdownComponents()}
                        >
                          {streamingText}
                        </ReactMarkdown>
                        {/* Live Typing Cursor */}
                        <span className="animate-typing-cursor" title="RYXIA écrit..." />
                      </div>

                      {/* Live Wave Generation Badge */}
                      <div className="flex items-center gap-2 pt-1 text-xs select-none">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500 shadow-xs">
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-1 bg-amber-400 rounded-full h-2 animate-wave-bar" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 bg-amber-500 rounded-full h-3 animate-wave-bar" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 bg-amber-400 rounded-full h-1.5 animate-wave-bar" style={{ animationDelay: '300ms' }} />
                            <span className="w-1 bg-amber-500 rounded-full h-2.5 animate-wave-bar" style={{ animationDelay: '450ms' }} />
                          </div>
                          <span className="text-[10.5px] font-mono font-medium">Génération en direct · RYXIA</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Initial thinking state with Dancing Sonic Waves */
                    <div
                      className="flex items-center gap-3 py-3 px-4 rounded-2xl border w-fit shadow-xs transition-all"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-end gap-1 h-4">
                        <span className="w-1 bg-amber-400 rounded-full h-2 animate-wave-bar" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 bg-amber-500 rounded-full h-4 animate-wave-bar" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 bg-amber-400 rounded-full h-3 animate-wave-bar" style={{ animationDelay: '300ms' }} />
                        <span className="w-1 bg-amber-500 rounded-full h-4.5 animate-wave-bar" style={{ animationDelay: '450ms' }} />
                        <span className="w-1 bg-amber-400 rounded-full h-2.5 animate-wave-bar" style={{ animationDelay: '600ms' }} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          RYXIA analyse et rédige votre réponse...
                        </span>
                        <span className="text-[10px] opacity-60 font-mono">
                          Moteur {modeConfig.name} actif
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Composer Bar */}
      <div
        className="chat-composer-wrapper w-full pb-4 pt-2 px-4 shrink-0 transition-colors duration-200"
        style={{
          background: isLight
            ? 'linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0.8), transparent)'
            : 'linear-gradient(to top, #212121, #212121, transparent)',
        }}
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Quick AI Intelligence & Speed Toggle */}
          <div className="flex items-center justify-end px-2 text-xs flex-wrap gap-2">

            {/* Quick AI Intelligence & Speed Toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (onToggleSpeedMode) {
                    const next = speedMode === 'balanced' ? 'deep' : speedMode === 'deep' ? 'turbo' : 'balanced';
                    onToggleSpeedMode(next);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shadow-xs ${
                  speedMode === 'deep'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 font-semibold'
                    : speedMode === 'balanced'
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40 font-semibold'
                    : 'opacity-70 hover:opacity-100 bg-neutral-100 dark:bg-white/5 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-white/10'
                }`}
                title={
                  speedMode === 'deep'
                    ? 'Mode Raisonnement Profond : Réflexion interne maximale pour calculs, code et concepts complexes'
                    : speedMode === 'balanced'
                    ? 'Mode IA Optimisé : Intelligence maximale (gemini-3.8-flash) avec équilibre et réflexion'
                    : 'Mode Turbo Flash : Latence minimale ultra-rapide'
                }
              >
                {speedMode === 'deep' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 fill-purple-400 animate-pulse" />
                    <span>🧠 Raisonnement Profond</span>
                  </>
                ) : speedMode === 'balanced' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-400" />
                    <span>✨ IA Optimisée</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                    <span>⚡ Turbo Flash</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Academic prompt suggestions if file attached */}
          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar animate-in fade-in">
              <span className="text-[11px] opacity-75 shrink-0 font-medium mr-0.5" style={{ color: 'var(--text-secondary)' }}>Suggestions :</span>
              <button
                type="button"
                onClick={() => setInputText(attachedFiles.length > 1 ? "Analyse et compare ces documents pas à pas en détaillant chaque point." : "Résous cet exercice pas à pas en détaillant chaque formule, étape de calcul et justification théorique.")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] font-medium transition-colors"
              >
                📐 {attachedFiles.length > 1 ? "Analyser et comparer" : "Résoudre pas à pas"}
              </button>
              <button
                type="button"
                onClick={() => setInputText("Vérifie mes calculs et mon raisonnement sur ces documents, identifie les éventuelles erreurs et explique comment les corriger.")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] font-medium transition-colors"
              >
                🔍 Corriger mes erreurs
              </button>
              <button
                type="button"
                onClick={() => setInputText("Fais une synthèse claire et structurée de ces éléments avec les points essentiels et notions clés.")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] font-medium transition-colors"
              >
                📝 Résumer
              </button>
              <button
                type="button"
                onClick={() => setInputText("Transcris fidèlement tout le texte manuscrit / imprimé (OCR) et les formules mathématiques de ces images.")}
                className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] font-medium transition-colors"
              >
                ✍️ Transcrire (OCR)
              </button>
            </div>
          )}

          {/* Attachment Preview Card above Composer (supports up to 4 images/files) */}
          {attachedFiles.length > 0 && (
            <div
              className="px-3.5 py-2.5 rounded-2xl border text-xs shadow-md animate-in fade-in slide-in-from-bottom-2 space-y-2.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              {/* Header with counter and clear action */}
              <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[11px] text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Images & documents joints ({attachedFiles.length}/4 max)</span>
                  </span>
                  {attachedFiles.length < 4 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-medium transition-colors"
                    >
                      + Ajouter une image
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAttachedFiles([])}
                  className="text-[11px] opacity-60 hover:opacity-100 hover:text-red-400 transition-colors"
                  title="Tout supprimer"
                >
                  Tout effacer
                </button>
              </div>

              {/* Gallery of attached files */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative group flex items-center gap-2 p-1.5 rounded-xl border bg-black/20"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {file.dataUrl ? (
                      <img
                        src={file.dataUrl}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded-lg shrink-0 cursor-pointer hover:opacity-90 transition-opacity border border-amber-500/30"
                        onClick={() => setZoomImageUrl(file.dataUrl!)}
                        title="Agrandir la photo"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
                        {file.type === 'application/pdf' ? (
                          <span className="font-extrabold text-[9px]">PDF</span>
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 pr-5">
                      <p className="font-medium truncate text-[11px]" style={{ color: 'var(--text-primary)' }}>
                        {file.name}
                      </p>
                      <p className="text-[9px] opacity-60">
                        {formatFileSize(file.size)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-red-500 text-white transition-colors"
                      title="Supprimer cette image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden File and Camera Pickers (with multiple support) */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,.pdf,.txt,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            className="relative rounded-3xl transition-all shadow-xl px-4 py-3 flex items-end gap-2 sm:gap-3"
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
            }}
          >
            {/* Paperclip Action: Attach Document or Photo (up to 4) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`relative p-1.5 rounded-full transition-colors shrink-0 mb-0.5 ${
                attachedFiles.length > 0
                  ? 'text-amber-500 bg-amber-500/20 hover:bg-amber-500/30'
                  : 'opacity-70 hover:opacity-100 hover:bg-[var(--bg-surface-hover)]'
              }`}
              title="Joindre jusqu'à 4 photos ou documents (Photos, PDF, TXT, Exercice)"
            >
              <Paperclip className="w-4 h-4" />
              {attachedFiles.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black font-extrabold text-[10px] flex items-center justify-center shadow-xs">
                  {attachedFiles.length}
                </span>
              )}
            </button>

            {/* Camera Action: Direct Device Camera Capture */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-1.5 rounded-full hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 mb-0.5 opacity-70 hover:opacity-100 text-amber-500/90 hover:text-amber-500 cursor-pointer"
              title="Prendre une photo directement (Appareil photo / Copie d'exercice)"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Live Voice Conversation Action */}
            {onOpenVoiceConversation && (
              <button
                type="button"
                onClick={onOpenVoiceConversation}
                className="p-1.5 rounded-full hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 mb-0.5 text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 cursor-pointer"
                title="Démarrer la Conversation Vocale (Voix Directe RYXIA)"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                attachedFiles.length > 0
                  ? (attachedFiles.length === 1
                      ? 'Posez votre question sur cette image ou document joint...'
                      : `Posez votre question sur ces ${attachedFiles.length} images ou documents joints...`)
                  : activeMode === 'study'
                  ? 'Posez une question de cours ou joignez jusqu\'à 4 images d\'exercice...'
                  : groundingMode === 'maps'
                  ? 'Posez une question sur un lieu, itinéraire ou restaurant (Google Maps)...'
                  : groundingMode === 'search'
                  ? 'Posez une question sur l\'actualité ou le web (Google Search)...'
                  : 'Demandez ce que vous voulez à RYXIA...'
              }
              rows={1}
              className="chat-textarea flex-1 bg-transparent text-[15px] focus:outline-none resize-none max-h-48 py-1 leading-relaxed"
              style={{ color: 'var(--text-primary)' }}
            />

            {/* Send / Stop Circular Button */}
            <div className="shrink-0 mb-0.5">
              {isStreaming ? (
                <button
                  onClick={onStopGeneration}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isLight ? 'bg-black text-white hover:bg-neutral-800' : 'bg-white text-black hover:bg-neutral-200'
                  }`}
                  title="Arrêter"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() && attachedFiles.length === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    inputText.trim() || attachedFiles.length > 0
                      ? isLight
                        ? 'bg-black text-white hover:bg-neutral-800'
                        : 'bg-white text-black hover:bg-neutral-200'
                      : 'opacity-30 cursor-not-allowed bg-neutral-500 text-neutral-300'
                  }`}
                  title="Envoyer"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>

          {/* Clean Footer */}
          <div
            className="text-center text-[11px] mt-2 font-normal flex items-center justify-center gap-1.5 flex-wrap"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>RYXIA by Adan · Tous droits réservés.</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Zoom Lightbox Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            onClick={() => setZoomImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomImageUrl}
            alt="Plein écran"
            referrerPolicy="no-referrer"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
