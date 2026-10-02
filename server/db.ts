import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User, Conversation, Message, UserSettings, UserStats } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'ryxia_db.json');

export interface StoredUser extends User {
  passwordHash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  conversations: Conversation[];
  messages: Message[];
  settings: Record<string, UserSettings>;
}

const defaultDatabase: DatabaseSchema = {
  users: [],
  conversations: [],
  messages: [],
  settings: {},
};

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDataDir();
    this.data = this.load();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading database file, falling back to default:', err);
    }
    return JSON.parse(JSON.stringify(defaultDatabase));
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.flush();
    }, 100);
  }

  public flush() {
    try {
      this.ensureDataDir();
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // Users
  public findUserByEmail(email: string): StoredUser | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(user: StoredUser): StoredUser {
    this.data.users.push(user);
    // Initialize default settings
    this.data.settings[user.id] = {
      userId: user.id,
      theme: 'obsidian',
      fontSize: 'md',
      enterSends: true,
      animations: true,
      aiProvider: 'auto',
      customOpenAiModel: 'gpt-5.6-luna',
    };
    this.scheduleSave();
    return user;
  }

  public updateUserProfile(id: string, updates: Partial<User>): User | undefined {
    const user = this.data.users.find(u => u.id === id);
    if (!user) return undefined;
    if (updates.name) user.name = updates.name;
    if (updates.avatar) user.avatar = updates.avatar;
    this.scheduleSave();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }

  // Conversations
  public getConversations(userId: string): Conversation[] {
    const userConvs = this.data.conversations
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return userConvs.map(c => {
      const msgs = this.data.messages.filter(m => m.conversationId === c.id);
      const lastMsg = msgs[msgs.length - 1];
      return {
        ...c,
        messagesCount: msgs.length,
        lastMessageSnippet: lastMsg ? (lastMsg.content.slice(0, 75) + (lastMsg.content.length > 75 ? '...' : '')) : '',
      };
    });
  }

  public getConversation(id: string, userId: string): Conversation | undefined {
    return this.data.conversations.find(c => c.id === id && c.userId === userId);
  }

  public createConversation(conv: Conversation): Conversation {
    this.data.conversations.push(conv);
    this.scheduleSave();
    return conv;
  }

  public updateConversation(id: string, userId: string, updates: Partial<Conversation>): Conversation | undefined {
    const conv = this.data.conversations.find(c => c.id === id && c.userId === userId);
    if (!conv) return undefined;
    if (updates.title) conv.title = updates.title;
    if (updates.mode) conv.mode = updates.mode;
    conv.updatedAt = new Date().toISOString();
    this.scheduleSave();
    return conv;
  }

  public deleteConversation(id: string, userId: string): boolean {
    const initialLen = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter(c => !(c.id === id && c.userId === userId));
    if (this.data.conversations.length !== initialLen) {
      // Remove messages for this conversation
      this.data.messages = this.data.messages.filter(m => m.conversationId !== id);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public clearAllConversations(userId: string): number {
    const convIdsToDelete = this.data.conversations
      .filter(c => c.userId === userId)
      .map(c => c.id);
    this.data.conversations = this.data.conversations.filter(c => c.userId !== userId);
    this.data.messages = this.data.messages.filter(m => !convIdsToDelete.includes(m.conversationId));
    this.scheduleSave();
    return convIdsToDelete.length;
  }

  // Messages
  public getMessages(conversationId: string, userId: string): Message[] {
    const conv = this.getConversation(conversationId, userId);
    if (!conv) return [];
    return this.data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public addMessage(msg: Message): Message {
    this.data.messages.push(msg);
    // update parent conversation updatedAt
    const conv = this.data.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.updatedAt = new Date().toISOString();
    }
    this.scheduleSave();
    return msg;
  }

  public deleteLastAssistantMessage(conversationId: string): Message | null {
    const msgs = this.data.messages.filter(m => m.conversationId === conversationId);
    if (msgs.length === 0) return null;
    const last = msgs[msgs.length - 1];
    if (last.role === 'assistant') {
      this.data.messages = this.data.messages.filter(m => m.id !== last.id);
      this.scheduleSave();
      return last;
    }
    return null;
  }

  // Settings
  public getSettings(userId: string): UserSettings {
    if (!this.data.settings[userId]) {
      this.data.settings[userId] = {
        userId,
        theme: 'obsidian',
        fontSize: 'md',
        enterSends: true,
        animations: true,
        aiProvider: 'auto',
        customOpenAiModel: 'gpt-5.6-luna',
      };
      this.scheduleSave();
    }
    return this.data.settings[userId];
  }

  public updateSettings(userId: string, updates: Partial<UserSettings>): UserSettings {
    const current = this.getSettings(userId);
    this.data.settings[userId] = { ...current, ...updates, userId };
    this.scheduleSave();
    return this.data.settings[userId];
  }

  // Stats
  public getUserStats(userId: string): UserStats {
    const user = this.findUserById(userId);
    const convs = this.data.conversations.filter(c => c.userId === userId);
    const convIds = convs.map(c => c.id);
    const msgs = this.data.messages.filter(m => convIds.includes(m.conversationId));

    // Calculate favorite mode
    const modeCounts: Record<string, number> = {};
    for (const c of convs) {
      modeCounts[c.mode] = (modeCounts[c.mode] || 0) + 1;
    }
    let favoriteMode: any = 'general';
    let max = 0;
    for (const [m, cnt] of Object.entries(modeCounts)) {
      if (cnt > max) {
        max = cnt;
        favoriteMode = m;
      }
    }

    return {
      totalConversations: convs.length,
      totalMessages: msgs.length,
      favoriteMode,
      memberSince: user ? user.createdAt : new Date().toISOString(),
    };
  }
}

export const db = new Database();
