import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { RYXIA_MODES } from '../../src/lib/modes.ts';
import { RyxiaMode, GroundingSource } from '../../src/types/index.ts';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, modelName: string, sources?: GroundingSource[]) => void;
  onError: (err: any) => void;
}

export interface StreamChatOptions {
  mode: RyxiaMode;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  customApiKey?: string;
  customModel?: string;
  providerPreference?: 'auto' | 'openai' | 'gemini';
  groundingPreference?: 'auto' | 'search' | 'maps' | 'none';
  latLng?: { latitude: number; longitude: number };
  signal?: AbortSignal;
}

export class AiEngine {
  public async streamChat(
    options: StreamChatOptions,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const {
      mode,
      messages,
      customApiKey,
      customModel,
      providerPreference = 'auto',
      groundingPreference = 'auto',
      latLng,
      signal,
    } = options;
    const modeConfig = RYXIA_MODES[mode] || RYXIA_MODES.general;
    const systemPrompt = modeConfig.systemPrompt;

    const openAiKey = customApiKey || process.env.OPENAI_API_KEY;
    const openAiModel = customModel || process.env.OPENAI_MODEL || 'gpt-5.6-luna';

    // 1. Try OpenAI if explicitly chosen
    const tryOpenAi = providerPreference === 'openai';
    if (tryOpenAi && openAiKey) {
      try {
        await this.streamOpenAi(openAiKey, openAiModel, systemPrompt, messages, callbacks, signal);
        return;
      } catch (err: any) {
        console.warn('OpenAI stream failed:', err.message);
        callbacks.onError(err);
        return;
      }
    }

    // 2. High-Availability Server AI Engine with Gemini Models:
    // - gemini-3.1-pro-preview for particularly complex tasks
    // - gemini-3.5-flash for general tasks
    // - gemini-3.1-flash-lite for tasks that should happen fast
    try {
      await this.streamGeminiResilient({
        mode,
        customModel,
        systemPrompt,
        messages,
        groundingPreference,
        latLng,
        callbacks,
        signal,
      });
    } catch (err: any) {
      console.error('All AI streaming attempts failed:', err.message || err);
      // Fallback message so the user gets a helpful actionable response
      const fallbackNotice = 'Les serveurs de traitement sont temporairement occupés. Votre message a été enregistré.';
      callbacks.onChunk(fallbackNotice);
      callbacks.onDone(fallbackNotice, 'RYXIA (Secours)');
    }
  }

