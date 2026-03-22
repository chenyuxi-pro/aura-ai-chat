import { Injectable } from '@angular/core';
import type { ChatMessage, Conversation, IConversationManager } from 'aura-ai-chat';

const STORAGE_KEY = 'angular-host-app:conversations';

interface StoredConversationRecord {
  id: string;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  messages?: unknown;
}

interface ConversationCandidate {
  id: string;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  messages?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  getManager(): IConversationManager {
    return {
      createConversation: async (conversation?: Conversation): Promise<Conversation> => {
        const created = this.normalizeConversation(
          conversation ?? {
            id: crypto.randomUUID(),
            title: 'New conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
          },
        );

        const store = this.readStore();
        store[created.id] = created;
        this.writeStore(store);
        return created;
      },
      loadConversation: async (conversationId: string): Promise<Conversation | null> => {
        return this.readStore()[conversationId] ?? null;
      },
      listConversations: async (): Promise<Conversation[]> => {
        return Object.values(this.readStore()).sort((left, right) => right.updatedAt - left.updatedAt);
      },
      saveMessage: async (conversationId: string, message: ChatMessage): Promise<void> => {
        const store = this.readStore();
        const timestamp = this.toTimestamp(message.timestamp);
        const existing = store[conversationId] ?? {
          id: conversationId,
          title: 'New conversation',
          createdAt: timestamp,
          updatedAt: timestamp,
          messages: [],
        };

        const messages = [...existing.messages];
        const existingIndex = messages.findIndex((entry) => entry.id === message.id);

        if (existingIndex >= 0) {
          messages[existingIndex] = message;
        } else {
          messages.push(message);
        }

        const updatedConversation: Conversation = {
          ...existing,
          title: this.inferTitle(existing.title, messages),
          updatedAt: Date.now(),
          messages,
        };

        store[conversationId] = updatedConversation;
        this.writeStore(store);
      },
      deleteConversation: async (conversationId: string): Promise<void> => {
        const store = this.readStore();
        delete store[conversationId];
        this.writeStore(store);
      },
      clearHistory: async (): Promise<void> => {
        localStorage.removeItem(STORAGE_KEY);
      },
    };
  }

  private inferTitle(currentTitle: string | undefined, messages: ChatMessage[]): string {
    if (currentTitle && currentTitle !== 'New conversation') {
      return currentTitle;
    }

    const firstUserMessage = messages.find((message) => message.role === 'user');
    const trimmed = firstUserMessage?.content.trim();

    if (!trimmed) {
      return 'New conversation';
    }

    return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
  }

  private readStore(): Record<string, Conversation> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, StoredConversationRecord>;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return Object.fromEntries(
        Object.entries(parsed).map(([id, value]) => {
          const normalized = this.normalizeConversation({
            id,
            title: typeof value?.title === 'string' ? value.title : 'New conversation',
            createdAt: value?.createdAt,
            updatedAt: value?.updatedAt,
            messages: value?.messages,
          });

          return [normalized.id, normalized];
        }),
      );
    } catch {
      return {};
    }
  }

  private writeStore(store: Record<string, Conversation>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  private normalizeConversation(value: ConversationCandidate): Conversation {
    const messages = Array.isArray(value.messages)
      ? value.messages.filter(this.isChatMessage).map((message) => ({
        ...message,
        timestamp: this.toTimestamp(message.timestamp),
      }))
      : [];

    const createdAt = this.toTimestamp(value.createdAt, messages[0]?.timestamp ?? Date.now());
    const updatedAt = this.toTimestamp(
      value.updatedAt,
      messages[messages.length - 1]?.timestamp ?? createdAt,
    );

    return {
      id: value.id,
      title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'New conversation',
      createdAt,
      updatedAt,
      messages,
    };
  }

  private isChatMessage(value: unknown): value is ChatMessage {
    return typeof value === 'object' && value !== null && typeof (value as ChatMessage).id === 'string';
  }

  private toTimestamp(value: unknown, fallback = Date.now()): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}
