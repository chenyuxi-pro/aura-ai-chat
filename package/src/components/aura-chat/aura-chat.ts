/* ──────────────────────────────────────────────────────────────────
 *  <aura-chat> — Root web component orchestrating all children
 * ────────────────────────────────────────────────────────────────── */

import { LitElement, html, unsafeCSS } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
    AuraConfig,
    Message,
    AIModel,
    AIProvider,
    AIProviderConfig,
    BuiltInProviderConfig,
    ConversationMeta,
    AuraTheme,
    CallToolResult,
    Tool,
} from '../../types/index.js';
import { ActionCancelledError } from '../../types/index.js';
import { store } from '../../store/aura-store.js';
import { promptBuilder } from '../../prompt/prompt-builder.js';
import { skillRegistry } from '../../skills/skill-registry.js';
import { toolRegistry } from '../../tools/tool-registry.js';
import { ActionToolRegistry } from '../../services/action-tool-registry.js';
import { PendingActionQueue } from '../../services/pending-action-queue.js';
import { createDispatch } from '../../services/tool-dispatcher.js';
import { OpenAIProvider } from '../../providers/openai-provider.js';
import { AnthropicProvider } from '../../providers/anthropic-provider.js';
import { GitHubCopilotProvider } from '../../providers/github-copilot-provider.js';
import type { CopilotLoginState } from '../aura-messages/aura-messages.js';
import type { AuraSettings } from '../aura-settings/aura-settings.js';
import styles from './aura-chat.css?inline';

// Import child components
import '../aura-header/aura-header.js';
import '../aura-messages/aura-messages.js';
import '../aura-input/aura-input.js';
import '../aura-settings/aura-settings.js';
import '../aura-history/aura-history.js';
import '../confirmation-bubble/confirmation-bubble.js';

function createBuiltInProvider(providerId: string, config: BuiltInProviderConfig): AIProvider | undefined {
    switch (providerId) {
        case 'openai': return new OpenAIProvider(config);
        case 'anthropic': return new AnthropicProvider(config);
        case 'github-copilot': return new GitHubCopilotProvider(config);
        default:
            console.error(`Unknown built-in provider: ${providerId}`);
            return undefined;
    }
}

function resolveProvider(config: AIProviderConfig): AIProvider | undefined {
    switch (config.type) {
        case 'built-in':
            return createBuiltInProvider(config.providerId, config);
        case 'custom':
            return config.instance;
        default:
            (config as never) satisfies never;
            console.error('Unknown provider config type');
            return undefined;
    }
}

interface ProviderOption {
    id: string;
    name: string;
    icon?: string;
}

@customElement('aura-chat')
export class AuraChat extends LitElement {
    static override styles = unsafeCSS(styles);

    // ── Public API ──────────────────────────────────────────────

    private _config: AuraConfig | null = null;

    @property({ type: Object })
    set config(val: AuraConfig | null) {
        this._config = val;
        if (val) this._initFromConfig(val);
    }
    get config(): AuraConfig | null {
        return this._config;
    }

    // ── Internal state ──────────────────────────────────────────

    @state() private _messages: Message[] = [];
    @state() private _isStreaming = false;
    @state() private _streamingContent = '';
    @state() private _settingsOpen = false;
    @state() private _historyOpen = false;
    @state() private _conversations: ConversationMeta[] = [];
    @state() private _activeConversationId: string | null = null;
    @state() private _models: AIModel[] = [];
    @state() private _activeModel = '';
    @state() private _activeProviderId = '';
    @state() private _inputHeight = 120;
    @state() private _resolvedTheme: string = 'dark';
    @state() private _copilotLoginState: CopilotLoginState | null = null;

    private _providers: Map<string, AIProvider> = new Map();
    private _providerOptions: ProviderOption[] = [];
    private _settingsDialog?: AuraSettings;
    private _unsubscribe?: () => void;
    private _copilotUnsub?: () => void;

