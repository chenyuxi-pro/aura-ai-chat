import type {
  AuraConfig,
  ChatMessage,
  Conversation,
  IConversationManager,
} from "../types/index.js";
import { AuraEventType } from "../types/index.js";
import type { EventBus } from "./event-bus.js";

function makeConversation(): Conversation {
  const now = Date.now();
  return {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
    title: "New Conversation",
  };
}

export class HistoryManager {
  private history: Conversation[] = [];
  private conversation: Conversation | null = null;
  private readonly conversationManager: IConversationManager | undefined;

  constructor(
    config: AuraConfig,
    private eventBus: EventBus | undefined,
  ) {
    this.conversationManager = config.agent?.conversationManager ?? config.history?.manager;
  }

  getCurrentConversation(): Conversation | null {
    return this.conversation;
  }

  getConversation(): Conversation {
    if (!this.conversation) {
      const conv = makeConversation();
      this.conversation = conv;
      this.upsertConversation(conv);
    }
    return this.conversation;
  }

  getMessages(): ChatMessage[] {
    return [...this.getConversation().messages];
  }

  async newConversation(): Promise<Conversation> {
    const local = makeConversation();

    if (this.conversationManager?.createConversation) {
      this.conversation = await this.conversationManager.createConversation(local);
    } else {
      this.conversation = local;
    }

    this.upsertConversation(this.conversation);
    this.eventBus?.emit(AuraEventType.ConversationStarted, {
      conversationId: this.conversation.id,
      conversation: this.conversation,
    });
    return this.conversation;
  }

  async createConversation(): Promise<Conversation> {
    return this.newConversation();
  }

  async loadConversation(conversationId: string): Promise<Conversation | null> {
    if (this.conversation?.id === conversationId) return this.conversation;

    let loaded: Conversation | null = null;
    if (this.conversationManager?.loadConversation) {
      loaded = await this.conversationManager.loadConversation(conversationId);
    } else if (this.conversationManager?.getConversation) {
      loaded = (await this.conversationManager.getConversation(conversationId)) ?? null;
    }

    if (!loaded) {
      loaded = this.history.find((c) => c.id === conversationId) ?? null;
    }

    if (loaded) {
      this.conversation = loaded;
      this.upsertConversation(loaded);
    }

    return loaded;
  }

  async listConversations(): Promise<Conversation[]> {
    if (this.conversationManager?.listConversations) {
      this.history = await this.conversationManager.listConversations();
      if (this.conversation) {
        const updated = this.history.find((c) => c.id === this.conversation!.id);
        if (updated) this.conversation = updated;
      }
    }

    return [...this.history].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async pushAndPersistMessage(message: ChatMessage): Promise<void> {
    this.pushMessage(message);

    if (this.conversationManager?.saveMessage) {
      await this.conversationManager.saveMessage(this.getConversation().id, message);
    }
  }

  pushMessage(message: ChatMessage): void {
    const conv = this.getConversation();
    conv.messages.push(message);
    conv.updatedAt = Date.now();
    this.upsertConversation(conv);
  }

  replaceMessage(id: string, updates: Partial<ChatMessage>): void {
    const conv = this.getConversation();
    const idx = conv.messages.findIndex((m) => m.id === id);
    if (idx >= 0) {
      conv.messages[idx] = { ...conv.messages[idx], ...updates };
      conv.updatedAt = Date.now();
      this.upsertConversation(conv);
    }
  }

  async persistExistingMessage(id: string): Promise<void> {
    if (!this.conversationManager?.saveMessage) return;
    const conv = this.getConversation();
    const msg = conv.messages.find((m) => m.id === id);
    if (msg) {
      await this.conversationManager.saveMessage(conv.id, msg);
    }
  }

  async addMessage(conversationId: string, msg: ChatMessage): Promise<void> {
    if (this.conversation?.id !== conversationId) {
      const loaded = await this.loadConversation(conversationId);
      if (!loaded) {
        this.conversation = {
          ...makeConversation(),
          id: conversationId,
        };
        this.upsertConversation(this.conversation);
      }
    }
    await this.pushAndPersistMessage(msg);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.loadConversation(id);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (this.conversationManager?.deleteConversation) {
      await this.conversationManager.deleteConversation(conversationId);
    }

    this.history = this.history.filter((c) => c.id !== conversationId);
    if (this.conversation?.id === conversationId) {
      this.conversation = null;
    }

    this.eventBus?.emit(AuraEventType.ConversationDeleted, { conversationId });
  }

  async clearHistory(): Promise<void> {
    if (this.conversationManager?.clearHistory) {
      await this.conversationManager.clearHistory();
    }
    this.history = [];
    this.conversation = null;
    this.eventBus?.emit(AuraEventType.HistoryCleared, {});
  }

  private upsertConversation(conversation: Conversation): void {
    const idx = this.history.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) {
      this.history[idx] = { ...conversation };
    } else {
      this.history.unshift({ ...conversation });
    }
  }
}
