/* ──────────────────────────────────────────────────────────────────
 *  <aura-confirmation-bubble> — Rendered inside the message list
 *  when a moderate or destructive tool is pending.
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Tool } from '../../types/index.js';
import { componentBridge } from '../../services/component-bridge.js';
import styles from './confirmation-bubble.css?inline';

@customElement('aura-confirmation-bubble')
export class ConfirmationBubble extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ type: Object }) tool!: Tool;
    @property({ type: Object }) args: Record<string, unknown> = {};
    @property({ type: String }) summary = '';

    @state() private _previewReady = false;
    @state() private _resolved: 'approved' | 'cancelled' | null = null;
    @state() private _confirmText = '';


    override async firstUpdated() {
        if (!this.tool?.preview) {
            this._previewReady = true;
            return;
        }

        const container = this.shadowRoot?.querySelector('.preview-slot') as HTMLDivElement | null;
        if (!container) {
            this._previewReady = true;
            return;
        }

        try {
            const element = await componentBridge.createElement(this.tool.preview, this.args);
            container.innerHTML = '';
            container.appendChild(element);

            // Dispatch preview-rendered event for host observability
            this.dispatchEvent(new CustomEvent('action-preview-rendered', {
                bubbles: true,
                composed: true,
                detail: { toolName: this.tool.name, element },
            }));
        } catch {
            // Fallback already handled by componentBridge
        } finally {
            this._previewReady = true;
        }
    }

    private get _isDestructive(): boolean {
        return this.tool?.risk === 'destructive';
    }

    private get _canApprove(): boolean {
        if (!this._previewReady) return false;
        if (this._resolved) return false;
        if (this._isDestructive) {
            return this._confirmText.trim().toLowerCase() === 'confirm';
        }
        return true;
    }

    private _onApprove() {
        if (!this._canApprove) return;
        this._resolved = 'approved';
        this.dispatchEvent(new CustomEvent('action-approved', {
            bubbles: true,
            composed: true,
            detail: { toolName: this.tool.name, arguments: this.args },
        }));
    }

    private _onCancel() {
        if (this._resolved) return;
        this._resolved = 'cancelled';
        this.dispatchEvent(new CustomEvent('action-cancelled', {
            bubbles: true,
            composed: true,
            detail: { toolName: this.tool.name, arguments: this.args },
        }));
    }

    private _onConfirmInput(e: Event) {
        this._confirmText = (e.target as HTMLInputElement).value;
    }

    override render() {
        const risk = this.tool?.risk;

        return html`
            <div class="confirmation-bubble">
                ${this.summary ? html`<p class="summary">${this.summary}</p>` : nothing}

                <span class="risk-badge ${risk}">
                    ${risk === 'destructive' ? '⚠' : '●'} ${risk?.toUpperCase()}
                </span>

                <div class="preview-container">
                    <div class="preview-label">PREVIEW</div>
                    ${!this._previewReady
                ? html`<div class="preview-loading"><div class="spinner"></div>Loading preview…</div>`
                : nothing}
                    <div class="preview-slot"></div>
                </div>

                ${this._isDestructive && !this._resolved ? html`
                    <div class="confirm-section">
                        <p class="confirm-label">Type "confirm" to proceed:</p>
                        <input
                            class="confirm-input"
                            type="text"
                            placeholder="confirm"
                            .value=${this._confirmText}
                            @input=${this._onConfirmInput}
                        />
                    </div>
                ` : nothing}

                ${this._resolved ? html`
                    <div class="outcome ${this._resolved}">
                        ${this._resolved === 'approved'
                    ? html`✓ Approved — executing…`
                    : html`✕ Cancelled`}
                    </div>
                ` : html`
                    <div class="actions">
                        <button class="btn btn-cancel" @click=${this._onCancel}>
                            ✕ Cancel
                        </button>
                        <button
                            class="btn btn-approve"
                            ?disabled=${!this._canApprove}
                            @click=${this._onApprove}
                        >
                            ✓ Approve
                        </button>
                    </div>
                `}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'aura-confirmation-bubble': ConfirmationBubble;
    }
}