    // ── Action Tool subsystem ────────────────────────────────────
    private _actionToolRegistry = new ActionToolRegistry();
    private _pendingActionQueue = new PendingActionQueue();
    private _dispatch = createDispatch(this._pendingActionQueue);
    @state() private _pendingProposal: { tool: Tool; args: Record<string, unknown>; summary: string } | null = null;
    private readonly _settingsThemeVars = [
        '--aura-font-family',
        '--aura-color-bg',
        '--aura-color-border',
        '--aura-color-text',
        '--aura-color-text-muted',
        '--aura-color-input-bg',
        '--aura-color-input-bg-focus',
        '--aura-color-primary',
        '--aura-color-primary-fg',
    ] as const;
    private readonly _handleSettingsClose = () => { this._settingsOpen = false; };
    private readonly _handleSettingsApply = (event: Event) => this._onApplySettings(event as CustomEvent<{ draft: Record<string, unknown> }>);
    private readonly _handleSettingsToggleSkill = (event: Event) => this._onToggleSkill(event as CustomEvent<{ name: string; enabled: boolean }>);
    private readonly _handleSettingsToggleTool = (event: Event) => this._onToggleTool(event as CustomEvent<{ name: string; enabled: boolean }>);

    // ── Lifecycle ───────────────────────────────────────────────

