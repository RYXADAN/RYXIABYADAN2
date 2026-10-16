/**
 * Service client pour l'API Google Gemini
 * 
 * Garantit :
 * 1. Vérification stricte de `response.ok` avant tout parsing JSON.
 * 2. Gestion sécurisée du texte brut (`response.text()`) et du streaming pour empêcher les erreurs "Unexpected end of JSON input".
 * 3. Utilisation propre de la variable d'environnement `import.meta.env.VITE_GEMINI_API_KEY`.
 */

export interface GeminiMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContent {
  role?: 'user' | 'model' | 'system';
  parts: GeminiMessagePart[];
}

export interface GeminiCallOptions {
  model?: string;
  apiKey?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface GeminiStreamOptions extends GeminiCallOptions {
  onChunk: (textChunk: string) => void;
  onFullText?: (fullText: string) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; error: string }) => void;
}

/**
 * Message d'erreur clair et sécurisé affiché si aucune clé API n'est détectée
 */
export const GEMINI_API_KEY_ERROR_MESSAGE = `⚠️ **Clé API Gemini non détectée** (\`import.meta.env.VITE_GEMINI_API_KEY\`)

Pour faire fonctionner l'envoi de messages sur **Netlify** et **GitHub** :

1. **Sur Netlify** :
   - Rendez-vous sur votre dashboard Netlify > votre site.
   - Cliquez sur **Site configuration** > **Environment variables**.
   - Cliquez sur **Add a variable** et configurez :
     - **Key** : \`VITE_GEMINI_API_KEY\`
     - **Value** : votre clé API Google Gemini (ex: \`AIzaSy...\`)
   - Déclenchez un nouveau déploiement (**Deploys** > **Trigger deploy** > **Clear cache and deploy site**).

2. **En local ou GitHub Actions** :
   - Ajoutez la ligne suivante dans votre fichier \`.env\` :
     \`\`\`env
     VITE_GEMINI_API_KEY=AIzaSy...
     \`\`\`

3. **Alternative immédiate** :
   - Vous pouvez également ouvrir les **Paramètres (icône roue)** > **Moteur IA** et saisir votre clé pour tester immédiatement sans redéployer.`;

/**
 * Récupère la clé d'API Gemini depuis la variable d'environnement Vite/Netlify
 * import.meta.env.VITE_GEMINI_API_KEY avec fallbacks sécurisés.
 */
export function getGeminiApiKey(customKey?: string): string {
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }

  // 1. Variable d'environnement Vite / Netlify standard : import.meta.env.VITE_GEMINI_API_KEY
  try {
    const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) {
      return viteKey.trim();
    }
  } catch {
    // Ignore error if import.meta.env is undefined
  }

  // 2. Fallbacks éventuels dans import.meta.env
  try {
    const envObj = (import.meta as any).env;
    if (envObj) {
      if (typeof envObj.VITE_GEMINI_API_KEY === 'string' && envObj.VITE_GEMINI_API_KEY.trim().length > 0) {
        return envObj.VITE_GEMINI_API_KEY.trim();
      }
      if (typeof envObj.GEMINI_API_KEY === 'string' && envObj.GEMINI_API_KEY.trim().length > 0) {
        return envObj.GEMINI_API_KEY.trim();
      }
    }
  } catch {
    // Ignore
  }

  // 3. Fallback dans le localStorage (ex: configuré dans l'interface ou pour test immédiat)
  if (typeof localStorage !== 'undefined') {
    try {
      const storedKey =
        localStorage.getItem('VITE_GEMINI_API_KEY') ||
        localStorage.getItem('ryxia_gemini_api_key') ||
        localStorage.getItem('gemini_api_key');
      if (storedKey && storedKey.trim().length > 0) {
        return storedKey.trim();
      }
    } catch {
      // Ignore
    }
  }

  // 4. Fallback process.env si injecté
  if (typeof process !== 'undefined' && process.env) {
    const procKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (procKey && typeof procKey === 'string' && procKey.trim().length > 0) {
      return procKey.trim();
    }
  }

  return '';
}

/**
 * Vérifie si une clé API Gemini valide est disponible
 */
export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

/**
 * Enregistre une clé API manuelle dans le localStorage
 */
export function setCustomGeminiApiKey(key: string): void {
  if (typeof localStorage === 'undefined') return;
  if (!key || !key.trim()) {
    localStorage.removeItem('ryxia_gemini_api_key');
    localStorage.removeItem('VITE_GEMINI_API_KEY');
  } else {
    localStorage.setItem('ryxia_gemini_api_key', key.trim());
    localStorage.setItem('VITE_GEMINI_API_KEY', key.trim());
  }
}

