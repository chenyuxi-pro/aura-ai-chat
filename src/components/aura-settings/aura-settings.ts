/* ──────────────────────────────────────────────────────────────────
 *  <aura-settings> — Settings modal with collapsible groups
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AuraConfig, Tool } from '../../types/index.js';
import { getSkillDisplayName, getToolDisplayName, isExcluded } from '../../types/index.js';
import styles from './aura-settings.css?inline';

@customElement('aura-settings')
export class AuraSettings extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) config: AuraConfig | null = null;

  @state() private _expanded: Set<string> = new Set(['identity', 'header', 'welcome', 'providers', 'behavior', 'skills', 'tools']);
  @state() private _draft: Record<string, unknown> = {};

  override render() {
    if (!this.open || !this.config) return nothing;

    return html`
      <div class="overlay" @click=${this._onClose}></div>
      <div class="panel">
        <div class="panel-header">
          <h2>Chat Settings</h2>
          <button class="close-btn" @click=${this._onClose}>✕</button>
        </div>
        <div class="panel-body">
          <div class="expand-controls">
            <button @click=${this._expandAll}>Expand all</button>
            <button @click=${this._collapseAll}>Collapse all</button>
          </div>
          ${this._renderGroup('identity', 'Identity', this._renderIdentity())}
          ${this._renderGroup('header', 'Header', this._renderHeader())}
          ${this._renderGroup('welcome', 'Welcome', this._renderWelcome())}
          ${this._renderGroup('providers', 'AI Providers', this._renderProviders())}
          ${this._renderGroup('behavior', 'AI Behavior', this._renderBehavior())}
          ${this._renderGroup('skills', 'Skills', this._renderSkills())}
          ${this._renderGroup('tools', 'Tools', this._renderTools())}
        </div>
        <div class="panel-footer">
          <div class="footer-actions">
            <button class="btn btn-secondary" @click=${this._onClose}>Cancel</button>
            <button class="btn btn-primary" @click=${this._onApply}>Apply</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderGroup(id: string, title: string, content: unknown) {
    const isOpen = this._expanded.has(id);
    return html`
      <div class="group">
        <div class="group-header" @click=${() => this._toggleGroup(id)}>
          <span class="group-chevron ${isOpen ? 'open' : ''}">▶</span>
          <span class="group-title">${title}</span>
        </div>
        <div class="group-body ${isOpen ? 'open' : ''}">
          ${content}
        </div>
      </div>
    `;
  }

  private _isVisible(group: string, field?: string): boolean {
    const vis = this.config?.ui?.settings?.visibility;
    if (!vis) return true;
    if (vis.all) {
      return !isExcluded(vis.exclusions ?? [], group, field);
    }
    return true;
  }

  private _isReadonly(group: string, field?: string): boolean {
    const ro = this.config?.ui?.settings?.readonly;
    if (!ro) return false;
    if (ro.all) {
      return !isExcluded(ro.exclusions ?? [], group, field);
    }
    return false;
  }

  private _renderIdentity() {
    const id = this.config!.identity;
    const fields = ['appId', 'ownerId', 'tenantId', 'userId', 'aiName'] as const;
    return html`
      ${fields.map(f =>
      this._isVisible('identity', f)
        ? html`
               <div class="field">
                 <div class="field-label">${f}</div>
                 <input type="text" .value=${id[f] ?? ''} ?readonly=${this._isReadonly('identity', f)}
                   @input=${(e: Event) => this._setDraft(`identity.${f}`, (e.target as HTMLInputElement).value)} />
               </div>
             `
        : nothing
    )}
    `;
  }

  private _renderHeader() {
    const h = this.config!.header;
    return html`
      ${this._isVisible('header', 'title') ? html`
        <div class="field">
          <div class="field-label">Title</div>
          <input type="text" .value=${h.title ?? ''} ?readonly=${this._isReadonly('header', 'title')}
            @input=${(e: Event) => this._setDraft('header.title', (e.target as HTMLInputElement).value)} />
        </div>
      ` : nothing}
      ${this._isVisible('header', 'icon') ? html`
        <div class="field">
          <div class="field-label">Icon URL</div>
          <input type="text" .value=${h.icon ?? ''} ?readonly=${this._isReadonly('header', 'icon')}
            @input=${(e: Event) => this._setDraft('header.icon', (e.target as HTMLInputElement).value)} />
        </div>
      ` : nothing}
    `;
  }

  private _renderWelcome() {
    const w = this.config!.welcome;
    return html`
      <div class="field">
        <div class="field-label">Title</div>
        <input type="text" .value=${w.title ?? ''} ?readonly=${this._isReadonly('welcome', 'title')}
          @input=${(e: Event) => this._setDraft('welcome.title', (e.target as HTMLInputElement).value)} />
      </div>
      <div class="field">
        <div class="field-label">Message</div>
        <textarea ?readonly=${this._isReadonly('welcome', 'message')}
          @input=${(e: Event) => this._setDraft('welcome.message', (e.target as HTMLTextAreaElement).value)}
        >${w.message ?? ''}</textarea>
      </div>
    `;
  }

  private _renderProviders() {
    const providers = this.config!.providers;
    return html`
      ${providers.map((p, i) => {
      const id = p.type === 'custom' ? p.instance.id : p.providerId;
      const name = (p.type === 'custom' ? p.displayName ?? p.instance.name : p.displayName ?? p.providerId);
      const isCopilot = p.type === 'built-in' && p.providerId === 'github-copilot';
      return html`
           <div class="check-item">
             <span>${name} (${id})</span>
           </div>
           ${p.type === 'built-in' && !isCopilot ? html`
             <div class="field" style="padding-left: 24px;">
               <div class="field-label">API Key</div>
               <input type="text" placeholder="sk-..."
                 .value=${p.apiKey ?? ''}
                 @input=${(e: Event) => this._setDraft(`providers.${i}.apiKey`, (e.target as HTMLInputElement).value)} />
             </div>
           ` : nothing}
           ${isCopilot ? html`
             <div class="field" style="padding-left: 24px;">
               <div class="field-label" style="color: var(--aura-color-text-muted); font-size: 12px; margin-bottom: 8px;">
                 🐙 Sign in from the chat area
               </div>
               <div class="check-item">
                 <input type="checkbox" .checked=${p.rememberToken !== false}
                   @change=${(e: Event) => this._setDraft(`providers.${i}.rememberToken`, (e.target as HTMLInputElement).checked)} />
                 <span>Remember access token</span>
               </div>
             </div>
           ` : nothing}
         `;
    })}
    `;
  }

  private _renderBehavior() {
    const b = this.config!.behavior;
    return html`
      ${this._isVisible('behavior', 'systemPrompt') ? html`
        <div class="field">
          <div class="field-label">System Prompt</div>
          <textarea ?readonly=${this._isReadonly('behavior', 'systemPrompt')}
            @input=${(e: Event) => this._setDraft('behavior.systemPrompt', (e.target as HTMLTextAreaElement).value)}
          >${b.systemPrompt ?? ''}</textarea>
        </div>
      ` : nothing}
      ${this._isVisible('behavior', 'securityInstructions') ? html`
        <div class="field">
          <div class="field-label">Security Instructions</div>
          <textarea ?readonly=${this._isReadonly('behavior', 'securityInstructions')}
            @input=${(e: Event) => this._setDraft('behavior.securityInstructions', (e.target as HTMLTextAreaElement).value)}
          >${b.securityInstructions ?? ''}</textarea>
        </div>
      ` : nothing}
      ${this._isVisible('behavior', 'temperature') ? html`
        <div class="field">
          <div class="field-label">Temperature</div>
          <div class="range-wrapper">
            <input type="range" min="0" max="2" step="0.1" .value=${String(b.temperature ?? 0.7)}
              ?disabled=${this._isReadonly('behavior', 'temperature')}
              @input=${(e: Event) => this._setDraft('behavior.temperature', parseFloat((e.target as HTMLInputElement).value))} />
            <span class="range-value">${b.temperature ?? 0.7}</span>
          </div>
        </div>
      ` : nothing}
      ${this._isVisible('behavior', 'maxTokens') ? html`
        <div class="field">
          <div class="field-label">Max Tokens</div>
          <input type="number" .value=${String(b.maxTokens ?? 4096)}
            ?readonly=${this._isReadonly('behavior', 'maxTokens')}
            @input=${(e: Event) => this._setDraft('behavior.maxTokens', parseInt((e.target as HTMLInputElement).value))} />
        </div>
      ` : nothing}
    `;
  }

  private _renderSkills() {
    const skills = this.config!.behavior?.skills ?? [];
    if (skills.length === 0) return html`<p style="color: var(--aura-color-text-muted); font-size: 13px;">No skills configured.</p>`;

    return html`
      ${skills.map(skill => html`
        <div class="check-item">
          <input type="checkbox" .checked=${skill.enabled !== false}
            @change=${(e: Event) => this._toggleSkill(skill.name, (e.target as HTMLInputElement).checked)} />
          <span>${getSkillDisplayName(skill)}</span>
          ${skill.category ? html`<span style="font-size:11px;color:var(--aura-color-text-muted)">(${skill.category})</span>` : nothing}
        </div>
        ${(skill.tools ?? []).map(tool => html`
          <div class="check-item check-sub">
            <input type="checkbox" .checked=${tool.enabled !== false}
              @change=${(e: Event) => this._toggleSkillTool(skill.name, tool.name, (e.target as HTMLInputElement).checked)} />
            <span>${getToolDisplayName(tool)}</span>
          </div>
        `)}
      `)}
    `;
  }

  private _renderTools() {
    const tools = this.config!.behavior?.tools ?? [];
    if (tools.length === 0) return html`<p style="color: var(--aura-color-text-muted); font-size: 13px;">No global tools configured.</p>`;

    return html`
      ${tools.map(tool => {
      const lockedBy = this._getToolLockReason(tool);
      return html`
           <div class="check-item">
             <input type="checkbox" .checked=${tool.enabled !== false}
               ?disabled=${!!lockedBy}
               class="${lockedBy ? 'locked' : ''}"
               title="${lockedBy ? `Used by: ${lockedBy} — disable that skill first` : ''}"
               @change=${(e: Event) => this._toggleTool(tool.name, (e.target as HTMLInputElement).checked)} />
             <span>${getToolDisplayName(tool)}</span>
             ${lockedBy ? html`<span class="lock-icon" title="Used by: ${lockedBy}">🔒</span>` : nothing}
           </div>
         `;
    })}
    `;
  }

  private _getToolLockReason(tool: Tool): string | null {
    const skills = this.config!.behavior?.skills ?? [];
    const lockingSkills: string[] = [];
    for (const skill of skills) {
      if (skill.enabled === false) continue;
      if (skill.tools?.some(t => t.name === tool.name)) {
        lockingSkills.push(getSkillDisplayName(skill));
      }
    }
    return lockingSkills.length > 0 ? lockingSkills.join(', ') : null;
  }

  // ── Actions ──────────────────────────────────────────────────

  private _toggleGroup(id: string) {
    if (this._expanded.has(id)) {
      this._expanded.delete(id);
    } else {
      this._expanded.add(id);
    }
    this._expanded = new Set(this._expanded);
  }

  private _expandAll() {
    this._expanded = new Set(['identity', 'header', 'welcome', 'providers', 'behavior', 'skills', 'tools']);
  }

  private _collapseAll() {
    this._expanded = new Set();
  }

  private _setDraft(path: string, value: unknown) {
    this._draft = { ...this._draft, [path]: value };
  }

  private _toggleSkill(name: string, enabled: boolean) {
    this.dispatchEvent(new CustomEvent('toggle-skill', { detail: { name, enabled }, bubbles: true, composed: true }));
  }

  private _toggleTool(name: string, enabled: boolean) {
    this.dispatchEvent(new CustomEvent('toggle-tool', { detail: { name, enabled }, bubbles: true, composed: true }));
  }

  private _toggleSkillTool(skillName: string, toolName: string, enabled: boolean) {
    this.dispatchEvent(new CustomEvent('toggle-skill-tool', { detail: { skillName, toolName, enabled }, bubbles: true, composed: true }));
  }

  private _onApply() {
    this.dispatchEvent(new CustomEvent('apply-settings', { detail: { draft: this._draft }, bubbles: true, composed: true }));
    this._draft = {};
    this._onClose();
  }

  private _onClose() {
    this._draft = {};
    this.dispatchEvent(new CustomEvent('close-settings', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'aura-settings': AuraSettings;
  }
}
