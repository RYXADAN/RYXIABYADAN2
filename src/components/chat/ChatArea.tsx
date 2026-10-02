import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Sun,
  Moon,
  Globe,
  MapPin,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Conversation, Message, RyxiaMode } from '../../types/index.ts';
import { RYXIA_MODES } from '../../lib/modes.ts';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  onSendMessage: (text: string, groundingPreference?: 'auto' | 'search' | 'maps', latLng?: { latitude: number; longitude: number }) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
  onChangeMode: (mode: RyxiaMode) => void;
  onNewConversation: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  enterSends?: boolean;
  theme?: 'dark' | 'light' | 'obsidian' | 'midnight';
  onToggleTheme?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
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
  theme = 'dark',
  onToggleTheme,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [groundingMode, setGroundingMode] = useState<'auto' | 'search' | 'maps'>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLight = theme === 'light';
  const activeMode: RyxiaMode = conversation ? conversation.mode : 'general';
  const modeConfig = RYXIA_MODES[activeMode] || RYXIA_MODES.general;

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
    if (!inputText.trim() || isStreaming) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (groundingMode === 'maps' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSendMessage(text, 'maps', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          onSendMessage(text, groundingMode);
        },
        { timeout: 3000 }
      );
    } else {
      onSendMessage(text, groundingMode);
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
      className="flex-1 flex flex-col h-screen relative overflow-hidden select-text transition-colors duration-200"
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
        className="h-14 px-4 flex items-center justify-between z-20 shrink-0 relative transition-colors duration-200"
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

          {/* Model Switcher Dropdown (ChatGPT model picker style) */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-[var(--bg-surface-hover)] text-base font-semibold transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-display font-bold tracking-tight text-lg">RYXIA</span>
                <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  by Adan
                </span>
                <span className="text-xs font-normal opacity-70 hidden sm:inline">
                  · {modeConfig.name}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </button>

            {showModelMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowModelMenu(false)}
                />
                <div
                  className="absolute left-0 mt-2 w-72 rounded-2xl shadow-2xl p-2 z-40 space-y-1 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    className="px-3 py-1.5 flex items-center justify-between border-b pb-2 mb-1"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-display font-bold text-xs">RYXIA — by Adan</span>
                    <span className="text-[10px] text-amber-500 font-mono">gemini-3.5-flash</span>
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
                        className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium'
                            : 'hover:bg-[var(--bg-surface-hover)]'
                        }`}
                        style={{
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        <div className="mt-0.5">{getModeIcon(mKey)}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center justify-between">
                            <span>{m.name}</span>
                            <span className="text-[10px] opacity-60 font-mono">{m.badge}</span>
                          </div>
                          <div className="text-xs opacity-70 line-clamp-1 mt-0.5">
                            {m.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Right: Theme Switcher + New Chat Shortcut */}
        <div className="flex items-center gap-1">
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
      <div className="flex-1 overflow-y-auto px-4 md:px-0 relative z-10">
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
            </div>
          ) : (
            /* Messages Stream */
            <div className="space-y-6 pt-4 pb-36">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isLast = index === messages.length - 1;

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end">
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
                    </div>
                  );
                }

                // Assistant Message
                return (
                  <div key={msg.id} className="group relative text-[15px] leading-relaxed">
                    {/* Brand Identifier */}
                    <div className="flex items-center gap-2 mb-2 select-none">
                      <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-display font-extrabold text-[11px] text-amber-500">
                        R
                      </div>
                      <span className="font-display font-bold text-xs">RYXIA</span>
                      <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        by Adan
                      </span>
                    </div>

                    <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
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
                                <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              ) : (
                                <Globe className="w-3 h-3 text-sky-500 shrink-0" />
                              )}
                              <span className="max-w-[220px] truncate text-[11px] font-medium group-hover:text-amber-500 transition-colors">
                                {src.title}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-40 shrink-0 group-hover:opacity-100" />
                            </a>
                          ))}
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

              {/* Streaming Indicator */}
              {isStreaming && (
                <div className="text-[15px] leading-relaxed">
                  <div className="flex items-center gap-2 mb-2 select-none">
                    <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-display font-extrabold text-[11px] text-amber-500">
                      R
                    </div>
                    <span className="font-display font-bold text-xs">RYXIA</span>
                    <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      by Adan
                    </span>
                  </div>

                  {streamingText ? (
                    <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={createMarkdownComponents()}
                      >
                        {streamingText}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>RYXIA consulte Google & génère sa réponse...</span>
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
        className="w-full pb-4 pt-2 px-4 shrink-0 transition-colors duration-200"
        style={{
          background: isLight
            ? 'linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0.8), transparent)'
            : 'linear-gradient(to top, #212121, #212121, transparent)',
        }}
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Grounding Selector Bar */}
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="opacity-60 text-[11px] font-medium mr-1">Ancrage :</span>
              <button
                type="button"
                onClick={() => setGroundingMode('auto')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  groundingMode === 'auto'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto</span>
              </button>

              <button
                type="button"
                onClick={() => setGroundingMode('search')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  groundingMode === 'search'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Utiliser Google Search Grounding (gemini-3.5-flash)"
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span>Google Search</span>
              </button>

              <button
                type="button"
                onClick={() => setGroundingMode('maps')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  groundingMode === 'maps'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Utiliser Google Maps Grounding (gemini-3.5-flash)"
              >
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>Google Maps</span>
              </button>
            </div>
          </div>

          <div
            className="relative rounded-3xl transition-all shadow-xl px-4 py-3 flex items-end gap-3"
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
            }}
          >
            {/* Action attachment button */}
            <button
              onClick={() => alert('Support d\'upload et d\'analyse de fichiers préparé pour la prochaine version.')}
              className="p-1.5 rounded-full hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 mb-0.5"
              style={{ color: 'var(--text-muted)' }}
              title="Joindre un fichier"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                groundingMode === 'maps'
                  ? 'Posez une question sur un lieu, itinéraire ou restaurant (Google Maps)...'
                  : groundingMode === 'search'
                  ? 'Posez une question sur l\'actualité ou le web (Google Search)...'
                  : 'Demandez ce que vous voulez à RYXIA...'
              }
              rows={1}
              className="flex-1 bg-transparent text-[15px] focus:outline-none resize-none max-h-48 py-1 leading-relaxed"
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
                  disabled={!inputText.trim()}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    inputText.trim()
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

          {/* ChatGPT-style Subtext with prominent RYXIA by Adan */}
          <div
            className="text-center text-[11px] mt-2 font-normal flex items-center justify-center gap-1.5 flex-wrap"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>RYXIA peut faire des erreurs.</span>
            <span>·</span>
            <span className="font-semibold font-display" style={{ color: 'var(--text-primary)' }}>RYXIA</span>
            <span className="text-amber-500 font-semibold">by Adan</span>
            <span>·</span>
            <span>Google Search & Maps Grounding</span>
          </div>
        </div>
      </div>
    </div>
  );
};
