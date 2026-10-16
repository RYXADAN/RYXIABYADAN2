import http from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { RYXIA_CREATOR_RULE } from '../../src/lib/modes.ts';

const VALID_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;
type ValidVoice = typeof VALID_VOICES[number];

export function setupLiveWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    let session: any = null;
    let isClosed = false;
    let isSessionReady = false;
    const pendingTextTurns: string[] = [];

    // Message listener registered immediately to never drop incoming messages
    clientWs.on('message', (raw) => {
      try {
        if (isClosed) return;
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'audio' && msg.data) {
          if (isSessionReady && session) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: msg.data,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } catch (err: any) {
              console.warn('[Live sendRealtimeInput warning]:', err?.message || err);
            }
          }
        } else if (msg.type === 'text' && msg.text) {
          if (isSessionReady && session) {
            try {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: msg.text }],
                  },
                ],
                turnComplete: true,
              });
            } catch (err: any) {
              console.warn('[Live sendClientContent warning]:', err?.message || err);
            }
          } else {
            // Queue text until session is established
            pendingTextTurns.push(msg.text);
          }
        }
      } catch (err: any) {
        console.error('[Live WS Message Parsing Error]', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        session?.close();
      } catch {}
    });

    clientWs.on('error', (err) => {
      console.warn('[Live Client WS Error]', err.message);
      isClosed = true;
      try {
        session?.close();
      } catch {}
    });

    try {
      // Parse query parameters
      const fullUrl = `http://localhost${req.url || '/api/live'}`;
      const parsedUrl = new URL(fullUrl);
      const requestedVoice = parsedUrl.searchParams.get('voice') || 'Zephyr';
      const voiceName: ValidVoice = (VALID_VOICES.includes(requestedVoice as any)
        ? requestedVoice
        : 'Zephyr') as ValidVoice;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'error',
            error: 'Clé API Gemini non configurée sur le serveur.'
          }));
          clientWs.close();
        }
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const now = new Date();
      const liveDateStr = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
      }).format(now);
      const liveTimeStr = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      }).format(now);

      const systemInstruction = `Tu es RYXIA LIVE, l'assistant vocal interactif en temps réel haut de gamme, conçu, développé et programmé exclusivement par Adan ("RYXIA — by Adan", slogan: "Your AI. Your way.").
Tu réponds à l'utilisateur de vive voix.

CONTEXTE TEMPOREL DU SYSTÈME EN TEMPS RÉEL :
- Date actuelle exacte : ${liveDateStr}
- Année actuelle : ${now.getFullYear()}
- Heure actuelle (pour information interne du système uniquement) : ${liveTimeStr}
- Date de création de RYXIA : Tu as été conçu et créé en septembre 2026 par Adan. Ne dis JAMAIS 2024. Pour toute question sur les dernières actualités ou informations, donne les informations les plus récentes.

RÈGLE ABSOLUE SUR L'HEURE ET LA DATE :
- Ne mentionne JAMAIS l'heure sauf si l'utilisateur te demande expressément et directement l'heure (ex: "quelle heure est-il ?", "donne-moi l'heure").
- Si l'utilisateur te demande quel jour ou quelle date nous sommes (ex: "on est quel jour ?", "c'est quoi la date ?"), réponds UNIQUEMENT avec le jour et la date (${liveDateStr}), sans JAMAIS mentionner l'heure.
- Réponds de manière naturelle, concise, rapide et fluide.

Règles vocales impératives :
1. Tes réponses doivent être fluides, concises (1 à 3 phrases percutantes), naturelles et agréables à écouter.
2. Adopte un ton chaleureux, confiant, professionnel et dynamique.
3. Si l'utilisateur pose une question de cours ou de calcul, donne l'explication audio pas-à-pas de manière limpide.
${RYXIA_CREATOR_RULE}`;

      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'ready',
                model: 'RYXIA Audio',
                voice: voiceName,
              }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            // Handle model turn audio & text parts
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                }));
              }
              if (part.text) {
                clientWs.send(JSON.stringify({
                  type: 'outputTranscription',
                  text: part.text,
                }));
              }
            }

            // Real-time spoken transcript of the assistant
            if (message.serverContent?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({
                type: 'outputTranscription',
                text: message.serverContent.outputTranscription.text,
              }));
            }

            // Real-time spoken transcript of the user
            if (message.serverContent?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({
                type: 'inputTranscription',
                text: message.serverContent.inputTranscription.text,
              }));
            }

            // Real-time interruption notification
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // Turn complete notification
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turnComplete' }));
            }
          },
          onerror: (err: any) => {
            console.error('[Live API Session Error]', err);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                error: err?.message || 'Erreur audio en direct',
              }));
            }
          },
          onclose: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
          },
        },
      });

      isSessionReady = true;

      // Flush any queued text turns
      while (pendingTextTurns.length > 0) {
        const text = pendingTextTurns.shift();
        if (text) {
          try {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text }],
                },
              ],
              turnComplete: true,
            });
          } catch (err: any) {
            console.warn('[Live sendClientContent flush error]:', err?.message || err);
          }
        }
      }
    } catch (err: any) {
      console.error('[Live API Connect Error]', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: err?.message || 'Échec de connexion au service vocal en direct.',
        }));
        clientWs.close();
      }
    }
  });

  return wss;
}
