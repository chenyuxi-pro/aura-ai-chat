/* ──────────────────────────────────────────────────────────────────
 *  Aura Store — Reactive state management + localStorage persistence
 * ────────────────────────────────────────────────────────────────── */

import type {
    AuraConfig,
    AuraEvent,
    AuraEventType,
    Message,
    ConversationMeta,
    AIProvider,
    AIProviderConfig,
    BuiltInProviderConfig,
} from '../types/index.js';

const LS_PREFIX = 'aura-widget:';

function lsGet(key: string): string | null {
    try {
        return localStorage.getItem(`${LS_PREFIX}${key}`);
    } catch {
        return null;
    }
}

function lsSet(key: string, value: string): void {
    try {
        localStorage.setItem(`${LS_PREFIX}${key}`, value);
    } catch { /* quota exceeded — silently ignore */ }
}

type Listener = () => void;

export class AuraStore {
    // ── Resolved state ──────────────────────────────────────────
    private _config!: AuraConfig;
    private _activeProvider: AIProvider | null = null;
    private _activeProviderId: string = '';
    private _activeModel: string = '';
    private _messages: Message[] = [];
    private _conversations: ConversationMeta[] = [];
    private _activeConversationId: string | null = null;
    private _isStreaming = false;
    private _streamingContent = '';
    private _isAuthenticated = false;
    private _settingsOpen = false;
    private _historyOpen = false;
    private _theme: 'light' | 'dark' | 'auto' = 'auto';
    private _inputHeight: number = 120;

    private _listeners: Set<Listener> = new Set();

    // ── Getters ─────────────────────────────────────────────────

    get config(): AuraConfig { return this._config; }
    get activeProvider(): AIProvider | null { return this._activeProvider; }
    get activeProviderId(): string { return this._activeProviderId; }
    get activeModel(): string { return this._activeModel; }
    get messages(): Message[] { return this._messages; }
    get conversations(): ConversationMeta[] { return this._conversations; }
    get activeConversationId(): string | null { return this._activeConversationId; }
    get isStreaming(): boolean { return this._isStreaming; }
    get streamingContent(): string { return this._streamingContent; }
    get isAuthenticated(): boolean { return this._isAuthenticated; }
    get settingsOpen(): boolean { return this._settingsOpen; }
    get historyOpen(): boolean { return this._historyOpen; }
    get theme(): 'light' | 'dark' | 'auto' { return this._theme; }
    get inputHeight(): number { return this._inputHeight; }

    // ── Initialization ──────────────────────────────────────────

    init(config: AuraConfig): void {
        this._config = config;

        // Restore persisted values
        const savedTheme = lsGet('theme') as 'light' | 'dark' | 'auto' | null;
        this._theme = savedTheme ?? config.ui?.theme ?? 'auto';

        const savedHeight = lsGet('input-height');
        if (savedHeight) this._inputHeight = parseInt(savedHeight, 10);

        const savedProvider = lsGet('provider');
        const savedModel = lsGet('model');

        // Resolve active provider
        if (config.providers.length > 0) {
            const providerConfig = savedProvider
                ? config.providers.find(p => this._providerIdFromConfig(p) === savedProvider) ?? config.providers[0]
                : config.providers[0];

            this._activeProviderId = this._providerIdFromConfig(providerConfig);
            this._activeModel = savedModel ?? this._defaultModelFromConfig(providerConfig);
        }

        this._notify();
    }

    private _providerIdFromConfig(config: AIProviderConfig): string {
        return config.type === 'custom' ? config.instance.id : config.providerId;
    }

    private _defaultModelFromConfig(config: AIProviderConfig): string {
        if (config.type === 'built-in') return (config as BuiltInProviderConfig).defaultModel ?? '';
        return '';
    }

    // ── Mutations ───────────────────────────────────────────────

    setActiveProvider(provider: AIProvider, providerId: string): void {
        this._activeProvider = provider;
        this._activeProviderId = providerId;
        lsSet('provider', providerId);
        this._notify();
    }

    setActiveModel(model: string): void {
        this._activeModel = model;
        lsSet('model', model);
        this._notify();
    }

    setMessages(messages: Message[]): void {
        this._messages = [...messages];
        this._notify();
    }

    addMessage(message: Message): void {
        this._messages = [...this._messages, message];
        this._notify();
    }

    setStreaming(streaming: boolean, content = ''): void {
        this._isStreaming = streaming;
        this._streamingContent = content;
        this._notify();
    }

    appendStreamContent(delta: string): void {
        this._streamingContent += delta;
        this._notify();
    }

    setAuthenticated(auth: boolean): void {
        this._isAuthenticated = auth;
        this._notify();
    }

    setSettingsOpen(open: boolean): void {
        this._settingsOpen = open;
        this._notify();
    }

    setHistoryOpen(open: boolean): void {
        this._historyOpen = open;
        this._notify();
    }

    setTheme(theme: 'light' | 'dark' | 'auto'): void {
        this._theme = theme;
        lsSet('theme', theme);
        this._notify();
    }

    setInputHeight(height: number): void {
        this._inputHeight = height;
        lsSet('input-height', String(height));
        this._notify();
    }

    setConversations(list: ConversationMeta[]): void {
        this._conversations = [...list];
        this._notify();
    }

    setActiveConversation(id: string | null): void {
        this._activeConversationId = id;
        this._notify();
    }

    updateConfig(patch: Partial<AuraConfig>): void {
        this._config = { ...this._config, ...patch };
        this._notify();
    }

    // ── Event Bus ───────────────────────────────────────────────

    emitEvent(type: AuraEventType, payload?: unknown): void {
        const event: AuraEvent = {
            type,
            timestamp: new Date().toISOString(),
            payload,
        };
        this._config?.onEvent?.(event);
    }

    // ── Subscriptions ───────────────────────────────────────────

    subscribe(listener: Listener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        for (const listener of this._listeners) {
            listener();
        }
    }
}

// Singleton instance
export const store = new AuraStore();
