import {
  LitElement,
  html,
  unsafeCSS,
  nothing,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgentStep } from "../../types/index.js";
import "@material/web/icon/icon.js";
import "../aura-action-preview/aura-action-preview.js";
import "../aura-json-view/aura-json-view.js";
import styles from "./aura-agent-step.css?inline";

@customElement("aura-agent-step")
export class AuraAgentStepElement extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Object }) step!: AgentStep;
  @state() private expanded = false;
  @state() private userInputValue = "";

  private userToggled = false;

  override updated(changed: PropertyValues): void {
    if (changed.has("step") && this.step && !this.userToggled) {
      this.expanded =
        (this.step.type === "approval" && this.step.status === "waiting") ||
        (this.step.type === "ask-user" && this.step.status === "waiting");
    }
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.userToggled = true;
  }

  override render(): TemplateResult | typeof nothing {
    if (!this.step) return nothing;

    const s = this.step;
    const isWaitingForHuman =
      (s.type === "approval" || s.type === "ask-user") &&
      s.status === "waiting";
    const isExpanded = this.expanded || isWaitingForHuman;
    const hasDetail = !!(
      s.pendingAction ||
      s.type === "ask-user" ||
      s.userInputQuestion ||
      s.detail ||
      s.toolName ||
      s.toolArgs ||
      s.toolResult
    );

    return html`
      <div class="timeline-item" part="step-card">
        <!-- Left rail: line + status icon -->
        <div class="timeline-rail">
          <md-icon class="timeline-icon timeline-icon--${s.status}">
            ${s.status === "running"
              ? "sync"
              : s.status === "complete"
                ? "check_circle"
                : s.status === "error"
                  ? "cancel"
                  : s.status === "rejected"
                    ? "block"
                    : s.status === "waiting"
                      ? "schedule"
                      : "radio_button_unchecked"}
          </md-icon>
        </div>

        <!-- Right body: clickable row + optional detail -->
        <div class="timeline-body">
          <div
            class="step-row"
            part="step"
            @click=${hasDetail ? this.toggleExpanded : undefined}
            role=${hasDetail ? "button" : "status"}
            tabindex=${hasDetail ? "0" : "-1"}
            aria-expanded=${hasDetail ? String(isExpanded) : nothing}
            aria-label="Step: ${s.summary}"
          >
            <!-- Summary -->
            <span class="step__summary">${s.summary}</span>

            <!-- Duration -->
            ${s.durationMs != null
              ? html`<span class="step__duration"
                  >(${this.formatDuration(s.durationMs)})</span
                >`
              : nothing}

            <!-- Expand chevron -->
            ${hasDetail
              ? html`<md-icon
                  class="step__chevron ${isExpanded
                    ? "step__chevron--open"
                    : ""}"
                  >chevron_right</md-icon
                >`
              : nothing}

            <!-- Trailing spacer -->
            <span class="step__spacer"></span>
          </div>

          <!-- Expanded detail panel -->
          ${hasDetail && isExpanded
            ? html`<div class="step__detail" part="step-detail">
                ${this.renderDetail()}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private renderDetail(): TemplateResult | typeof nothing {
    const s = this.step;
    const question =
      s.userInputQuestion?.trim() ||
      (typeof s.toolArgs?.["question"] === "string"
        ? String(s.toolArgs["question"]).trim()
        : "") ||
      "Please provide the information needed to continue.";

    if (s.type === "ask-user") {
      const isWaiting = s.status === "waiting";
      return html`
        <div class="step__user-input">
          <span class="step__detail-label">Question</span>
          <p class="step__user-input-question">
            ${question}
          </p>
          ${isWaiting
            ? html`
                <div class="step__user-input-row">
                  <input
                    class="step__user-input-field"
                    type="text"
                    placeholder="Type your reply..."
                    .value=${this.userInputValue}
                    @input=${(e: Event) => {
                      this.userInputValue = (
                        e.target as HTMLInputElement
                      ).value;
                    }}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        this.submitUserInput();
                      }
                    }}
                  />
                  <button
                    class="step__user-input-btn"
                    ?disabled=${!this.userInputValue.trim()}
                    @click=${this.submitUserInput}
                  >
                    <md-icon>send</md-icon>
                  </button>
                </div>
              `
            : html`
                <div class="step__user-input-answer">
                  ${s.toolResult
                    ? html`
                        <span class="step__detail-label">Answer</span>
                        <p class="step__user-input-reply">${s.toolResult}</p>
                      `
                    : nothing}
                </div>
              `}
        </div>
        ${s.detail
          ? html`<div class="step__detail-text">${s.detail}</div>`
          : nothing}
      `;
    }

    if (s.pendingAction) {
      return html`
        <action-preview
          class="step__action-preview"
          .action=${s.pendingAction}
          .disabled=${s.status !== "waiting"}
        ></action-preview>
        ${s.detail
          ? html`<div class="step__detail-text">${s.detail}</div>`
          : nothing}
      `;
    }

    return html`
      ${s.toolName
        ? html`
            <div class="step__detail-row">
              <span class="step__detail-label">Tool</span>
              <code class="step__detail-value">${s.toolName}</code>
            </div>
          `
        : nothing}
      ${s.toolArgs
        ? html`
            <div class="step__detail-row">
              <span class="step__detail-label">Input</span>
            </div>
            <aura-json-view .data=${s.toolArgs}></aura-json-view>
          `
        : nothing}
      ${s.toolResult
        ? html`
            <div class="step__detail-row">
              <span class="step__detail-label">Output</span>
            </div>
            <aura-json-view
              .data=${this.parseToolResult(s.toolResult)}
            ></aura-json-view>
          `
        : nothing}
      ${s.detail
        ? html`<div class="step__detail-text">${s.detail}</div>`
        : nothing}
    `;
  }

  private submitUserInput(): void {
    const text = this.userInputValue.trim();
    if (!text) return;

    this.dispatchEvent(
      new CustomEvent("user-input-submitted", {
        bubbles: true,
        composed: true,
        detail: { stepId: this.step.id, text },
      }),
    );
    this.userInputValue = "";
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private parseToolResult(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-agent-step": AuraAgentStepElement;
  }
}
