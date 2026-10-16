import { User, Conversation, Message, UserSettings, UserStats, RyxiaMode } from '../types/index.ts';
import {
  callGeminiApi,
  streamGeminiApi,
  safeParseHttpResponse,
  getGeminiApiKey,
  hasGeminiApiKey,
  GEMINI_API_KEY_ERROR_MESSAGE,
  type GeminiCallOptions,
  type GeminiStreamOptions,
  type GeminiContent,
  type GeminiMessagePart,
} from './gemini.ts';
import { RYXIA_MODES, RYXIA_FORMATTING_RULES } from './modes.ts';

const TOKEN_KEY = 'ryxia_auth_token';
const LOCAL_CONVERSATIONS_KEY = 'ryxia_local_conversations';
const LOCAL_MESSAGES_KEY_PREFIX = 'ryxia_local_msgs_';

export function getLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(convs));
  } catch {
    // Ignore
  }
}

export function getLocalMessages(convId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MESSAGES_KEY_PREFIX}${convId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMessages(convId: string, msgs: Message[]): void {
  try {
    localStorage.setItem(`${LOCAL_MESSAGES_KEY_PREFIX}${convId}`, JSON.stringify(msgs));
  } catch {
    // Ignore
  }
}

/**
 * Détecte si l'application s'exécute sur un hébergement statique sans backend Express
 * (ex: Netlify, GitHub Pages, Vercel SPA, Cloudflare Pages).
 */
export function isStaticOrClientOnlyEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.includes('netlify.app') ||
    host.includes('github.io') ||
    host.includes('pages.dev') ||
    host.includes('vercel.app') ||
    host.endsWith('.surge.sh')
  );
}

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

/**
 * Analyse sécurisée d'une réponse API pour éviter l'erreur "Unexpected end of JSON input"
 */
async function parseResponseJson<T = any>(res: Response, fallbackError = 'Erreur serveur'): Promise<T> {
  const text = await res.text();
  let data: any = null;

  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      // Pas de format JSON valide (ex: HTML 502/504 ou texte brut)
    }
  }

  if (!res.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      (text && text.trim() ? text.slice(0, 250) : `${fallbackError} (${res.status})`);
    throw new Error(errorMsg);
  }

  return (data !== null ? data : ({} as T));
}

/**
 * Détecte si une erreur HTTP ou un message d'erreur est temporaire et justifie un réessai (503, 429, etc.)
 */
export function isTemporaryRetryableError(status?: number, message?: string): boolean {
  if (status === 503 || status === 429 || status === 502 || status === 504) {
    return true;
  }
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('high demand') ||
    lower.includes('spikes in demand') ||
    lower.includes('temporairement indisponible') ||
    lower.includes('indisponible') ||
    lower.includes('unavailable') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error')
  );
}

/**
 * Attente asynchrone (sleep) respectant le signal d'annulation AbortSignal
 */
export async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Exécution directe côté client via l'API Google Gemini
 * Utilisée sur Netlify, GitHub Pages, ou quand le backend Express n'est pas déployé.
 * Lit import.meta.env.VITE_GEMINI_API_KEY et renvoie un message d'erreur clair si absente.
 */
