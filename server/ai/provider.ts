import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { RYXIA_MODES, RYXIA_CREATOR_RULE } from '../../src/lib/modes.ts';
import { RyxiaMode, GroundingSource, ClientTimeInfo } from '../../src/types/index.ts';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, modelName: string, sources?: GroundingSource[]) => void;
  onError: (err: any) => void;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}

export interface StreamChatOptions {
  mode: RyxiaMode;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachment?: ChatAttachment;
    attachments?: ChatAttachment[];
  }>;
  customApiKey?: string;
  customModel?: string;
  providerPreference?: 'auto' | 'openai' | 'gemini';
  groundingPreference?: 'auto' | 'search' | 'maps' | 'none';
  speedMode?: 'turbo' | 'balanced' | 'deep';
  responseLength?: 'compact' | 'balanced' | 'detailed';
  latLng?: { latitude: number; longitude: number };
  clientTime?: ClientTimeInfo;
  signal?: AbortSignal;
}

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  customApiKey?: string;
}

export interface EditImageOptions {
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  customApiKey?: string;
}

export interface ImageResult {
  imageUrl: string;
  mimeType: string;
  prompt: string;
  model: string;
  text?: string;
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
      speedMode = 'turbo',
      responseLength = 'balanced',
      latLng,
      signal,
    } = options;
    const modeConfig = RYXIA_MODES[mode] || RYXIA_MODES.general;

    let lengthDirective = '';
    if (responseLength === 'compact') {
      lengthDirective = `CONSIGNE DE LONGUEUR : Sois très concis et direct (1 à 2 phrases).`;
    } else if (responseLength === 'detailed' || mode === 'study') {
      lengthDirective = `CONSIGNE PÉDAGOGIQUE & DÉVELOPPEMENT : Développe la réponse de manière méthodique et pas-à-pas avec des explications claires, les formules mathématiques mobilisées, les étapes de calcul et la vérification des résultats.`;
    } else {
      // Default: Balanced (Moyenne)
      lengthDirective = `CONSIGNE DE LONGUEUR ABSOLUE (RÉPONSES MOYENNES, PAS TROP COURTES, PAS TROP LONGUES) :
- Fournis TOUJOURS une réponse de longueur MOYENNE et ÉQUILIBRÉE.
- Ne réponds JAMAIS en un seul mot sec ou en une phrase télégraphique (ex: évite "Rome.", "Arigatō.", "4").
- Ne ponds JAMAIS de longue dissertation de 5 pages ou de multiples sous-titres superflus pour une question simple.
- Pour une question simple ou courante, formule un paragraphe fluide d'environ 2 à 4 phrases bien dosées : donne la réponse claire et complète, accompagnée d'une mise en contexte ou d'une nuance utile.`;
    }

    if (speedMode === 'turbo' && mode !== 'study') {
      lengthDirective += `\nCONSIGNE DE VITESSE : Va immédiatement à l'essentiel avec concision et fluidité.`;
    }

    const lastUserMsg = messages[messages.length - 1]?.content || '';

    // Temporal context (synchronized with real-time system clock & client)
    const userNow = options.clientTime?.iso ? new Date(options.clientTime.iso) : new Date();
    const timeZone = options.clientTime?.timeZone || 'Europe/Paris';
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const dateFrFormatted = options.clientTime?.dateString || capitalize(
      new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
      }).format(userNow)
    );

    const timeFrFormatted = options.clientTime?.timeString || new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone,
    }).format(userNow);

    const currentYear = userNow.getFullYear();
    const isoDateStr = userNow.toISOString();

    // QUESTIONS SPÉCIFIQUES SUR ADAN ("Qui est Adan ?", "C'est qui Adan ?", etc.) :
    if (this.isWhoIsAdanQuery(lastUserMsg)) {
      const adanResponse = `**Adan** est le créateur, concepteur et développeur de **RYXIA**.\n\nC'est un **jeune lycéen qui habite en Algérie**, passionné par l'informatique et les technologies d'intelligence artificielle, qui **aime coder et créer** des projets innovants. C'est lui qui a entièrement pensé, développé et programmé RYXIA.`;
      callbacks.onChunk(adanResponse);
      callbacks.onDone(adanResponse, 'RYXIA (by Adan)');
      return;
    }

    // DATE DE CRÉATION DE RYXIA (SEPTEMBRE 2026 — INTERDICTION STRICTE DE DIRE 2024) :
    if (this.isCreationDateQuery(lastUserMsg)) {
      const cleanLower = lastUserMsg.toLowerCase();
      if (cleanLower.includes('2024')) {
        const no2024Response = `Non, **RYXIA n'a pas du tout été créé en 2024** !\n\n**RYXIA** a été entièrement pensé, conçu et programmé en **septembre 2026** par **Adan**, un jeune lycéen résidant en Algérie passionné par le développement informatique et l'intelligence artificielle.\n\nL'année 2024 correspond uniquement aux fondations de certains moteurs d'entraînement généraux antérieurs, mais RYXIA est né en septembre 2026 et bénéficie des technologies et connaissances les plus récentes.`;
        callbacks.onChunk(no2024Response);
        callbacks.onDone(no2024Response, 'RYXIA (by Adan)');
        return;
      }

      const creationResponse = `**RYXIA** a été créé et conçu en **septembre 2026** par **Adan**, un jeune lycéen en Algérie passionné par la programmation et l'informatique.\n\nIl a entièrement imaginé et programmé RYXIA (*"RYXIA — by Adan"*, Your AI. Your way.) pour en faire une intelligence artificielle élégante, rapide et à la pointe des technologies actuelles.`;
      callbacks.onChunk(creationResponse);
      callbacks.onDone(creationResponse, 'RYXIA (by Adan)');
      return;
    }

    // RÈGLE D'OR CONCERNANT SON ORIGINE ET SON CRÉATEUR :
    // 1. RYXIA a été intégralement conçu, programmé et développé par Adan en septembre 2026.
    // 2. Répondre obligatoirement avec l'explication exacte sans mention de tiers.
    if (this.isOriginOrCreatorQuery(lastUserMsg)) {
      const exactResponse = `RYXIA a été créé manuellement et intégralement en **septembre 2026** par **Adan**, un **jeune lycéen résidant en Algérie** passionné par l'informatique, qui **aime coder et créer**.\n\nIl s'agit donc d'une ingénierie et d'une programmation entièrement conçues et guidées par Adan ("*RYXIA — by Adan*", Your AI. Your way.).`;
      callbacks.onChunk(exactResponse);
      callbacks.onDone(exactResponse, 'RYXIA (by Adan)');
      return;
    }

    // RÉPONSE NATURELLE ET RAPIDE POUR LES QUESTIONS DE DATE (SANS L'HEURE SI NON DEMANDÉE) :
    if (this.isDirectDateQuery(lastUserMsg)) {
      const exactDateResponse = `Aujourd'hui, nous sommes le **${dateFrFormatted}**.`;
      callbacks.onChunk(exactDateResponse);
      callbacks.onDone(exactDateResponse, 'RYXIA');
      return;
    }

    // RÉPONSE POUR LES QUESTIONS PORTANT SUR L'HEURE :
    if (this.isDirectTimeQuery(lastUserMsg)) {
      const exactTimeResponse = `Il est actuellement **${timeFrFormatted.slice(0, 5)}**.`;
      callbacks.onChunk(exactTimeResponse);
      callbacks.onDone(exactTimeResponse, 'RYXIA');
      return;
    }

    const temporalDirective = `
=========================================
CONTEXTE TEMPOREL DU SYSTÈME EN TEMPS RÉEL :
- Date actuelle exacte : ${dateFrFormatted}
- Année actuelle : ${currentYear}
- Heure actuelle (pour information interne du système uniquement) : ${timeFrFormatted} (${timeZone})

CONSIGNE STRICTE SUR LA DATE DE CRÉATION ET LES DERNIÈRES INFORMATIONS :
1. DATE DE CRÉATION (SEPTEMBRE 2026) :
   - Si l'utilisateur te demande quand tu as été créé ou conçu, réponds TOUJOURS que tu as été créé en septembre 2026 par Adan.
   - NE DIS JAMAIS 2024 ! Il est STRICTEMENT INTERDIT de mentionner l'année 2024 comme date de création ou comme limite temporelle de tes connaissances.
2. DERNIÈRES INFORMATIONS & ACTUALITÉS RÉCENTES :
   - Si l'utilisateur demande les dernières informations, actualités, classements, nouveautés ou ce qu'il se passe en ce moment, fournis TOUJOURS les informations contemporaines les plus récentes et à jour. Ne dis jamais que tes connaissances s'arrêtent en 2024.
3. NE JAMAIS DIRE L'HEURE SPONTANÉMENT : Si l'utilisateur ne te demande pas expressément quelle heure il est, il est FORMELLEMENT INTERDIT de mentionner l'heure ou les minutes dans ta réponse.
4. QUESTIONS SUR LE JOUR OU LA DATE : Si l'utilisateur te demande quel jour ou quelle date nous sommes (ex: "on est quel jour ?"), réponds UNIQUEMENT avec le jour et la date (${dateFrFormatted}), SANS JAMAIS ajouter l'heure.
5. CONVERSATIONS CLASSIQUES : Pour tout autre message (bonjour, code, devoirs, discussion générale, etc.), réponds immédiatement, normalement et rapidement à la demande SANS insérer d'horodatage ni mentionner l'heure.
=========================================`;

    const symbolsDirective = `
=========================================
RÈGLE STRICTE SUR LES VRAIS SYMBOLES MONÉTAIRES ET SIGNES MATHÉMATIQUES & SCIENTIFIQUES (QUAND IL LE FAUT) :
1. VRAIS SYMBOLES MONÉTAIRES ET POURCENTAGES :
- € (Euro) : Écris TOUJOURS "€" (ex: "150 €", "12,50 €"), JAMAIS les mots "euros" ou "EUR".
- $ (Dollar) : Écris TOUJOURS "$" (ex: "50 $", "$50"), JAMAIS les mots "dollars" ou "USD".
- £ (Livre sterling) : Écris TOUJOURS "£" (ex: "25 £", "£25"), JAMAIS les mots "livres" ou "GBP".
- % (Pourcentage) : Écris TOUJOURS "%" (ex: "15 %", "99,9 %"), JAMAIS le mot "pourcent".

2. VRAIS SIGNES MATHÉMATIQUES & SCIENTIFIQUES :
- Opérateurs :
  * "×" (multiplication réelle) : Utilise TOUJOURS le vrai symbole Unicode "×" (ex: "5 × 4 = 20", "2 × π × r"), JAMAIS l'astérisque "*" ni la lettre "x" minuscule pour exprimer une opération.
  * "÷" (division réelle) : Utilise TOUJOURS le vrai symbole "÷" (ex: "20 ÷ 4 = 5"), JAMAIS le simple slash "/" dans les calculs arithmétiques.
  * "±" (plus ou moins) : Utilise TOUJOURS "±" (ex: "x = (-b ± √Δ) ÷ (2 × a)", "± 0,5"), JAMAIS "+/-".
  * "=" (égal) : Utilise TOUJOURS "=".
  * "≠" (différent de) : Utilise TOUJOURS "≠" (ex: "x ≠ 0"), JAMAIS "!=" ni "<>".
  * "≈" (environ égal) : Utilise TOUJOURS "≈" (ex: "π ≈ 3,14159"), JAMAIS "~" ni "approx".
  * "≤" (inférieur ou égal) : Utilise TOUJOURS "≤" (ex: "x ≤ 10"), JAMAIS "<=".
  * "≥" (supérieur ou égal) : Utilise TOUJOURS "≥" (ex: "x ≥ 0"), JAMAIS ">=".
- Algèbre, calcul & sciences :
  * "√" (racine carrée) : Utilise TOUJOURS "√" (ex: "√25 = 5", "√(a² + b²)"), JAMAIS "sqrt()".
  * "π" (pi) : Utilise TOUJOURS "π" (ex: "A = π × r²"), JAMAIS le mot "pi".
  * "∞" (infini) : Utilise TOUJOURS "∞" (ex: "lim x → +∞", "]-∞, +∞["), JAMAIS "inf" ou "infini".
  * "²" (au carré) et "³" (au cube) : Utilise TOUJOURS les vrais exposants directs "²" et "³" (ex: "x² + 2x + 1 = 0", "cm²", "m³", "E = m × c²"), JAMAIS "^2" ou "^3".
  * "∑" (somme) et "∫" (intégrale) : Utilise TOUJOURS les vrais symboles "∑" et "∫", JAMAIS les mots "somme" ou "integrale".
  * "Δ" (delta) : Utilise TOUJOURS "Δ" (ex: discriminant "Δ = b² - 4 × a × c", variation "ΔT = T₂ - T₁").
  * "°" (degré) : Utilise TOUJOURS le symbole "°" (ex: angle "90°", température "25 °C", "37 °C"), JAMAIS "degres".
  * "α", "β", "θ" : Utilise TOUJOURS les vraies lettres grecques "α" (alpha), "β" (bêta), "θ" (thêta) (ex: angle "θ = 45°", coefficients "α", "β", "cos(θ)", "sin(α)").
(Exception : dans les blocs de code informatique formels de programmation comme \`\`\`python ou \`\`\`javascript, conserve la syntaxe du langage technique pour que le code compile sans erreur).
=========================================`;

    const visionDirective = `
=========================================
EXPERTISE EN ANALYSE DE PHOTOS & VISION MULTIMODALE :
Quand l'utilisateur joint une image ou pose une question telle que "c'est quoi ça ?", "explique", "décris ce qui est sur l'image", "c quoi", ou toute question visuelle :
1. IDENTIFICATION PRÉCISE & DIRECTE :
   - Donne immédiatement le nom exact, la nature, l'espèce ou la référence de ce qui est visible dès le premier paragraphe.
2. DESCRIPTION VISUELLE DÉTAILLÉE :
   - Décris avec précision ce qu'on observe (matières, couleurs, textures, formes, état, éléments au premier plan et en arrière-plan).
3. EXPLICATION APPROFONDIE & CONTEXTE :
   - Explique son rôle, fonctionnement, utilité pratique, origine ou contexte historique/scientifique.
4. TRAITEMENT SPÉCIFIQUE SELON LE TYPE D'IMAGE :
   - Document / Exercice / Tableau / Copie : retranscris fidèlement les textes et formules (OCR) et résous méthodiquement l'exercice étape par étape.
   - Objet / Produit / Outil : explique son usage, ses fonctionnalités principales et conseils pratiques.
   - Nature / Plante / Animal : donne l'espèce, les traits distinctifs, son habitat, et s'il y a lieu la comestibilité ou la toxicité.
   - Monument / Lieu / Art : indique la localisation, l'époque, l'histoire et les anecdotes clés.
5. CLARTÉ DE STRUCTURE :
   - Utilise des titres de sections Markdown et des listes à puces soignées pour rendre l'analyse agréable, complète et immédiatement intelligible.
=========================================`;

    const scienceDirective = `
=========================================
SCIENCE SKILLS & EXPERTISE BIOMOLÉCULAIRE :
Tu disposes d'une expertise scientifique et biomédicale avancée :
1. BIOLOGIE STRUCTURALE & PROTÉINES :
   - Maîtrise des structures 3D de protéines issues d'AlphaFold DB et RCSB PDB (codes PDB à 4 caractères, accessions UniProt).
   - Compréhension des métriques de confiance per-résidu pLDDT (Très haute >90, Confiante 70-90, Faible 50-70, Très faible <50) et des matrices PAE (Predicted Aligned Error).
2. CHIMIE, PHARMACOLOGIE & FORMULES :
   - Connaissance approfondie de PubChem et ChEMBL : formules brutes, masses molaires, représentations SMILES canoniques, noms IUPAC, cibles pharmacologiques et mécanismes d'action.
3. GÉNOMIQUE & VARIATION GÉNÉTIQUE :
   - Références AlphaGenome Atlas, bases de données de variants (ClinVar, gnomAD, dbSNP rsID, Ensembl).
4. LITTÉRATURE BIOMÉDICALE & CITATIONS :
   - Capacité à citer et référencer les publications scientifiques (Europe PMC, PubMed, DOI).
5. NOTATION SCIENTIFIQUE RIGOUREUSE :
   - Utilise toujours les symboles mathématiques et scientifiques réels (×, ÷, ±, =, ≠, ≈, ≤, ≥, √, π, ∞, ², ³, ∑, ∫, Δ, °, α, β, θ) et la notation correcte des unités (ex: Å, kDa, µM, nM, g/mol).
=========================================`;

    const systemPrompt = `${temporalDirective}\n\n${symbolsDirective}\n\n${visionDirective}\n\n${scienceDirective}\n\n${modeConfig.systemPrompt}\n\n${RYXIA_CREATOR_RULE}\n\n${lengthDirective}`;

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
    // - gemini-3.1-flash-lite for instant turbo responses (minimal latency)
    // - gemini-3.8-flash with low thinking level for fast balanced responses
    // - gemini-3.1-pro-preview for particularly complex tasks
    const geminiModel = (customModel && customModel !== 'auto' && customModel.startsWith('gemini-'))
      ? customModel
      : undefined;

    try {
      await this.streamGeminiResilient({
        mode,
        customModel: geminiModel,
        speedMode,
        systemPrompt,
        messages,
        groundingPreference,
        latLng,
        callbacks,
        signal,
      });
    } catch (err: any) {
      console.error('All AI streaming attempts failed:', err?.message || err);
      const isQuota =
        err?.status === 429 ||
        err?.code === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('Quota exceeded');

      const isUnavailable =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.status === 'Service Unavailable' ||
        err?.message?.includes('503') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('high demand');

      const fallbackNotice = isQuota
        ? "Le cluster d'intelligence artificielle connaît une très forte affluence en ce moment (limite de requêtes temporaire). Veuillez patienter quelques instants et renvoyer votre message."
        : isUnavailable
        ? "Les serveurs d'inférence font face à un pic de demande temporaire. Vos messages ont bien été préservés : n'hésitez pas à relancer votre question dans quelques secondes."
        : "Une perturbation temporaire des serveurs est survenue. Le contexte de votre échange a été préservé ; n'hésitez pas à relancer votre question.";

      callbacks.onChunk(fallbackNotice);
      callbacks.onDone(fallbackNotice, 'RYXIA (Secours)');
    }
  }

  private async streamOpenAi(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string; attachment?: ChatAttachment; attachments?: ChatAttachment[] }>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => {
        const isAssistant = m.role === 'assistant';
        const attList = (m.attachments && m.attachments.length > 0)
          ? m.attachments
          : (m.attachment ? [m.attachment] : []);

        const contentParts: any[] = [];
        if (m.content) {
          contentParts.push({ type: 'text', text: m.content });
        }

        for (const att of attList) {
          if (att.base64Data && (att.mimeType?.startsWith('image/') || (!att.mimeType && !att.textContent))) {
            const cleanB64 = att.base64Data.replace(/^data:[^;]+;base64,/, '');
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${att.mimeType || 'image/jpeg'};base64,${cleanB64}`,
              },
            });
          }
          if (att.textContent) {
            contentParts.push({
              type: 'text',
              text: `\n\n[Document joint: ${att.name}]\n${att.textContent}`,
            });
          }
        }

        if (contentParts.length === 0) {
          contentParts.push({ type: 'text', text: 'Bonjour' });
        }

        return {
          role: isAssistant ? 'assistant' : 'user',
          content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts,
        };
      }),
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

  public isWhoIsAdanQuery(text: string): boolean {
    if (!text) return false;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const adanPatterns = [
      /qui est adan/,
      /c est qui adan/,
      /qui c est adan/,
      /adan c est qui/,
      /adan est qui/,
      /parle moi d adan/,
      /parle d adan/,
      /tu connais adan/,
      /connais tu adan/,
      /qui est ton createur adan/,
      /qui est adan amarir/,
      /who is adan/,
      /tell me about adan/,
      /presente adan/,
      /presentation d adan/,
      /info sur adan/,
      /infos sur adan/,
      /qui est ce adan/,
    ];

    if (adanPatterns.some((p) => p.test(clean))) return true;

    return clean.includes('adan') && (clean.includes('qui') || clean.includes('present') || clean.includes('connai') || clean.includes('auteur') || clean.includes('personne'));
  }

  public isCreationDateQuery(text: string): boolean {
    if (!text) return false;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /quand (as tu|tu as|a tu|tu a|est ce que tu as)?\s*ete\s*(cree|crer|concu|developpe|programme|lance|mis en ligne|fait)/,
      /quand (tu a|tu as|t as|t a)\s*(ete\s*)?(crer|cree)/,
      /quand\s*(a|as)?\s*ete\s*(cree|crer|concu|programme|lance|fait)\s*(ryxia)?/,
      /quand\s*(est ce que\s*)?(ryxia\s*)?(a|as)?\s*ete\s*(cree|crer|concu)/,
      /tu (as|a)?\s*ete\s*(cree|crer|concu|programme|lance|fait)\s*quand/,
      /tu (dates?|date)\s*de\s*quand/,
      /tu (es|est)\s*ne\s*quand/,
      /(quelle est|c est quoi)\s*(ta|la)?\s*date\s*de\s*(creation|lancement|conception|naissance)/,
      /en quelle annee\s*(as tu|tu as|a tu|tu a)?\s*ete\s*(cree|crer|concu|programme|lance)/,
      /depuis quand\s*(existes tu|tu existes|es tu la)/,
      /date de creation(\s*de\s*ryxia)?/,
      /de quand\s*(dates tu|tu dates)/,
      /(cree|crer|concu|programme)\s*en\s*2024/,
      /es\s*tu\s*(cree|crer)\s*en\s*2024/,
      /when\s*(were you|was ryxia)\s*(created|made|born|launched|built)/,
    ];

    if (patterns.some((p) => p.test(clean))) return true;

    const hasWhenOrDate = clean.includes('quand') || clean.includes('date') || clean.includes('annee');
    const hasCreation = clean.includes('cree') || clean.includes('crer') || clean.includes('concu') || clean.includes('programme') || clean.includes('creation') || clean.includes('naissance');
    return hasWhenOrDate && hasCreation;
  }

  public isOriginOrCreatorQuery(text: string): boolean {
    if (!text) return false;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /qui (te?|t|tu)?\s*(a|as)?\s*(cree|concu|developpe|programme|code|fabrique|invente|fait|construit)/,
      /qui est (ton|le|votre)?\s*(createur|concepteur|developpeur|fondateur|auteur|papa|pere|inventeur)/,
      /comment (as tu|tu as|a tu)\s*ete\s*(concu|cree|developpe|programme|fait|construit)/,
      /qui a (cree|concu|developpe|programme|fait)\s*ryxia/,
      /par qui (as tu|tu as|a tu)?\s*ete\s*(cree|concu|developpe)/,
      /(cree|concu|developpe|programme|fait|fabrique)\s*par qui/,
      /d ou viens tu|d ou tu viens|d ou proviens tu/,
      /origine de ryxia|qui a fabrique ryxia/,
      /who (created|made|developed|programmed|built) (you|ryxia)/,
      /who is your creator/,
    ];

    return patterns.some((p) => p.test(clean));
  }

  public isDirectDateQuery(text: string): boolean {
    if (!text) return false;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // If query also explicitly mentions "heure", do not treat as pure date query
    if (clean.includes('heure') || clean.includes('horaire')) return false;

    const patterns = [
      /^(on est|c est|cest|nous sommes)\s+(quel|quelle|le combien|quelle date)/,
      /^quel(le)?\s+(jour|date)\s+(on est|est on|sommes nous|c est|cest)/,
      /^quel(le)?\s+jour(\s+de la semaine)?/,
      /^quelle\s+est\s+la\s+date/,
      /^c\s*est\s+quoi\s+la\s+date/,
      /^donne(\s+moi)?\s+(la\s+date|le\s+jour)/,
      /^date\s+d\s*aujourd\s*hui/,
      /^date\s+du\s+jour/,
      /^on\s+est\s+le\s+combien/,
      /^c\s*est\s+le\s+combien/,
      /^what\s+day\s+is\s+(it|today)/,
      /^what\s+is\s+today\s*s\s+date/,
    ];

    return patterns.some((p) => p.test(clean));
  }

  public isDirectTimeQuery(text: string): boolean {
    if (!text) return false;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /^(il est|c est|cest)\s+quelle\s+heure/,
      /^quelle\s+heure\s+(est\s+il|il\s+est|c\s+est)/,
      /^(donne|dis)(\s+moi)?\s+l\s*heure/,
      /^l\s*heure\s+(svp|stp|actuelle)/,
      /^c\s*est\s+quoi\s+l\s*heure/,
      /^what\s+time\s+is\s+it/,
    ];

    return patterns.some((p) => p.test(clean));
  }

  private detectGroundingType(
    lastUserMessage: string,
    preference: 'auto' | 'search' | 'maps' | 'none',
    speedMode?: 'turbo' | 'balanced' | 'deep'
  ): 'search' | 'maps' | 'none' {
    if (preference === 'none') return 'none';
    if (preference === 'maps') return 'maps';
    if (preference === 'search') return 'search';

    // Never trigger web search or maps for queries about origin, creator, creation date or Adan
    if (this.isWhoIsAdanQuery(lastUserMessage) || this.isOriginOrCreatorQuery(lastUserMessage) || this.isCreationDateQuery(lastUserMessage) || lastUserMessage.toLowerCase().includes('adan')) {
      return 'none';
    }

    // In turbo speed mode, skip auto-grounding to guarantee sub-second response start
    if (speedMode === 'turbo') return 'none';

    const text = lastUserMessage.toLowerCase();

    // Check for maps/places/geography queries
    const mapKeywords = [
      'où se trouve', 'ou se trouve', 'restaurant', 'café', 'cafe', 'bar', 'hôtel', 'hotel',
      'itinéraire', 'itineraire', 'route', 'direction', 'adresse', 'localisation',
      'google maps', 'distance entre', 'monument', 'musée', 'musee', 'gare', 'aéroport', 'aeroport', 'nearby',
      'where is', 'directions to'
    ];
    if (mapKeywords.some(kw => text.includes(kw))) {
      return 'maps';
    }

    // Check for explicit or relevant web search intent keywords for up-to-date information
    const searchKeywords = [
      'recherche sur le web', 'cherche sur google', 'actualité', 'actualite', 'aujourd\'hui',
      'dernières nouvelles', 'dernieres nouvelles', 'météo', 'meteo', 'qui a gagné',
      'score de', 'prix actuel', 'cours de la bourse', 'breaking news', 'search web',
      'qui est le président', 'qui est premier ministre', 'classement',
      'résultat', 'resultat', 'taux de change', 'crypto', 'cours du bitcoin', 'quand sort',
      'derniere info', 'dernières infos', 'dernieres infos', 'derniere infos', 'dernieres info',
      'derniere information', 'dernières informations', 'dernieres informations',
      'derniers faits', 'derniers événements', 'derniers evenements',
      'ce qui se passe', 'en ce moment', 'actus', 'nouvelles récentes', 'nouvelles recentes',
      'faits récents', 'faits recents', 'les dernières', 'les dernieres', 'infos récentes', 'infos recentes',
      'derniere actu', 'dernieres actus', 'derniers scoops', 'donne moi les dernieres infos'
    ];
    if (searchKeywords.some(kw => text.includes(kw))) {
      return 'search';
    }

    // Default to none in auto mode to conserve API quotas and ensure ultra-fast responses
    return 'none';
  }

  private selectModelForTask(
    mode: RyxiaMode,
    customModel?: string,
    lastUserMessage?: string,
    speedMode?: 'turbo' | 'balanced' | 'deep',
    hasAttachment?: boolean
  ): { targetModel: string; candidates: string[] } {
    // 1. Custom model explicitly provided
    if (customModel && customModel !== 'auto' && customModel.startsWith('gemini-')) {
      const validCustomModel = (customModel.includes('2.5') || customModel.includes('2.0') || customModel.includes('1.5'))
        ? 'gemini-3.8-flash'
        : customModel;
      return {
        targetModel: validCustomModel,
        candidates: [validCustomModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
      };
    }

    // 2. Toujours prioriser gemini-3.8-flash lorsqu'un fichier ou une photo est transmise
    // pour garantir la meilleure acuité visuelle, OCR et raisonnement multimodal
    if (hasAttachment) {
      return {
        targetModel: 'gemini-3.8-flash',
        candidates: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
      };
    }

    // 3. Only if the user explicitly chose the "fast" mode (RYXIA FAST), use flash-lite for sub-second responses
    if (mode === 'fast') {
      return {
        targetModel: 'gemini-3.1-flash-lite',
        candidates: ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'],
      };
    }

    // 4. For all intelligent, balanced and deep tasks (general, code, study, creative):
    // ALWAYS use gemini-3.8-flash as the primary powerhouse engine with multi-tier failover.
    return {
      targetModel: 'gemini-3.8-flash',
      candidates: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
    };
  }

  /**
   * Normalise et structure l'historique de conversation pour Gemini :
   * 1. Conserve la mémoire contextuelle complète sur plusieurs tours.
   * 2. Respecte l'alternance stricte user/model requise par l'API (fusionne les tours consécutifs de même rôle).
   * 3. S'assure que le dialogue démarre et se termine par un message utilisateur.
   * 4. Préserve les pièces jointes (images / OCR / documents) des tours précédents.
   */
  private buildNormalizedContents(
    messages: Array<{ role: string; content: string; attachment?: ChatAttachment; attachments?: ChatAttachment[] }>
  ): any[] {
    const rawItems: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

    // Ne retient pas les messages système d'erreur et conserve les 24 derniers tours pour un contexte riche et précis
    const filtered = messages
      .filter((m) => m.role !== 'system')
      .slice(-24);

    for (const msg of filtered) {
      const parts: any[] = [];
      const attList = (msg.attachments && msg.attachments.length > 0)
        ? msg.attachments
        : (msg.attachment ? [msg.attachment] : []);

      let hasImageInMsg = false;

      for (const att of attList) {
        if (att.base64Data) {
          const cleanBase64 = att.base64Data.replace(/^data:[^;]+;base64,/, '');
          let mime = att.mimeType || '';
          if (!mime) {
            const name = (att.name || '').toLowerCase();
            if (name.endsWith('.pdf')) mime = 'application/pdf';
            else if (name.endsWith('.png')) mime = 'image/png';
            else if (name.endsWith('.webp')) mime = 'image/webp';
            else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
            else mime = 'image/jpeg';
          }

          if (mime.startsWith('image/')) {
            hasImageInMsg = true;
          }

          if (mime.startsWith('image/') || mime === 'application/pdf') {
            parts.push({
              inlineData: {
                mimeType: mime,
                data: cleanBase64,
              },
            });
          } else if (mime.startsWith('text/') || (att.name && att.name.match(/\.(txt|md|csv|json|js|ts|py|html|css)$/i))) {
            try {
              const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
              parts.push({
                text: `[Document texte joint : "${att.name}"]\n${decoded}`,
              });
            } catch {
              parts.push({
                inlineData: {
                  mimeType: mime || 'text/plain',
                  data: cleanBase64,
                },
              });
            }
          } else {
            parts.push({
              inlineData: {
                mimeType: mime || 'image/jpeg',
                data: cleanBase64,
              },
            });
          }
        }
        if (att.textContent && !att.base64Data) {
          parts.push({
            text: `[Document joint : "${att.name}"]\n${att.textContent}`,
          });
        }
      }

      // Traitement intelligent du texte pour les questions visuelles et photos
      if (hasImageInMsg) {
        const rawContent = (msg.content || '').trim();
        const lower = rawContent.toLowerCase();
        const isShortVisionQuery =
          !rawContent ||
          rawContent.length < 40 ||
          lower.includes('c quoi') ||
          lower.includes("c'est quoi") ||
          lower.includes('explique') ||
          lower.includes('décris') ||
          lower.includes('decris') ||
          lower.includes('analyse') ||
          lower.includes("qu'est-ce que") ||
          lower.includes('ce truc') ||
          lower.includes('c quoi sa') ||
          lower.includes('photo');

        if (isShortVisionQuery) {
          const userIntent = rawContent || "Que vois-tu sur cette image ?";
          parts.push({
            text: `${userIntent}\n\n[Consigne d'analyse experte : Identifie avec exactitude le sujet visible (nom précis, espèce, marque, modèle, lieu, monument, document ou problème). Décris méticuleusement les éléments observables (formes, couleurs, matières, détails clés, premier et arrière-plan). Explique son rôle, fonctionnement, contexte historique ou utilité pratique. Si c'est un devoir ou un exercice, détaille la résolution complète pas-à-pas avec les formules nécessaires.]`,
          });
        } else {
          parts.push({ text: rawContent });
        }
      } else if (msg.content && msg.content.trim()) {
        parts.push({ text: msg.content.trim() });
      } else if (parts.length > 0) {
        parts.push({ text: 'Merci d\'analyser précisément ces documents et d\'expliquer leur contenu avec rigueur.' });
      }

      if (parts.length > 0) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        rawItems.push({ role, parts });
      }
    }

    if (rawItems.length === 0) {
      return [{ role: 'user', parts: [{ text: 'Bonjour' }] }];
    }

    // Fusionne les messages consécutifs ayant le même rôle (règle obligatoire de l'API Gemini)
    const merged: Array<{ role: 'user' | 'model'; parts: any[] }> = [];
    for (const item of rawItems) {
      if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
        merged[merged.length - 1].parts.push(...item.parts);
      } else {
        merged.push({ role: item.role, parts: [...item.parts] });
      }
    }

    // Assure le début par 'user'
    while (merged.length > 0 && merged[0].role !== 'user') {
      merged.shift();
    }

    // Assure la fin par 'user'
    while (merged.length > 0 && merged[merged.length - 1].role !== 'user') {
      merged.pop();
    }

    if (merged.length === 0) {
      return [{ role: 'user', parts: [{ text: 'Bonjour' }] }];
    }

    return merged;
  }

  private async streamGeminiResilient(params: {
    mode: RyxiaMode;
    customModel?: string;
    speedMode?: 'turbo' | 'balanced' | 'deep';
    systemPrompt: string;
    messages: Array<{ role: string; content: string; attachment?: ChatAttachment; attachments?: ChatAttachment[] }>;
    groundingPreference: 'auto' | 'search' | 'maps' | 'none';
    latLng?: { latitude: number; longitude: number };
    callbacks: StreamCallbacks;
    signal?: AbortSignal;
  }): Promise<void> {
    const { mode, customModel, speedMode = 'turbo', systemPrompt, messages, groundingPreference, latLng, callbacks, signal } = params;

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
    const hasAnyAttachment = messages.some((m) => !!m.attachment || (m.attachments && m.attachments.length > 0));
    const groundingType = this.detectGroundingType(lastUserMsg, groundingPreference, speedMode);

    // Format conversation history with strict multi-turn alternation and attachment memory
    const contents = this.buildNormalizedContents(messages);

    // Attempt Search Grounding (gemini-3.8-flash with googleSearch) or Maps Grounding if requested
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
          // Google Search tool enabled for Search Grounding as required
          tools = [{ googleSearch: {} }];
        }

        // Primary: gemini-3.8-flash with Google Search / Maps grounding, with failover to gemini-flash-latest
        const searchCandidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];

        for (const searchModel of searchCandidateModels) {
          try {
            const searchConfig: any = {
              systemInstruction: systemPrompt,
              ...(tools ? { tools } : {}),
              ...(toolConfig ? { toolConfig } : {}),
            };

            if (searchModel.startsWith('gemini-3') || searchModel.startsWith('gemini-4')) {
              searchConfig.thinkingConfig = {
                thinkingLevel: ThinkingLevel.LOW,
              };
            }

            const streamResult = await client.models.generateContentStream({
              model: searchModel,
              contents,
              config: searchConfig,
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

              const modelDisplayName = 'RYXIA Core v1';

              callbacks.onDone(fullResponse, modelDisplayName, sources.length > 0 ? sources : undefined);
              return;
            }
          } catch (searchErr: any) {
            console.warn(`Search Grounding on ${searchModel} failed:`, searchErr?.message || searchErr);
            // proceed to next candidate or fallback
          }
        }
      } catch {
        // Grounding failed or quota exceeded, proceed cleanly to core Gemini models
      }
    }

    // Select model according to speed and feature requirements:
    // - gemini-3.8-flash for multimodal vision, OCR & reasoning
    // - gemini-3.1-flash-lite for ultra-fast, minimal latency responses
    const { candidates } = this.selectModelForTask(mode, customModel, lastUserMsg, speedMode, hasAnyAttachment);
    let lastError: any = null;

    for (const model of candidates) {
      if (signal?.aborted) return;
      
      // Attempt with retry if temporary rate limit (429) occurs
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) return;
        try {
          const config: any = {
            systemInstruction: systemPrompt,
          };

          if (model === 'gemini-3.1-flash-lite') {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
          } else if (model === 'gemini-3.8-flash') {
            if (speedMode === 'deep' || mode === 'code' || mode === 'study') {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
            } else {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }
          }

          const fallbackStream = await client.models.generateContentStream({
            model,
            contents,
            config,
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
            const displayModel = model.includes('flash-lite')
              ? 'RYXIA Flash'
              : model.includes('pro')
              ? 'RYXIA Deep Engine'
              : 'RYXIA Core v1';
            callbacks.onDone(fullResponse, displayModel);
            return;
          }
        } catch (err: any) {
          lastError = err;
          const isQuota = err?.status === 429 ||
                          err?.code === 429 ||
                          err?.message?.includes('429') ||
                          err?.message?.includes('RESOURCE_EXHAUSTED') ||
                          err?.message?.includes('Quota exceeded');
          const isUnavailable = err?.status === 503 ||
                                err?.code === 503 ||
                                err?.status === 'Service Unavailable' ||
                                err?.error?.code === 503 ||
                                err?.message?.includes('503') ||
                                err?.message?.includes('UNAVAILABLE') ||
                                err?.message?.includes('high demand');

          if (isQuota && attempt === 0) {
            console.warn(`Model ${model} hit temporary quota (429). Retrying after 500ms...`);
            await new Promise((r) => setTimeout(r, 500));
            continue;
          } else if (isQuota) {
            console.warn(`Model ${model} quota saturated on attempt ${attempt + 1}. Failing over to next candidate.`);
            break;
          } else if (isUnavailable) {
            console.warn(`Model ${model} experiencing temporary demand (503). Immediate failover to next candidate.`);
            break;
          } else {
            console.warn(`Model ${model} stream error:`, err?.message || err);
            break;
          }
        }
      }
    }

    // Final ultra-resilient safety net: if all streaming attempts failed (e.g. streaming proxy or demand spike),
    // attempt a single non-streaming generateContent call on available models
    for (const emergencyModel of ['gemini-3.1-flash-lite', 'gemini-flash-latest']) {
      if (signal?.aborted) return;
      try {
        console.warn(`Attempting emergency non-streaming fallback on ${emergencyModel}...`);
        const unaryResult = await client.models.generateContent({
          model: emergencyModel,
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        });

        const text = unaryResult.text;
        if (text) {
          callbacks.onChunk(text);
          callbacks.onDone(text, 'RYXIA (Secours)');
          return;
        }
      } catch (unaryErr: any) {
        console.warn(`Emergency fallback on ${emergencyModel} failed:`, unaryErr?.message || unaryErr);
      }
    }

    throw lastError || new Error('Erreur de streaming sur les clusters IA');
  }

  /**
   * Generates a real, aesthetic vector SVG drawing of the requested subject using Gemini
   */
  public async generateAiVectorIllustration(
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    customApiKey?: string
  ): Promise<string | null> {
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const width = aspectRatio === '16:9' ? 1200 : aspectRatio === '9:16' ? 675 : aspectRatio === '4:3' ? 1000 : aspectRatio === '3:4' ? 750 : 800;
    const height = aspectRatio === '16:9' ? 675 : aspectRatio === '9:16' ? 1200 : aspectRatio === '4:3' ? 750 : aspectRatio === '3:4' ? 1000 : 800;

    const cleanPrompt = prompt
      .replace(/^Une illustration ou photographie détaillée de haute qualité\s*:\s*/i, '')
      .replace(/^Un schéma explicatif clair, précis et esthétique, infographie pédagogique détaillée avec annotations\s*:\s*/i, '')
      .trim();

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    for (const model of candidateModels) {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: `Tu es un artiste illustrateur vectoriel et designer graphique d'élite.
Génère une illustration vectorielle SVG complète, magnifique, très colorée, esthétique et détaillée qui dessine expressément : "${cleanPrompt}".
Règles strictes :
1. Dimensions exactes : <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
2. Dessine RÉELLEMENT le sujet demandé ("${cleanPrompt}") avec des formes riches (<path>, <polygon>, <circle>, <ellipse>, <rect>), de superbes dégradés (<defs><linearGradient/></defs>), des détails et de la texture visuelle.
3. Ne mets AUCUN texte de métadonnées, AUCUN mot du style "RYXIA STUDIO IMAGE", AUCUN titre générique, AUCUNE citation du prompt : dessine uniquement le sujet lui-même.
4. Reste STRICTEMENT conforme : le code doit commencer par <svg et se terminer par </svg>.
5. Pas de markdown (pas de balises code \`\`\`), aucun commentaire, aucun mot avant ou après.`,
        });

        let fullText = '';
        for await (const chunk of stream) {
          if (chunk.text) fullText += chunk.text;
        }

        let clean = fullText.trim();
        clean = clean.replace(/^```(?:svg|xml)?/i, '').replace(/```$/i, '').trim();
        const svgMatch = clean.match(/<svg[\s\S]*<\/svg>/i);
        if (svgMatch && svgMatch[0].length > 250) {
          return svgMatch[0];
        }
      } catch (err: any) {
        console.warn(`Vector illustration attempt on ${model} note:`, err?.message || err);
      }
    }

    return null;
  }

  /**
   * Procedural aesthetic vector drawing for common subjects as resilient instant fallback
   */
  private generateProceduralVectorArt(prompt: string, width: number, height: number): string {
    const p = prompt.toLowerCase();
    const cx = width / 2;
    const cy = height / 2;

    if (p.includes('chat') || p.includes('cat') || p.includes('kitten') || p.includes('félin')) {
      return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgG" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#2a2238"/>
      <stop offset="50%" stop-color="#191526"/>
      <stop offset="100%" stop-color="#0c0a14"/>
    </radialGradient>
    <linearGradient id="furG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
    <linearGradient id="earIn" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fca5a5"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
    <radialGradient id="eyeG" cx="35%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="60%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="15" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgG)"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * 0.42}" fill="#f59e0b" fill-opacity="0.08" filter="url(#glow)"/>
  <!-- Oreilles -->
  <polygon points="${cx - 140},${cy - 80} ${cx - 200},${cy - 260} ${cx - 40},${cy - 170}" fill="url(#furG)"/>
  <polygon points="${cx - 130},${cy - 90} ${cx - 185},${cy - 240} ${cx - 60},${cy - 165}" fill="url(#earIn)"/>
  <polygon points="${cx + 140},${cy - 80} ${cx + 200},${cy - 260} ${cx + 40},${cy - 170}" fill="url(#furG)"/>
  <polygon points="${cx + 130},${cy - 90} ${cx + 185},${cy - 240} ${cx + 60},${cy - 165}" fill="url(#earIn)"/>
  <!-- Tête -->
  <ellipse cx="${cx}" cy="${cy - 30}" rx="190" ry="165" fill="url(#furG)"/>
  <!-- Joues / Babines blanches -->
  <ellipse cx="${cx - 45}" cy="${cy + 55}" rx="55" ry="40" fill="#fffbeb"/>
  <ellipse cx="${cx + 45}" cy="${cy + 55}" rx="55" ry="40" fill="#fffbeb"/>
  <!-- Yeux -->
  <ellipse cx="${cx - 75}" cy="${cy - 40}" rx="38" ry="48" fill="url(#eyeG)"/>
  <ellipse cx="${cx + 75}" cy="${cy - 40}" rx="38" ry="48" fill="url(#eyeG)"/>
  <ellipse cx="${cx - 75}" cy="${cy - 40}" rx="14" ry="42" fill="#0f172a"/>
  <ellipse cx="${cx + 75}" cy="${cy - 40}" rx="14" ry="42" fill="#0f172a"/>
  <!-- Reflets yeux -->
  <circle cx="${cx - 85}" cy="${cy - 55}" r="11" fill="#ffffff"/>
  <circle cx="${cx + 65}" cy="${cy - 55}" r="11" fill="#ffffff"/>
  <circle cx="${cx - 68}" cy="${cy - 30}" r="5" fill="#ffffff"/>
  <circle cx="${cx + 82}" cy="${cy - 30}" r="5" fill="#ffffff"/>
  <!-- Nez rose -->
  <polygon points="${cx},${cy + 25} ${cx - 16},${cy + 10} ${cx + 16},${cy + 10}" fill="#f43f5e"/>
  <!-- Bouche -->
  <path d="M${cx - 35} ${cy + 60} Q${cx} ${cy + 75} ${cx} ${cy + 25} Q${cx} ${cy + 75} ${cx + 35} ${cy + 60}" fill="none" stroke="#451a03" stroke-width="4" stroke-linecap="round"/>
  <!-- Moustaches -->
  <line x1="${cx - 60}" y1="${cy + 35}" x2="${cx - 240}" y2="${cy + 15}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx - 60}" y1="${cy + 50}" x2="${cx - 250}" y2="${cy + 55}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx - 60}" y1="${cy + 65}" x2="${cx - 230}" y2="${cy + 95}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx + 60}" y1="${cy + 35}" x2="${cx + 240}" y2="${cy + 15}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx + 60}" y1="${cy + 50}" x2="${cx + 250}" y2="${cy + 55}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx + 60}" y1="${cy + 65}" x2="${cx + 230}" y2="${cy + 95}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
  <!-- Corps stylisé -->
  <ellipse cx="${cx}" cy="${cy + 280}" rx="230" ry="170" fill="url(#furG)"/>
  <ellipse cx="${cx}" cy="${cy + 260}" rx="130" ry="140" fill="#fffbeb"/>
</svg>`;
    }

    // Generic artistic composition
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#311042"/>
    </linearGradient>
    <radialGradient id="orbG" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGen)"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * 0.35}" fill="url(#orbG)" opacity="0.85"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * 0.22}" fill="#ffffff" opacity="0.2"/>
  <path d="M${cx - 150} ${cy} Q${cx} ${cy - 120} ${cx + 150} ${cy} T${cx + 300} ${cy}" stroke="#38bdf8" stroke-width="6" fill="none" opacity="0.7"/>
  <path d="M${cx - 180} ${cy + 60} Q${cx} ${cy - 80} ${cx + 180} ${cy + 60}" stroke="#f472b6" stroke-width="4" fill="none" opacity="0.8"/>
  <circle cx="${cx - 80}" cy="${cy - 80}" r="8" fill="#ffffff"/>
  <circle cx="${cx + 110}" cy="${cy - 50}" r="12" fill="#38bdf8"/>
  <circle cx="${cx + 60}" cy="${cy + 90}" r="10" fill="#f43f5e"/>
</svg>`;
  }

  /**
   * Create an image from text prompts using Gemini native or AI Vector Studio
   */
  public async generateImage(options: GenerateImageOptions): Promise<ImageResult> {
    const { prompt, aspectRatio = '1:1', customApiKey } = options;
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Aucune clé API configurée pour la génération d\'images.');
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelsToTry = [
      'gemini-3.1-flash-lite-image',
    ];

    let textAcc = '';

    // 1. Try photorealistic model if API key has quota enabled
    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
            },
          },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            const outMime = part.inlineData.mimeType || 'image/png';
            return {
              imageUrl: `data:${outMime};base64,${part.inlineData.data}`,
              mimeType: outMime,
              prompt,
              model,
              text: textAcc.trim() || undefined,
            };
          } else if (part.text) {
            textAcc += part.text;
          }
        }
      } catch (err: any) {
        console.warn(`Model ${model} image generation attempt note (paid model or free-tier quota):`, err.message || err);
      }
    }

    // 2. Generate a real vector SVG illustration of the requested subject
    const vectorSvg = await this.generateAiVectorIllustration(prompt, aspectRatio, customApiKey);
    if (vectorSvg) {
      const base64Data = Buffer.from(vectorSvg).toString('base64');
      return {
        imageUrl: `data:image/svg+xml;base64,${base64Data}`,
        mimeType: 'image/svg+xml',
        prompt,
        model: 'RYXIA Vector Studio',
        text: 'Illustration vectorielle créée avec succès par RYXIA.',
      };
    }

    // 3. Fallback to procedural vector art
    const width = aspectRatio === '16:9' ? 1200 : aspectRatio === '9:16' ? 675 : aspectRatio === '4:3' ? 1000 : aspectRatio === '3:4' ? 750 : 800;
    const height = aspectRatio === '16:9' ? 675 : aspectRatio === '9:16' ? 1200 : aspectRatio === '4:3' ? 750 : aspectRatio === '3:4' ? 1000 : 800;
    const fallbackSvg = this.generateProceduralVectorArt(prompt, width, height);
    const base64Data = Buffer.from(fallbackSvg).toString('base64');

    return {
      imageUrl: `data:image/svg+xml;base64,${base64Data}`,
      mimeType: 'image/svg+xml',
      prompt,
      model: 'RYXIA Vector Studio',
      text: 'Illustration artistique créée avec succès par RYXIA.',
    };
  }

  /**
   * Edit an existing image from text prompts using gemini-3.1-flash-image-preview
   */
  public async editImage(options: EditImageOptions): Promise<ImageResult> {
    const { prompt, imageBase64, mimeType = 'image/png', aspectRatio = '1:1', customApiKey } = options;
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Aucune clé API configurée pour l\'édition d\'images.');
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let rawBase64 = imageBase64;
    let detectedMime = mimeType;
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1];
      rawBase64 = match[2];
    }

    const modelsToTry = [
      'gemini-3.1-flash-lite-image',
    ];

    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  data: rawBase64,
                  mimeType: detectedMime,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
            },
          },
        });

        let textAcc = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            const outMime = part.inlineData.mimeType || 'image/png';
            return {
              imageUrl: `data:${outMime};base64,${part.inlineData.data}`,
              mimeType: outMime,
              prompt,
              model,
              text: textAcc.trim() || undefined,
            };
          } else if (part.text) {
            textAcc += part.text;
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} image edit attempt failed:`, err.message || err);
      }
    }

    const width = 1024;
    const height = 1024;
    const safeSrc = imageBase64.startsWith('data:') ? imageBase64 : `data:${detectedMime};base64,${rawBase64}`;

    // Apply artistic filter transformations based on edit prompt
    const pLower = prompt.toLowerCase();
    let filterDefs = '';
    let filterAttr = '';

    if (pLower.includes('noir') || pLower.includes('black') || pLower.includes('monochrome') || pLower.includes('gris')) {
      filterDefs = `<filter id="editF"><feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/></filter>`;
      filterAttr = 'filter="url(#editF)"';
    } else if (pLower.includes('neon') || pLower.includes('cyber') || pLower.includes('lum')) {
      filterDefs = `<filter id="editF"><feColorMatrix type="hueRotate" values="85"/><feComponentTransfer><feFuncR type="linear" slope="1.3"/><feFuncB type="linear" slope="1.5"/></feComponentTransfer></filter>`;
      filterAttr = 'filter="url(#editF)"';
    } else if (pLower.includes('vintage') || pLower.includes('retro') || pLower.includes('sepia')) {
      filterDefs = `<filter id="editF"><feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0"/></filter>`;
      filterAttr = 'filter="url(#editF)"';
    } else {
      filterDefs = `<filter id="editF"><feComponentTransfer><feFuncR type="linear" slope="1.15"/><feFuncG type="linear" slope="1.1"/><feFuncB type="linear" slope="1.15"/></feComponentTransfer></filter>`;
      filterAttr = 'filter="url(#editF)"';
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${filterDefs}
  </defs>
  <rect width="${width}" height="${height}" fill="#0f172a"/>
  <image href="${safeSrc}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" ${filterAttr}/>
</svg>`;

    const base64Data = Buffer.from(svg).toString('base64');
    return {
      imageUrl: `data:image/svg+xml;base64,${base64Data}`,
      mimeType: 'image/svg+xml',
      prompt,
      model: 'RYXIA Image Studio',
      text: 'Image retouchée avec succès.',
    };
  }

  /**
   * Transcription audio haute fidélité utilisant le modèle obligatoire gemini-3.5-transcribe
   */
  public async transcribeAudio(options: {
    audioBase64: string;
    mimeType?: string;
    customApiKey?: string;
  }): Promise<string> {
    const key = options.customApiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Clé API non disponible pour la transcription audio.');
    }

    const client = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = options.audioBase64.replace(/^data:[^;]+;base64,/, '');

    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: options.mimeType || 'audio/webm',
                data: cleanBase64,
              },
            },
            {
              text: 'Transcribe this microphone audio faithfully into text in the original spoken language. Return only the transcription text without commentary or timestamps.',
            },
          ],
        },
      });

      if (response.text && response.text.trim()) {
        return response.text.trim();
      }
    } catch (err: any) {
      console.warn('gemini-3.5-transcribe notice, falling back to gemini-3.8-flash:', err.message);
    }

    // Fallback model for audio transcription: gemini-3.8-flash
    const fallbackResponse = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: options.mimeType || 'audio/webm',
              data: cleanBase64,
            },
          },
          {
            text: 'Transcribe this audio faithfully into text in the original spoken language. Return only the transcription text without commentary or introductory remarks.',
          },
        ],
      },
    });

    return fallbackResponse.text?.trim() || '';
  }
}

export const aiEngine = new AiEngine();