/**
 * Supprime la clé API manuelle du localStorage
 */
export function removeCustomGeminiApiKey(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('ryxia_gemini_api_key');
  localStorage.removeItem('VITE_GEMINI_API_KEY');
}

/**
 * Analyse de façon ultra-sécurisée une réponse HTTP pour éviter tout crash
 * "Unexpected end of JSON input"
 */
export async function safeParseHttpResponse<T = any>(response: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
  error?: string;
}> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (readErr: any) {
    return {
      ok: false,
      status: response.status,
      data: null,
      rawText: '',
      error: `Impossible de lire le corps de la réponse: ${readErr?.message || 'Erreur inconnue'}`,
    };
  }

  // Si la réponse n'est pas OK (4xx, 5xx), extraire l'erreur sans planter
  if (!response.ok) {
    let errorMessage = `Erreur HTTP ${response.status} (${response.statusText || 'Échec'})`;
    if (rawText.trim()) {
      try {
        const jsonError = JSON.parse(rawText);
        if (jsonError.error?.message) {
          errorMessage = jsonError.error.message;
        } else if (typeof jsonError.error === 'string') {
          errorMessage = jsonError.error;
        } else if (jsonError.message) {
          errorMessage = jsonError.message;
        }
      } catch {
        // Le corps d'erreur est du texte brut ou HTML (ex: 502 Bad Gateway)
        const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanSnippet) {
          errorMessage += `: ${cleanSnippet.slice(0, 200)}`;
        }
      }
    }
    return {
      ok: false,
      status: response.status,
      data: null,
      rawText,
      error: errorMessage,
    };
  }

  // Si le corps est vide (ex: status 204 ou réponse vide du serveur)
  if (!rawText || !rawText.trim()) {
    return {
      ok: true,
      status: response.status,
      data: null,
      rawText: '',
    };
  }

  // Tentative de parsing JSON sécurisé
  try {
    const data = JSON.parse(rawText) as T;
    return {
      ok: true,
      status: response.status,
      data,
      rawText,
    };
  } catch (parseErr: any) {
    return {
      ok: false,
      status: response.status,
      data: null,
      rawText,
      error: `Réponse reçue non-JSON ou JSON incomplet: ${rawText.slice(0, 150)}...`,
    };
  }
}

/**
 * Extrait le texte d'un objet de réponse Gemini standard
 */
export function extractGeminiText(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data;

  const candidates = data.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0]?.content?.parts || [];
    return parts.map((p: any) => p.text || '').join('');
  }

  return '';
}

/**
 * Fonction d'appel direct à l'API Google Gemini (Mode synchrone / standard)
 * 
 * - Vérifie `response.ok` avant de parser
 * - Lit le texte brut avec `response.text()` pour prévenir "Unexpected end of JSON input"
 * - Utilise `import.meta.env.VITE_GEMINI_API_KEY`
 */
export async function callGeminiApi(
  promptOrContents: string | GeminiContent[],
  options: GeminiCallOptions = {}
): Promise<{ text: string; rawResponse: any }> {
  const apiKey = getGeminiApiKey(options.apiKey);
  if (!apiKey) {
    throw new Error(GEMINI_API_KEY_ERROR_MESSAGE);
  }

  const model = options.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Construction du corps de requête
  const contents: GeminiContent[] =
    typeof promptOrContents === 'string'
      ? [{ role: 'user', parts: [{ text: promptOrContents }] }]
      : promptOrContents;

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens,
    },
  };

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });
  } catch (networkErr: any) {
    if (networkErr.name === 'AbortError') {
      throw networkErr;
    }
    throw new Error(`Échec de connexion réseau vers Gemini: ${networkErr.message || 'Réseau inaccessible'}`);
  }

  // 1. Sécurité : Parsing robuste et vérification de response.ok
  const parsed = await safeParseHttpResponse(response);

  if (!parsed.ok) {
    throw new Error(parsed.error || `Erreur Gemini (${parsed.status})`);
  }

  if (!parsed.data) {
    throw new Error("L'API Gemini a renvoyé une réponse vide (aucun contenu JSON).");
  }

  const text = extractGeminiText(parsed.data);
  return {
    text,
    rawResponse: parsed.data,
  };
}

/**
 * Fonction d'appel à l'API Google Gemini en streaming sécurisé
 * 
 * - Vérifie `response.ok` avant de lire le flux
 * - Traite les fragments SSE sans planter sur du JSON partiel
 * - Utilise `import.meta.env.VITE_GEMINI_API_KEY`
 */
