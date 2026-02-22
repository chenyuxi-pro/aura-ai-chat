import {
  LitElement,
  html,
  unsafeCSS,
  nothing,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import type {
  Attachment,
  ModelInfo,
  AIProvider,
  SuggestedPrompt,
} from "../../types/index.js";
import {
  loadUserSelectedModel,
  loadUserSelectedProvider,
  loadUserChatInputHeight,
  saveUserChatInputHeight,
  saveUserSelectedProvider,
  saveUserSelectedModel,
} from "../../utils/preferences.js";
import "@material/web/icon/icon.js";
import styles from "./aura-input.css?inline";

import "../file-attachment/file-attachment.js";
import "../suggested-prompts/suggested-prompts.js";
import type { ProviderManager } from "../../services/provider-manager.js";

type OpenDropdown = "provider" | "model" | null;

@customElement("aura-input")
export class AuraInput extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: String }) placeholder =
    "Ask AI to help with your request...";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) enableAttachments = false;
  @property({ type: Number }) maxAttachmentSize = 10_485_760;
  @property({ type: Array }) allowedAttachmentTypes: string[] = [];
  @property({ type: Object }) providerManager: ProviderManager | null = null;
  @property({ type: String }) appId = "";
  @property({ type: Array }) suggestedPrompts: SuggestedPrompt[] = [];

  @state() providers: AIProvider[] = [];
  @state() private availableModels: ModelInfo[] = [];
  @state() private modelsLoading = false;
  @state() private inputValue = "";
  @state() private pendingAttachments: Attachment[] = [];
  @state() private openDropdown: OpenDropdown = null;
  @state() private showPromptsPopup = false;

  @query(".chat-textarea") private inputEl!: HTMLTextAreaElement;
  @query("file-attachment") private fileAttachmentEl!: HTMLElement & {
    clear(): void;
  };

  get selectedProvider(): AIProvider | null {
    return this.providerManager?.getActiveProvider() ?? null;
  }

  get selectedModel(): string | null {
    return this.providerManager?.getActiveModel() ?? null;
  }

  focusInput(): void {
    this.inputEl?.focus();
  }

  setInputValue(value: string): void {
    this.inputValue = value;
  }

  getInputValue(): string {
    return this.inputValue;
  }

  clearInput(): void {
    this.inputValue = "";
    this.pendingAttachments = [];
    this.fileAttachmentEl?.clear();
  }

  async reloadModels(): Promise<void> {
    await this._loadModels();
  }

  private boundCloseDropdown = this._closeDropdownOnOutsideClick.bind(this);

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this.boundCloseDropdown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("click", this.boundCloseDropdown);
  }

  private _closeDropdownOnOutsideClick(e: MouseEvent): void {
    if (!this.openDropdown) return;
    const path = e.composedPath();
    const clickedInsideSelector = path.some(
      (el) => el instanceof HTMLElement && el.closest?.(".selector-group"),
    );
    if (!clickedInsideSelector) {
      this.openDropdown = null;
    }
  }

  override async updated(changed: PropertyValues): Promise<void> {
    if (changed.has("providerManager") && this.providerManager) {
      this._initProvider();
      await this._initModel();
    }
    if (changed.has("appId") && this.appId) {
      this._restoreInputHeight();
    }
  }

  private _initProvider(): void {
    if (!this.providerManager) return;
    this.providers = this.providerManager.getProviders();
    const savedProviderId = loadUserSelectedProvider(this.appId);
    this.providerManager.switchProvider(
      savedProviderId ??
        (this.providers.length > 0 ? this.providers[0].id : ""),
    );
    this.dispatchEvent(
      new CustomEvent("provider-selected", {
        bubbles: true,
        composed: true,
        detail: { provider: this.providerManager.getActiveProvider() },
      }),
    );
  }

  private async _initModel(): Promise<void> {
    if (!this.providerManager) return;
    const savedModel = loadUserSelectedModel(this.appId);
    this.providerManager.setModel(savedModel ?? "");
    await this._loadModels();
  }

  private async _loadModels(): Promise<void> {
    if (!this.providerManager) return;
    this.modelsLoading = true;
    this.availableModels = [];
    try {
      const activeProvider = this.providerManager.getActiveProvider();
      if (activeProvider) {
        const models = await activeProvider.listModels();
        this.availableModels = models;
        let activeModel = this.providerManager.getActiveModel();
        if (
          !activeModel ||
          !this.availableModels.some((m) => m.id === activeModel)
        ) {
          activeModel = models.length > 0 ? models[0].id : "";
        }
        this._selectModel(activeModel);
      }
    } catch (err) {
      console.error("[aura-input] Error loading models:", err);
      this.availableModels = [];
    } finally {
      this.modelsLoading = false;
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="input-area" part="input-area">
        <div
          class="resize-handle"
          @pointerdown=${this._handleResizeStart}
        ></div>
        <div class="textarea-row" part="textarea-row">
          <textarea
            class="chat-textarea"
            part="input-field"
            rows="2"
            placeholder=${this.placeholder}
            aria-label=${this.placeholder}
            .value=${this.inputValue}
            @input=${this._handleInput}
            @keydown=${this._handleKeyDown}
            ?disabled=${this.disabled || this.loading}
          ></textarea>
        </div>
        <div class="bottom-row">
          <div class="bottom-row_left">
            ${this._renderProviderDropdown()} ${this._renderModelDropdown()}
            ${this.enableAttachments
              ? html`<file-attachment
                  .attachments=${this.pendingAttachments}
                  .maxSize=${this.maxAttachmentSize}
                  .allowedTypes=${this.allowedAttachmentTypes}
                  .disabled=${this.loading}
                  @attachments-changed=${this._handleAttachmentsChanged}
                ></file-attachment>`
              : nothing}
          </div>
          <div class="bottom-row_right">
            ${this._renderIdeaButton()}
            ${this.loading
              ? html` <button
                  class="send-btn stop-btn"
                  part="stop-button"
                  aria-label="Stop generating"
                  title="Stop generating"
                  @click=${this._handleStop}
                >
                  <md-icon>stop</md-icon>
                </button>`
              : html` <button
                  class="send-btn"
                  part="send-button"
                  aria-label="Send message"
                  title="Send message"
                  ?disabled=${!this.inputValue.trim() || this.disabled}
                  @click=${this._handleSend}
                >
                  <md-icon>send</md-icon>
                </button>`}
          </div>
        </div>
      </div>
    `;
  }

  private _renderIdeaButton(): TemplateResult | typeof nothing {
    if (!this.suggestedPrompts.length || this.loading) return nothing;
    return html`
      <div class="idea-button-wrapper">
        <button
          class="idea-btn"
          part="idea-button"
          aria-label="Suggested prompts"
          title="Suggested prompts"
          @mouseenter=${this._showPrompts}
          @mouseleave=${this._scheduleHidePrompts}
          @click=${this._togglePrompts}
        >
          <md-icon>lightbulb</md-icon>
        </button>
        ${this.showPromptsPopup
          ? html`
              <div
                class="prompts-popup"
                part="prompts-popup"
                @mouseenter=${this._showPrompts}
                @mouseleave=${this._scheduleHidePrompts}
              >
                <suggested-prompts
                  .prompts=${this.suggestedPrompts}
                  .label=${"Pick a prompt"}
                  @prompt-selected=${this._handlePopupPromptSelected}
                ></suggested-prompts>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _hideTimeout: ReturnType<typeof setTimeout> | null = null;

  private _showPrompts(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
    this.showPromptsPopup = true;
  }

  private _scheduleHidePrompts(): void {
    this._hideTimeout = setTimeout(() => {
      this.showPromptsPopup = false;
      this._hideTimeout = null;
    }, 200);
  }

  private _togglePrompts(): void {
    this.showPromptsPopup = !this.showPromptsPopup;
  }

  private _handlePopupPromptSelected(
    e: CustomEvent<{ prompt: SuggestedPrompt }>,
  ): void {
    e.stopPropagation();
    this.showPromptsPopup = false;
    this.dispatchEvent(
      new CustomEvent("prompt-selected", {
        bubbles: true,
        composed: true,
        detail: e.detail,
      }),
    );
  }

  private _renderProviderDropdown(): TemplateResult | typeof nothing {
    const icon = this.selectedProvider?.icon ?? "psychology";
    const isOpen = this.openDropdown === "provider";
    const isDisabled = this.loading;

    return html`
      <span class="selector-group">
        <button
          class="selector-trigger"
          part="provider-selector"
          aria-label="AI provider"
          aria-haspopup="listbox"
          aria-expanded=${isOpen}
          ?disabled=${isDisabled}
          @click=${(e: MouseEvent) =>
            !isDisabled && this._toggleDropdown("provider", e)}
        >
          <md-icon>${icon}</md-icon>
          <span>${this.selectedProvider?.label ?? "Provider"}</span>
          <md-icon class="chevron"
            >${isOpen ? "expand_less" : "expand_more"}</md-icon
          >
        </button>
        ${isOpen
          ? html`
              <div
                class="selector-menu"
                role="listbox"
                aria-label="AI provider"
              >
                ${this.providers.map(
                  (p) => html`
                    <button
                      class="selector-menu__item"
                      role="option"
                      aria-selected=${p.id === this.selectedProvider?.id}
                      @click=${() => this._selectProvider(p.id)}
                    >
                      <md-icon>${p.icon ?? "psychology"}</md-icon>
                      ${p.label}
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}
      </span>
    `;
  }

  private _renderModelDropdown(): TemplateResult | typeof nothing {
    if (this.providers.length === 0) return nothing;
    const selectedModelInfo = this.availableModels.find(
      (m) => m.id === this.selectedModel,
    );
    const icon = selectedModelInfo?.icon ?? "graph_5";
    const isOpen = this.openDropdown === "model";
    const isDisabled = this.loading || this.modelsLoading;
    const label = this.modelsLoading
      ? "Loading..."
      : selectedModelInfo
        ? (selectedModelInfo.name ?? selectedModelInfo.id)
        : this.selectedModel || "(default)";

    return html`
      <span class="selector-group">
        <button
          class="selector-trigger"
          part="model-selector"
          aria-label="Model"
          aria-haspopup="listbox"
          aria-expanded=${isOpen}
          ?disabled=${isDisabled}
          @click=${(e: MouseEvent) =>
            !isDisabled && this._toggleDropdown("model", e)}
        >
          <md-icon>${icon}</md-icon>
          <span>${label}</span>
          <md-icon class="chevron"
            >${isOpen ? "expand_less" : "expand_more"}</md-icon
          >
        </button>
        ${isOpen && this.availableModels.length > 0
          ? html`
              <div class="selector-menu" role="listbox" aria-label="Model">
                ${this.availableModels.map(
                  (m) => html`
                    <button
                      class="selector-menu__item"
                      role="option"
                      aria-selected=${m.id === this.selectedModel}
                      @click=${() => this._selectModel(m.id)}
                    >
                      <md-icon>${m.icon ?? "graph_5"}</md-icon>
                      ${m.name ?? m.id}
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}
      </span>
    `;
  }

  private _toggleDropdown(which: "provider" | "model", e: MouseEvent): void {
    e.stopPropagation();
    this.openDropdown = this.openDropdown === which ? null : which;
  }

  private _handleResizeStart(e: PointerEvent): void {
    e.preventDefault();
    const inputArea = (e.target as HTMLElement).parentElement!;
    const startY = e.clientY;
    const startHeight = inputArea.offsetHeight;

    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.max(90, startHeight + delta);
      inputArea.style.height = `${newHeight}px`;
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      saveUserChatInputHeight(this.appId, inputArea.offsetHeight);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  private _restoreInputHeight(): void {
    const height = loadUserChatInputHeight(this.appId);
    if (height == null) return;
    const inputArea = this.renderRoot.querySelector<HTMLElement>(".input-area");
    if (inputArea) {
      inputArea.style.height = `${height}px`;
    }
  }

  private _handleInput(e: Event): void {
    this.inputValue = (e.target as HTMLTextAreaElement).value;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this._handleSend();
    }
  }

  private _handleSend(): void {
    const text = this.inputValue.trim();
    if (!text) return;
    const attachments = this.pendingAttachments.length
      ? [...this.pendingAttachments]
      : undefined;

    this.dispatchEvent(
      new CustomEvent("send-message", {
        bubbles: true,
        composed: true,
        detail: { text, attachments },
      }),
    );

    this.inputValue = "";
    this.pendingAttachments = [];
    if (attachments && this.fileAttachmentEl) {
      this.fileAttachmentEl.clear();
    }
  }

  private _handleStop(): void {
    this.dispatchEvent(
      new CustomEvent("stop-generating", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _selectProvider(providerId: string): Promise<void> {
    if (
      !providerId ||
      !this.providerManager ||
      !this.providers.some((p) => p.id === providerId)
    )
      return;
    this.openDropdown = null;
    this.providerManager.switchProvider(providerId);
    this.providerManager.setModel("");
    await this._loadModels();
    this.dispatchEvent(
      new CustomEvent("provider-selected", {
        bubbles: true,
        composed: true,
        detail: { provider: this.providerManager.getActiveProvider() },
      }),
    );
    saveUserSelectedProvider(this.appId, providerId);
    saveUserSelectedModel(this.appId, "");
  }

  private _selectModel(modelId: string): void {
    this.openDropdown = null;
    this.providerManager?.setModel(modelId);
    saveUserSelectedModel(this.appId, modelId);
    this.dispatchEvent(
      new CustomEvent("model-selected", {
        bubbles: true,
        composed: true,
        detail: { modelId },
      }),
    );
  }

  private _handleAttachmentsChanged(
    e: CustomEvent<{ attachments: Attachment[] }>,
  ): void {
    this.pendingAttachments = e.detail.attachments;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-input": AuraInput;
  }
}
