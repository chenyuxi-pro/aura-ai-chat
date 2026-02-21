/* ──────────────────────────────────────────────────────────────────
 *  <aura-header> — Header bar with title and action buttons
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import styles from './aura-header.css?inline';

@customElement('aura-header')
export class AuraHeader extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() title = 'Aura';
    @property() icon = '';

    override render() {
        return html`
      <div class="header-left">
        <div class="header-icon">
          ${this.icon
                ? html`<img src="${this.icon}" alt="" />`
                : html`${this.title.charAt(0).toUpperCase()}`}
        </div>
        <span class="header-title">${this.title}</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" title="New conversation" @click=${this._onNew}>
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
        <button class="header-btn" title="History" @click=${this._onHistory}>
          <svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
        </button>
        <button class="header-btn" title="Settings" @click=${this._onSettings}>
          <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
      </div>
    `;
    }

    private _onNew() {
        this.dispatchEvent(new CustomEvent('new-conversation', { bubbles: true, composed: true }));
    }

    private _onHistory() {
        this.dispatchEvent(new CustomEvent('toggle-history', { bubbles: true, composed: true }));
    }

    private _onSettings() {
        this.dispatchEvent(new CustomEvent('toggle-settings', { bubbles: true, composed: true }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'aura-header': AuraHeader;
    }
}
