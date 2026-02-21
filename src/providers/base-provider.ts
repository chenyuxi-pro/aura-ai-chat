/* ──────────────────────────────────────────────────────────────────
 *  Base AI Provider — Abstract class with shared auth/token helpers
 * ────────────────────────────────────────────────────────────────── */

import type {
    AIProvider,
    AIModel,
    AIRequest,
    AIStreamChunk,
    BuiltInProviderConfig,
} from '../types/index.js';

const LS_PREFIX = 'aura-widget:';

export abstract class BaseProvider implements AIProvider {
    abstract readonly id: string;
    abstract readonly name: string;
    readonly icon?: string;

    protected _apiKey: string | null = null;
    protected _baseUrl: string;
    protected _defaultModel: string;
    protected _defaultParameters: Record<string, unknown>;
    protected _abortController: AbortController | null = null;

    constructor(config: BuiltInProviderConfig, defaultBaseUrl: string) {
        this._apiKey = config.apiKey ?? this._loadToken() ?? null;
        this._baseUrl = config.baseUrl ?? defaultBaseUrl;
        this._defaultModel = config.defaultModel ?? '';
        this._defaultParameters = config.defaultParameters ?? {};
    }

    // ── Auth lifecycle ────────────────────────────────────────

    async isAuthenticated(): Promise<boolean> {
        return this._apiKey !== null && this._apiKey.length > 0;
    }

    async authenticate(rememberToken: boolean): Promise<void> {
        // In a real implementation, this would open an OAuth popup.
        // For now, we check if an API key was injected or stored.
        const storedToken = this._loadToken();
        if (storedToken) {
            this._apiKey = storedToken;
            return;
        }
        // Prompt-based auth is handled by the host app providing apiKey
        if (rememberToken && this._apiKey) {
            this._saveToken(this._apiKey);
        }
    }

    onAuthComplete(): void {
        // Called by widget after detecting popup close
        const token = this._loadToken();
        if (token) {
            this._apiKey = token;
        }
    }

    logout(): void {
        this._apiKey = null;
        this._removeToken();
    }

    // ── Token persistence ─────────────────────────────────────

    private _tokenKey(): string {
        return `${LS_PREFIX}token:${this.id}`;
    }

    private _loadToken(): string | null {
        try {
            return localStorage.getItem(this._tokenKey());
        } catch {
            return null;
        }
    }

    private _saveToken(token: string): void {
        try {
            localStorage.setItem(this._tokenKey(), token);
        } catch { /* ignore */ }
    }

    private _removeToken(): void {
        try {
            localStorage.removeItem(this._tokenKey());
        } catch { /* ignore */ }
    }

    // ── Public API key setter (for demo / settings) ───────────

    setApiKey(key: string, remember = false): void {
        this._apiKey = key;
        if (remember) this._saveToken(key);
    }

    // ── Inference ─────────────────────────────────────────────

    abstract getAvailableModels(): Promise<AIModel[]>;
    abstract sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>>;

    cancelRequest(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    protected _getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
        };
    }
}
