import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ToolResultContent } from "../../types/index.js";
import "../aura-json-view/aura-json-view.js";
import styles from "./aura-result-view.css?inline";

@customElement("aura-result-view")
export class AuraResultViewElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Array }) resultContent!: ToolResultContent[];

  override render(): TemplateResult {
    if (!this.resultContent || this.resultContent.length === 0) return html``;

    return html`
      ${this.resultContent.map((item) => this.renderContentItem(item))}
    `;
  }

  private renderContentItem(item: ToolResultContent): TemplateResult {
    switch (item.type) {
      case "json":
        return html`
          <div class="result-json-container">
            ${item.label
              ? html`<div class="result-json-label">${item.label}</div>`
              : ""}
            <aura-json-view .data=${item.data}></aura-json-view>
          </div>
        `;
      case "custom-element":
        return this.renderCustomElement(item.element, item.props);
      case "text":
        return html`<div class="result-text">${item.text}</div>`;
      case "image":
        return html`
          <img
            class="result-image"
            src="data:${item.mimeType};base64,${item.data}"
            alt="Result"
          />
        `;
      case "resource":
        return html`
          <div class="result-resource">
            <span class="result-resource-uri">${item.resource.uri}</span>
            ${"text" in item.resource
              ? html`<pre class="result-resource-text">
${item.resource.text}</pre
                >`
              : html`<span class="result-resource-binary">[binary data]</span>`}
          </div>
        `;
      default:
        return html``;
    }
  }

  private renderCustomElement(
    tag: string,
    props: Record<string, unknown>,
  ): TemplateResult {
    if (!customElements.get(tag)) {
      return html`
        <div class="result-view-missing">
          Result element &lt;${tag}&gt; is not registered.
        </div>
      `;
    }

    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      (el as unknown as Record<string, unknown>)[key] = value;
    }

    return html` <div class="result-custom-element-container">${el}</div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-result-view": AuraResultViewElement;
  }
}
