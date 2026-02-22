import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import styles from "./aura-json-view.css?inline";

@customElement("aura-json-view")
export class AuraJsonView extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ attribute: false }) data: unknown = undefined;

  override render(): TemplateResult {
    if (this.data === undefined) return html``;

    return html` <pre class="json-view">${this.renderJson(this.data)}</pre> `;
  }

  private renderJson(data: unknown): TemplateResult {
    const json = this.stringifyData(data);
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

    return html`${unsafeHTML(highlighted)}`;
  }

  private stringifyData(data: unknown): string {
    if (typeof data === "string") {
      return JSON.stringify(data, null, 2);
    }

    const json = JSON.stringify(data, null, 2);
    return json ?? String(data);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-json-view": AuraJsonView;
  }
}
