import { Injectable } from '@angular/core';
import type { ConversationHistoryProvider, ConversationMeta, Message } from 'aura-ai-chat';
import type { Conversation, ConversationSummary } from '../models/conversation.model';

const STORAGE_KEY = 'angular-host-app:conversations';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  async onNew(): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    const conversations = this.readStore();
    conversations[conversation.id] = conversation;
    this.writeStore(conversations);

    return conversation;
  }

  async onLoad(id: string): Promise<Message[]> {
    const conversation = this.readStore()[id];
    return conversation?.messages ?? [];
  }

  async onSave(conversation: Conversation): Promise<void> {
    const store = this.readStore();
    store[conversation.id] = {
      ...conversation,
      updatedAt: new Date().toISOString(),
    };
    this.writeStore(store);
  }

  async onHistory(): Promise<ConversationSummary[]> {
    const store = this.readStore();
    return Object.values(store)
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getCallbacks(): ConversationHistoryProvider {
    return {
      createConversation: async (): Promise<ConversationMeta> => {
        const conversation = await this.onNew();
        return this.toMeta(conversation);
      },
      listConversations: async (): Promise<ConversationMeta[]> => {
        const history = await this.onHistory();
        return history.map((entry) => ({
          id: entry.id,
          title: entry.title,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }));
      },
      getMessages: async (conversationId: string): Promise<Message[]> => {
        return this.onLoad(conversationId);
      },
      saveMessage: async (conversationId: string, message: Message): Promise<void> => {
        const store = this.readStore();
        const existing = store[conversationId] ?? {
          id: conversationId,
          title: 'New conversation',
          createdAt: message.createdAt,
          updatedAt: message.createdAt,
          messages: [],
        };

        const updatedMessages = [...existing.messages, message];
        const inferredTitle =
          existing.title && existing.title !== 'New conversation'
            ? existing.title
            : this.inferTitleFromMessages(updatedMessages);

        const updatedConversation: Conversation = {
          ...existing,
          title: inferredTitle,
          updatedAt: new Date().toISOString(),
          messages: updatedMessages,
        };

        await this.onSave(updatedConversation);
      },
      deleteConversation: async (conversationId: string): Promise<void> => {
        const store = this.readStore();
        delete store[conversationId];
        this.writeStore(store);
      },
      updateConversation: async (
        conversationId: string,
        patch: Partial<ConversationMeta>,
      ): Promise<void> => {
        const store = this.readStore();
        const existing = store[conversationId];
        if (!existing) {
          return;
        }

        store[conversationId] = {
          ...existing,
          title: patch.title ?? existing.title,
          updatedAt: new Date().toISOString(),
        };

        this.writeStore(store);
      },
    };
  }

  private inferTitleFromMessages(messages: Message[]): string {
    const firstUserMessage = messages.find((message) => message.role === 'user');
    if (!firstUserMessage) {
      return 'New conversation';
    }

    const trimmed = firstUserMessage.content.trim();
    if (!trimmed) {
      return 'New conversation';
    }

    return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
  }

  private toMeta(conversation: Conversation): ConversationMeta {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private readStore(): Record<string, Conversation> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, Conversation>;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  }

  private writeStore(store: Record<string, Conversation>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}