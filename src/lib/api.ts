import { User, Conversation, Message, UserSettings, UserStats, RyxiaMode } from '../types/index.ts';

const TOKEN_KEY = 'ryxia_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearStoredToken();
  }

  return res;
}

export const api = {
  auth: {
    async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');
      setStoredToken(data.token);
      return data;
    },

    async login(email: string, password: string): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la connexion');
      setStoredToken(data.token);
      return data;
    },

    async guest(): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur session invité');
      setStoredToken(data.token);
      return data;
    },

    async firebaseSync(payload: { uid: string; name?: string; email?: string; avatar?: string }): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur synchronisation Firebase');
      if (data.token) setStoredToken(data.token);
      return data;
    },

    async me(): Promise<{ user: User; stats: UserStats; settings: UserSettings } | null> {
      const token = getStoredToken();
      if (!token) return null;
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },

    async updateProfile(updates: { name?: string; avatar?: string }): Promise<User> {
      const res = await fetchWithAuth('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur mise à jour profil');
      return data.user;
    },

    logout() {
      clearStoredToken();
    },
  },

  conversations: {
    async list(): Promise<Conversation[]> {
      const res = await fetchWithAuth('/api/conversations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement conversations');
      return data.conversations || [];
    },

    async create(title?: string, mode: RyxiaMode = 'general'): Promise<Conversation> {
      const res = await fetchWithAuth('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création conversation');
      return data.conversation;
    },

    async get(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
      const res = await fetchWithAuth(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur récupération conversation');
      return data;
    },

    async update(id: string, updates: { title?: string; mode?: RyxiaMode }): Promise<Conversation> {
      const res = await fetchWithAuth(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur modification conversation');
      return data.conversation;
    },

    async delete(id: string): Promise<boolean> {
      const res = await fetchWithAuth(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    },

    async clearAll(): Promise<boolean> {
      const res = await fetchWithAuth('/api/conversations', {
        method: 'DELETE',
      });
      return res.ok;
    },

    getExportUrl(id: string, format: 'markdown' | 'json' = 'markdown'): string {
      const token = getStoredToken();
      return `/api/conversations/${id}/export?format=${format}&token=${token || ''}`;
    },
  },

  settings: {
    async get(): Promise<UserSettings> {
      const res = await fetchWithAuth('/api/settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement paramètres');
      return data.settings;
    },

    async update(updates: Partial<UserSettings>): Promise<UserSettings> {
      const res = await fetchWithAuth('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde paramètres');
      return data.settings;
    },
  },

  stats: {
    async get(): Promise<UserStats> {
      const res = await fetchWithAuth('/api/stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement statistiques');
      return data.stats;
    },
  },

  chat: {
    async stream({
      conversationId,
      message,
      mode,
      regenerate,
      groundingPreference,
      latLng,
      onInit,
      onChunk,
      onDone,
      onError,
      signal,
    }: {
      conversationId: string;
      message?: string;
      mode?: RyxiaMode;
      regenerate?: boolean;
      groundingPreference?: 'auto' | 'search' | 'maps' | 'none';
      latLng?: { latitude: number; longitude: number };
      onInit?: (data: { conversationId: string; title: string; mode: RyxiaMode }) => void;
      onChunk: (text: string) => void;
      onDone: (message: Message) => void;
      onError: (err: string) => void;
      signal?: AbortSignal;
    }) {
      const token = getStoredToken();
      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ conversationId, message, mode, regenerate, groundingPreference, latLng }),
          signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          onError(errData.error || `Erreur serveur (${response.status})`);
          return;
        }

        if (!response.body) {
          onError('Flux de données non disponible');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'init' && onInit) {
                  onInit(data);
                } else if (data.type === 'chunk') {
                  onChunk(data.text);
                } else if (data.type === 'done') {
                  onDone(data.message);
                } else if (data.type === 'error') {
                  onError(data.error);
                }
              } catch {
                // ignore parsing error for chunk
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Normal abort requested by user
          return;
        }
        onError(err.message || 'Erreur de connexion au serveur RYXIA.');
      }
    },
  },
};
