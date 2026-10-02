import React, { useState, useEffect } from 'react';
import { X, Sliders, Moon, Cpu, Trash2, Download, User as UserIcon, Info, Check, Shield } from 'lucide-react';
import { User, UserSettings, UserStats } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  settings: UserSettings;
  stats?: UserStats;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onClearAllConversations: () => void;
  onProfileUpdated?: (user: User) => void;
}

type TabType = 'appearance' | 'ai' | 'chat' | 'data' | 'account' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  settings,
  stats,
  onUpdateSettings,
  onClearAllConversations,
  onProfileUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [userName, setUserName] = useState(user.name);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveSettings = async (updates: Partial<UserSettings>) => {
    setIsSaving(true);
    try {
      const updated = await api.settings.update(updates);
      setLocalSettings(updated);
      onUpdateSettings(updated);
      setSavedMessage('Paramètres enregistrés');
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    try {
      const updated = await api.auth.updateProfile({ name: userName.trim() });
      if (onProfileUpdated) onProfileUpdated(updated);
      setSavedMessage('Profil mis à jour');
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Erreur mise à jour profil');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-[#0d0e15] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[550px] text-[#ededf2]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2 py-1 text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors text-xs font-mono"
          aria-label="Fermer"
          title="Fermer (Échap)"
        >
          <span className="hidden sm:inline-block px-1 py-0.2 rounded bg-white/5 border border-white/10 text-[10px]">Échap</span>
          <X className="w-4 h-4" />
        </button>

        {/* Sidebar Tabs */}
        <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#090a0f] p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
          <div className="hidden md:block px-2.5 py-2 mb-2 font-display font-bold text-sm text-white">
            Paramètres RYXIA
          </div>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'appearance' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4 text-amber-400" />
            <span>Apparence</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'ai' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>Fournisseur IA</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'chat' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Chat & Saisie</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'account' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserIcon className="w-4 h-4 text-purple-400" />
            <span>Mon Compte</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'data' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Données</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'about' ? 'bg-white/10 text-white font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Info className="w-4 h-4 text-neutral-400" />
            <span>À propos</span>
          </button>
        </div>

        {/* Content Pane */}
        <div className="flex-1 p-6 overflow-y-auto">
          {savedMessage && (
            <div className="mb-4 py-2 px-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>{savedMessage}</span>
            </div>
          )}

          {/* Apparence Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Thème d'affichage</h3>
                <p className="text-xs text-neutral-400 mb-3">Choisissez entre le thème sombre ou le thème clair.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'dark', label: 'Sombre (Dark)', desc: 'Palette anthracite sobre et reposante' },
                    { id: 'light', label: 'Clair (Light)', desc: 'Blanc épuré, contraste doux et net' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSaveSettings({ theme: t.id as any })}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        localSettings.theme === t.id
                          ? 'border-amber-400/80 bg-amber-400/10 text-white shadow-sm'
                          : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-0.5 text-white flex items-center justify-between">
                        <span>{t.label}</span>
                        {localSettings.theme === t.id && (
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <h3 className="text-base font-semibold text-white mb-1">Taille de police</h3>
                <p className="text-xs text-neutral-400 mb-3">Ajustez la taille du texte dans le flux de discussion.</p>
                <div className="flex gap-2">
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleSaveSettings({ fontSize: size })}
                      className={`px-4 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        localSettings.fontSize === size
                          ? 'bg-white text-neutral-950 border-white'
                          : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {size === 'sm' ? 'Compact' : size === 'md' ? 'Normal' : 'Grand'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Animations fluides</div>
                    <div className="text-xs text-neutral-400">Transitions et apparitions des messages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.animations}
                    onChange={(e) => handleSaveSettings({ animations: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI Provider Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Moteur d'Intelligence Artificielle</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  RYXIA est configuré par défaut pour utiliser le modèle principal <strong className="text-white">GPT-5.6 Luna</strong> (OpenAI Responses API) avec bascule automatique haute disponibilité.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Modèle principal ciblé
                    </label>
                    <input
                      type="text"
                      value={localSettings.customOpenAiModel || 'gpt-5.6-luna'}
                      onChange={(e) => setLocalSettings({ ...localSettings, customOpenAiModel: e.target.value })}
                      onBlur={() => handleSaveSettings({ customOpenAiModel: localSettings.customOpenAiModel })}
                      placeholder="gpt-5.6-luna"
                      className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[11px] text-neutral-500 mt-1 block">
                      Par défaut: <code className="text-amber-300">gpt-5.6-luna</code>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Clé API OpenAI personnalisée (Optionnelle)</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Chiffrée serveur
                      </span>
                    </label>
                    <input
                      type="password"
                      value={localSettings.customOpenAiKey || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, customOpenAiKey: e.target.value })}
                      onBlur={() => handleSaveSettings({ customOpenAiKey: localSettings.customOpenAiKey })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[11px] text-neutral-500 mt-1 block">
                      Si non renseignée, RYXIA utilise le cluster d'IA unifié serveur pour des réponses instantanées sans configuration.
                    </span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Préférence d'acheminement
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'auto', label: 'Auto (Recommandé)', desc: 'OpenAI + secours transparent' },
                        { id: 'openai', label: 'OpenAI Stricte', desc: 'GPT-5.6 Luna uniquement' },
                        { id: 'gemini', label: 'Moteur Core', desc: 'Ultra-rapide' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSaveSettings({ aiProvider: p.id as any })}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            localSettings.aiProvider === p.id
                              ? 'border-amber-400/60 bg-amber-400/5 text-white'
                              : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/20'
                          }`}
                        >
                          <div className="text-xs font-semibold">{p.label}</div>
                          <div className="text-[10px] text-neutral-500">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Comportement du composeur</h3>
                <p className="text-xs text-neutral-400 mb-4">Gérez le fonctionnement des raccourcis clavier.</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    <div>
                      <div className="text-xs font-semibold text-white">Touche Entrée pour envoyer</div>
                      <div className="text-[11px] text-neutral-400">Shift + Entrée pour insérer un saut de ligne</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enterSends}
                      onChange={(e) => handleSaveSettings({ enterSends: e.target.checked })}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    <div className="text-xs font-semibold text-white mb-1">Rendu Markdown riche</div>
                    <div className="text-[11px] text-neutral-400">
                      Actif : affichage des titres, listes, tableaux, blocs de code avec coloration syntaxique et bouton de copie instantané.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Profil utilisateur</h3>
                <p className="text-xs text-neutral-400 mb-4">Informations sur votre compte RYXIA.</p>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Nom / Pseudonyme</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Adresse email</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-3 py-2 text-sm bg-black/20 border border-white/[0.06] rounded-lg text-neutral-400 cursor-not-allowed"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-200 rounded-md transition-colors"
                    >
                      Mettre à jour le nom
                    </button>
                  </div>
                </form>

                {stats && (
                  <div className="mt-6 pt-4 border-t border-white/[0.08]">
                    <div className="text-xs font-semibold text-white mb-2">Statistiques d'utilisation</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-white/[0.06] bg-black/30">
                        <div className="text-neutral-400">Conversations créées</div>
                        <div className="text-lg font-bold text-white font-mono mt-0.5">{stats.totalConversations}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-white/[0.06] bg-black/30">
                        <div className="text-neutral-400">Messages échangés</div>
                        <div className="text-lg font-bold text-white font-mono mt-0.5">{stats.totalMessages}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Gestion des données</h3>
                <p className="text-xs text-neutral-400 mb-4">Exportation et suppression de vos historiques.</p>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Supprimer tout l'historique</div>
                      <div className="text-[11px] text-neutral-400">Efface définitivement toutes vos conversations sur ce compte.</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous vraiment supprimer toutes vos conversations ? Cette action est irréversible.')) {
                          onClearAllConversations();
                          setSavedMessage('Toutes les conversations ont été supprimées');
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Tout effacer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-5 text-sm">
              <div className="p-4 rounded-xl border border-white/[0.08] bg-black/40">
                <div className="font-display font-extrabold text-2xl text-white tracking-tight mb-1">
                  RYXIA
                </div>
                <div className="text-xs font-medium text-amber-400 mb-3">
                  RYXIA — by Adan · Your AI. Your way.
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  Plateforme d'intelligence artificielle avancée, conçue pour un usage professionnel, intellectuel et créatif sans artifice ni distraction.
                </p>
                <div className="pt-3 border-t border-white/[0.06] text-[11px] text-neutral-500 space-y-1 font-mono">
                  <div>Version : 1.0.0 Pro</div>
                  <div>Moteur par défaut : OpenAI Responses API (GPT-5.6 Luna)</div>
                  <div>Architecture : Full-stack Next-grade TypeScript / SSE Stream</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