    override connectedCallback() {
        super.connectedCallback();
        this._applySystemTheme();
        this._ensureSettingsDialog();
        this._syncSettingsDialog();
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => this._applySystemTheme());
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe?.();
        this._copilotUnsub?.();
        this._teardownSettingsDialog();
    }

    override updated(_changed: PropertyValues<this>) {
        this._syncSettingsDialog();
    }

    private _ensureSettingsDialog() {
        if (this._settingsDialog || !this.isConnected) return;

        const dialog = document.createElement('aura-settings') as AuraSettings;
        dialog.addEventListener('close-settings', this._handleSettingsClose as EventListener);
        dialog.addEventListener('apply-settings', this._handleSettingsApply as EventListener);
        dialog.addEventListener('toggle-skill', this._handleSettingsToggleSkill as EventListener);
        dialog.addEventListener('toggle-tool', this._handleSettingsToggleTool as EventListener);
        document.body.appendChild(dialog);
        this._settingsDialog = dialog;
    }

    private _teardownSettingsDialog() {
        if (!this._settingsDialog) return;

        this._settingsDialog.removeEventListener('close-settings', this._handleSettingsClose as EventListener);
        this._settingsDialog.removeEventListener('apply-settings', this._handleSettingsApply as EventListener);
        this._settingsDialog.removeEventListener('toggle-skill', this._handleSettingsToggleSkill as EventListener);
        this._settingsDialog.removeEventListener('toggle-tool', this._handleSettingsToggleTool as EventListener);
        this._settingsDialog.remove();
        this._settingsDialog = undefined;
    }

    private _syncSettingsDialog() {
        this._ensureSettingsDialog();
        if (!this._settingsDialog) return;

        this._settingsDialog.open = this._settingsOpen;
        this._settingsDialog.config = this._config;

        const theme = this.getAttribute('data-theme') || this._resolvedTheme;
        this._settingsDialog.setAttribute('data-theme', theme);

        const computed = getComputedStyle(this);
        for (const varName of this._settingsThemeVars) {
            const value = computed.getPropertyValue(varName).trim();
            if (value) {
                this._settingsDialog.style.setProperty(varName, value);
            } else {
                this._settingsDialog.style.removeProperty(varName);
            }
        }
    }

    private async _initFromConfig(config: AuraConfig) {
        store.init(config);

        // Resolve providers
        this._providers.clear();
        this._providerOptions = [];
        for (const pc of config.providers) {
            const provider = resolveProvider(pc);
            if (!provider) continue;
            const id = provider.id;
            this._providers.set(id, provider);
            this._providerOptions.push({
                id,
                name: pc.displayName ?? provider.name,
                icon: pc.icon ?? provider.icon,
            });
        }

        // Set active provider
        this._activeProviderId = store.activeProviderId || this._providerOptions[0]?.id || '';
        this._activeModel = store.activeModel;

        // Register skills & tools
        skillRegistry.clear();
        toolRegistry.clear();
        if (config.behavior.skills) skillRegistry.registerAll(config.behavior.skills);
        if (config.behavior.tools) toolRegistry.registerAll(config.behavior.tools);

        // Register action tools
        this._registerActionTools(config.behavior.tools);

        // Load models for active provider
        await this._loadModels();

        // Check auth & copilot login state
        this._updateCopilotState();
        const provider = this._providers.get(this._activeProviderId);
        if (provider) {
            const authed = await provider.isAuthenticated();
            store.setAuthenticated(authed);
        }

        // Load conversations
        await this._loadConversations();

        // Theme
        this._applyTheme(config.ui?.theme || 'light');

        // Input height
        this._inputHeight = store.inputHeight;

        store.emitEvent('debug', { message: 'Widget initialized', config: { providers: this._providerOptions.map(p => p.id) } });
    }

    private async _loadModels() {
        const provider = this._providers.get(this._activeProviderId);
        if (!provider) return;
        try {
            this._models = await provider.getAvailableModels();

            // If current model is not in the list, or no model is selected, pick the first available
            if (this._models.length > 0) {
                const isValid = this._models.some(m => m.id === this._activeModel);
                if (!isValid) {
                    this._activeModel = this._models[0].id;
                    store.setActiveModel(this._activeModel);
                }
            }
        } catch {
            this._models = [];
        }
    }

    private async _loadConversations() {
        if (!this._config?.conversation) return;
        try {
            this._conversations = await this._config.conversation.listConversations();
        } catch {
            this._conversations = [];
        }
    }

    private _applyTheme(theme: AuraTheme) {
        const t = theme || 'light';
        if (t === 'auto') {
            this._applySystemTheme();
        } else {
            this._resolvedTheme = t;
            this.setAttribute('data-theme', t);
        }
    }

    private _applySystemTheme() {
        const config = this._config;
        const theme = config?.ui?.theme ?? store.theme;
        if (theme !== 'auto') return;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this._resolvedTheme = prefersDark ? 'dark' : 'light';
        this.setAttribute('data-theme', this._resolvedTheme);
    }

    // ── Render ──────────────────────────────────────────────────

    override render() {
        if (!this._config) return html``;

        return html`
      <aura-header
        .title=${this._config.header.title}
        .icon=${this._config.header.icon || ''}
        @new-conversation=${this._onNewConversation}
        @toggle-history=${this._onToggleHistory}
        @toggle-settings=${this._onToggleSettings}
      ></aura-header>

      <aura-messages
        .messages=${this._messages}
        .streaming=${this._isStreaming}
        .streamingContent=${this._streamingContent}
        .aiName=${this._config.identity.aiName}
        .aiIcon=${this._providerOptions.find(p => p.id === this._activeProviderId)?.icon || ''}
        .welcomeTitle=${this._config.welcome.title}
        .welcomeMessage=${this._config.welcome.message}
        .welcomeIcon=${this._config.welcome.icon || ''}
        .suggestedPrompts=${this._config.welcome.suggestedPrompts}
        .copilotLogin=${this._copilotLoginState}
        @send-prompt=${this._onSuggestedPrompt}
        @copilot-sign-in=${this._onCopilotSignIn}
      ></aura-messages>

      <aura-input
        .providers=${this._providerOptions}
        .activeProviderId=${this._activeProviderId}
        .models=${this._models}
        .activeModel=${this._activeModel}
        .streaming=${this._isStreaming}
        .inputHeight=${this._inputHeight}
        @send-message=${this._onSendMessage}
        @cancel-stream=${this._onCancelStream}
        @provider-change=${this._onProviderChange}
        @model-change=${this._onModelChange}
        @resize-input=${this._onResizeInput}
      ></aura-input>

      <aura-history
        .open=${this._historyOpen}
        .conversations=${this._conversations}
        .activeConversationId=${this._activeConversationId || ''}
        .canDelete=${!!this._config.conversation.deleteConversation}
        .canRename=${!!this._config.conversation.updateConversation}
        @close-history=${() => this._historyOpen = false}
        @select-conversation=${this._onSelectConversation}
        @delete-conversation=${this._onDeleteConversation}
        @rename-conversation=${this._onRenameConversation}
      ></aura-history>

      ${this._pendingProposal ? html`
        <aura-confirmation-bubble
          .tool=${this._pendingProposal.tool}
          .args=${this._pendingProposal.args}
          .summary=${this._pendingProposal.summary}
          @action-approved=${this._onActionApproved}
          @action-cancelled=${this._onActionCancelled}
        ></aura-confirmation-bubble>
      ` : ''}
    `;
    }

    // ── Event handlers ──────────────────────────────────────────

    private async _onSendMessage(e: CustomEvent<{ text: string }>) {
        const text = e.detail.text;
        if (!text.trim() || this._isStreaming) return;

        // Create conversation if needed
        if (!this._activeConversationId) {
            try {
                const conv = await this._config!.conversation.createConversation();
                this._activeConversationId = conv.id;
                store.setActiveConversation(conv.id);
                store.emitEvent('conversation:new', { conversationId: conv.id });
            } catch (err) {
                store.emitEvent('error', { message: 'Failed to create conversation', error: err });
                return;
            }
        }

        // Add user message
        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        this._messages = [...this._messages, userMsg];

        // Persist
        try {
            await this._config!.conversation.saveMessage(this._activeConversationId, userMsg);
        } catch { /* best effort */ }

        store.emitEvent('user:message', { message: userMsg });

        // Send to AI
        await this._streamAIResponse();
    }

    private async _onSuggestedPrompt(e: CustomEvent<{ prompt: string }>) {
        const input = this.shadowRoot?.querySelector('aura-input') as any;
        if (input?.setInput) {
            input.setInput(e.detail.prompt);
        }
        // Auto-send the prompt
        await this._onSendMessage(new CustomEvent('send-message', { detail: { text: e.detail.prompt } }));
    }

    private async _streamAIResponse() {
        const provider = this._providers.get(this._activeProviderId);
        if (!provider) {
            store.emitEvent('error', { message: 'No active provider' });
            return;
        }

        this._isStreaming = true;
        this._streamingContent = '';
        store.emitEvent('ai:stream:start', {});

        try {
            const systemPrompt = await promptBuilder.build(
                this._config!.behavior,
                this._actionToolRegistry.buildSystemPromptBlock(),
            );
            const request = {
                systemPrompt,
                messages: this._messages,
                model: this._activeModel,
                parameters: {
                    temperature: this._config!.behavior.temperature,
                    maxTokens: this._config!.behavior.maxTokens,
                    topP: this._config!.behavior.topP,
                },
            };

            const stream = await provider.sendMessage(request);
            for await (const chunk of stream) {
                if (chunk.done) break;
                this._streamingContent += chunk.delta;
            }

            // Finalize AI message
            const aiMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: this._streamingContent,
                createdAt: new Date().toISOString(),
            };

            // Check if response is an action_proposal
            const proposal = this._parseActionProposal(this._streamingContent);
            if (proposal) {
                // Don't add the raw JSON as a visible message
                // Instead handle the proposal
                await this._handleActionProposal(proposal, aiMsg);
            } else {
                this._messages = [...this._messages, aiMsg];

                // Persist
                if (this._activeConversationId) {
                    try {
                        await this._config!.conversation.saveMessage(this._activeConversationId, aiMsg);
                    } catch { /* best effort */ }
                }

                store.emitEvent('ai:message', { message: aiMsg });
            }

            store.emitEvent('ai:stream:end', {});
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                store.emitEvent('error', { message: 'AI request failed', error: String(err) });
                // Add error message
                const errorMsg: Message = {
                    id: crypto.randomUUID(),
                    role: 'error',
                    content: `Sorry, something went wrong: ${(err as Error).message || 'Unknown error'}`,
                    createdAt: new Date().toISOString(),
                };
                this._messages = [...this._messages, errorMsg];
            } else {
                store.emitEvent('ai:stream:cancel', {});
            }
        } finally {
            this._isStreaming = false;
            this._streamingContent = '';
        }
    }

    private _onCancelStream() {
        const provider = this._providers.get(this._activeProviderId);
        provider?.cancelRequest();
        this._isStreaming = false;
        this._streamingContent = '';
        store.emitEvent('ai:stream:cancel', {});
    }

    private async _onNewConversation() {
        try {
            const conv = await this._config!.conversation.createConversation();
            this._activeConversationId = conv.id;
            this._messages = [];
            await this._loadConversations();
            store.emitEvent('conversation:new', { conversationId: conv.id });
        } catch (err) {
            store.emitEvent('error', { message: 'Failed to create conversation', error: err });
        }
    }

    private _onToggleHistory() {
        this._historyOpen = !this._historyOpen;
        if (this._historyOpen) this._loadConversations();
    }

    private _onToggleSettings() {
        this._settingsOpen = !this._settingsOpen;
    }

    private async _onSelectConversation(e: CustomEvent<{ id: string }>) {
        const id = e.detail.id;
        this._activeConversationId = id;
        this._historyOpen = false;
        try {
            this._messages = await this._config!.conversation.getMessages(id);
        } catch {
            this._messages = [];
        }
        store.emitEvent('conversation:switched', { conversationId: id });
    }

    private async _onDeleteConversation(e: CustomEvent<{ id: string }>) {
        if (!this._config?.conversation.deleteConversation) return;
        try {
            await this._config.conversation.deleteConversation(e.detail.id);
            if (this._activeConversationId === e.detail.id) {
                this._activeConversationId = null;
                this._messages = [];
            }
            await this._loadConversations();
        } catch (err) {
            store.emitEvent('error', { message: 'Failed to delete conversation', error: err });
        }
    }

    private async _onRenameConversation(e: CustomEvent<{ id: string; title: string }>) {
        if (!this._config?.conversation.updateConversation) return;
        try {
            await this._config.conversation.updateConversation(e.detail.id, { title: e.detail.title });
            await this._loadConversations();
        } catch (err) {
            store.emitEvent('error', { message: 'Failed to rename conversation', error: err });
        }
    }

    private async _onProviderChange(e: CustomEvent<{ providerId: string }>) {
        this._activeProviderId = e.detail.providerId;
        store.setActiveProvider(this._providers.get(e.detail.providerId)!, e.detail.providerId);
        this._updateCopilotState();
        await this._loadModels();
    }

    // ── Copilot login ────────────────────────────────────────────

    private _updateCopilotState() {
        // Unsub from previous copilot provider
        this._copilotUnsub?.();
        this._copilotUnsub = undefined;

        const provider = this._providers.get(this._activeProviderId);
        if (provider instanceof GitHubCopilotProvider) {
            this._copilotLoginState = { status: provider.loginStatus };
            this._copilotUnsub = provider.onStatusChange((status, info) => {
                this._copilotLoginState = { status, info };

                if (status === 'ACTIVATING_DEVICE' && info) {
                    // Try to auto-copy code to clipboard
                    try {
                        navigator.clipboard.writeText(info.userCode);
                    } catch { /* ignore */ }
                }

                if (status === 'LOGGED_IN') {
                    store.setAuthenticated(true);
                    this._loadModels();
                    store.emitEvent('debug', { message: 'GitHub Copilot authenticated' });
                }
            });
        } else {
            this._copilotLoginState = null;
        }
    }

    private async _onCopilotSignIn(e: CustomEvent<{ rememberToken: boolean }>) {
        const provider = this._providers.get(this._activeProviderId);
        if (!(provider instanceof GitHubCopilotProvider)) return;

        const rememberToken = e.detail.rememberToken ?? true;

        try {
            // Step 1: Request device code
            const info = await provider.authenticate(rememberToken);

            if (info) {
                // Step 2: Copy code to clipboard while page is still focused
                try {
                    await navigator.clipboard.writeText(info.userCode);
                    store.emitEvent('debug', { message: 'Device code copied to clipboard' });
                } catch (err) {
                    console.warn('[AuraChat] Failed to auto-copy code:', err);
                }

                // Step 3: Open the GitHub login page in a new tab
                window.open('https://github.com/login/device?skip_account_picker=true', '_blank');
            }
        } catch (err) {
            store.emitEvent('error', { message: 'GitHub Copilot login failed', error: err });
        }
    }

    private _onModelChange(e: CustomEvent<{ model: string }>) {
        this._activeModel = e.detail.model;
        store.setActiveModel(e.detail.model);
    }

    private _onResizeInput(e: CustomEvent<{ height: number }>) {
        this._inputHeight = e.detail.height;
        store.setInputHeight(e.detail.height);
    }

    private _onApplySettings(e: CustomEvent<{ draft: Record<string, unknown> }>) {
        const draft = e.detail.draft;
        if (!this._config) return;

        // Apply draft patches to config
        const newConfig = { ...this._config };
        for (const [path, value] of Object.entries(draft)) {
            const parts = path.split('.');
            let obj: Record<string, unknown> = newConfig as unknown as Record<string, unknown>;
            for (let i = 0; i < parts.length - 1; i++) {
                const key = parts[i];
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    obj[key] = { ...(obj[key] as Record<string, unknown>) };
                    obj = obj[key] as Record<string, unknown>;
                }
            }
            obj[parts[parts.length - 1]] = value;
        }

        this.config = newConfig;
        store.emitEvent('debug', { message: 'Settings applied', draft });
    }

    private _onToggleSkill(e: CustomEvent<{ name: string; enabled: boolean }>) {
        skillRegistry.setEnabled(e.detail.name, e.detail.enabled);
        store.emitEvent('debug', { message: `Skill ${e.detail.name} ${e.detail.enabled ? 'enabled' : 'disabled'}` });
    }

    private _onToggleTool(e: CustomEvent<{ name: string; enabled: boolean }>) {
        toolRegistry.setEnabled(e.detail.name, e.detail.enabled);
        store.emitEvent('debug', { message: `Tool ${e.detail.name} ${e.detail.enabled ? 'enabled' : 'disabled'}` });
    }

    // ── Action Tool System ────────────────────────────────────────

    /**
     * Register action tools from the behavior config.
     * Unregisters all previously registered action tools first.
     */
    private _registerActionTools(tools?: Tool[]): void {
        this._actionToolRegistry.clear();
        if (!tools) return;

        for (const tool of tools) {
            try {
                this._actionToolRegistry.register(tool);
            } catch (err) {
                store.emitEvent('error', {
                    message: `Failed to register action tool: ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        }
    }

    /**
     * Parse AI response for action_proposal JSON.
     * Returns the parsed proposal or null if not a proposal.
     */
    private _parseActionProposal(content: string): {
        name: string;
        arguments: Record<string, unknown>;
        summary: string;
    } | null {
        const trimmed = content.trim();

        // Try to parse as JSON directly
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.type === 'action_proposal' && typeof parsed.name === 'string') {
                return {
                    name: parsed.name,
                    arguments: parsed.arguments || {},
                    summary: parsed.summary || '',
                };
            }
        } catch {
            // Not valid JSON — check for JSON inside markdown code block
            const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (codeBlockMatch) {
                try {
                    const parsed = JSON.parse(codeBlockMatch[1].trim());
                    if (parsed && parsed.type === 'action_proposal' && typeof parsed.name === 'string') {
                        return {
                            name: parsed.name,
                            arguments: parsed.arguments || {},
                            summary: parsed.summary || '',
                        };
                    }
                } catch { /* not valid JSON in code block */ }
            }
        }

        return null;
    }

    /**
     * Handle a parsed action proposal from the AI.
     */
    private async _handleActionProposal(
        proposal: { name: string; arguments: Record<string, unknown>; summary: string },
        _aiMsg: Message,
    ): Promise<void> {
        const tool = this._actionToolRegistry.get(proposal.name);
        if (!tool) {
            // Tool not found — show warning
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠ AI attempted to invoke unknown action tool: "${proposal.name}"`,
                createdAt: new Date().toISOString(),
            };
            this._messages = [...this._messages, errorMsg];
            return;
        }

        // Validate args
        const validation = this._actionToolRegistry.validateArgs(proposal.name, proposal.arguments);
        if (!validation.valid) {
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠ AI attempted an action but produced invalid output: ${validation.errors.join(', ')}`,
                createdAt: new Date().toISOString(),
            };
            this._messages = [...this._messages, errorMsg];
            return;
        }

        // Check if there's already a pending action
        if (this._pendingActionQueue.hasPending()) {
            const waitMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Another action is already pending. Please wait for the user to respond.',
                createdAt: new Date().toISOString(),
            };
            this._messages = [...this._messages, waitMsg];
            return;
        }

        store.emitEvent('action:proposed', {
            toolName: proposal.name,
            arguments: proposal.arguments,
            summary: proposal.summary,
        });

        // Set pending proposal to trigger ConfirmationBubble rendering
        this._pendingProposal = {
            tool,
            args: proposal.arguments,
            summary: proposal.summary,
        };

        // Dispatch through the tool dispatcher
        try {
            const result = await this._dispatch(tool, proposal.arguments);

            // Clear pending proposal
            this._pendingProposal = null;

            // Inject result back into conversation
            const resultText = result.content
                .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
                .map(c => c.text)
                .join('\n');

            const resultMsg: Message = {
                id: crypto.randomUUID(),
                role: 'system',
                content: result.isError
                    ? `Tool error: ${resultText}`
                    : `Tool result: ${resultText}`,
                createdAt: new Date().toISOString(),
                metadata: { type: 'tool_result', toolName: proposal.name, result },
            };
            this._messages = [...this._messages, resultMsg];

            store.emitEvent('action:succeeded', {
                toolName: proposal.name,
                arguments: proposal.arguments,
                result,
            });

            // Continue the conversation so AI can respond to the result
            await this._streamAIResponse();
        } catch (err) {
            // Clear pending proposal
            this._pendingProposal = null;

            if (err instanceof ActionCancelledError) {
                // Inject cancellation notice
                const cancelMsg: Message = {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: 'The user cancelled the action.',
                    createdAt: new Date().toISOString(),
                    metadata: { type: 'action_cancelled', toolName: proposal.name },
                };
                this._messages = [...this._messages, cancelMsg];

                store.emitEvent('action:cancelled', {
                    toolName: proposal.name,
                    arguments: proposal.arguments,
                });

                // Let AI acknowledge the cancellation
                await this._streamAIResponse();
            } else {
                store.emitEvent('action:failed', {
                    toolName: proposal.name,
                    arguments: proposal.arguments,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }

    /**
     * Handle confirmation bubble approval event.
     */
    private _onActionApproved() {
        this._pendingActionQueue.approve();
    }

    /**
     * Handle confirmation bubble cancellation event.
     */
    private _onActionCancelled() {
        this._pendingActionQueue.cancel();
    }

    /**
     * Public method for host apps to trigger tools programmatically.
     */
    async executeAction(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
        const tool = this._actionToolRegistry.get(toolName);
        if (!tool) {
            return {
                content: [{ type: 'text', text: `Tool "${toolName}" not found.` }],
                isError: true,
            };
        }
        return this._dispatch(tool, args);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'aura-chat': AuraChat;
    }
}
