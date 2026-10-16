import React, { useState, useEffect, useRef } from 'react';
import { api } from './lib/api.ts';
import { User, Conversation, Message, UserSettings, UserStats, RyxiaMode, FileAttachment, ClientTimeInfo } from './types/index.ts';
import { Sidebar } from './components/sidebar/Sidebar.tsx';
import { ChatArea } from './components/chat/ChatArea.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { SettingsModal } from './components/settings/SettingsModal.tsx';
import { ShortcutsModal } from './components/modals/ShortcutsModal.tsx';
import { VoiceConversationModal } from './components/voice/VoiceConversationModal.tsx';
import {
  syncMessageToFirestore,
  syncConversationToFirestore,
  deleteConversationFromFirestore,
  logOut as firebaseLogOut,
  auth as firebaseAuth,
  signInWithGoogle,
  subscribeToUserConversations,
  subscribeToConversationMessages,
} from './lib/firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const savedLocalTheme = (localStorage.getItem('ryxia_theme') as 'dark' | 'light') || 'dark';

  const [settings, setSettings] = useState<UserSettings>({
    userId: '',
    theme: savedLocalTheme,
    fontSize: 'md',
    enterSends: true,
    animations: true,
    aiProvider: 'auto',
    speedMode: 'turbo',
    responseLength: 'balanced',
    customOpenAiModel: 'RYXIA Core v1',
  });
  const [stats, setStats] = useState<UserStats | undefined>(undefined);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Layout & Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Live Voice Conversation (Voix Directe RYXIA)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const handleVoiceTranscriptSaved = async (
    transcript: { role: 'user' | 'assistant'; text: string }[]
  ) => {
    if (transcript.length === 0) return;
    let convId = activeConversationId;
    if (!convId) {
      try {
        const firstUserTurn = transcript.find((t) => t.role === 'user');
        const title = firstUserTurn?.text.slice(0, 36) || 'Conversation Vocale';
        const newConv = await api.conversations.create(title, 'general');
        convId = newConv.id;
        setActiveConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
        syncConversationToFirestore(newConv);
      } catch (e) {
        console.error('Failed to create conv for voice transcript:', e);
        return;
      }
    }

    const newMsgs: Message[] = transcript.map((turn, i) => ({
      id: `msg_${Date.now()}_${i}`,
      conversationId: convId!,
      role: turn.role,
      content: turn.text,
      createdAt: new Date().toISOString(),
      model: turn.role === 'assistant' ? 'RYXIA Audio' : 'user',
    }));

    setMessages((prev) => [...prev, ...newMsgs]);
    if (user) {
      newMsgs.forEach((m) => syncMessageToFirestore(m, user.id));
    }
  };

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K for new conversation, Esc to close modals, Cmd+B for sidebar, Cmd+/ for shortcuts help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Esc: Close open modals
      if (e.key === 'Escape') {
        if (isAuthModalOpen || isSettingsModalOpen || isShortcutsModalOpen || isVoiceModalOpen) {
          e.preventDefault();
          setIsAuthModalOpen(false);
          setIsSettingsModalOpen(false);
          setIsShortcutsModalOpen(false);
          setIsVoiceModalOpen(false);
          return;
        }
      }

      // 2. Cmd+Shift+V or Ctrl+Shift+V: Open Voice Conversation (RYXIA Audio)
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsAuthModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsShortcutsModalOpen(false);
        setIsVoiceModalOpen((prev) => !prev);
        return;
      }

      // 3. Cmd+K or Ctrl+K: Open new conversation
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsAuthModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsShortcutsModalOpen(false);
        handleNewConversation();
        return;
      }

      // 4. Cmd+B or Ctrl+B: Toggle sidebar
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // 5. Cmd+/ or Ctrl+/: Toggle shortcuts help modal
      if (isCmdOrCtrl && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, isSettingsModalOpen, isShortcutsModalOpen, isVoiceModalOpen, isStreaming]);

  // Sync theme with HTML root and document
  useEffect(() => {
    const isLight = settings.theme === 'light';
    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('dark');
      document.body.classList.add('theme-light');
      document.body.classList.remove('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('dark');
      document.body.classList.remove('theme-light');
      document.body.classList.add('dark');
    }
  }, [settings.theme]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        try {
          const syncRes = await api.auth.firebaseSync({
            uid: fbUser.uid,
            name: fbUser.displayName || 'Utilisateur Google',
            email: fbUser.email || '',
            avatar: fbUser.photoURL || undefined,
          });
          setUser(syncRes.user);
          const convs = await api.conversations.list();
          setConversations(convs);
        } catch (e) {
          console.warn('Firebase state sync warning:', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-initialize session: if logged in, restore session; if not, create instant guest session so user can chat right away!
  useEffect(() => {
    async function initSession() {
      try {
        let session = await api.auth.me();
        if (!session) {
          // Initialize seamless instant session like ChatGPT
          const guest = await api.auth.guest();
          session = await api.auth.me();
          if (session) {
            setUser(session.user);
            const initialTheme = (localStorage.getItem('ryxia_theme') as any) || session.settings.theme || 'dark';
            setSettings({ ...session.settings, theme: initialTheme });
            setStats(session.stats);
          } else {
            setUser(guest.user);
          }
        } else {
          setUser(session.user);
          const initialTheme = (localStorage.getItem('ryxia_theme') as any) || session.settings.theme || 'dark';
          setSettings({ ...session.settings, theme: initialTheme });
          setStats(session.stats);
          const convs = await api.conversations.list();
          setConversations(convs);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  // Synchronisation multi-appareils temps réel des conversations (Google OAuth)
  useEffect(() => {
    if (!user || user.id === 'guest' || !user.id) return;

    const unsubscribe = subscribeToUserConversations(user.id, (firestoreConvs) => {
      if (firestoreConvs && firestoreConvs.length > 0) {
        setConversations((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          for (const fc of firestoreConvs) {
            map.set(fc.id, fc);
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Synchronisation multi-appareils temps réel des messages du fil actif
  useEffect(() => {
    if (!activeConversationId || !user || user.id === 'guest' || isStreaming) return;

    const unsubscribe = subscribeToConversationMessages(activeConversationId, (firestoreMsgs) => {
      if (firestoreMsgs && firestoreMsgs.length > 0 && !isStreaming) {
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const hasNew = firestoreMsgs.some((m) => !prevIds.has(m.id));
          if (hasNew || firestoreMsgs.length !== prev.length) {
            return firestoreMsgs;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [activeConversationId, user?.id, isStreaming]);

  const handleToggleTheme = async () => {
    const nextTheme: 'dark' | 'light' = settings.theme === 'light' ? 'dark' : 'light';
    setSettings((prev) => ({ ...prev, theme: nextTheme }));
    localStorage.setItem('ryxia_theme', nextTheme);
    try {
      await api.settings.update({ theme: nextTheme });
    } catch (e) {
      // non-fatal
    }
  };

  // When active conversation changes, load its messages
  const loadConversationMessages = async (id: string) => {
    try {
      const data = await api.conversations.get(id);
      setActiveConversationId(id);
      setMessages(data.messages);
    } catch (err) {
      console.error('Error fetching conversation:', err);
    }
  };

  const handleSelectConversation = (id: string) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setStreamingText('');
    }
    loadConversationMessages(id);
  };

  const handleNewConversation = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setStreamingText('');
    }
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleSendMessage = async (
    text: string,
    groundingPreference?: 'auto' | 'search' | 'maps',
    latLng?: { latitude: number; longitude: number },
    speedModeOverride?: 'turbo' | 'balanced' | 'deep',
    attachment?: FileAttachment,
    attachments?: FileAttachment[]
  ) => {
    if (isStreaming) return;

    const allAttachments = (attachments && attachments.length > 0)
      ? attachments
      : (attachment ? [attachment] : undefined);
    const primaryAttachment = allAttachments?.[0];

    let targetConvId = activeConversationId;
    const currentMode: RyxiaMode = activeConversation?.mode || 'general';

    // Auto-create conversation if empty
    if (!targetConvId) {
      try {
        const titleText = text.trim() ? text.slice(0, 40) : (primaryAttachment?.name ? `Images: ${primaryAttachment.name.slice(0, 30)}` : 'Nouvelle conversation');
        const newConv = await api.conversations.create(titleText, currentMode);
        targetConvId = newConv.id;
        setActiveConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
        syncConversationToFirestore(newConv);
      } catch (err) {
        console.error('Failed to create conversation:', err);
        return;
      }
    }

    // Append optimistic user message with attachments
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`,
      conversationId: targetConvId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      model: 'user',
      attachment: primaryAttachment,
      attachments: allAttachments,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    if (user) {
      syncMessageToFirestore(tempUserMsg, user.id);
    }

    // Setup streaming
    setIsStreaming(true);
    setStreamingText('');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const now = new Date();
    const clientTime: ClientTimeInfo = {
      iso: now.toISOString(),
      dateString: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
      timeString: new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    };

    await api.chat.stream({
      conversationId: targetConvId,
      message: text,
      mode: currentMode,
      groundingPreference,
      speedMode: speedModeOverride || settings.speedMode || 'balanced',
      latLng,
      attachment: primaryAttachment,
      attachments: allAttachments,
      clientTime,
      signal: controller.signal,
      onInit: (initData) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === initData.conversationId ? { ...c, title: initData.title, mode: initData.mode } : c
          )
        );
      },
      onChunk: (chunk) => {
        setStreamingText((prev) => prev + chunk);
      },
      onDone: (assistantMsg) => {
        setIsStreaming(false);
        setStreamingText('');
        setMessages((prev) => [...prev, assistantMsg]);
        api.conversations.list().then(setConversations);
        if (user) {
          syncMessageToFirestore(assistantMsg, user.id);
        }
      },
      onError: (errMsg) => {
        setIsStreaming(false);
        setStreamingText('');
        const errAssistantMsg: Message = {
          id: `err_${Date.now()}`,
          conversationId: targetConvId!,
          role: 'assistant',
          content: `⚠️ **Erreur** : ${errMsg}`,
          createdAt: new Date().toISOString(),
          model: 'system-error',
        };
        setMessages((prev) => [...prev, errAssistantMsg]);
      },
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    if (streamingText && activeConversationId) {
      const partialMsg: Message = {
        id: `partial_${Date.now()}`,
        conversationId: activeConversationId,
        role: 'assistant',
        content: streamingText,
        createdAt: new Date().toISOString(),
        model: 'RYXIA (Interrompu)',
      };
      setMessages((prev) => [...prev, partialMsg]);
    }
    setStreamingText('');
  };

  const handleToggleSpeedMode = async (newSpeed: 'turbo' | 'balanced' | 'deep') => {
    setSettings((prev) => ({ ...prev, speedMode: newSpeed }));
    try {
      await api.settings.update({ speedMode: newSpeed });
    } catch (e) {
      console.warn('Speed mode update warning:', e);
    }
  };

  const handleRegenerate = async () => {
    if (!activeConversationId || isStreaming) return;

    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
        copy.pop();
      }
      return copy;
    });

    setIsStreaming(true);
    setStreamingText('');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    await api.chat.stream({
      conversationId: activeConversationId,
      regenerate: true,
      mode: activeConversation?.mode || 'general',
      speedMode: settings.speedMode || 'turbo',
      signal: controller.signal,
      onChunk: (chunk) => {
        setStreamingText((prev) => prev + chunk);
      },
      onDone: (assistantMsg) => {
        setIsStreaming(false);
        setStreamingText('');
        setMessages((prev) => [...prev, assistantMsg]);
        if (user) {
          syncMessageToFirestore(assistantMsg, user.id);
        }
      },
      onError: (errMsg) => {
        setIsStreaming(false);
        setStreamingText('');
        const errAssistantMsg: Message = {
          id: `err_${Date.now()}`,
          conversationId: activeConversationId!,
          role: 'assistant',
          content: `⚠️ **Erreur lors de la régénération** : ${errMsg}`,
          createdAt: new Date().toISOString(),
          model: 'system-error',
        };
        setMessages((prev) => [...prev, errAssistantMsg]);
      },
    });
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await api.conversations.update(id, { title: newTitle });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      syncConversationToFirestore(updated);
    } catch (err: any) {
      console.error('Erreur renommage:', err);
    }
  };

  const handleDeleteConversation = async (id?: string) => {
    const targetId = id || activeConversationId;
    if (!targetId) return;

    try {
      await api.conversations.delete(targetId);
      deleteConversationFromFirestore(targetId);
      setConversations((prev) => prev.filter((c) => c.id !== targetId));
      if (activeConversationId === targetId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleClearAllConversations = async () => {
    try {
      await api.conversations.clearAll();
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
    } catch (err: any) {
      console.error('Erreur suppression toutes conversations:', err);
    }
  };

  const [draftMode, setDraftMode] = useState<RyxiaMode>('general');

  const handleChangeMode = async (mode: RyxiaMode) => {
    setDraftMode(mode);
    if (activeConversationId) {
      try {
        const updated = await api.conversations.update(activeConversationId, { mode });
        setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? { ...c, mode: updated.mode } : c)));
        syncConversationToFirestore(updated);
      } catch (err) {
        console.error('Failed to change mode in db:', err);
      }
    }
  };

  const handleExport = (format: 'markdown' | 'json') => {
    if (!activeConversationId) return;
    const url = api.conversations.getExportUrl(activeConversationId, format);
    window.location.href = url;
  };

  const handleLogout = async () => {
    await firebaseLogOut();
    api.auth.logout();
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    const guest = await api.auth.guest();
    setUser(guest.user);
  };

  const handleGoogleSignIn = async () => {
    try {
      const fbUser = await signInWithGoogle();
      const syncResult = await api.auth.firebaseSync({
        uid: fbUser.id,
        name: fbUser.name,
        email: fbUser.email,
        avatar: fbUser.avatar,
      });
      setUser(syncResult.user);
      const convs = await api.conversations.list();
      setConversations(convs);
    } catch (err: any) {
      console.warn('Google sign in warning:', err);
      // Fallback: open auth modal if popup blocked or cancelled
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = async (loggedUser: User) => {
    setUser(loggedUser);
    const session = await api.auth.me();
    if (session) {
      setSettings(session.settings);
      setStats(session.stats);
    }
    const convs = await api.conversations.list();
    setConversations(convs);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const currentMode: RyxiaMode = activeConversation ? activeConversation.mode : draftMode;

  if (loading) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center transition-colors duration-200"
        style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-layout flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
    >
      {/* ChatGPT-style Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeMode={currentMode}
        onChangeMode={handleChangeMode}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        user={user || { id: 'guest', name: 'Invité', email: 'guest@ryxia.ai', createdAt: '' }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onExportConversation={handleExport}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenVoiceConversation={() => setIsVoiceModalOpen(true)}
        onGoogleSignIn={handleGoogleSignIn}
      />

      {/* ChatGPT-style Main Chat View with Grounding & Search & Maps */}
      <ChatArea
        conversation={activeConversation}
        activeMode={currentMode}
        messages={messages}
        isStreaming={isStreaming}
        streamingText={streamingText}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        onRegenerate={handleRegenerate}
        onChangeMode={handleChangeMode}
        onNewConversation={handleNewConversation}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        enterSends={settings.enterSends}
        speedMode={settings.speedMode || 'turbo'}
        onToggleSpeedMode={handleToggleSpeedMode}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        onOpenVoiceConversation={() => setIsVoiceModalOpen(true)}
      />

      {/* Auth Modal (Google Sign-In + Firebase Auth) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Settings Modal */}
      {isSettingsModalOpen && user && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          user={user}
          settings={settings}
          stats={stats}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            if (newSettings.theme) {
              localStorage.setItem('ryxia_theme', newSettings.theme);
            }
          }}
          onClearAllConversations={handleClearAllConversations}
          onProfileUpdated={setUser}
        />
      )}

      {/* Keyboard Shortcuts Helper Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Live Voice Conversation Modal (Voix Directe RYXIA) */}
      <VoiceConversationModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSaveToChat={handleVoiceTranscriptSaved}
      />
    </div>
  );
}