export async function streamClientSideGeminiChat({
  conversationId,
  message,
  mode = 'general',
  groundingPreference,
  speedMode = 'balanced',
  latLng,
  attachment,
  attachments,
  clientTime,
  onInit,
  onChunk,
  onDone,
  onError,
  onRetry,
  signal,
}: {
  conversationId: string;
  message?: string;
  mode?: RyxiaMode;
  regenerate?: boolean;
  groundingPreference?: 'auto' | 'search' | 'maps' | 'none';
  speedMode?: 'turbo' | 'balanced' | 'deep';
  latLng?: { latitude: number; longitude: number };
  attachment?: import('../types/index.ts').FileAttachment;
  attachments?: import('../types/index.ts').FileAttachment[];
  clientTime?: import('../types/index.ts').ClientTimeInfo;
  onInit?: (data: { conversationId: string; title: string; mode: RyxiaMode }) => void;
  onChunk: (text: string) => void;
  onDone: (message: Message) => void;
  onError: (err: string) => void;
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; error: string }) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error('[streamClientSideGeminiChat] Clé API Gemini manquante (VITE_GEMINI_API_KEY non détectée).');
    onError(GEMINI_API_KEY_ERROR_MESSAGE);
    return;
  }

  const title = (message && message.trim()) ? (message.trim().slice(0, 30) + (message.length > 30 ? '...' : '')) : 'Discussion';
  onInit?.({ conversationId, title, mode });

  // 1. Récupération de l'historique local pour préserver le contexte de conversation multi-tours
  const previousMessages = getLocalMessages(conversationId);
  const contents: GeminiContent[] = [];

  for (const m of previousMessages.slice(-12)) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: m.content }] });
    }
  }

  // 2. Construction du message utilisateur avec pièces jointes / visuels
  const userParts: GeminiMessagePart[] = [];
  const allAttachments = (attachments && attachments.length > 0) ? attachments : (attachment ? [attachment] : []);
  for (const att of allAttachments) {
    if (att.base64Data && att.type) {
      userParts.push({
        inlineData: {
          mimeType: att.type,
          data: att.base64Data,
        },
      });
    } else if (att.textContent) {
      userParts.push({
        text: `[Document joint: ${att.name}]\n${att.textContent}\n`,
      });
    }
  }

  userParts.push({ text: message || '' });
  contents.push({ role: 'user', parts: userParts });

  // Enregistrer le message utilisateur localement
  if (message) {
    const userMsg: Message = {
      id: `msg_u_${Date.now()}`,
      conversationId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      model: 'user',
      attachment: attachment || (allAttachments[0] || undefined),
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
    };
    saveLocalMessages(conversationId, [...previousMessages, userMsg]);
  }

  // 3. Instruction système avec identité RYXIA (Adan, septembre 2026, pas de 2024, règles de calibrage)
  const now = new Date();
  const effectiveTime = clientTime || {
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

  const modeConfig = RYXIA_MODES[mode] || RYXIA_MODES.general;
  const systemInstruction = `${RYXIA_FORMATTING_RULES}

MODE ACTIF : ${modeConfig.name}
${modeConfig.systemPrompt}

Informations temporelles actuelles de l'utilisateur :
- Date : ${effectiveTime.dateString}
- Heure : ${effectiveTime.timeString}
- Fuseau horaire : ${effectiveTime.timeZone}`;

  try {
    const targetModel = 'gemini-2.5-flash';
    const fullText = await streamGeminiApi(contents, {
      model: targetModel,
      apiKey,
      systemInstruction,
      signal,
      onChunk,
      onRetry,
    });

    const assistantMsg: Message = {
      id: `msg_a_${Date.now()}`,
      conversationId,
      role: 'assistant',
      content: fullText,
      createdAt: new Date().toISOString(),
      model: 'RYXIA (Gemini Flash)',
    };

    const currentMsgs = getLocalMessages(conversationId);
    saveLocalMessages(conversationId, [...currentMsgs, assistantMsg]);

    onDone(assistantMsg);
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) return;
    const errorMsg = err?.message || 'Erreur lors de la communication avec Gemini.';
    onError(errorMsg);
  }
}

