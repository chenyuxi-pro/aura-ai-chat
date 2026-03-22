import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SuggestedPrompt } from "../../types/index.js";
import styles from "./suggested-prompts.css?inline";

@customElement("suggested-prompts")
export class SuggestedPromptsElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Array }) prompts: SuggestedPrompt[] = [];
  @property({ type: String }) label = "Suggested prompts";

  override render(): TemplateResult {
    if (!this.prompts.length) return html``;

    return html`
      <div
        class="prompts-container"
        role="group"
        aria-label=${this.label}
        part="suggested-prompts"
      >
        ${this.prompts.map(
          (p) => html`
            <button
              class="prompt-chip"
              part="prompt-chip"
              title=${p.description ?? p.title}
              @click=${() => this.selectPrompt(p)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  this.selectPrompt(p);
                }
              }}
            >
              <span class="prompt-chip__title">${p.title}</span>
              ${p.description
                ? html`<span class="prompt-chip__desc">${p.description}</span>`
                : ""}
            </button>
          `,
        )}
      </div>
    `;
  }

  private selectPrompt(prompt: SuggestedPrompt): void {
    this.dispatchEvent(
      new CustomEvent("prompt-selected", {
        bubbles: true,
        composed: true,
        detail: { prompt },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "suggested-prompts": SuggestedPromptsElement;
  }
}