  private async streamOpenAi(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `OpenAI API returned status ${res.status}`);
    }

    if (!res.body) {
      throw new Error('No response stream body returned from OpenAI');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';

    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullResponse += delta;
              callbacks.onChunk(delta);
            }
          } catch {
            // ignore non-json chunk
          }
        }
      }
    }

    callbacks.onDone(fullResponse, `OpenAI ${model}`);
  }

  private detectGroundingType(
    lastUserMessage: string,
    preference: 'auto' | 'search' | 'maps' | 'none'
  ): 'search' | 'maps' | 'none' {
    if (preference === 'none') return 'none';
    if (preference === 'maps') return 'maps';
    if (preference === 'search') return 'search';

    const text = lastUserMessage.toLowerCase();

    // Check for maps/places/geography queries
    const mapKeywords = [
      'où se trouve', 'ou se trouve', 'restaurant', 'café', 'cafe', 'bar', 'hôtel', 'hotel',
      'itinéraire', 'itineraire', 'route', 'direction', 'adresse', 'localisation', 'carte',
      'maps', 'proche', 'près de', 'pres de', 'à côté', 'a cote', 'distance', 'quartier',
      'ville', 'pays', 'monument', 'musée', 'musee', 'gare', 'aéroport', 'aeroport', 'nearby',
      'place', 'where is', 'address', 'directions to', 'located in'
    ];
    if (mapKeywords.some(kw => text.includes(kw))) {
      return 'maps';
    }

    // Check for explicit web search intent keywords
    const searchKeywords = [
      'recherche sur le web', 'cherche sur google', 'actualité', 'actualite', 'aujourd\'hui',
      'dernières nouvelles', 'dernieres nouvelles', 'météo', 'meteo', 'qui a gagné',
      'score de', 'prix actuel', 'cours de la bourse', 'breaking news', 'search web'
    ];
    if (searchKeywords.some(kw => text.includes(kw))) {
      return 'search';
    }

    // Default to none in auto mode to conserve API quotas and ensure fast responses
    return 'none';
  }

  private selectModelForTask(
    mode: RyxiaMode,
    customModel?: string,
    lastUserMessage?: string
  ): { targetModel: string; candidates: string[] } {
    // 1. Check if user selected specific custom model
    if (customModel && ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(customModel)) {
      if (customModel === 'gemini-3.1-pro-preview') {
        return { targetModel: 'gemini-3.1-pro-preview', candidates: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'] };
      }
      if (customModel === 'gemini-3.1-flash-lite') {
        return { targetModel: 'gemini-3.1-flash-lite', candidates: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'] };
      }
      return { targetModel: 'gemini-3.5-flash', candidates: ['gemini-3.5-flash', 'gemini-3.1-flash-lite'] };
    }

    // 2. Check for fast tasks (gemini-3.1-flash-lite)
    if (mode === 'fast') {
      return {
        targetModel: 'gemini-3.1-flash-lite',
        candidates: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
      };
    }

    // 3. Check for particularly complex tasks (gemini-3.1-pro-preview)
    // Code mode, or complex algorithmic / architectural queries
    const text = (lastUserMessage || '').toLowerCase();
    const isComplex = mode === 'code' ||
      text.includes('architecture') ||
      text.includes('algorithme') ||
      text.includes('démonstration') ||
      text.includes('démontre') ||
      text.includes('complexe') ||
      text.includes('refactor');

    if (isComplex) {
      return {
        targetModel: 'gemini-3.1-pro-preview',
        candidates: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
      };
    }

    // 4. General tasks (gemini-3.5-flash)
    return {
      targetModel: 'gemini-3.5-flash',
      candidates: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
    };
  }

  private async streamGeminiResilient(params: {
    mode: RyxiaMode;
    customModel?: string;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    groundingPreference: 'auto' | 'search' | 'maps' | 'none';
    latLng?: { latitude: number; longitude: number };
    callbacks: StreamCallbacks;
    signal?: AbortSignal;
  }): Promise<void> {
    const { mode, customModel, systemPrompt, messages, groundingPreference, latLng, callbacks, signal } = params;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Aucune clé API configurée pour RYXIA.');
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const groundingType = this.detectGroundingType(lastUserMsg, groundingPreference);

    // Format conversation history for multi-turn chat in Gemini
    const contents: any[] = [];
    for (const msg of messages) {
      if (msg.content && msg.content.trim()) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Bonjour' }] });
    }

    // Attempt Grounding if requested with gemini-3.5-flash
    if (groundingType !== 'none') {
      try {
        let tools: any[] | undefined = undefined;
        let toolConfig: any = undefined;

        if (groundingType === 'maps') {
          tools = [{ googleMaps: {} }];
          if (latLng) {
            toolConfig = {
              retrievalConfig: {
                latLng: {
                  latitude: latLng.latitude,
                  longitude: latLng.longitude,
                },
              },
            };
          }
        } else {
          tools = [{ googleSearch: {} }];
        }

        const streamResult = await client.models.generateContentStream({
          model: 'gemini-3.5-flash',
          contents,
          config: {
            systemInstruction: systemPrompt,
            ...(tools ? { tools } : {}),
            ...(toolConfig ? { toolConfig } : {}),
          },
        });

        let fullResponse = '';
        const rawGroundingChunks: any[] = [];

        for await (const chunk of streamResult) {
          if (signal?.aborted) break;

          const text = chunk.text;
          if (text) {
            fullResponse += text;
            callbacks.onChunk(text);
          }

          const candidate = chunk.candidates?.[0];
          if (candidate?.groundingMetadata?.groundingChunks) {
            rawGroundingChunks.push(...candidate.groundingMetadata.groundingChunks);
          }
        }

        if (fullResponse) {
          const sources: GroundingSource[] = [];
          const seenUrls = new Set<string>();

          for (const item of rawGroundingChunks) {
            if (item.web && item.web.uri && !seenUrls.has(item.web.uri)) {
              seenUrls.add(item.web.uri);
              sources.push({
                title: item.web.title || 'Source Web',
                url: item.web.uri,
                type: 'search',
              });
            }
            if (item.maps && item.maps.uri && !seenUrls.has(item.maps.uri)) {
              seenUrls.add(item.maps.uri);
              sources.push({
                title: item.maps.title || 'Lieu Google Maps',
                url: item.maps.uri,
                type: 'maps',
              });
            }
          }

          const modelDisplayName = groundingType === 'maps'
            ? 'RYXIA (Google Maps Grounding · gemini-3.5-flash)'
            : 'RYXIA (Google Search Grounding · gemini-3.5-flash)';

          callbacks.onDone(fullResponse, modelDisplayName, sources.length > 0 ? sources : undefined);
          return;
        }
      } catch {
        // Grounding failed or quota exceeded, proceed cleanly to core Gemini models
      }
    }

    // Select model according to feature requirements:
    // - gemini-3.1-pro-preview for particularly complex tasks
    // - gemini-3.5-flash for general tasks
    // - gemini-3.1-flash-lite for tasks that should happen fast
    const { candidates } = this.selectModelForTask(mode, customModel, lastUserMsg);
    let lastError: any = null;

    for (const model of candidates) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) return;
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          const fallbackStream = await client.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: systemPrompt,
            },
          });

          let fullResponse = '';
          for await (const chunk of fallbackStream) {
            if (signal?.aborted) break;
            const text = chunk.text;
            if (text) {
              fullResponse += text;
              callbacks.onChunk(text);
            }
          }

          if (fullResponse || !signal?.aborted) {
            callbacks.onDone(fullResponse, `RYXIA (${model})`);
            return;
          }
        } catch (err: any) {
          lastError = err;
          if (err.message && err.message.includes('429')) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
      }
    }

    throw lastError || new Error('Erreur de streaming sur les clusters IA');
  }
}

export const aiEngine = new AiEngine();
