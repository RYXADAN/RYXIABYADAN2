import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { signInWithGoogle } from '../../lib/firebase.ts';
import { User } from '../../types/index.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const fbUser = await signInWithGoogle();
      const syncResult = await api.auth.firebaseSync({
        uid: fbUser.id,
        name: fbUser.name,
        email: fbUser.email,
        avatar: fbUser.avatar,
      });
      onSuccess(syncResult.user);
      onClose();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // If popup closed by user or popup blocked
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Fenêtre de connexion Google fermée.');
      } else {
        setError(err.message || 'Échec de la connexion avec Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Veuillez renseigner votre nom.');
        if (!email.trim()) throw new Error('Veuillez renseigner votre adresse email.');
        if (password.length < 6) throw new Error('Le mot de passe doit comporter au moins 6 caractères.');

        const result = await api.auth.register(name, email, password);
        onSuccess(result.user);
        onClose();
      } else {
        if (!email.trim() || !password) throw new Error('Veuillez remplir tous les champs.');
        const result = await api.auth.login(email, password);
        onSuccess(result.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl p-6 transition-all"
        style={{
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 opacity-70 hover:opacity-100 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-xs font-mono"
          aria-label="Fermer"
          title="Fermer (Échap)"
        >
          <span className="hidden sm:inline-block px-1 py-0.2 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px]">Échap</span>
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-display font-bold text-2xl tracking-tight">RYXIA</span>
            <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              by Adan
            </span>
          </div>
          <div className="text-xs opacity-60">
            {mode === 'login' ? 'Connexion sécurisée avec Firebase' : 'Créer un compte RYXIA'}
          </div>
        </div>

        {/* Google Sign-in Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border font-medium text-sm transition-all hover:bg-[var(--bg-surface-hover)] shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
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
        </div>

        {/* Divider */}
        <div className="flex items-center my-4 opacity-40">
          <div className="flex-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
          <span className="px-3 text-[11px] uppercase tracking-wider">ou</span>
          <div className="flex-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
        </div>

        {/* Tab switch */}
        <div
          className="flex rounded-xl p-1 mb-5"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'shadow-xs'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: mode === 'login' ? 'var(--bg-main)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'register'
                ? 'shadow-xs'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: mode === 'register' ? 'var(--bg-main)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            Créer un compte
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">
                Nom complet
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 opacity-40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Adan Martin"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 opacity-40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@exemple.com"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 opacity-40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Connexion' : 'Finaliser mon inscription'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
