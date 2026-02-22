import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ToolCallRequest } from "../../types/index.js";
import styles from "./confirmation-bubble.css?inline";

@customElement("confirmation-bubble")
export class ConfirmationBubbleElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Object }) toolCall!: ToolCallRequest;
  @property({ type: String }) toolDisplayName = "";

  override render(): TemplateResult {
    const name = this.toolDisplayName || this.toolCall?.id || "Unknown tool";
    const args = this.toolCall
      ? JSON.stringify(this.toolCall.arguments, null, 2)
      : "{}";

    return html`
      <div class="overlay" @click=${this.handleCancel}></div>
      <div
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div class="dialog_icon">
          <md-icon>warning</md-icon>
        </div>
        <h3 class="dialog_title" id="confirm-title">Confirm: ${name}</h3>
        <p class="dialog_description" id="confirm-desc">
          This tool requires your confirmation before executing. Review the
          parameters below and choose to proceed or cancel.
        </p>
        <div class="dialog_details">${args}</div>
        <div class="dialog_actions">
          <button class="btn btn--cancel" @click=${this.handleCancel}>
            Cancel
          </button>
          <button
            class="btn btn--confirm"
            @click=${this.handleConfirm}
            autofocus
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    `;
  }

  private handleConfirm(): void {
    this.dispatchEvent(
      new CustomEvent("confirm-result", {
        bubbles: true,
        composed: true,
        detail: { confirmed: true },
      }),
    );
  }

  private handleCancel(): void {
    this.dispatchEvent(
      new CustomEvent("confirm-result", {
        bubbles: true,
        composed: true,
        detail: { confirmed: false },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "confirmation-bubble": ConfirmationBubbleElement;
  }
}