export async function streamGeminiApi(
  promptOrContents: string | GeminiContent[],
  options: GeminiStreamOptions
): Promise<string> {
  const apiKey = getGeminiApiKey(options.apiKey);
  if (!apiKey) {
    const err = new Error(GEMINI_API_KEY_ERROR_MESSAGE);
    if (options.onError) options.onError(err);
    throw err;
  }

  const model = options.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const contents: GeminiContent[] =
    typeof promptOrContents === 'string'
      ? [{ role: 'user', parts: [{ text: promptOrContents }] }]
      : promptOrContents;

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens,
    },
  };

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const backoffFactor = options.backoffFactor ?? 2;
  const maxDelayMs = 8000;

  let attempt = 0;
  let response!: Response;

  while (attempt <= maxRetries) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });
    } catch (networkErr: any) {
      if (networkErr.name === 'AbortError' || options.signal?.aborted) throw networkErr;
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
        console.warn(`[streamGeminiApi] Erreur réseau, réessai ${attempt + 1}/${maxRetries} dans ${delay}ms...`);
        options.onRetry?.({ attempt: attempt + 1, maxRetries, delayMs: delay, error: networkErr.message || 'Réseau' });
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }
      const err = new Error(`Échec de connexion réseau: ${networkErr.message || 'Inaccessible'}`);
      if (options.onError) options.onError(err);
      throw err;
    }

    // 1. Vérification stricte de response.ok avant d'essayer de lire le flux
    if (!response.ok) {
      let errorDetail = `Erreur Gemini Stream (${response.status})`;
      try {
        const rawError = await response.text();
        if (rawError.trim()) {
          try {
            const jsonErr = JSON.parse(rawError);
            errorDetail = jsonErr.error?.message || jsonErr.message || errorDetail;
          } catch {
            errorDetail += `: ${rawError.slice(0, 200)}`;
          }
        }
      } catch {
        // Ignore read error
      }

      const isUnavailable = response.status === 503 ||
                            response.status === 429 ||
                            response.status === 502 ||
                            response.status === 504 ||
                            errorDetail.includes('503') ||
                            errorDetail.includes('high demand') ||
                            errorDetail.includes('UNAVAILABLE') ||
                            errorDetail.includes('RESOURCE_EXHAUSTED');

      if (isUnavailable && attempt < maxRetries && !options.signal?.aborted) {
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt) + jitter, maxDelayMs);
        console.warn(
          `[streamGeminiApi] Erreur 503/charge temporaire (${response.status}: ${errorDetail}). Réessai exponentiel ${attempt + 1}/${maxRetries} dans ${delay}ms...`
        );
        options.onRetry?.({ attempt: attempt + 1, maxRetries, delayMs: delay, error: errorDetail });
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      const err = new Error(errorDetail);
      if (options.onError) options.onError(err);
      throw err;
    }

    break;
  }

  if (!response || !response.body) {
    const err = new Error('Flux de réponse non disponible dans le corps HTTP.');
    if (options.onError) options.onError(err);
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullAccumulatedText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Conserver le dernier segment incomplet dans le buffer
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) continue; // Ignorer les commentaires ou lignes vides

        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsedChunk = JSON.parse(jsonStr);
            const chunkText = extractGeminiText(parsedChunk);
            if (chunkText) {
              fullAccumulatedText += chunkText;
              options.onChunk(chunkText);
            }
          } catch {
            // Fragment JSON incomplet ou malformé : ignorer sans planter l'application
          }
        }
      }
    }

    // Traitement du reliquat éventuel dans le buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const jsonStr = buffer.trim().slice(6).trim();
        if (jsonStr !== '[DONE]') {
          const parsedChunk = JSON.parse(jsonStr);
          const chunkText = extractGeminiText(parsedChunk);
          if (chunkText) {
            fullAccumulatedText += chunkText;
            options.onChunk(chunkText);
          }
        }
      } catch {
        // Ignorer silencieusement
      }
    }

    if (options.onFullText) {
      options.onFullText(fullAccumulatedText);
    }

    return fullAccumulatedText;
  } catch (streamErr: any) {
    if (streamErr.name === 'AbortError') {
      return fullAccumulatedText;
    }
    if (options.onError) {
      options.onError(streamErr);
    }
    throw streamErr;
  }
}

/**
 * Alias pratiques pour une intégration directe
 */
export const sendGeminiMessage = callGeminiApi;
export const streamGeminiMessage = streamGeminiApi;
