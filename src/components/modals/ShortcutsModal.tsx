import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      action: 'Nouvelle conversation',
      keys: [`${modKey}`, 'K'],
      description: 'Démarre immédiatement un nouveau fil de discussion',
    },
    {
      action: 'Fermer les fenêtres / modales',
      keys: ['Échap'],
      description: 'Ferme les paramètres, connexions ou dialogues ouverts',
    },
    {
      action: 'Afficher / Masquer la barre latérale',
      keys: [`${modKey}`, 'B'],
      description: 'Bascule l\'affichage du volet de navigation',
    },
    {
      action: 'Envoyer le message',
      keys: ['Entrée'],
      description: 'Transmet votre message à RYXIA',
    },
    {
      action: 'Saut de ligne',
      keys: ['Maj', 'Entrée'],
      description: 'Insère une nouvelle ligne sans envoyer',
    },
    {
      action: 'Aide des raccourcis clavier',
      keys: [`${modKey}`, '/'],
      description: 'Ouvre cette liste récapitulative des commandes',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10 transition-all border animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg tracking-tight">Raccourcis Clavier</h2>
              <p className="text-xs opacity-65">Commandes rapides pour naviguer dans RYXIA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors opacity-70 hover:opacity-100 flex items-center gap-1.5 text-xs font-mono"
            title="Fermer (Échap)"
          >
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px]">
              Échap
            </span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="py-4 space-y-3">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div>
                <div className="text-sm font-medium">{item.action}</div>
                <div className="text-xs opacity-60 mt-0.5">{item.description}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-1 rounded-md text-xs font-mono font-medium shadow-xs border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="pt-3 border-t flex items-center justify-between text-xs opacity-70"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span>Astuce : Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border text-[10px] font-mono">{modKey} + K</kbd> à tout moment.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};
