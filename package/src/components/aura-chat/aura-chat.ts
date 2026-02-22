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
  AuraConfig,
  ChatMessage,
  SuggestedPrompt,
  Attachment,
  ToolCallRequest,
  AIProvider,
  Conversation,
  AgentStep,
} from "../../types/index.js";
import { AuraEventType } from "../../types/index.js";
import {
  CopilotLoginStatus,
  DeviceFlowInfo,
  GitHubCopilotProvider,
} from "../../providers/github-copilot-provider.js";
import { EventBus } from "../../logging/event-bus.js";
import {
  lightTheme,
  darkTheme,
  professionalLightTheme,
  type AuraTheme,
} from "../../themes/index.js";
import "@material/web/icon/icon.js";
import styles from "./aura-chat.css?inline";

import "../aura-messages/aura-messages.js";
import "../suggested-prompts/suggested-prompts.js";
import "../confirmation-bubble/confirmation-bubble.js";
import "../aura-history/aura-history.js";
import "../aura-settings/aura-settings.js";
import "../aura-action-preview/aura-action-preview.js";
import "../aura-input/aura-input.js";
import type { AuraInput } from "../aura-input/aura-input.js";
import { HistoryManager } from "../../services/history-manager.js";
import { ensureMaterialSymbolsFont } from "../../utils/fonts.js";
import { ProviderManager } from "../../services/provider-manager.js";
import { SkillRegistry } from "../../skills/skill-registry.js";
import { ToolDispatcher } from "../../services/tool-dispatcher.js";
import {
  CommunicationManager,
  type HumanInTheLoopResult,
} from "../../services/communication-manager.js";
import { WebMcpBridge } from "../../services/webmcp-bridge.js";
import "../aura-agent-step/aura-agent-step.js";

type WidgetStatus = "idle" | "loading" | "streaming" | "error";

@customElement("aura-chat")
export class AuraChat extends LitElement {
  static override styles = [
    unsafeCSS(styles),
    lightTheme,
    darkTheme,
    professionalLightTheme,
  ];

  @property({ type: Object }) config!: AuraConfig;

  @state() private messages: ChatMessage[] = [];
  @state() private status: WidgetStatus = "idle";
  @state() private pendingConfirm: {
    toolCall: ToolCallRequest;
    resolve: (confirmed: boolean) => void;
  } | null = null;
  private pendingHumanInTheLoop: {
    stepId: string;
    resolve: (result: HumanInTheLoopResult) => void;
  } | null = null;

  private confirmationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private confirmationReminderTimeoutId: ReturnType<typeof setTimeout> | null =
    null;
  private static readonly DEFAULT_CONFIRMATION_TIMEOUT_MS = 65_000;

  @state() private copilotLoginStatus: CopilotLoginStatus = "not_logged_in";
  @state() private copilotDeviceInfo: DeviceFlowInfo | null = null;
  @state() private copilotRememberToken = false;
  @state() private copilotCodeCopied = false;

  @state() private settingsOpen = false;
  @state() private historyOpen = false;

  @query(".transcript") private transcriptEl!: HTMLDivElement;
  @query("aura-input") private chatInputEl!: AuraInput;

  private historyManager: HistoryManager | undefined = undefined;
  private providerManager: ProviderManager | undefined = undefined;
  private eventBus?: EventBus;
  private webMcpBridge?: WebMcpBridge;

