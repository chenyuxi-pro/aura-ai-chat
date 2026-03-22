import { LitElement, html, unsafeCSS, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type {
  PendingAction,
  ActionStatusType,
  ToolResultContent,
} from "../../types/index.js";
import styles from "./aura-action-preview.css?inline";
import "../aura-json-view/aura-json-view.js";

const STATUS_LABELS: Record<ActionStatusType, string> = {
  pending: "Pending",
  executing: "Executing",
  completed: "Completed",
  failed: "Failed",
  rejected: "Rejected",
  "timed-out": "Timed Out",
};

@customElement("action-preview")
export class ActionPreviewElement extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Object }) action!: PendingAction;
  @property({ type: Boolean }) disabled = false;

  override render(): TemplateResult | typeof nothing {
    const a = this.action;
    if (!a) return nothing;

    const statusClass = `card--${a.status}`;
    const isDestructive = a.risk === "destructive";
    const riskClass = isDestructive ? "risk-destructive" : "risk-moderate";
    const isPending = a.status === "pending";
    const showButtons = isPending && !this.disabled;

    return html`
      <div class="card ${statusClass} ${riskClass}" part="card">
        <div class="header" part="header">
          <span class="header__icon">
            <md-icon>${isDestructive ? "warning" : "build"}</md-icon>
          </span>
          <span class="header__title">${a.title ?? a.toolName}</span>
          <span class="badge badge--${a.status}">
            ${STATUS_LABELS[a.status]}
          </span>
        </div>

        ${a.description
          ? html`<div class="description" part="description">
              ${a.description}
            </div>`
          : nothing}
        ${this.renderPreview()}
        ${a.error
          ? html`<div class="error-section" part="error">${a.error}</div>`
          : nothing}
        ${showButtons
          ? html`
              <div class="actions" part="actions">
                <button class="btn btn--reject" @click=${this.handleReject}>
                  Cancel
                </button>
                <button class="btn btn--approve" @click=${this.handleApprove}>
                  Approve & Execute
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderPreview(): TemplateResult | typeof nothing {
    const a = this.action;

    if (a.previewContent && a.previewContent.length > 0) {
      return html`
        <div class="preview-container" part="preview">
          ${a.previewContent.map((item) => this.renderContentItem(item))}
        </div>
      `;
    }

    const args = a.toolCall?.arguments;
    if (args && Object.keys(args).length > 0) {
      return html`
        <div class="preview-container" part="preview">
          <aura-json-view .data=${args}></aura-json-view>
        </div>
      `;
    }

    return nothing;
  }

  private renderContentItem(
    item: ToolResultContent,
  ): TemplateResult | typeof nothing {
    switch (item.type) {
      case "custom-element":
        return this.renderCustomElement(item.element, item.props);
      case "text":
        return html`<div class="preview-text">${item.text}</div>`;
      case "image":
        return html`<img
          class="preview-image"
          src="data:${item.mimeType};base64,${item.data}"
          alt="Preview"
        />`;
      default:
        return nothing;
    }
  }

  private renderCustomElement(
    tag: string,
    props: Record<string, unknown>,
  ): TemplateResult {
    if (!customElements.get(tag)) {
      return html`
        <div class="preview-custom-missing">
          Preview element &lt;${tag}&gt; is not registered.
        </div>
      `;
    }

    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      (el as unknown as Record<string, unknown>)[key] = value;
    }

    return html`${el}`;
  }

  private handleApprove(): void {
    this.action = { ...this.action, status: "executing" };
    this.dispatchEvent(
      new CustomEvent("approve-action", {
        bubbles: true,
        composed: true,
        detail: { actionId: this.action.id },
      }),
    );
  }

  private handleReject(): void {
    this.action = { ...this.action, status: "rejected" };
    this.dispatchEvent(
      new CustomEvent("reject-action", {
        bubbles: true,
        composed: true,
        detail: { actionId: this.action.id },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "action-preview": ActionPreviewElement;
  }
}