export const api = {
  auth: {
    async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await parseResponseJson<{ token: string; user: User }>(res, "Erreur lors de l'inscription");
      setStoredToken(data.token);
      return data;
    },

    async login(email: string, password: string): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseResponseJson<{ token: string; user: User }>(res, 'Erreur lors de la connexion');
      setStoredToken(data.token);
      return data;
    },

    async guest(): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await parseResponseJson<{ token: string; user: User }>(res, 'Erreur session invité');
      setStoredToken(data.token);
      return data;
    },

    async firebaseSync(payload: { uid: string; name?: string; email?: string; avatar?: string }): Promise<{ token: string; user: User }> {
      const res = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponseJson<{ token: string; user: User }>(res, 'Erreur synchronisation Firebase');
      if (data.token) setStoredToken(data.token);
      return data;
    },

    async me(): Promise<{ user: User; stats: UserStats; settings: UserSettings } | null> {
      const token = getStoredToken();
      if (!token) return null;
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (!res.ok) return null;
        return await parseResponseJson(res);
      } catch {
        return null;
      }
    },

    async updateProfile(updates: { name?: string; avatar?: string }): Promise<User> {
      const res = await fetchWithAuth('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const data = await parseResponseJson<{ user: User }>(res, 'Erreur mise à jour profil');
      return data.user;
    },

    logout() {
      clearStoredToken();
    },
  },

  conversations: {
    async list(): Promise<Conversation[]> {
      try {
        const res = await fetchWithAuth('/api/conversations');
        if (res.ok) {
          const data = await parseResponseJson<{ conversations: Conversation[] }>(res, 'Erreur chargement conversations');
          if (data && data.conversations) {
            saveLocalConversations(data.conversations);
            return data.conversations;
          }
        }
      } catch {
        // Fallback local storage en environnement Netlify / GitHub
      }
      return getLocalConversations();
    },

    async create(title?: string, mode: RyxiaMode = 'general'): Promise<Conversation> {
      try {
        const res = await fetchWithAuth('/api/conversations', {
          method: 'POST',
          body: JSON.stringify({ title, mode }),
        });
        if (res.ok) {
          const data = await parseResponseJson<{ conversation: Conversation }>(res, 'Erreur création conversation');
          if (data && data.conversation) {
            const current = getLocalConversations();
            saveLocalConversations([data.conversation, ...current]);
            return data.conversation;
          }
        }
      } catch {
        // Fallback local
      }

      // Création locale instantanée pour déploiement Netlify / GitHub
      const localConv: Conversation = {
        id: `conv_${Date.now()}`,
        userId: 'guest',
        title: title || 'Nouvelle discussion',
        mode: mode || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = getLocalConversations();
      saveLocalConversations([localConv, ...current]);
      return localConv;
    },

    async get(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
      try {
        const res = await fetchWithAuth(`/api/conversations/${id}`);
        if (res.ok) {
          return await parseResponseJson(res, 'Erreur récupération conversation');
        }
      } catch {
        // Fallback local
      }

      const all = getLocalConversations();
      const conv = all.find((c) => c.id === id) || {
        id,
        userId: 'guest',
        title: 'Discussion',
        mode: 'general' as RyxiaMode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const messages = getLocalMessages(id);
      return { conversation: conv, messages };
    },

    async update(id: string, updates: { title?: string; mode?: RyxiaMode }): Promise<Conversation> {
      try {
        const res = await fetchWithAuth(`/api/conversations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await parseResponseJson<{ conversation: Conversation }>(res, 'Erreur modification conversation');
          if (data && data.conversation) {
            return data.conversation;
          }
        }
      } catch {
        // Fallback local
      }

      const all = getLocalConversations();
      const index = all.findIndex((c) => c.id === id);
      if (index >= 0) {
        all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
        saveLocalConversations(all);
        return all[index];
      }
      return {
        id,
        userId: 'guest',
        title: updates.title || 'Discussion',
        mode: updates.mode || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },

    async delete(id: string): Promise<boolean> {
      try {
        await fetchWithAuth(`/api/conversations/${id}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore
      }
      const all = getLocalConversations().filter((c) => c.id !== id);
      saveLocalConversations(all);
      try {
        localStorage.removeItem(`${LOCAL_MESSAGES_KEY_PREFIX}${id}`);
      } catch {}
      return true;
    },

    async clearAll(): Promise<boolean> {
      try {
        await fetchWithAuth('/api/conversations', {
          method: 'DELETE',
        });
      } catch {
        // Ignore
      }
      saveLocalConversations([]);
      return true;
    },

    getExportUrl(id: string, format: 'markdown' | 'json' = 'markdown'): string {
      const token = getStoredToken();
      return `/api/conversations/${id}/export?format=${format}&token=${token || ''}`;
    },
  },

  settings: {
    async get(): Promise<UserSettings> {
      const res = await fetchWithAuth('/api/settings');
      const data = await parseResponseJson<{ settings: UserSettings }>(res, 'Erreur chargement paramètres');
      return data.settings;
    },

    async update(updates: Partial<UserSettings>): Promise<UserSettings> {
      const res = await fetchWithAuth('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const data = await parseResponseJson<{ settings: UserSettings }>(res, 'Erreur sauvegarde paramètres');
      return data.settings;
    },
  },

  stats: {
    async get(): Promise<UserStats> {
      const res = await fetchWithAuth('/api/stats');
      const data = await parseResponseJson<{ stats: UserStats }>(res, 'Erreur chargement statistiques');
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
      speedMode,
      latLng,
      attachment,
      attachments,
      clientTime,
      maxRetries = 3,
      initialDelayMs = 1000,
      backoffFactor = 2,
      maxDelayMs = 8000,
      onInit,
      onChunk,
      onDone,
      onError,
      onRetry,
      signal,
    }: {
      conversationId: string;
      message?: string;
      mode?: RyxiaMode;
      regenerate?: boolean;
      groundingPreference?: 'auto' | 'search' | 'maps' | 'none';
      speedMode?: 'turbo' | 'balanced' | 'deep';
      latLng?: { latitude: number; longitude: number };
      attachment?: import('../types/index.ts').FileAttachment;
      attachments?: import('../types/index.ts').FileAttachment[];
      clientTime?: import('../types/index.ts').ClientTimeInfo;
      maxRetries?: number;
      initialDelayMs?: number;
      backoffFactor?: number;
      maxDelayMs?: number;
      onInit?: (data: { conversationId: string; title: string; mode: RyxiaMode }) => void;
      onChunk: (text: string) => void;
      onDone: (message: Message) => void;
      onError: (err: string) => void;
      onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; error: string }) => void;
      signal?: AbortSignal;
    }) {
      // Détection automatique déploiement statique Netlify / GitHub Pages
      if (isStaticOrClientOnlyEnvironment()) {
        return await streamClientSideGeminiChat({
          conversationId,
          message,
          mode,
          regenerate,
          groundingPreference,
          speedMode,
          latLng,
          attachment,
          attachments,
          clientTime,
          onInit,
          onChunk,
          onDone,
          onError,
          onRetry,
          signal,
        });
      }

      let attempt = 0;
      let lastErrorMessage = '';
      let receivedAnyChunk = false;

      while (attempt <= maxRetries) {
        if (signal?.aborted) return;

        try {
          const token = getStoredToken();
          const now = new Date();
          const effectiveClientTime = clientTime || {
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

          const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              conversationId,
              message,
              mode,
              regenerate,
              groundingPreference,
              speedMode,
              latLng,
              attachment: attachment || (attachments && attachments.length > 0 ? attachments[0] : undefined),
              attachments: (attachments && attachments.length > 0) ? attachments : (attachment ? [attachment] : undefined),
              clientTime: effectiveClientTime,
            }),
            signal,
          });

          // Si la route /api/chat/stream n'existe pas (déploiement statique Netlify / GitHub sans SSR)
          if (
            response.status === 404 ||
            (response.headers.get('content-type') && response.headers.get('content-type')?.includes('text/html'))
          ) {
            console.warn(
              '[api.chat.stream] Endpoint serveur non trouvé (404/HTML). Bascule automatique vers le client direct Gemini (VITE_GEMINI_API_KEY)...'
            );
            return await streamClientSideGeminiChat({
              conversationId,
              message,
              mode,
              regenerate,
              groundingPreference,
              speedMode,
              latLng,
              attachment,
              attachments,
              clientTime,
              onInit,
              onChunk,
              onDone,
              onError,
              onRetry,
              signal,
            });
          }

          // 1. Vérification stricte de response.ok avec lecture textuelle protégée
          if (!response.ok) {
            let errorMsg = `Erreur serveur (${response.status})`;
            try {
              const rawErrText = await response.text();
              if (rawErrText.trim()) {
                try {
                  const parsed = JSON.parse(rawErrText);
                  errorMsg = parsed.error || parsed.message || errorMsg;
                } catch {
                  errorMsg += `: ${rawErrText.slice(0, 200)}`;
                }
              }
            } catch {
              // Lecture échouée
            }

            const canRetry = isTemporaryRetryableError(response.status, errorMsg);
            if (canRetry && attempt < maxRetries && !signal?.aborted) {
              const jitter = Math.floor(Math.random() * 350);
              const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
              console.warn(
                `[api.chat.stream] Erreur temporaire 503 (${response.status} - ${errorMsg}). Réessai avec backoff exponentiel ${attempt + 1}/${maxRetries} dans ${delay}ms...`
              );
              onRetry?.({ attempt: attempt + 1, maxRetries, delayMs: delay, error: errorMsg });
              await sleepWithAbort(delay, signal);
              attempt++;
              continue;
            }

            onError(errorMsg);
            return;
          }

          if (!response.body) {
            onError('Flux de données non disponible');
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let streamErrorOccurred = false;
          let streamErrorMessage = '';

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
                    receivedAnyChunk = true;
                    onChunk(data.text);
                  } else if (data.type === 'done') {
                    onDone(data.message);
                    return; // Succès complet
                  } else if (data.type === 'error') {
                    streamErrorOccurred = true;
                    streamErrorMessage = data.error || 'Erreur pendant le flux';
                  }
                } catch {
                  // Fragment JSON incomplet ou non parsable dans le flux : ignoré sans crash
                }
              }
            }

            if (streamErrorOccurred) break;
          }

          // Si le flux s'est interrompu avec un événement d'erreur SSE
          if (streamErrorOccurred) {
            const canRetry = isTemporaryRetryableError(503, streamErrorMessage);
            // On ne réessaie automatiquement que si aucun fragment de réponse n'a été émis
            if (canRetry && !receivedAnyChunk && attempt < maxRetries && !signal?.aborted) {
              const jitter = Math.floor(Math.random() * 350);
              const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
              console.warn(
                `[api.chat.stream] Événement d'erreur SSE 503/charge détecté (${streamErrorMessage}). Réessai ${attempt + 1}/${maxRetries} dans ${delay}ms...`
              );
              onRetry?.({ attempt: attempt + 1, maxRetries, delayMs: delay, error: streamErrorMessage });
              await sleepWithAbort(delay, signal);
              attempt++;
              continue;
            }

            onError(streamErrorMessage);
            return;
          }

          // Si le flux s'est fermé prématurément sans données ni erreur
          if (!receivedAnyChunk && attempt < maxRetries && !signal?.aborted) {
            const jitter = Math.floor(Math.random() * 350);
            const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
            console.warn(
              `[api.chat.stream] Flux interrompu sans chunk. Réessai ${attempt + 1}/${maxRetries} dans ${delay}ms...`
            );
            await sleepWithAbort(delay, signal);
            attempt++;
            continue;
          }

          return;
        } catch (err: any) {
          if (err.name === 'AbortError' || signal?.aborted) {
            return;
          }

          // Si le backend est injoignable (déploiement statique sans serveur), bascule automatique sur le client direct
          if (
            (err.message?.includes('Failed to fetch') ||
              err.message?.includes('NetworkError') ||
              err.name === 'TypeError') &&
            !receivedAnyChunk
          ) {
            console.warn(
              '[api.chat.stream] Serveur backend injoignable. Bascule automatique vers le client direct Gemini (VITE_GEMINI_API_KEY)...'
            );
            try {
              return await streamClientSideGeminiChat({
                conversationId,
                message,
                mode,
                regenerate,
                groundingPreference,
                speedMode,
                latLng,
                attachment,
                attachments,
                clientTime,
                onInit,
                onChunk,
                onDone,
                onError,
                onRetry,
                signal,
              });
            } catch {
              // Si le repli direct a aussi rencontré une erreur, continuer
            }
          }

          lastErrorMessage = err?.message || 'Erreur de connexion au serveur RYXIA.';
          const canRetry = isTemporaryRetryableError(undefined, lastErrorMessage);

          if (canRetry && !receivedAnyChunk && attempt < maxRetries && !signal?.aborted) {
            const jitter = Math.floor(Math.random() * 350);
            const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
            console.warn(
              `[api.chat.stream] Exception réseau/503 (${lastErrorMessage}). Réessai exponentiel ${attempt + 1}/${maxRetries} dans ${delay}ms...`
            );
            onRetry?.({ attempt: attempt + 1, maxRetries, delayMs: delay, error: lastErrorMessage });
            try {
              await sleepWithAbort(delay, signal);
            } catch (abortErr: any) {
              if (abortErr.name === 'AbortError' || signal?.aborted) return;
            }
            attempt++;
            continue;
          }

          onError(lastErrorMessage);
          return;
        }
      }

      if (lastErrorMessage) {
        onError(lastErrorMessage);
      }
    },
  },

  /**
   * Intégration directe Gemini (Client-side)
   */
  gemini: {
    call: callGeminiApi,
    stream: streamGeminiApi,
    getApiKey: getGeminiApiKey,
    safeParse: safeParseHttpResponse,
  },

  images: {
    async generate(params: {
      prompt: string;
      aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
      conversationId?: string;
    }): Promise<{ success: boolean; image: { imageUrl: string; mimeType: string; prompt: string; model: string; text?: string } }> {
      const res = await fetchWithAuth('/api/images/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return await parseResponseJson(res, "Erreur lors de la génération de l'image");
    },

    async edit(params: {
      prompt: string;
      imageBase64: string;
      mimeType?: string;
      aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
      conversationId?: string;
    }): Promise<{ success: boolean; image: { imageUrl: string; mimeType: string; prompt: string; model: string; text?: string } }> {
      const res = await fetchWithAuth('/api/images/edit', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return await parseResponseJson(res, "Erreur lors de la modification de l'image");
    },
  },

  audio: {
    async transcribe(params: { audioBase64: string; mimeType?: string }): Promise<string> {
      const res = await fetchWithAuth('/api/audio/transcribe', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const data = await parseResponseJson<{ text?: string }>(res, "Erreur lors de la transcription audio");
      return data.text || '';
    },
  },

  science: {
    async getProtein(id: string) {
      const res = await fetchWithAuth(`/api/science/protein/${encodeURIComponent(id)}`);
      return await parseResponseJson(res, 'Protéine introuvable');
    },
    async getChemical(query: string) {
      const res = await fetchWithAuth(`/api/science/chemical/${encodeURIComponent(query)}`);
      return await parseResponseJson(res, 'Composé introuvable');
    },
    async getLiterature(query: string) {
      const res = await fetchWithAuth(`/api/science/literature/${encodeURIComponent(query)}`);
      const data = await parseResponseJson<{ results: any[] }>(res, 'Erreur recherche');
      return data.results || [];
    },
  },
};

// Exports utilitaires
export {
  callGeminiApi,
  streamGeminiApi,
  safeParseHttpResponse,
  getGeminiApiKey,
  type GeminiCallOptions,
  type GeminiStreamOptions,
  type GeminiContent,
};
