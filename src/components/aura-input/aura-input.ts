/* ──────────────────────────────────────────────────────────────────
 *  <aura-input> — Chat input with resizable height, provider/model
 *                 selectors, and send/cancel button
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { AIModel } from '../../types/index.js';
import styles from './aura-input.css?inline';

interface ProviderOption {
  id: string;
  name: string;
  icon?: string;
}

@customElement('aura-input')
export class AuraInput extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Array }) providers: ProviderOption[] = [];
  @property() activeProviderId = '';
  @property({ type: Array }) models: AIModel[] = [];
  @property() activeModel = '';
  @property({ type: Boolean }) streaming = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) inputHeight = 120;

  @state() private _providerOpen = false;
  @state() private _modelOpen = false;

  @query('textarea') private _textarea!: HTMLTextAreaElement;
  @query('.provider-dropdown') private _providerDropdown?: HTMLElement;
  @query('.model-dropdown') private _modelDropdown?: HTMLElement;

  private _ownerDocument: Document | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._ownerDocument = this.ownerDocument ?? document;
    this._ownerDocument.addEventListener('pointerdown', this._onPointerDownOutside, true);
  }

  override disconnectedCallback() {
    this._ownerDocument?.removeEventListener('pointerdown', this._onPointerDownOutside, true);
    this._ownerDocument = null;
    super.disconnectedCallback();
  }

  override render() {
    const activeProvider = this.providers.find(p => p.id === this.activeProviderId);
    const activeModel = this.models.find(m => m.id === this.activeModel);

    return html`
      <style>
        :host {
          height: ${this.inputHeight}px;
        }
      </style>
      <div class="drag-handle" @mousedown=${this._onDragStart}></div>
      <div class="input-area">
        <div class="textarea-wrapper">
          <textarea
            placeholder="Type a message…"
            ?disabled=${this.disabled}
            @keydown=${this._onKeyDown}
          ></textarea>
        </div>
        <div class="bottom-bar">
          <!-- Provider dropdown -->
          <div class="dropdown-wrapper provider-dropdown">
            <button class="dropdown-btn" @click=${this._toggleProviderDropdown}>
              <span class="material-symbols-outlined dropdown-icon">
                ${activeProvider?.icon || 'auto_awesome'}
              </span>
              ${activeProvider?.name || 'Provider'}
              <span class="dropdown-arrow">▼</span>
            </button>
            ${this._providerOpen
        ? html`
                  <div class="dropdown-menu">
                    ${this.providers.map(
          p => html`
                        <button
                          class="dropdown-item ${p.id === this.activeProviderId ? 'active' : ''}"
                          @click=${() => this._selectProvider(p.id)}
                        >
                          <span class="material-symbols-outlined dropdown-icon">
                            ${p.icon || 'auto_awesome'}
                          </span>
                          ${p.name}
                        </button>
                      `
        )}
                  </div>
                `
        : nothing}
          </div>

          <!-- Model dropdown -->
          <div class="dropdown-wrapper model-dropdown">
            <button class="dropdown-btn" @click=${this._toggleModelDropdown}>
              <span class="material-symbols-outlined dropdown-icon">
                ${activeModel?.icon || 'graph_5'}
              </span>
              ${activeModel?.name || 'Model'}
              <span class="dropdown-arrow">▼</span>
            </button>
            ${this._modelOpen
        ? html`
                  <div class="dropdown-menu">
                    ${this.models.map(
          m => html`
                        <button
                          class="dropdown-item ${m.id === this.activeModel ? 'active' : ''}"
                          @click=${() => this._selectModel(m.id)}
                        >
                          <span class="material-symbols-outlined dropdown-icon">
                            ${m.icon || 'graph_5'}
                          </span>
                          ${m.name}
                        </button>
                      `
        )}
                  </div>
                `
        : nothing}
          </div>

          <div class="spacer"></div>

          <!-- Send / Cancel button -->
          ${this.streaming
        ? html`
                <button class="send-btn cancel" title="Cancel" @click=${this._onCancel}>
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              `
        : html`
                <button
                  class="send-btn"
                  title="Send"
                  ?disabled=${this.disabled}
                  @click=${this._onSend}
                >
                  <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              `}
        </div>
      </div>
    `;
  }

  // ── Events ──────────────────────────────────────────────────

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._onSend();
    }
  }

  private _onSend() {
    const text = this._textarea?.value?.trim();
    if (!text || this.disabled) return;
    this.dispatchEvent(
      new CustomEvent('send-message', {
        detail: { text },
        bubbles: true,
        composed: true,
      })
    );
    this._textarea.value = '';
  }

  private _onCancel() {
    this.dispatchEvent(new CustomEvent('cancel-stream', { bubbles: true, composed: true }));
  }

  private _toggleProviderDropdown() {
    this._providerOpen = !this._providerOpen;
    if (this._providerOpen) this._modelOpen = false;
  }

  private _toggleModelDropdown() {
    this._modelOpen = !this._modelOpen;
    if (this._modelOpen) this._providerOpen = false;
  }

  private _onPointerDownOutside = (e: PointerEvent) => {
    if (!this._providerOpen && !this._modelOpen) return;

    const path = e.composedPath();
    const inProviderDropdown = !!this._providerDropdown && path.includes(this._providerDropdown);
    const inModelDropdown = !!this._modelDropdown && path.includes(this._modelDropdown);

    if (this._providerOpen && !inProviderDropdown) this._providerOpen = false;
    if (this._modelOpen && !inModelDropdown) this._modelOpen = false;
  };

  private _selectProvider(id: string) {
    this._providerOpen = false;
    this.dispatchEvent(
      new CustomEvent('provider-change', {
        detail: { providerId: id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _selectModel(id: string) {
    this._modelOpen = false;
    this.dispatchEvent(
      new CustomEvent('model-change', {
        detail: { model: id },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Drag resize ─────────────────────────────────────────────

  private _onDragStart(e: MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = this.inputHeight;

    const onMove = (moveEvt: MouseEvent) => {
      // Dragging UP decreases clientY, which should INCREASE height
      const delta = startY - moveEvt.clientY;
      const newHeight = Math.max(80, Math.min(400, startHeight + delta));

      this.inputHeight = newHeight;
      this.dispatchEvent(
        new CustomEvent('resize-input', {
          detail: { height: newHeight },
          bubbles: true,
          composed: true,
        })
      );
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Set the textarea value programmatically (e.g. from suggested prompts) */
  public setInput(text: string) {
    if (this._textarea) {
      this._textarea.value = text;
      this._textarea.focus();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'aura-input': AuraInput;
  }
}
