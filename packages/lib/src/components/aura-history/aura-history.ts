import {
  LitElement,
  html,
  unsafeCSS,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "@material/web/icon/icon.js";
import styles from "./aura-history.css?inline";
import type { AuraChatHistorySummary } from "../../types/index.js";
import { toAuraChatHistorySummaries } from "../../utils/histories.js";
import type { HistoryManager } from "../../services/history-manager.js";

@customElement("aura-history")
export class AuraHistory extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Object }) historyManager: HistoryManager | null = null;
  @property({ type: String }) activeConversationId = "";

  @state() private searchQuery = "";
  @state() private conversations: AuraChatHistorySummary[] = [];
  @state() private loading = false;

  override async updated(_changedProperties: PropertyValues): Promise<void> {
    if (_changedProperties.has("historyManager") && this.historyManager) {
      await this.loadConversations();
      this.searchQuery = "";
    }
  }

  override render(): TemplateResult {
    const filtered = this.getFilteredConversations();

    return html`
      <div class="history-overlay" @click=${this.handleOverlayClick}>
        <div class="history-modal" @click=${(e: Event) => e.stopPropagation()}>
          ${this.renderHeader()} ${this.renderSearch()}
          ${this.renderBody(filtered)}
        </div>
      </div>
    `;
  }

  private renderHeader(): TemplateResult {
    return html`
      <div class="history-modal__header">
        <div class="history-modal__header-left">
          <md-icon class="history-modal__header-icon">history</md-icon>
          <span class="history-modal__title">Conversation History</span>
        </div>
        <button
          class="history-modal__close"
          @click=${this.handleClose}
          aria-label="Close history"
        >
          <md-icon>close</md-icon>
        </button>
      </div>
    `;
  }

  private renderSearch(): TemplateResult {
    return html`
      <div class="history-search">
        <md-icon class="history-search__icon">search</md-icon>
        <input
          class="history-search__input"
          type="text"
          placeholder="Search conversations..."
          aria-label="Search conversations"
          .value=${this.searchQuery}
          @input=${this.handleSearch}
        />
      </div>
    `;
  }

  private renderBody(filtered: AuraChatHistorySummary[]): TemplateResult {
    return html`
      <div
        class="history-modal__body"
        role="listbox"
        aria-label="Conversation history"
      >
        ${this.loading
          ? this.renderLoadingState()
          : filtered.length === 0
            ? this.renderEmptyState()
            : filtered.map((conv) => this.renderConversationItem(conv))}
      </div>
    `;
  }

  private renderLoadingState(): TemplateResult {
    return html`
      <div
        class="history-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="history-loading__spinner" aria-hidden="true"></span>
        <span>Loading conversations...</span>
      </div>
    `;
  }

  private renderEmptyState(): TemplateResult {
    return html`
      <div class="history-empty">
        <md-icon class="history-empty__icon">forum</md-icon>
        <div class="history-empty__title">No conversations yet</div>
        <div class="history-empty__subtitle">
          Your chat history will appear here
        </div>
      </div>
    `;
  }

  private renderConversationItem(conv: AuraChatHistorySummary): TemplateResult {
    const isActive = conv.id === this.activeConversationId;
    return html`
      <div
        class="history-item ${isActive ? "active" : ""}"
        role="option"
        aria-selected=${isActive}
        tabindex="0"
        @click=${() => this.handleSelect(conv.id)}
        @keydown=${(e: KeyboardEvent) => this.handleItemKeydown(e, conv.id)}
      >
        <div class="history-item__content">
          <div class="history-item__title">${conv.title}</div>
          <div class="history-item__preview">${conv.preview}</div>
          <div class="history-item__meta">
            <span class="history-item__time">
              <md-icon class="history-item__meta-icon">schedule</md-icon>
              ${this.formatRelativeTime(conv.updatedAt)}
            </span>
            <span class="history-item__count">
              <md-icon class="history-item__meta-icon"
                >chat_bubble_outline</md-icon
              >
              ${conv.messageCount}
            </span>
          </div>
        </div>
        <button
          class="history-item__delete"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.handleDelete(conv.id);
          }}
          aria-label="Delete conversation"
          title="Delete"
        >
          <md-icon>delete_outline</md-icon>
        </button>
      </div>
    `;
  }

  private getFilteredConversations(): AuraChatHistorySummary[] {
    const query = this.searchQuery.toLowerCase();
    return query
      ? this.conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(query) ||
            c.preview.toLowerCase().includes(query),
        )
      : this.conversations;
  }

  private handleOverlayClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains("history-overlay")) {
      this.handleClose();
    }
  }

  private handleItemKeydown(e: KeyboardEvent, conversationId: string): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.handleSelect(conversationId);
    }
  }

  private loadConversations = async (): Promise<void> => {
    if (!this.historyManager) return;
    this.loading = true;
    try {
      const conversations = await this.historyManager.listConversations?.();
      this.conversations = toAuraChatHistorySummaries(conversations ?? []);
    } catch (err) {
      console.error("[aura-history] Failed to load conversations:", err);
    } finally {
      this.loading = false;
    }
  };

  private handleSearch(e: Event): void {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private handleClose(): void {
    this.searchQuery = "";
    this.dispatchEvent(
      new CustomEvent("history-closed", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async handleSelect(conversationId: string): Promise<void> {
    if (!this.historyManager) return;
    try {
      const loadedConversation =
        await this.historyManager.loadConversation?.(conversationId);
      this.dispatchEvent(
        new CustomEvent("conversation-selected", {
          bubbles: true,
          composed: true,
          detail: { conversation: loadedConversation },
        }),
      );
    } catch (err) {
      console.error("[aura-history] Failed to select conversation:", err);
    }
  }

  private async handleDelete(conversationId: string): Promise<void> {
    if (!this.historyManager) return;
    try {
      await this.historyManager.deleteConversation?.(conversationId);
      await this.loadConversations();
      this.dispatchEvent(
        new CustomEvent("conversation-deleted", {
          bubbles: true,
          composed: true,
          detail: { conversationId },
        }),
      );
    } catch (err) {
      console.error("[aura-history] Failed to delete conversation:", err);
    }
  }

  private formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-history": AuraHistory;
  }
}
