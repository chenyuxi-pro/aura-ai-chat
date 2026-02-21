/* ──────────────────────────────────────────────────────────────────
 *  <aura-history> — Conversation history side drawer
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ConversationMeta } from '../../types/index.js';
import styles from './aura-history.css?inline';

@customElement('aura-history')
export class AuraHistory extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Array }) conversations: ConversationMeta[] = [];
  @property() activeConversationId = '';
  @property({ type: Boolean }) canDelete = false;
  @property({ type: Boolean }) canRename = false;

  override render() {
    if (!this.open) return nothing;

    return html`
      <div class="overlay" @click=${this._onClose}></div>
      <div class="drawer">
        <div class="drawer-header">
          <h3>History</h3>
          <button class="close-btn" @click=${this._onClose}>✕</button>
        </div>
        <div class="drawer-body">
          ${this.conversations.length === 0
        ? html`
                <div class="empty-state">
                  <div class="empty-icon">💬</div>
                  <div>No conversations yet</div>
                </div>
              `
        : this.conversations.map(conv => this._renderConversation(conv))}
        </div>
      </div>
    `;
  }

  private _renderConversation(conv: ConversationMeta) {
    const isActive = conv.id === this.activeConversationId;
    const date = new Date(conv.updatedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return html`
      <div
        class="conversation-item ${isActive ? 'active' : ''}"
        @click=${() => this._selectConversation(conv.id)}
      >
        <span class="conv-icon">💬</span>
        <div class="conv-info">
          <div class="conv-title">${conv.title || 'Untitled'}</div>
          <div class="conv-date">${date}</div>
        </div>
        <div class="conv-actions">
          ${this.canRename
        ? html`
                <button class="conv-action-btn" title="Rename" @click=${(e: Event) => { e.stopPropagation(); this._renameConversation(conv); }}>
                  ✏️
                </button>
              `
        : nothing}
          ${this.canDelete
        ? html`
                <button class="conv-action-btn delete" title="Delete" @click=${(e: Event) => { e.stopPropagation(); this._deleteConversation(conv.id); }}>
                  🗑️
                </button>
              `
        : nothing}
        </div>
      </div>
    `;
  }

  private _selectConversation(id: string) {
    this.dispatchEvent(
      new CustomEvent('select-conversation', { detail: { id }, bubbles: true, composed: true })
    );
  }

  private _deleteConversation(id: string) {
    this.dispatchEvent(
      new CustomEvent('delete-conversation', { detail: { id }, bubbles: true, composed: true })
    );
  }

  private _renameConversation(conv: ConversationMeta) {
    const newTitle = prompt('Rename conversation:', conv.title || 'Untitled');
    if (newTitle !== null) {
      this.dispatchEvent(
        new CustomEvent('rename-conversation', {
          detail: { id: conv.id, title: newTitle },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _onClose() {
    this.dispatchEvent(new CustomEvent('close-history', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'aura-history': AuraHistory;
  }
}
