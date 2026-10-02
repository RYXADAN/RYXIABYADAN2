export type RyxiaMode = 'general' | 'code' | 'study' | 'creative' | 'fast';

export interface RyxiaModeConfig {
  id: RyxiaMode;
  name: string;
  badge: string;
  description: string;
  systemPrompt: string;
  suggestions: {
    title: string;
    prompt: string;
    icon: string;
  }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  type: 'search' | 'maps';
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model: string;
  sources?: GroundingSource[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  mode: RyxiaMode;
  createdAt: string;
  updatedAt: string;
  messagesCount?: number;
  lastMessageSnippet?: string;
}

export interface UserSettings {
  userId: string;
  theme: 'dark' | 'light' | 'obsidian' | 'midnight';
  fontSize: 'sm' | 'md' | 'lg';
  enterSends: boolean;
  animations: boolean;
  aiProvider: 'auto' | 'openai' | 'gemini';
  customOpenAiModel?: string;
  customOpenAiKey?: string;
}

export interface UserStats {
  totalConversations: number;
  totalMessages: number;
  favoriteMode: RyxiaMode;
  memberSince: string;
}
