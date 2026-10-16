import React, { useState, useMemo, useEffect } from 'react';
import {
  SquarePen,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  LogOut,
  User as UserIcon,
  PanelLeftClose,
  Download,
  Sun,
  Moon,
  Keyboard,
  Wand2,
  Mic,
} from 'lucide-react';
import { VoiceLogo } from '../voice/VoiceLogo.tsx';
import { Conversation, User, RyxiaMode } from '../../types/index.ts';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeMode?: RyxiaMode;
  onChangeMode?: (mode: RyxiaMode) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  user: User;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onExportConversation?: (format: 'markdown' | 'json') => void;
  theme?: 'dark' | 'light' | 'obsidian' | 'midnight';
  onToggleTheme?: () => void;
  onOpenShortcuts?: () => void;
  onOpenImageStudio?: (mode?: 'create' | 'edit') => void;
  onOpenVoiceConversation?: () => void;
  onGoogleSignIn?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  activeMode = 'general',
  onChangeMode,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  user,
  onOpenSettings,
  onOpenAuth,
  onLogout,
  isOpen,
  onClose,
  onExportConversation,
  theme = 'dark',
  onToggleTheme,
  onOpenShortcuts,
  onOpenImageStudio,
  onOpenVoiceConversation,
  onGoogleSignIn,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Group conversations by relative dates like ChatGPT
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    const groups: { [key: string]: Conversation[] } = {
      "Aujourd'hui": [],
      "Hier": [],
      "7 jours précédents": [],
      "Plus ancien": [],
    };

    conversations.forEach((conv) => {
      const convTime = new Date(conv.updatedAt).getTime();
      if (convTime >= today) {
        groups["Aujourd'hui"].push(conv);
      } else if (convTime >= yesterday) {
        groups["Hier"].push(conv);
      } else if (convTime >= sevenDaysAgo) {
        groups["7 jours précédents"].push(conv);
      } else {
        groups["Plus ancien"].push(conv);
      }
    });

    return groups;
  }, [conversations]);

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setActiveMenuId(null);
  };

  const handleSaveRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleSelectConv = (id: string) => {
    onSelectConversation(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleNewConv = () => {
    onNewConversation();
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowUserMenu(false);
      setActiveMenuId(null);
      setEditingId(null);
    }
  }, [isOpen]);

  return (
    <>
      {/* Mobile backdrop with smooth opacity transition */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        className={`sidebar-drawer ${isOpen ? 'is-open pointer-events-auto' : 'is-closed pointer-events-none'}`}
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-primary)',
        }}
        aria-hidden={!isOpen}
      >
        <div className="sidebar-inner-content">
        {/* Top: Header, New Chat & Voice Conversation */}
        <div className="p-3 space-y-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Brand header - clean without R badge */}
          <div className="flex items-center justify-between px-1 pt-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-extrabold text-base tracking-tight text-[var(--text-primary)] drop-shadow-[0_0_12px_rgba(255,115,0,0.2)]">
                RYXIA
              </span>
              <span className="text-[11px] font-semibold text-orange-500 dark:text-orange-400 font-mono tracking-tight">
                by Adan
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors opacity-70 hover:opacity-100 cursor-pointer"
              title="Fermer la barre latérale"
            >
              <PanelLeftClose className="w-4 h-4 text-zinc-500 hover:text-[var(--text-primary)]" />
            </button>
          </div>

          {/* New Chat Primary CTA */}
          <button
            onClick={handleNewConv}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold border border-orange-500/25 hover:border-orange-500/50 bg-white dark:bg-[#0c0e15] hover:bg-orange-50/70 dark:hover:bg-[#141722] text-[var(--text-primary)] group shadow-xs cursor-pointer"
            title="Nouvelle discussion (Cmd+K ou Ctrl+K)"
          >
            <div className="flex items-center gap-2">
              <SquarePen className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 group-hover:scale-110 transition-transform" />
              <span>Nouvelle discussion</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] opacity-60 font-mono border bg-[var(--bg-main)]" style={{ borderColor: 'var(--border-subtle)' }}>
              ⌘K
            </kbd>
          </button>

          {/* Section Conversation Vocale - DIRECTEMENT SOUS Nouvelle discussion */}
          {onOpenVoiceConversation && (
            <button
              onClick={() => {
                onOpenVoiceConversation();
                if (typeof window !== 'undefined' && window.innerWidth < 768) onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold border border-orange-500/35 hover:border-orange-500 bg-orange-500/10 hover:bg-orange-500/15 text-orange-600 dark:text-orange-300 shadow-[0_0_15px_rgba(255,115,0,0.06)] group cursor-pointer"
              title="Démarrer la Conversation Vocale (RYXIA Audio)"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <VoiceLogo size="sm" className="text-white" animated />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-zinc-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-200">Conversation Vocale</span>
                  <span className="text-[10px] text-orange-600/80 dark:text-orange-400/80 font-mono">Voix Directe RYXIA</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 animate-ping shadow-[0_0_8px_rgba(255,115,0,0.8)]" />
            </button>
          )}
        </div>

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4 text-xs py-2">
          {Object.entries(grouped).map(([groupTitle, convs]) => {
            if (convs.length === 0) return null;

            return (
              <div key={groupTitle} className="space-y-0.5">
                <div
                  className="px-3 py-1 text-[11px] font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {groupTitle}
                </div>

                {convs.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isEditing = editingId === conv.id;

                  if (isEditing) {
                    return (
                      <form
                        key={conv.id}
                        onSubmit={(e) => handleSaveRename(e, conv.id)}
                        className="px-2 py-1.5 flex items-center gap-1.5 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-surface)' }}
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                          className="flex-1 px-2 py-0.5 text-xs rounded focus:outline-none"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button type="submit" className="p-1 text-emerald-500 hover:opacity-80">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="p-1 opacity-70 hover:opacity-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConv(conv.id)}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all text-[13px] ${
                        isActive
                          ? 'bg-orange-500/15 dark:bg-orange-500/20 font-semibold border border-orange-500/35 shadow-xs'
                          : 'hover:bg-[var(--bg-surface-hover)]'
                      }`}
                      style={{
                        color: isActive
                          ? (theme === 'light' ? '#c2410c' : '#ffffff')
                          : 'var(--text-secondary)',
                      }}
                    >
                      <span className="truncate pr-2">{conv.title}</span>

                      {/* 3-dots Menu Button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                          }}
                          className={`p-1 rounded transition-opacity ${
                            isActive || activeMenuId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          style={{ color: 'var(--text-muted)' }}
                          title="Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Options Dropdown */}
                        {activeMenuId === conv.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                              }}
                            />
                            <div
                              className="absolute right-0 top-6 w-36 rounded-xl shadow-2xl p-1 z-50 text-xs space-y-0.5"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(conv);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Renommer</span>
                              </button>

                              {onExportConversation && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExportConversation('markdown');
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Exporter (.md)</span>
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onDeleteConversation(conv.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {conversations.length === 0 && (
            <div className="py-6 px-3 text-center text-xs opacity-50">
              Aucune discussion enregistrée
            </div>
          )}
        </div>

        {/* Bottom User Menu (ChatGPT style) */}
        <div className="p-3 relative" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Bouton Connexion Google juste en haut du bouton Invité */}
          {user.name === 'Invité' && (
            <button
              onClick={() => {
                if (onGoogleSignIn) onGoogleSignIn();
                else onOpenAuth();
              }}
              className="w-full mb-2 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold shadow-xs transition-all cursor-pointer group hover:border-amber-500/40"
              style={{ color: 'var(--text-primary)' }}
              title="Connexion directe avec votre compte Google"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Connexion Google</span>
            </button>
          )}

          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {user.name || 'Utilisateur'}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  RYXIA · by Adan
                </div>
              </div>
            </div>
          </button>

          {/* User Popover Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className="absolute left-3 right-3 bottom-16 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {/* Quick Google Sign In in popover menu */}
                {user.name === 'Invité' && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onGoogleSignIn) onGoogleSignIn();
                      else onOpenAuth();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-semibold transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continuer avec Google</span>
                  </button>
                )}

                {/* Theme Toggle option */}
                {onToggleTheme && (
                  <button
                    onClick={() => {
                      onToggleTheme();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {theme === 'light' ? (
                        <Moon className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400" />
                      )}
                      <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
                    </div>
                    <span className="text-[10px] opacity-60 font-mono">
                      {theme === 'light' ? 'Clair' : 'Sombre'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onOpenSettings();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <Settings className="w-4 h-4 opacity-70" />
                  <span>Paramètres</span>
                </button>

                {onOpenShortcuts && (
                  <button
                    onClick={() => {
                      onOpenShortcuts();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Keyboard className="w-4 h-4 opacity-70" />
                      <span>Raccourcis clavier</span>
                    </div>
                    <kbd className="px-1 py-0.5 rounded text-[10px] opacity-60 font-mono bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      ⌘/
                    </kbd>
                  </button>
                )}

                <button
                  onClick={() => {
                    onOpenAuth();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <UserIcon className="w-4 h-4 opacity-70" />
                  <span>{user.name === 'Invité' ? 'Connexion / Inscription' : 'Changer de compte'}</span>
                </button>

                {user.name !== 'Invité' && (
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Se déconnecter</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        </div>
      </aside>
    </>
  );
};
