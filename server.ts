import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { db } from './server/db.ts';
import { hashPassword, verifyPassword, generateToken, authenticateToken, AuthenticatedRequest } from './server/auth.ts';
import { aiEngine } from './server/ai/provider.ts';
import { Conversation, Message, RyxiaMode } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- Health / Info ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'RYXIA', signature: 'RYXIA — by Adan', version: '1.0.0 Pro' });
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà.' });
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser = db.createUser({
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(email)}`,
    });

    const token = generateToken(newUser);
    res.cookie('ryxia_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la création du compte.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = generateToken(user);
    res.cookie('ryxia_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
});

app.post('/api/auth/guest', async (req, res) => {
  try {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const guestEmail = `${guestId}@ryxia.local`;
    const passwordHash = await hashPassword('ryxia_guest_pass');

    const newUser = db.createUser({
      id: guestId,
      name: 'Invité',
      email: guestEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${guestId}`,
    });

    const token = generateToken(newUser);
    res.cookie('ryxia_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      },
      isGuest: true,
    });
  } catch (err: any) {
    console.error('Guest auth error:', err);
    return res.status(500).json({ error: 'Erreur création session invitée' });
  }
});

// Firebase Auth Google Sign-in Sync Endpoint
app.post('/api/auth/firebase-sync', async (req, res) => {
  try {
    const { uid, email, name, avatar } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID Firebase manquant.' });
    }

    let user = db.findUserById(uid);
    if (!user) {
      const passwordHash = await hashPassword(`fb_secret_${uid}`);
      user = db.createUser({
        id: uid,
        name: name || (email ? email.split('@')[0] : 'Utilisateur Google'),
        email: email || `${uid}@firebase.user`,
        passwordHash,
        avatar: avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${uid}`,
        createdAt: new Date().toISOString(),
      });
    } else if (name || avatar) {
      db.updateUserProfile(uid, { name, avatar });
      user = db.findUserById(uid);
    }

    if (!user) {
      return res.status(500).json({ error: 'Erreur lors de la création du profil utilisateur.' });
    }

    const token = generateToken(user);
    res.cookie('ryxia_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const stats = db.getUserStats(user.id);
    const settings = db.getSettings(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      stats,
      settings,
    });
  } catch (err: any) {
    console.error('Firebase sync error:', err);
    return res.status(500).json({ error: 'Erreur lors de la synchronisation Firebase.' });
  }
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const stats = db.getUserStats(user.id);
  const settings = db.getSettings(user.id);

  // Return clean user object without password hash
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    stats,
    settings,
  });
});

app.patch('/api/auth/profile', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { name, avatar } = req.body;
  const updated = db.updateUserProfile(user.id, { name, avatar });
  return res.json({ user: updated });
});

// --- Conversations Routes ---
app.get('/api/conversations', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const conversations = db.getConversations(userId);
  return res.json({ conversations });
});

app.post('/api/conversations', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { title, mode } = req.body;

  const validMode: RyxiaMode = ['general', 'code', 'study', 'creative', 'fast'].includes(mode) ? mode : 'general';
  const newConv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: title ? title.trim() : 'Nouvelle conversation',
    mode: validMode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = db.createConversation(newConv);
  return res.status(201).json({ conversation: saved });
});

app.get('/api/conversations/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const conversation = db.getConversation(id, userId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  const messages = db.getMessages(id, userId);
  return res.json({ conversation, messages });
});

app.patch('/api/conversations/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { title, mode } = req.body;

  const updated = db.updateConversation(id, userId, { title, mode });
  if (!updated) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  return res.json({ conversation: updated });
});

app.delete('/api/conversations/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const deleted = db.deleteConversation(id, userId);
  if (!deleted) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  return res.json({ success: true });
});

app.delete('/api/conversations', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const count = db.clearAllConversations(userId);
  return res.json({ success: true, count });
});

app.get('/api/conversations/:id/export', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const format = req.query.format === 'json' ? 'json' : 'markdown';

  const conv = db.getConversation(id, userId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation introuvable.' });
  }

  const messages = db.getMessages(id, userId);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ryxia_${conv.id}.json"`);
    return res.send(JSON.stringify({ conversation: conv, messages }, null, 2));
  }

  let md = `# ${conv.title}\n\n`;
  md += `**Date**: ${new Date(conv.createdAt).toLocaleDateString()} | **Mode**: ${conv.mode.toUpperCase()}\n`;
  md += `**Signature**: RYXIA — by Adan\n\n---\n\n`;

  for (const m of messages) {
    md += `### ${m.role === 'user' ? 'Vous' : 'RYXIA (' + m.model + ')'}\n\n`;
    md += `${m.content}\n\n---\n\n`;
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ryxia_${conv.id}.md"`);
  return res.send(md);
});

// --- Chat Streaming Route (SSE) ---
app.post('/api/chat/stream', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { conversationId, message, mode, regenerate, groundingPreference, latLng } = req.body;

  let conv = db.getConversation(conversationId, userId);
  if (!conv) {
    // Auto-create conversation if none provided
    const newMode: RyxiaMode = ['general', 'code', 'study', 'creative', 'fast'].includes(mode) ? mode : 'general';
    conv = db.createConversation({
      id: conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: message ? message.slice(0, 40) : 'Nouvelle conversation',
      mode: newMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Update mode if explicitly provided
  if (mode && mode !== conv.mode && ['general', 'code', 'study', 'creative', 'fast'].includes(mode)) {
    conv = db.updateConversation(conv.id, userId, { mode })!;
  }

  // If regenerate, pop last assistant message
  if (regenerate) {
    db.deleteLastAssistantMessage(conv.id);
  } else if (message) {
    // Add new user message
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      conversationId: conv.id,
      role: 'user',
      content: message.trim(),
      createdAt: new Date().toISOString(),
      model: 'user',
    };
    db.addMessage(userMsg);

    // If this is the first message in conversation, update title dynamically
    const allMsgs = db.getMessages(conv.id, userId);
    if (allMsgs.length <= 1) {
      const cleanTitle = message.trim().slice(0, 48) + (message.length > 48 ? '...' : '');
      db.updateConversation(conv.id, userId, { title: cleanTitle });
    }
  }

  // Fetch full conversation history for context memory
  const history = db.getMessages(conv.id, userId);
  const contextMessages = history.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  const userSettings = db.getSettings(userId);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial conversation metadata
  res.write(`data: ${JSON.stringify({ type: 'init', conversationId: conv.id, title: conv.title, mode: conv.mode })}\n\n`);

  let accumulatedText = '';
  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    await aiEngine.streamChat(
      {
        mode: conv.mode,
        messages: contextMessages,
        customApiKey: userSettings.customOpenAiKey,
        customModel: userSettings.customOpenAiModel || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        providerPreference: userSettings.aiProvider || 'auto',
        groundingPreference: groundingPreference || 'auto',
        latLng,
        signal: abortController.signal,
      },
      {
        onChunk: (chunk: string) => {
          accumulatedText += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        },
        onDone: (fullText: string, modelName: string, sources?: any[]) => {
          const finalContent = fullText || accumulatedText;
          const assistantMsg: Message = {
            id: `msg_${Date.now()}_a`,
            conversationId: conv!.id,
            role: 'assistant',
            content: finalContent,
            createdAt: new Date().toISOString(),
            model: modelName,
            sources,
          };
          db.addMessage(assistantMsg);

          res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMsg })}\n\n`);
          res.end();
        },
        onError: (err: any) => {
          console.error('Chat stream error:', err);
          res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Une erreur est survenue lors de la génération.' })}\n\n`);
          res.end();
        },
      }
    );
  } catch (err: any) {
    console.error('Unexpected streaming error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'RYXIA est temporairement indisponible. Réessayez dans quelques instants.' })}\n\n`);
    res.end();
  }
});

// --- Settings Routes ---
app.get('/api/settings', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const settings = db.getSettings(userId);
  return res.json({ settings });
});

app.patch('/api/settings', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const updated = db.updateSettings(userId, req.body);
  return res.json({ settings: updated });
});

// --- Stats Route ---
app.get('/api/stats', authenticateToken, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const stats = db.getUserStats(userId);
  return res.json({ stats });
});

// --- Vite Middleware (Dev) or Static Hosting (Prod) ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RYXIA Engine] Server is active at http://0.0.0.0:${PORT}`);
    console.log(`[RYXIA Engine] Signature: RYXIA — by Adan | Your AI. Your way.`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting RYXIA server:', err);
});
