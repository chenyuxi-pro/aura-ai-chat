import { LitElement, html, unsafeCSS, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type {
  ChatMessage,
  PendingAction,
} from "../../types/index.js";
import styles from "./aura-messages.css?inline";
import { renderBasicMarkdown, formatTimestamp } from "../../utils/helpers.js";
import "../aura-action-preview/aura-action-preview.js";
import "../aura-agent-iteration/aura-agent-iteration.js";

@customElement("aura-messages")
export class AuraMessagesElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Object }) message!: ChatMessage;
  @property({ type: String }) aiIcon = "smart_toy";
  @property({ type: String }) aiName = "AI Assistant";
  @property({ type: Object }) action?: PendingAction;
  @property({ type: Boolean }) actionDisabled = false;
  @property({ type: Boolean }) streaming = false;

  private handleRetryClick(): void {
    this.dispatchEvent(
      new CustomEvent("retry", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult {
    if (this.action) return this.renderActionMessage();

    const msg = this.message;
    if (!msg) return html``;

    if (msg.metadata?.["isIteration"] === true) {
      return html`<aura-agent-iteration .message=${msg}></aura-agent-iteration>`;
    }

    const hasToolCalls = !!(msg.toolCalls && msg.toolCalls.length > 0);
    const isTool = msg.role === "tool";

    // Intermediate assistant planning/tool-call messages are represented
    // in the iteration timeline instead of as standalone chat bubbles.
    if (hasToolCalls) {
      return html``;
    }

    if (isTool) {
      // Tool outputs are shown inside the expanded step detail to keep the
      // transcript compact and grouped like an agent timeline.
      return html``;
    }

    const isUser = msg.role === "user";
    const isError = !!(
      msg.metadata?.["type"] === "error" || msg.metadata?.["isError"]
    );
    const layoutClass = isUser
      ? "user-message"
      : isError
        ? "error-message"
        : "ai-message";

    const senderLabel = isUser ? "You" : this.aiName;
    const avatarSymbol = isUser
      ? html`<md-icon>person</md-icon>`
      : isError
        ? html`<md-icon>error</md-icon>`
        : html`<md-icon>${this.aiIcon}</md-icon>`;

    return html`
      <div
        class="chat-message ${layoutClass}"
        role="log"
        aria-label="${senderLabel} message"
        part="message message-${msg.role}"
      >
        <div class="message-avatar" part="avatar">${avatarSymbol}</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${senderLabel}</span>
            <span class="message-time">
              <time datetime=${new Date(msg.timestamp).toISOString()}>
                ${formatTimestamp(msg.timestamp)}
              </time>
            </span>
          </div>
          <div class="message-body" part="message-body">
            <div
              class="message-text"
              .innerHTML=${renderBasicMarkdown(msg.content)}
            ></div>
            ${this.streaming
              ? html`
                  <span class="streaming-dots">
                    <span class="streaming-dot"></span>
                    <span class="streaming-dot"></span>
                    <span class="streaming-dot"></span>
                  </span>
                `
              : nothing}
            ${isError
              ? html`
                  <button
                    class="retry-btn"
                    part="retry-button"
                    @click=${this.handleRetryClick}
                  >
                    Retry
                  </button>
                `
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private renderActionMessage(): TemplateResult {
    const a = this.action!;
    return html`
      <div
        class="chat-message ai-message"
        role="log"
        aria-label="${this.aiName} action confirmation"
        part="message message-action"
      >
        <div class="message-avatar" part="avatar">
          <md-icon>${this.aiIcon}</md-icon>
        </div>
        <div class="message-content" style="max-width: 85%">
          <div class="message-header">
            <span class="message-sender">${this.aiName}</span>
            <span class="message-time">
              <time datetime=${new Date().toISOString()}>
                ${formatTimestamp(Date.now())}
              </time>
            </span>
          </div>
          <div class="message-body message-body--action" part="message-body">
            <action-preview
              .action=${a}
              .disabled=${this.actionDisabled}
              @approve-action=${(e: CustomEvent) => {
                e.stopPropagation();
                this.dispatchEvent(
                  new CustomEvent("approve-action", {
                    bubbles: true,
                    composed: true,
                    detail: e.detail,
                  }),
                );
              }}
              @reject-action=${(e: CustomEvent) => {
                e.stopPropagation();
                this.dispatchEvent(
                  new CustomEvent("reject-action", {
                    bubbles: true,
                    composed: true,
                    detail: e.detail,
                  }),
                );
              }}
            ></action-preview>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-messages": AuraMessagesElement;
  }
}
