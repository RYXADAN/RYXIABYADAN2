import React, { useState, useEffect } from 'react';
import { X, Sliders, Moon, Cpu, Trash2, Download, User as UserIcon, Info, Check, Shield, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { User, UserSettings, UserStats } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { getGeminiApiKey, hasGeminiApiKey, setCustomGeminiApiKey } from '../../lib/gemini.ts';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    return (typeof localStorage !== 'undefined' ? (localStorage.getItem('ryxia_gemini_api_key') || '') : '') || '';
  });
  const [keyConfigured, setKeyConfigured] = useState(() => hasGeminiApiKey());

  const handleSaveApiKey = () => {
    setCustomGeminiApiKey(apiKeyInput);
    const configured = hasGeminiApiKey();
    setKeyConfigured(configured);
    setSavedMessage(configured ? 'Clé API enregistrée avec succès' : 'Clé API supprimée');
    setTimeout(() => setSavedMessage(null), 3000);
  };

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
    setErrorMessage(null);
    try {
      const updated = await api.settings.update(updates);
      setLocalSettings(updated);
      onUpdateSettings(updated);
      setSavedMessage('Paramètres enregistrés');
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la sauvegarde');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setErrorMessage(null);
    try {
      const updated = await api.auth.updateProfile({ name: userName.trim() });
      if (onProfileUpdated) onProfileUpdated(updated);
      setSavedMessage('Profil mis à jour');
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur mise à jour profil');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col md:flex-row h-[550px]"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-xs font-mono opacity-70 hover:opacity-100"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Fermer"
          title="Fermer (Échap)"
        >
          <span className="hidden sm:inline-block px-1 py-0.2 rounded border text-[10px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>Échap</span>
          <X className="w-4 h-4" />
        </button>

        {/* Sidebar Tabs */}
        <div
          className="w-full md:w-52 border-b md:border-b-0 md:border-r p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0"
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="hidden md:block px-2.5 py-2 mb-2 font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Paramètres RYXIA
          </div>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'appearance' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'appearance' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'appearance' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Moon className="w-4 h-4 text-amber-500" />
            <span>Apparence</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'ai' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'ai' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Cpu className="w-4 h-4 text-sky-500" />
            <span>Fournisseur IA</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'chat' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'chat' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Sliders className="w-4 h-4 text-emerald-500" />
            <span>Chat & Saisie</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'account' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'account' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'account' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <UserIcon className="w-4 h-4 text-purple-500" />
            <span>Mon Compte</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'data' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'data' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'data' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Données</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
              activeTab === 'about' ? 'font-semibold' : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
            style={{
              backgroundColor: activeTab === 'about' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'about' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Info className="w-4 h-4 opacity-70" />
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

          {errorMessage && (
            <div className="mb-4 py-2 px-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <X className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Apparence Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Thème d'affichage</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Choisissez entre le thème sombre ou le thème clair.</p>
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
                          ? 'border-amber-500/80 bg-amber-500/10 shadow-sm'
                          : 'hover:border-amber-500/40'
                      }`}
                      style={{
                        backgroundColor: localSettings.theme === t.id ? undefined : 'var(--bg-surface)',
                        borderColor: localSettings.theme === t.id ? undefined : 'var(--border-color)',
                      }}
                    >
                      <div className="text-xs font-semibold mb-0.5 flex items-center justify-between" style={{ color: 'var(--text-primary)' }}>
                        <span>{t.label}</span>
                        {localSettings.theme === t.id && (
                          <Check className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Taille de police</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Ajustez la taille du texte dans le flux de discussion.</p>
                <div className="flex gap-2">
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleSaveSettings({ fontSize: size })}
                      className={`px-4 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        localSettings.fontSize === size
                          ? 'bg-amber-500 text-white border-amber-500 font-semibold shadow-xs'
                          : 'hover:bg-[var(--bg-surface-hover)]'
                      }`}
                      style={{
                        backgroundColor: localSettings.fontSize === size ? undefined : 'var(--bg-surface)',
                        borderColor: localSettings.fontSize === size ? undefined : 'var(--border-color)',
                        color: localSettings.fontSize === size ? undefined : 'var(--text-primary)',
                      }}
                    >
                      {size === 'sm' ? 'Compact' : size === 'md' ? 'Normal' : 'Grand'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Animations fluides</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Transitions et apparitions des messages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.animations}
                    onChange={(e) => handleSaveSettings({ animations: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI Provider Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Moteur d'Intelligence Artificielle</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                  RYXIA est configuré par défaut pour utiliser le modèle principal <strong style={{ color: 'var(--text-primary)' }}>GPT-5.6 Luna</strong> (OpenAI Responses API) avec bascule automatique haute disponibilité.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      Modèle principal ciblé
                    </label>
                    <input
                      type="text"
                      value={localSettings.customOpenAiModel || 'gpt-5.6-luna'}
                      onChange={(e) => setLocalSettings({ ...localSettings, customOpenAiModel: e.target.value })}
                      onBlur={() => handleSaveSettings({ customOpenAiModel: localSettings.customOpenAiModel })}
                      placeholder="gpt-5.6-luna"
                      className="w-full px-3 py-2 text-xs font-mono border rounded-lg placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
                      Par défaut: <code className="text-amber-600 dark:text-amber-400 font-semibold">gpt-5.6-luna</code>
                    </span>
                  </div>

                  {/* Configuration Clé API Gemini pour Netlify & GitHub */}
                  <div
                    className="p-3.5 rounded-xl border space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Clé API Google Gemini (Netlify / GitHub / Vite)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${
                          keyConfigured
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {keyConfigured ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>Détectée & Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            <span>Non détectée</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      L'application lit automatiquement la variable d'environnement{' '}
                      <code className="px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10 text-amber-600 dark:text-amber-400 font-mono text-[10px]">
                        import.meta.env.VITE_GEMINI_API_KEY
                      </code>{' '}
                      requise lors d'un déploiement statique sur Netlify ou GitHub Pages.
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Clé API personnalisée (sauvegardée localement) :
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="AIzaSy..."
                          className="flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveApiKey}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer"
                        >
                          Enregistrer
                        </button>
                      </div>
                      <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                        💡 Sur Netlify, ajoutez la variable <code className="text-amber-600 dark:text-amber-400 font-semibold font-mono">VITE_GEMINI_API_KEY</code> dans <em>Site configuration &gt; Environment variables</em>.
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-medium mb-1.5 flex items-center justify-between" style={{ color: 'var(--text-primary)' }}>
                      <span>Moteur d'intelligence et mode de réflexion</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">Haute intelligence ✨</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          id: 'balanced',
                          label: '✨ IA Optimisée',
                          desc: 'RYXIA Core v1 · Haute intelligence & réflexion équilibrée',
                        },
                        {
                          id: 'deep',
                          label: '🧠 Raisonnement Profond',
                          desc: 'RYXIA Deep Engine · Pensée interne poussée (Code/STEM)',
                        },
                        {
                          id: 'turbo',
                          label: '⚡ Turbo Flash',
                          desc: 'RYXIA Flash · Latence minimale sub-seconde',
                        },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSaveSettings({ speedMode: s.id as any })}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            (localSettings.speedMode || 'balanced') === s.id
                              ? 'border-amber-500/80 bg-amber-500/15 shadow-xs'
                              : 'hover:border-amber-500/30'
                          }`}
                          style={{
                            backgroundColor: (localSettings.speedMode || 'balanced') === s.id ? undefined : 'var(--bg-surface)',
                            borderColor: (localSettings.speedMode || 'balanced') === s.id ? undefined : 'var(--border-color)',
                          }}
                        >
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.label}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      Préférence d'acheminement
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'auto', label: 'Auto (Recommandé)', desc: 'RYXIA AI Native Engine ultra-rapide' },
                        { id: 'gemini', label: 'RYXIA AI Native Engine', desc: 'Priorité vitesse & latence 0' },
                        { id: 'openai', label: 'OpenAI Stricte', desc: 'GPT-5.6 Luna uniquement' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSaveSettings({ aiProvider: p.id as any })}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            localSettings.aiProvider === p.id
                              ? 'border-amber-500/70 bg-amber-500/15'
                              : 'hover:border-amber-500/30'
                          }`}
                          style={{
                            backgroundColor: localSettings.aiProvider === p.id ? undefined : 'var(--bg-surface)',
                            borderColor: localSettings.aiProvider === p.id ? undefined : 'var(--border-color)',
                          }}
                        >
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
                          <div className="text-[10px] opacity-75" style={{ color: 'var(--text-secondary)' }}>{p.desc}</div>
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
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Comportement du composeur</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Gérez le fonctionnement des raccourcis clavier.</p>

                <div className="space-y-4">
                  {/* Response Length Calibration */}
                  <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Longueur des réponses</div>
                    <div className="text-[11px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                      Calibrez le niveau de détail souhaité dans les réponses de RYXIA.
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          id: 'compact',
                          label: 'Courte',
                          desc: 'Brève & directe (1-2 phrases)',
                        },
                        {
                          id: 'balanced',
                          label: 'Moyenne (Idéal)',
                          desc: 'Équilibrée, ni trop courte ni trop longue',
                        },
                        {
                          id: 'detailed',
                          label: 'Détaillée',
                          desc: 'Explications riches et approfondies',
                        },
                      ].map((item) => {
                        const current = localSettings.responseLength || 'balanced';
                        const isSelected = current === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSaveSettings({ responseLength: item.id as any })}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'border-amber-500/70 bg-amber-500/15 shadow-xs'
                                : 'hover:border-amber-500/30'
                            }`}
                            style={{
                              backgroundColor: isSelected ? undefined : 'var(--bg-main)',
                              borderColor: isSelected ? undefined : 'var(--border-color)',
                            }}
                          >
                            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Touche Entrée pour envoyer</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Shift + Entrée pour insérer un saut de ligne</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enterSends}
                      onChange={(e) => handleSaveSettings({ enterSends: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Rendu Markdown riche</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Profil utilisateur</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Informations sur votre compte RYXIA.</p>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Nom / Pseudonyme</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-amber-500"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {user.email.startsWith('guest_') || user.email.includes('ryxia.local')
                        ? 'Identifiant du compte'
                        : 'Adresse email'}
                    </label>
                    <input
                      type="text"
                      value={
                        user.email.startsWith('guest_') || user.email.includes('ryxia.local')
                          ? 'Compte Invité RYXIA (invite@ryxia.app)'
                          : user.email
                      }
                      disabled
                      className="w-full px-3 py-2 text-sm border rounded-lg cursor-not-allowed opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-secondary)',
                      }}
                    />
                    {(user.email.startsWith('guest_') || user.email.includes('ryxia.local')) && (
                      <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
                        Vous utilisez une session libre et instantanée sans inscription.
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-xs"
                    >
                      Mettre à jour le nom
                    </button>
                  </div>
                </form>

                {stats && (
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Statistiques d'utilisation</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>Conversations créées</div>
                        <div className="text-lg font-bold font-mono mt-0.5 text-amber-600 dark:text-amber-400">{stats.totalConversations}</div>
                      </div>
                      <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>Messages échangés</div>
                        <div className="text-lg font-bold font-mono mt-0.5 text-amber-600 dark:text-amber-400">{stats.totalMessages}</div>
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
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Gestion des données</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Exportation et suppression de vos historiques.</p>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Supprimer tout l'historique</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Efface définitivement toutes vos conversations sur ce compte.</div>
                    </div>
                    {confirmClearAll ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClearAllConversations();
                            setConfirmClearAll(false);
                            setSavedMessage('Toutes les conversations ont été supprimées');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                        >
                          Confirmer la suppression
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(false)}
                          className="px-2.5 py-1.5 text-xs hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(true)}
                        className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Tout effacer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-5 text-sm">
              <div className="p-4 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-start gap-4">
                  <img
                    src="/src/assets/images/ryxia_logo_1791824246855.jpg"
                    alt="Logo RYXIA"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
                      RYXIA
                    </div>
                    <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 font-mono">
                      RYXIA — by Adan · Your AI. Your way.
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Plateforme d'intelligence artificielle avancée, conçue pour un usage professionnel, intellectuel et créatif sans artifice ni distraction.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t text-[11px] space-y-1 font-mono" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
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