  private boundSystemTheme = this._onSystemThemeChange.bind(this);
  private orchestrator: CommunicationManager | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    ensureMaterialSymbolsFont();
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", this.boundSystemTheme);
    this._applyTheme("light");
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearConfirmationTimeout();
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .removeEventListener("change", this.boundSystemTheme);
    if (this.webMcpBridge) {
      this.webMcpBridge.teardown();
      this.webMcpBridge = undefined;
    }
  }

  override async updated(changed: PropertyValues): Promise<void> {
    if (changed.has("config") && this.config) {
      this._applyTheme(this.config.appearance?.theme || "light");
      const prevConfig = changed.get("config") as AuraConfig | undefined;
      const needsInit =
        !this.orchestrator ||
        !prevConfig ||
        prevConfig.agent?.conversationManager !==
          this.config.agent?.conversationManager ||
        prevConfig.agent?.conversationId !== this.config.agent?.conversationId;
      if (needsInit) {
        await this.initManager();
      }
    }
  }

  private _applyTheme(theme: AuraTheme): void {
    if (theme === "auto") {
      this._applySystemTheme();
    } else {
      this.setAttribute("data-theme", theme);
    }
  }

  private _applySystemTheme(): void {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    this.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  private _onSystemThemeChange(): void {
    const theme = this.config?.appearance?.theme ?? "light";
    if (theme === "auto") {
      this._applySystemTheme();
    }
  }

  private async initManager(): Promise<void> {
    this.eventBus = new EventBus(this, this.config.onAuraEvent);
    this.historyManager = new HistoryManager(this.config, this.eventBus);
    this.providerManager = new ProviderManager(this.config?.providers);
    const skillManager = new SkillRegistry();
    if (this.config.agent?.skills) {
      skillManager.registerSkills(this.config.agent.skills);
    }
    if (this.config.agent?.tools) {
      skillManager.registerTools(this.config.agent.tools);
    }
    const toolRunner = new ToolDispatcher(
      skillManager,
      this.config.agent?.toolTimeout,
    );
    this.webMcpBridge?.teardown();
    if (this.config.agent?.enableWebMcp) {
      const conversationId = this.historyManager.getConversation().id;
      this.webMcpBridge = new WebMcpBridge(
        skillManager,
        this.config.identity.appMetadata,
        conversationId,
      );
      this.webMcpBridge.expose();
      this.webMcpBridge.importPageTools();
    }
    this.orchestrator = new CommunicationManager(
      skillManager,
      toolRunner,
      this.providerManager,
      this.historyManager,
      this.eventBus,
      this.config,
      {
        onStepStart: (_step: AgentStep) => {
          this.refreshMessages();
          this.scrollToBottom();
        },
        onStepUpdate: (_step: AgentStep) => {
          this.refreshMessages();
          this.scrollToBottom();
        },
        onStreamDelta: (_delta: string) => {
          this.scrollToBottom();
        },
        onMessagePushed: () => {
          this.refreshMessages();
          this.scrollToBottom();
        },
        requestHumanInTheLoop: (step: AgentStep) => {
          this.refreshMessages();
          this.scrollToBottom();
          this.ensureNotificationPermission();
          this.notifyIfHidden(
            "Action requires your response",
            `"${step.summary}" is waiting for your response.`,
          );
          return new Promise<HumanInTheLoopResult>((resolve) => {
            this.pendingHumanInTheLoop = { stepId: step.id, resolve };
            this.startConfirmationTimeout(resolve);
          });
        },
      },
    );
    this.refreshMessages();
  }

  refreshMessages(): void {
    this.messages = [...(this.historyManager?.getMessages() ?? [])];
  }

  private get activeProvider(): AIProvider | undefined {
    return this.providerManager?.getActiveProvider();
  }

  private get activeProviderIcon(): string {
    return this.activeProvider?.icon ?? "smart_toy";
  }

  private get isCopilotSelected(): boolean {
    return this.activeProvider?.id === GitHubCopilotProvider.id;
  }

  private get needsCopilotLogin(): boolean {
    return (
      this.isCopilotSelected &&
      this.copilotLoginStatus !== "logged_in" &&
      this.copilotLoginStatus !== "checking"
    );
  }

  private get isCopilotChecking(): boolean {
    return this.isCopilotSelected && this.copilotLoginStatus === "checking";
  }

  private initCopilotLoginWatcher(copilot: GitHubCopilotProvider): void {
    if (!copilot) return;
    this.copilotLoginStatus = copilot.loginStatus;
    this.copilotRememberToken = copilot.getRememberToken();
    copilot.onLoginStatusChange = (status: CopilotLoginStatus) => {
      this.copilotLoginStatus = status;
      if (status === "logged_in") {
        this.copilotDeviceInfo = null;
        this.chatInputEl?.reloadModels();
      }
    };
  }

  private async handleCopilotLogin(): Promise<void> {
    const copilot = this.activeProvider as GitHubCopilotProvider;
    if (!copilot) return;
    copilot.setRememberToken(this.copilotRememberToken);
    try {
      const info = await copilot.login();
      this.copilotDeviceInfo = info;
      try {
        await navigator.clipboard.writeText(info.userCode);
        this.copilotCodeCopied = true;
        setTimeout(() => {
          this.copilotCodeCopied = false;
        }, 2000);
      } catch {
        // clipboard may fail
      }
      window.open(this.getCopilotVerificationUrl(info), "_blank", "noopener");
    } catch (err) {
      console.error("[aura-chat] Copilot login failed:", err);
      this.copilotLoginStatus = "error";
    }
  }

  private getCopilotVerificationUrl(info: DeviceFlowInfo): string {
    const url = new URL(info.verificationUri);
    url.pathname = "/login/device";
    url.searchParams.set("skip_account_picker", "true");
    return url.toString();
  }

  private handleRememberTokenChange(e: Event): void {
    this.copilotRememberToken = (e.target as HTMLInputElement).checked;
  }

  private async handleCopyDeviceCode(): Promise<void> {
    const code = this.copilotDeviceInfo?.userCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copilotCodeCopied = true;
      setTimeout(() => {
        this.copilotCodeCopied = false;
      }, 2000);
    } catch {
      console.warn("[aura-chat] Failed to copy device code");
    }
  }

  override render(): TemplateResult {
    return html`
      <!-- Main chat column -->
      <div class="chat-column">
        ${this.renderHeader()} ${this.renderTranscript()}
        ${this.renderInputArea()}
      </div>
      ${this.renderOverlays()}
    `;
  }

  private renderHeader(): TemplateResult {
    const cfg = this.config;
    return html`
      <div class="header" part="header">
        <div class="header__left">
          <span class="header__icon" part="header-icon">
            <md-icon
              >${cfg?.appearance?.headerIcon ??
              this.activeProviderIcon}</md-icon
            >
          </span>
          <span class="header__title" part="header-title">
            ${cfg?.appearance?.headerTitle ??
            cfg?.identity?.aiName ??
            "AI Assistant"}
          </span>
        </div>
        <div class="header__actions">
          <button
            class="header__btn"
            @click=${this.handleNewConversation}
            aria-label="New conversation"
            title="New conversation"
          >
            <md-icon>add</md-icon>
          </button>
          <button
            class="header__btn"
            @click=${this.handleOpenHistory}
            aria-label="Conversation history"
            title="Conversation history"
          >
            <md-icon>history</md-icon>
          </button>
          <button
            class="header__btn"
            @click=${this.handleOpenSettings}
            aria-label="Chat settings"
            title="Chat settings"
          >
            <md-icon>settings</md-icon>
          </button>
        </div>
      </div>
    `;
  }

  private renderTranscript(): TemplateResult {
    const cfg = this.config;
    const showEmpty =
      this.messages.length === 0 &&
      this.status !== "loading" &&
      this.status !== "streaming";
    const loadingMessage =
      this.status === "loading"
        ? "Loading..."
        : this.status === "streaming" && !cfg?.appearance?.loadingMessage
          ? "Thinking..."
          : cfg?.appearance?.loadingMessage;
    return html`
      <div
        class="transcript"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        part="transcript"
      >
        ${this.isCopilotChecking
          ? this.renderTypingIndicator("Logging in...")
          : nothing}
        ${this.needsCopilotLogin ? this.renderCopilotLogin() : nothing}
        ${showEmpty && !this.needsCopilotLogin && !this.isCopilotChecking
          ? this.renderEmptyState()
          : nothing}
        ${!this.needsCopilotLogin && !this.isCopilotChecking
          ? this.renderTimelineItems()
          : nothing}
        ${!this.needsCopilotLogin &&
        !this.isCopilotChecking &&
        this.messages.length > 0 &&
        (this.status === "loading" || this.status === "streaming")
          ? this.renderTypingIndicator(loadingMessage)
          : nothing}
      </div>
    `;
  }

  private renderTimelineItems(): TemplateResult {
    const showThinking = this.config?.agent?.showThinkingProcess ?? true;
    return html`${this.messages
      .filter((m) => {
        if (m.role === "system") return false;
        if (m.metadata?.["isIteration"] && !showThinking) {
          const steps = (m.metadata["agentSteps"] as AgentStep[]) ?? [];
          const hasWaitingApproval = steps.some(
            (s) => s.type === "approval" && s.status === "waiting",
          );
          const hasWaitingUserInput = steps.some(
            (s) => s.type === "ask-user" && s.status === "waiting",
          );
          if (!hasWaitingApproval && !hasWaitingUserInput) return false;
        }
        return true;
      })
      .map(
        (m) => html`
          <aura-messages
            .message=${m}
            .aiIcon=${this.activeProviderIcon}
            .aiName=${this.config?.identity?.aiName ?? "AI Assistant"}
            .agentSteps=${m.metadata && m.metadata["isIteration"]
              ? (m.metadata["agentSteps"] as AgentStep[]).filter(
                  (s) => s.iteration === m.metadata?.["iterationNumber"],
                )
              : undefined}
            @approve-action=${this.handleStepApproved}
            @reject-action=${this.handleStepRejected}
            @user-input-submitted=${this.handleUserInputSubmitted}
            @retry=${this.handleRetry}
            part="aura-messages"
          ></aura-messages>
        `,
      )}`;
  }

  private renderInputArea(): TemplateResult {
    const cfg = this.config;
    const isLoading = this.status === "loading" || this.status === "streaming";
    return html`
      <aura-input
        .placeholder=${cfg?.appearance?.inputPlaceholder ??
        "Ask AI to help with your request..."}
        .disabled=${this.needsCopilotLogin}
        .loading=${isLoading}
        .enableAttachments=${!!this.config?.appearance?.enableAttachments}
        .maxAttachmentSize=${this.config?.appearance?.maxAttachmentSize ??
        10_485_760}
        .allowedAttachmentTypes=${this.config?.appearance
          ?.allowedAttachmentTypes ?? []}
        .providerManager=${this.providerManager}
        .appId=${this.config?.identity?.appMetadata?.appId ?? "default"}
        .suggestedPrompts=${this.config?.appearance?.suggestedPrompts ?? []}
        @send-message=${this.handleSendMessage}
        @stop-generating=${this.handleStop}
        @provider-selected=${this.handleProviderSelected}
        @prompt-selected=${this.handlePromptSelected}
      ></aura-input>
    `;
  }

  private renderOverlays(): TemplateResult {
    return html`
      ${this.pendingConfirm
        ? html`
            <confirmation-bubble
              .toolCall=${this.pendingConfirm.toolCall}
              @confirm-result=${this.handleConfirmResult}
            ></confirmation-bubble>
          `
        : nothing}
      ${this.settingsOpen ? this.renderSettingsModal() : nothing}
      ${this.historyOpen
        ? html`
            <aura-history
              .historyManager=${this.historyManager}
              @conversation-selected=${this.handleHistoryConversationSelected}
              @history-closed=${this.handleCloseHistory}
            ></aura-history>
          `
        : nothing}
    `;
  }

  private renderCopilotLogin(): TemplateResult {
    if (
      this.copilotDeviceInfo &&
      (this.copilotLoginStatus === "polling" ||
        this.copilotLoginStatus === "activating_device")
    ) {
      return html`
        <div class="copilot-device" part="copilot-device">
          <md-icon class="copilot-login__icon">key</md-icon>
          <h3 class="copilot-device__heading">
            Enter your device code on GitHub
          </h3>
          <p class="copilot-device__desc">
            Your code has been copied to the clipboard. Paste it on the GitHub
            page that just opened.
          </p>
          <div class="copilot-device__code-row">
            <span class="copilot-device__code"
              >${this.copilotDeviceInfo.userCode}</span
            >
            <button
              class="copilot-device__copy-btn"
              title="Copy code"
              @click=${this.handleCopyDeviceCode}
            >
              <md-icon
                >${this.copilotCodeCopied ? "check" : "content_copy"}</md-icon
              >
            </button>
          </div>
          <div class="copilot-device__status">
            <span class="copilot-device__spinner"></span>
            Waiting for authorisation...
          </div>
          <a
            class="copilot-device__link"
            href=${this.getCopilotVerificationUrl(this.copilotDeviceInfo)}
            target="_blank"
            rel="noopener"
            >Open GitHub verification page</a
          >
        </div>
      `;
    }
    if (
      this.copilotLoginStatus === "activating_device" &&
      !this.copilotDeviceInfo
    ) {
      return html`
        <div class="copilot-device" part="copilot-device">
          <md-icon class="copilot-login__icon">login</md-icon>
          <h3 class="copilot-device__heading">Connecting to GitHub...</h3>
          <div class="copilot-device__status">
            <span class="copilot-device__spinner"></span>
            Requesting device code...
          </div>
        </div>
      `;
    }
    if (this.copilotLoginStatus === "error") {
      return html`
        <div class="copilot-login" part="copilot-login">
          <md-icon class="copilot-login__icon">error_outline</md-icon>
          <h3 class="copilot-login__heading">Connection failed</h3>
          <p class="copilot-login__desc">
            Could not connect to GitHub Copilot. Please try again.
          </p>
          <button class="copilot-login__btn" @click=${this.handleCopilotLogin}>
            <md-icon>refresh</md-icon> Retry connection
          </button>
        </div>
      `;
    }
    return html`
      <div class="copilot-login" part="copilot-login">
        <md-icon class="copilot-login__icon">login</md-icon>
        <h3 class="copilot-login__heading">Connect to GitHub Copilot</h3>
        <p class="copilot-login__desc">
          Sign in with your GitHub account to start chatting with Copilot.
        </p>
        <label class="copilot-login__remember">
          <input
            type="checkbox"
            .checked=${this.copilotRememberToken}
            @change=${this.handleRememberTokenChange}
          />
          Remember my access token
        </label>
        <button class="copilot-login__btn" @click=${this.handleCopilotLogin}>
          <md-icon>login</md-icon> Connect to GitHub Copilot
        </button>
      </div>
    `;
  }

  private renderEmptyState(): TemplateResult {
    const welcomeMessageTitle = this.config?.appearance?.welcomeMessageTitle;
    const welcome = this.config?.appearance?.welcomeMessage;
    const prompts = this.config?.appearance?.suggestedPrompts ?? [];
    return html`
      <div class="empty-state" part="empty-state">
        <span class="empty-state__icon"><md-icon>chat</md-icon></span>
        <h3 class="empty-state__heading">
          ${welcomeMessageTitle ?? "How can I help?"}
        </h3>
        <p class="empty-state__desc">
          ${welcome ??
          "Ask me to create charts, add datasets, configure filters, or modify your dashboard."}
        </p>
        <suggested-prompts
          .prompts=${prompts}
          .label=${"Suggested prompts"}
          @prompt-selected=${this.handlePromptSelected}
        ></suggested-prompts>
      </div>
    `;
  }

  private renderTypingIndicator(label?: string): TemplateResult {
    return html`
      <div
        class="typing-indicator"
        part="typing-indicator"
        role="status"
        aria-label=${label ?? "Thinking..."}
      >
        <div class="typing-avatar">
          <md-icon>${this.activeProviderIcon}</md-icon>
        </div>
        <div class="typing-content">
          <div class="typing-header">
            <span class="typing-sender"
              >${this.config?.identity?.aiName ?? "AI Assistant"}</span
            >
            ${label
              ? html`<span class="typing-label" part="typing-label"
                  >${label}</span
                >`
              : nothing}
          </div>
          <div class="typing-body">
            <div class="typing-dots">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private handleStepApproved(_e: CustomEvent<{ actionId: string }>): void {
    if (!this.pendingHumanInTheLoop) return;
    this.clearConfirmationTimeout();
    const resolve = this.pendingHumanInTheLoop.resolve;
    this.pendingHumanInTheLoop = null;
    resolve({ approved: true });
  }

  private handleStepRejected(_e: CustomEvent<{ actionId: string }>): void {
    if (!this.pendingHumanInTheLoop) return;
    this.clearConfirmationTimeout();
    const resolve = this.pendingHumanInTheLoop.resolve;
    this.pendingHumanInTheLoop = null;
    resolve({ approved: false });
  }

  private handleUserInputSubmitted(
    e: CustomEvent<{ stepId: string; text: string }>,
  ): void {
    if (!this.pendingHumanInTheLoop) return;
    this.clearConfirmationTimeout();
    const resolve = this.pendingHumanInTheLoop.resolve;
    this.pendingHumanInTheLoop = null;
    resolve({ text: e.detail.text });
  }

  private startConfirmationTimeout(
    resolve: (result: HumanInTheLoopResult) => void,
  ): void {
    this.clearConfirmationTimeout();
    const timeoutMs =
      this.config?.agent?.confirmationTimeoutMs ??
      AuraChat.DEFAULT_CONFIRMATION_TIMEOUT_MS;
    if (timeoutMs <= 0) return;
    const reminderMs = timeoutMs - 60_000;
    if (reminderMs > 0) {
      this.confirmationReminderTimeoutId = setTimeout(() => {
        this.confirmationReminderTimeoutId = null;
        if (!this.pendingHumanInTheLoop) return;
        this.notifyIfHidden(
          "Action expiring soon",
          "A pending confirmation will timeout in 1 minute. Switch back to respond.",
        );
      }, reminderMs);
    }
    this.confirmationTimeoutId = setTimeout(() => {
      this.confirmationTimeoutId = null;
      if (!this.pendingHumanInTheLoop) return;
      this.pendingHumanInTheLoop = null;
      resolve({ timedOut: true });
      this.notifyIfHidden(
        "Confirmation timed out",
        "This action was cancelled as no response was received in time. Please try again when you're ready.",
      );
    }, timeoutMs);
  }

  private clearConfirmationTimeout(): void {
    if (this.confirmationReminderTimeoutId !== null) {
      clearTimeout(this.confirmationReminderTimeoutId);
      this.confirmationReminderTimeoutId = null;
    }
    if (this.confirmationTimeoutId !== null) {
      clearTimeout(this.confirmationTimeoutId);
      this.confirmationTimeoutId = null;
    }
  }

  private notifyIfHidden(title: string, body: string): void {
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      return;
    }
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: this.activeProviderIcon ?? "smart_toy",
        tag: "aura-confirmation",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Notification may fail
    }
  }

  private ensureNotificationPermission(): void {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  private handleOpenSettings(): void {
    this.settingsOpen = true;
  }

  private handleCloseSettings(): void {
    this.settingsOpen = false;
  }

  private handleSettingsApply(e: CustomEvent): void {
    this.settingsOpen = false;
    this.dispatchEvent(
      new CustomEvent("settings-apply", {
        bubbles: true,
        composed: true,
        detail: e.detail,
      }),
    );
  }

  private get settingsConfigEl() {
    return this.shadowRoot?.getElementById("settingsConfig") as
      | (HTMLElement & {
          getValues(): unknown;
          expandAll(): void;
          collapseAll(): void;
          isAllReadonly: boolean;
        })
      | null;
  }

  private handleSettingsExpandAll(): void {
    this.settingsConfigEl?.expandAll();
  }

  private handleSettingsCollapseAll(): void {
    this.settingsConfigEl?.collapseAll();
  }

  private handleSettingsApplyFromFooter(): void {
    const configEl = this.settingsConfigEl;
    if (!configEl) return;
    const values = configEl.getValues();
    this.settingsOpen = false;
    this.dispatchEvent(
      new CustomEvent("settings-apply", {
        bubbles: true,
        composed: true,
        detail: values,
      }),
    );
  }

  private renderSettingsModal(): TemplateResult {
    return html`
      <div
        class="settings-overlay"
        @click=${(e: Event) => {
          if (
            (e.target as HTMLElement).classList.contains("settings-overlay")
          ) {
            this.handleCloseSettings();
          }
        }}
      >
        <div class="settings-modal">
          <div class="settings-modal__header">
            <span class="settings-modal__title">Chat Settings</span>
            <button
              class="settings-modal__close"
              @click=${this.handleCloseSettings}
              aria-label="Close settings"
            >
              <md-icon>close</md-icon>
            </button>
          </div>
          <div class="settings-modal__body">
            <aura-settings
              id="settingsConfig"
              data-theme=${this.getAttribute("data-theme") ?? "light"}
              .config=${this.config}
              @settings-apply=${this.handleSettingsApply}
              @settings-cancel=${this.handleCloseSettings}
            ></aura-settings>
          </div>
          <div class="settings-modal__footer">
            <div class="settings-modal__footer-left">
              <button class="btn-toggle" @click=${this.handleSettingsExpandAll}>
                Expand All
              </button>
              <button
                class="btn-toggle"
                @click=${this.handleSettingsCollapseAll}
              >
                Collapse All
              </button>
            </div>
            <div class="settings-modal__footer-right">
              <button class="btn-cancel" @click=${this.handleCloseSettings}>
                Cancel
              </button>
              <button
                class="btn-apply"
                @click=${this.handleSettingsApplyFromFooter}
                ?disabled=${this.config?.settingsModalConfig?.readonly &&
                !this.config.settingsModalConfig.editableFields?.length}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async handleOpenHistory(): Promise<void> {
    this.historyOpen = true;
  }

  private handleCloseHistory(): void {
    this.historyOpen = false;
  }

  private async handleHistoryConversationSelected(
    e: CustomEvent<{ conversation: Conversation }>,
  ): Promise<void> {
    const { conversation } = e.detail;
    if (conversation) {
      this.messages = [...conversation.messages];
      this.status = "idle";
    }
    this.historyOpen = false;
  }

  private async handleSendMessage(
    e: CustomEvent<{ text: string; attachments?: Attachment[] }>,
  ): Promise<void> {
    const { text, attachments } = e.detail;
    if (!text) return;
    if (!this.orchestrator) return;
    this.status = this.config.agent?.enableStreaming ? "streaming" : "loading";
    this.chatInputEl?.focusInput();
    try {
      await this.orchestrator.run(text, attachments);
      this.status = "idle";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const cancelMsg: ChatMessage = {
          id: `msg_cancel_${Date.now()}`,
          role: "assistant",
          content: "OK, I've stopped generating the response.",
          timestamp: Date.now(),
        };
        await this.historyManager?.pushAndPersistMessage(cancelMsg);
        this.refreshMessages();
        this.status = "idle";
      } else {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        this.eventBus?.emit(AuraEventType.Error, { error: errorObj });
        const errorMsg: ChatMessage = {
          id: `msg_error_${Date.now()}`,
          role: "assistant",
          content: errorObj.message || "Something went wrong.",
          timestamp: Date.now(),
          metadata: { type: "error" },
        };
        await this.historyManager?.pushAndPersistMessage(errorMsg);
        this.refreshMessages();
        this.status = "idle";
      }
    }
    await this.updateComplete;
    this.scrollToBottom();
    this.chatInputEl?.focusInput();
  }

  private handleStop(): void {
    this.orchestrator?.cancel();
  }

  private handlePromptSelected(
    e: CustomEvent<{ prompt: SuggestedPrompt }>,
  ): void {
    this.handleSendMessage(
      new CustomEvent("send-message", {
        detail: { text: e.detail.prompt.promptText },
      }),
    );
  }

  private async handleNewConversation(): Promise<void> {
    if (this.historyManager) {
      await this.historyManager.newConversation();
      this.messages = [];
      this.status = "idle";
      this.pendingHumanInTheLoop = null;
      this.orchestrator?.reset();
    }
  }

  private handleRetry(): void {
    const lastUser = [...this.messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUser) {
      const idx = this.messages.lastIndexOf(lastUser);
      this.messages = this.messages.slice(0, idx);
      this.handleSendMessage(
        new CustomEvent("send-message", {
          detail: { text: lastUser.content },
        }),
      );
    }
  }

  private handleConfirmResult(e: CustomEvent<{ confirmed: boolean }>): void {
    if (this.pendingConfirm) {
      this.pendingConfirm.resolve(e.detail.confirmed);
      this.pendingConfirm = null;
    }
  }

  private handleProviderSelected(
    e: CustomEvent<{ provider: AIProvider }>,
  ): void {
    const { provider } = e.detail;
    const providerId = provider?.id ?? "";
    if (providerId === GitHubCopilotProvider.id) {
      this.initCopilotLoginWatcher(provider as GitHubCopilotProvider);
    } else {
      this.copilotDeviceInfo = null;
      this.copilotLoginStatus = "not_logged_in";
    }
    this.requestUpdate();
  }

  private scrollToBottom(): void {
    if (this.transcriptEl) {
      this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
    }
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-chat": AuraChat;
  }
}
