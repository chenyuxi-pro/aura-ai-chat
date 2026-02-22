import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import styles from "./aura-json-view.css?inline";

@customElement("aura-json-view")
export class AuraJsonView extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Object }) data: any = null;

  override render(): TemplateResult {
    if (!this.data) return html``;

    return html` <pre class="json-view">${this.renderJson(this.data)}</pre> `;
  }

  private renderJson(data: any): TemplateResult {
    const json = JSON.stringify(data, null, 2);
    // Simple syntax highlighting via regex replacement
    // This is a basic implementation; for production, a dedicated highlighter is better
    const highlighted = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = "json-number";
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = "json-key";
            } else {
              cls = "json-string";
            }
          } else if (/true|false/.test(match)) {
            cls = "json-boolean";
          } else if (/null/.test(match)) {
            cls = "json-null";
          }
          return `<span class="${cls}">${match}</span>`;
        },
      );

    // Using dangerouslySetInnerHTML equivalent in Lit (not recommended but for display here)
    // Actually Lit has no direct equivalent without a library, so we'll just return the string
    // if we want highlighting. For now, let's keep it simple.
    return html`${html([highlighted] as unknown as TemplateStringsArray)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-json-view": AuraJsonView;
  }
}
