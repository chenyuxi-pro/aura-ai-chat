/* ──────────────────────────────────────────────────────────────────
 *  <aura-messages> — Message list, welcome state, streaming indicator
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { MessageRole } from '../../types/index.js';
import type { Message, SuggestedPrompt } from '../../types/index.js';
import type { CopilotLoginStatus, DeviceFlowInfo } from '../../providers/github-copilot-provider.js';
import styles from './aura-messages.css?inline';

export interface CopilotLoginState {
  status: CopilotLoginStatus;
  info?: DeviceFlowInfo;
}

@customElement('aura-messages')
export class AuraMessages extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Array }) messages: Message[] = [];
  @property({ type: Boolean }) streaming = false;
  @property() streamingContent = '';
  @property() aiName = 'Aura';
  @property() welcomeTitle = '';
  @property() welcomeMessage = '';
  @property() welcomeIcon = '';
  @property({ type: Array }) suggestedPrompts: SuggestedPrompt[] = [];
  @state() private _rememberToken = true;
  @property() aiIcon = '';
  @property({ type: Object }) copilotLogin: CopilotLoginState | null = null;

  override updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    if (changedProps.has('messages') || changedProps.has('streamingContent')) {
      this._scrollToBottom();
    }
  }

  override render() {
    // Show copilot login card when provider needs auth
    if (this.copilotLogin && this.copilotLogin.status !== 'LOGGED_IN') {
      return this._renderCopilotLogin();
    }
    if (this.messages.length === 0 && !this.streaming) {
      return this._renderWelcome();
    }
    return this._renderMessages();
  }

  private _renderCopilotLogin() {
    const state = this.copilotLogin!;
    return html`
      <div class="welcome">
        <div class="copilot-login-card">
          <div class="copilot-logo">🐙</div>
          <h2 class="welcome-title">Connect to GitHub Copilot</h2>
          <p class="welcome-message">Sign in with your GitHub account to start chatting with Copilot.</p>

          ${state.status === 'NOT_LOGGED_IN' ? html`
            <div class="copilot-login-options">
              <label class="copilot-remember-me">
                <input type="checkbox" .checked=${this._rememberToken} @change=${this._onToggleRememberToken} />
                Remember access token
              </label>
            </div>
            <button class="copilot-signin-btn" @click=${this._onCopilotSignIn}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Sign in with GitHub
            </button>
          ` : nothing}

          ${state.status === 'ACTIVATING_DEVICE' && state.info ? html`
            <div class="copilot-device-flow">
              <div class="copilot-instruction">Enter this code at the link below:</div>
              <div class="copilot-code-container">
                <div class="copilot-user-code">${state.info.userCode}</div>
                <button class="copilot-copy-btn" @click=${() => this._copyToClipboard(state.info!.userCode)} title="Copy code">
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                    <path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                  </svg>
                </button>
              </div>
              <a class="copilot-verify-link" href="${state.info.verificationUri}" target="_blank" rel="noopener">
                ${state.info.verificationUri} ↗
              </a>
              <div class="copilot-waiting">Waiting for authorization…</div>
            </div>
          ` : nothing}

          ${state.status === 'ACTIVATING_DEVICE' && !state.info ? html`
            <div class="copilot-status">⏳ Connecting to GitHub…</div>
          ` : nothing}

          ${state.status === 'LOGGING_IN' ? html`
            <div class="copilot-status">🔄 Verifying authorization…</div>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private _onCopilotSignIn() {
    this.dispatchEvent(new CustomEvent('copilot-sign-in', {
      detail: { rememberToken: this._rememberToken },
      bubbles: true,
      composed: true
    }));
  }

  private _onToggleRememberToken(e: Event) {
    this._rememberToken = (e.target as HTMLInputElement).checked;
  }

  private _copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  private _renderWelcome() {
    return html`
      <div class="welcome">
        <div class="welcome-icon">
          ${this.welcomeIcon
        ? html`<img src="${this.welcomeIcon}" alt="" style="width:32px;height:32px;border-radius:8px" />`
        : html`✦`}
        </div>
        <h2 class="welcome-title">${this.welcomeTitle || `Hi, I'm ${this.aiName}`}</h2>
        <p class="welcome-message">${this.welcomeMessage || 'How can I help you today?'}</p>
        ${this.suggestedPrompts.length > 0
        ? html`
              <div class="suggested-prompts">
                ${this.suggestedPrompts.map(
          prompt => html`
                    <button class="prompt-chip" @click=${() => this._onSuggestedPrompt(prompt)}>
                      ${prompt.icon ? html`<span>${prompt.icon}</span>` : nothing}
                      ${prompt.label}
                    </button>
                  `
        )}
              </div>
            `
        : nothing}
      </div>
    `;
  }

  private _renderMessages() {
    return html`
      <div class="messages-list">
        ${this.messages.map(msg => this._renderMessage(msg))}
        ${this.streaming ? this._renderStreamingMessage() : nothing}
      </div>
    `;
  }

  private _renderMessage(msg: Message) {
    const isUser = msg.role === MessageRole.User;
    const isError = msg.role === MessageRole.Error;
    const roleClass = isError ? 'assistant error' : msg.role;
    const avatarClass = isUser ? 'user-avatar' : isError ? 'error-avatar' : 'ai';
    const avatarContent = isUser
      ? '👤'
      : this.aiIcon
        ? html`<span class="material-symbols-outlined avatar-icon">${this.aiIcon}</span>`
        : this.aiName.charAt(0).toUpperCase();

    return html`
      <div class="message ${roleClass}">
        <div class="avatar ${avatarClass}">
          ${avatarContent}
        </div>
        <div class="bubble">
          ${unsafeHTML(this._renderMarkdown(msg.content))}
        </div>
      </div>
    `;
  }

  private _renderStreamingMessage() {
    const avatarContent = this.aiIcon
      ? html`<span class="material-symbols-outlined avatar-icon">${this.aiIcon}</span>`
      : this.aiName.charAt(0).toUpperCase();
    return html`
      <div class="message assistant">
        <div class="avatar ai">${avatarContent}</div>
        <div class="bubble">
          ${this.streamingContent
        ? unsafeHTML(this._renderMarkdown(this.streamingContent))
        : html`
                <div class="typing-indicator">
                  <div class="dot"></div>
                  <div class="dot"></div>
                  <div class="dot"></div>
                </div>
              `}
        </div>
      </div>
    `;
  }

  private _renderMarkdown(content: string): string {
    const rawHtml = marked.parse(content, { async: false }) as string;
    const clean = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'span',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'del', 'hr', 'img', 'sup', 'sub',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'title'],
    });

    // Add copy buttons to code blocks
    return clean.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
      (_match, attrs, code) => {
        return `<pre><code${attrs}>${code}</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Copy</button></pre>`;
      }
    );
  }

  private _scrollToBottom() {
    requestAnimationFrame(() => {
      this.scrollTop = this.scrollHeight;
    });
  }

  private _onSuggestedPrompt(prompt: SuggestedPrompt) {
    this.dispatchEvent(
      new CustomEvent('send-prompt', {
        detail: { prompt: prompt.prompt },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'aura-messages': AuraMessages;
  }
}
