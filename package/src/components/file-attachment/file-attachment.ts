import { LitElement, html, unsafeCSS, nothing, type TemplateResult } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import type { Attachment } from "../../types/index.js";
import styles from "./file-attachment.css?inline";
import { generateAttachmentId, formatFileSize } from "../../utils/helpers.js";

@customElement("file-attachment")
export class FileAttachmentElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Array }) attachments: Attachment[] = [];
  @property({ type: Number }) maxSize = 10_485_760;
  @property({ type: Array }) allowedTypes: string[] = [];
  @property({ type: Boolean }) disabled = false;

  @state() private error = "";

  @query('input[type="file"]') private fileInput!: HTMLInputElement;

  override render(): TemplateResult {
    return html`
      <div class="attach-row" part="attachment-row">
        <button
          class="attach-btn"
          part="attach-button"
          @click=${this.openFilePicker}
          ?disabled=${this.disabled}
          aria-label="Attach file"
          title="Attach file"
        >
          <md-icon>attach_file</md-icon>
        </button>

        ${this.attachments.map(
          (a) => html`
            <span class="chip" part="attachment-chip">
              <span class="chip_name">${a.fileName ?? a.name ?? "attachment"}</span>
              <span class="chip___size">${formatFileSize(a.size)}</span>
              <button
                class="chip__remove"
                @click=${() => this.removeAttachment(a.id)}
                aria-label="Remove ${a.fileName ?? a.name ?? "attachment"}"
              >
                <md-icon>close</md-icon>
              </button>
            </span>
          `,
        )}

        <input
          type="file"
          multiple
          @change=${this.handleFileSelect}
          .accept=${this.allowedTypes.length ? this.allowedTypes.join(",") : ""}
        />
      </div>
      ${this.error
        ? html`<div class="error-text" role="alert">${this.error}</div>`
        : nothing}
    `;
  }

  private openFilePicker(): void {
    this.fileInput?.click();
  }

  private handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.error = "";

    for (const file of files) {
      if (file.size > this.maxSize) {
        this.error = `"${file.name}" exceeds the ${formatFileSize(
          this.maxSize,
        )} limit.`;
        continue;
      }

      const isAllowed =
        this.allowedTypes.length === 0 ||
        this.allowedTypes.some((t) => {
          if (t.endsWith("/*")) {
            const prefix = t.slice(0, -1);
            return file.type.startsWith(prefix);
          }
          return file.type === t || file.name.endsWith(t);
        });

      if (!isAllowed) {
        this.error = `"${file.name}" is not an allowed file type.`;
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const attachment: Attachment = {
          id: generateAttachmentId(),
          fileName: file.name,
          size: file.size,
          mimeType: file.type,
          data: base64,
          url: URL.createObjectURL(file),
        };
        this.attachments = [...this.attachments, attachment];
        this.notifyChange();
      };
      reader.readAsDataURL(file);
    }
    input.value = "";
  }

  private removeAttachment(id: string): void {
    const a = this.attachments.find((att) => att.id === id);
    if (a?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(a.url);
    }
    this.attachments = this.attachments.filter((att) => att.id !== id);
    this.notifyChange();
  }

  clear(): void {
    for (const a of this.attachments) {
      if (a.url?.startsWith("blob:")) URL.revokeObjectURL(a.url);
    }
    this.attachments = [];
    this.error = "";
    this.notifyChange();
  }

  private notifyChange(): void {
    this.dispatchEvent(
      new CustomEvent("attachments-changed", {
        bubbles: true,
        composed: true,
        detail: { attachments: this.attachments },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "file-attachment": FileAttachmentElement;
  }
}
