import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Conversation, User } from '../../types/index.ts';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
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

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs"
        onClick={onClose}
      />

      <aside
        className="fixed md:relative z-40 h-full w-[260px] flex flex-col justify-between shrink-0 font-sans select-none animate-in slide-in-from-left duration-150 transition-colors duration-200"
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-primary)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {/* Top: Header & New Chat */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="font-display font-extrabold text-xs text-amber-500">R</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-sm tracking-tight">RYXIA</span>
                <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  by Adan
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors opacity-70 hover:opacity-100"
              title="Fermer la barre latérale"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-semibold shadow-xs hover:border-amber-500/30 group"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
            title="Nouvelle discussion (Cmd+K ou Ctrl+K)"
          >
            <div className="flex items-center gap-2">
              <SquarePen className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span>Nouvelle discussion</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] opacity-70 font-mono border bg-[var(--bg-main)]" style={{ borderColor: 'var(--border-subtle)' }}>
              ⌘K
            </kbd>
          </button>
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
                      onClick={() => onSelectConversation(conv.id)}
                      className="group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-[13px]"
                      style={{
                        backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
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
                                  if (confirm('Supprimer cette discussion ?')) {
                                    onDeleteConversation(conv.id);
                                  }
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
      </aside>
    </>
  );
};
