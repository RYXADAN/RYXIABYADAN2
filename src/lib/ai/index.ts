export * from '../modes.ts';
export * from '../../types/index.ts';

export interface ChatCompletionPayload {
  conversationId: string;
  message: string;
  mode?: string;
}
