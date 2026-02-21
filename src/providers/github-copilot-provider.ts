/* ──────────────────────────────────────────────────────────────────
 *  GitHub Copilot Provider — OAuth Device Flow Login
 *  Adapted from notebook-intelligence/notebook-intelligence
 *  https://github.com/notebook-intelligence/notebook-intelligence
 * ────────────────────────────────────────────────────────────────── */

import type {
    AIProvider,
    AIModel,
    AIRequest,
    AIStreamChunk,
    BuiltInProviderConfig,
} from '../types/index.js';

// ── Constants ──────────────────────────────────────────────────────

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const GH_WEB_BASE_URL = '/github'; // Proxied via vite.config.ts to https://github.com
const GH_REST_API_BASE_URL = '/github-api'; // Proxied via vite.config.ts to https://api.github.com

const EDITOR_VERSION = 'vscode/1.93.1';
const EDITOR_PLUGIN_VERSION = 'copilot/1.155.0';
const USER_AGENT = 'GithubCopilot/1.155.0';

const LS_PREFIX = 'aura-ai-chat:';
const TOKEN_REFRESH_BUFFER_MS = 10_000; // refresh 10s before expiry

// ── Types ──────────────────────────────────────────────────────────

export type CopilotLoginStatus =
    | 'NOT_LOGGED_IN'
    | 'ACTIVATING_DEVICE'
    | 'LOGGING_IN'
    | 'LOGGED_IN';

export interface DeviceFlowInfo {
    verificationUri: string;
    userCode: string;
}

type StatusChangeCallback = (status: CopilotLoginStatus, info?: DeviceFlowInfo) => void;

// ── Provider ───────────────────────────────────────────────────────

export class GitHubCopilotProvider implements AIProvider {
    readonly id = 'github-copilot';
    readonly name = 'GitHub Copilot';
    readonly icon = '🐙';

    private _accessToken: string | null = null;
    private _copilotToken: string | null = null;
    private _tokenExpiresAt = 0;
    private _apiEndpoint = '/github-copilot-api'; // Proxied via vite.config.ts to https://api.githubcopilot.com
    private _deviceCode: string | null = null;
    private _status: CopilotLoginStatus = 'NOT_LOGGED_IN';
    private _pollTimer: ReturnType<typeof setTimeout> | null = null;
    private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private _abortController: AbortController | null = null;
    private _defaultModel: string;
    private _statusCallbacks: StatusChangeCallback[] = [];
    private _machineId: string;
    private _rememberToken = true;

    constructor(config?: BuiltInProviderConfig) {
        this._defaultModel = config?.defaultModel ?? 'gpt-4o';
        this._machineId = this._getOrCreateMachineId();
        this._rememberToken = config?.rememberToken ?? true;

        // Try to restore saved access token
        const savedToken = this._loadAccessToken();
        if (savedToken) {
            this._accessToken = savedToken;
            // Attempt silent login with stored token
            this._fetchCopilotToken().catch(() => {
                // Token expired or invalid — clear it
                this._accessToken = null;
                this._removeAccessToken();
            });
        }
    }

    // ── Status change subscription ────────────────────────────────

    onStatusChange(callback: StatusChangeCallback): () => void {
        this._statusCallbacks.push(callback);
        return () => {
            this._statusCallbacks = this._statusCallbacks.filter(cb => cb !== callback);
        };
    }

    get loginStatus(): CopilotLoginStatus {
        return this._status;
    }

    private _setStatus(status: CopilotLoginStatus, info?: DeviceFlowInfo) {
        this._status = status;
        for (const cb of this._statusCallbacks) {
            try { cb(status, info); } catch { /* ignore */ }
        }
    }

    // ── Auth lifecycle ────────────────────────────────────────────

    async isAuthenticated(): Promise<boolean> {
        return this._status === 'LOGGED_IN' && this._copilotToken !== null;
    }

    async authenticate(rememberToken = true): Promise<DeviceFlowInfo | undefined> {
        if (this._status === 'LOGGED_IN') return undefined;
        this._rememberToken = rememberToken;

        // Step 1: Request device code
        this._setStatus('ACTIVATING_DEVICE');

        const deviceResp = await fetch(`${GH_WEB_BASE_URL}/login/device/code`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'editor-version': EDITOR_VERSION,
                'editor-plugin-version': EDITOR_PLUGIN_VERSION,
                'user-agent': USER_AGENT,
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                scope: 'read:user',
            }),
        });

        if (!deviceResp.ok) {
            this._setStatus('NOT_LOGGED_IN');
            throw new Error(`Device code request failed: ${deviceResp.status}`);
        }

        const deviceData = await deviceResp.json();
        this._deviceCode = deviceData.device_code;

        const info: DeviceFlowInfo = {
            verificationUri: deviceData.verification_uri,
            userCode: deviceData.user_code,
        };

        this._setStatus('ACTIVATING_DEVICE', info);

        // Step 2: Poll for access token (async)
        this._pollForAccessToken(deviceData.interval).catch(err => {
            console.error('[GitHubCopilotProvider] Initial poll failed:', err);
        });

        return info;
    }

    onAuthComplete(): void {
        // Called externally if host detects auth completed through other means
        const token = this._loadAccessToken();
        if (token) {
            this._accessToken = token;
            this._fetchCopilotToken().catch(() => { /* ignore */ });
        }
    }

    logout(): void {
        this._stopPolling();
        this._stopRefreshTimer();
        this._accessToken = null;
        this._copilotToken = null;
        this._tokenExpiresAt = 0;
        this._deviceCode = null;
        this._removeAccessToken();
        this._setStatus('NOT_LOGGED_IN');
    }

    // ── Device flow polling ───────────────────────────────────────

    private _pollForAccessToken(initialInterval?: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._stopPolling();
            let currentInterval = (initialInterval || 5) * 1000;

            const poll = async () => {
                if (this._status !== 'ACTIVATING_DEVICE' || !this._deviceCode) {
                    return;
                }

                try {
                    const resp = await fetch(`${GH_WEB_BASE_URL}/login/oauth/access_token`, {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json',
                            'content-type': 'application/json',
                            'editor-version': EDITOR_VERSION,
                            'editor-plugin-version': EDITOR_PLUGIN_VERSION,
                            'user-agent': USER_AGENT,
                        },
                        body: JSON.stringify({
                            client_id: CLIENT_ID,
                            device_code: this._deviceCode,
                            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        }),
                    });

                    if (this._status !== 'ACTIVATING_DEVICE') return;

                    if (!resp.ok) {
                        const status = resp.status;
                        const text = await resp.text().catch(() => 'no text');
                        console.warn(`[GitHubCopilotProvider] Poll failed with status ${status}: ${text}`);
                        this._pollTimer = setTimeout(poll, currentInterval);
                        return;
                    }

                    const contentType = resp.headers.get('content-type') || '';
                    if (!contentType.includes('application/json')) {
                        const text = await resp.text().catch(() => 'no text');
                        console.warn(`[GitHubCopilotProvider] Poll returned non-JSON (${contentType}): ${text.substring(0, 100)}...`);
                        this._pollTimer = setTimeout(poll, currentInterval);
                        return;
                    }

                    const data = await resp.json();
                    console.log('[GitHubCopilotProvider] Poll result:', data);

                    if (data.access_token) {
                        this._stopPolling();
                        this._accessToken = data.access_token;
                        if (this._rememberToken) {
                            this._saveAccessToken(data.access_token);
                        }
                        this._setStatus('LOGGING_IN');

                        try {
                            await this._fetchCopilotToken();
                            resolve();
                        } catch (err) {
                            this._setStatus('NOT_LOGGED_IN');
                            reject(err);
                        }
                        return;
                    }

                    if (data.error === 'authorization_pending') {
                        if (data.interval) {
                            currentInterval = data.interval * 1000;
                        }
                        this._pollTimer = setTimeout(poll, currentInterval);
                    } else if (data.error === 'slow_down') {
                        if (data.interval) {
                            currentInterval = data.interval * 1000;
                        } else {
                            currentInterval += 5000;
                        }
                        this._pollTimer = setTimeout(poll, currentInterval);
                    } else {
                        this._stopPolling();
                        this._setStatus('NOT_LOGGED_IN');
                        reject(new Error(`OAuth error: ${data.error} — ${data.error_description || ''}`));
                    }
                } catch (err) {
                    if (this._status === 'ACTIVATING_DEVICE') {
                        console.warn('[GitHubCopilotProvider] Poll network error:', err);
                        this._pollTimer = setTimeout(poll, currentInterval);
                    }
                }
            };

            this._pollTimer = setTimeout(poll, currentInterval);
        });
    }

    private _stopPolling() {
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
        }
    }

    // ── Copilot token exchange ─────────────────────────────────────

    private async _fetchCopilotToken(): Promise<void> {
        if (!this._accessToken) {
            this._setStatus('NOT_LOGGED_IN');
            throw new Error('No access token');
        }

        this._setStatus('LOGGING_IN');

        const resp = await fetch(`${GH_REST_API_BASE_URL}/copilot_internal/v2/token`, {
            headers: {
                'authorization': `Bearer ${this._accessToken}`,
                'editor-version': EDITOR_VERSION,
                'editor-plugin-version': EDITOR_PLUGIN_VERSION,
                'user-agent': USER_AGENT,
                'accept': 'application/json',
            },
        });

        if (resp.status === 401) {
            console.warn('[GitHubCopilotProvider] Access token 401 Unauthorized');
            // Access token invalid or expired
            this._accessToken = null;
            this._removeAccessToken();
            this._setStatus('NOT_LOGGED_IN');
            throw new Error('Access token expired — please re-login');
        }

        if (!resp.ok) {
            const status = resp.status;
            const text = await resp.text().catch(() => 'no text');
            console.error(`[GitHubCopilotProvider] Copilot token exchange failed (${status}): ${text}`);
            this._setStatus('NOT_LOGGED_IN');
            throw new Error(`Copilot token request failed: ${resp.status}`);
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await resp.text().catch(() => 'no text');
            console.error(`[GitHubCopilotProvider] Copilot token returned non-JSON (${contentType}): ${text.substring(0, 150)}`);
            this._setStatus('NOT_LOGGED_IN');
            throw new Error('Invalid response from token exchange');
        }

        const data = await resp.json();
        console.log('[GitHubCopilotProvider] Copilot token successfully received');
        this._copilotToken = data.token;
        this._tokenExpiresAt = data.expires_at
            ? data.expires_at * 1000 // seconds → ms
            : Date.now() + 1500_000;

        // Update endpoints if provided
        const endpoints = data.endpoints ?? {};
        if (endpoints.api) {
            // If the API returns the standard production endpoint, map it to our proxy
            if (endpoints.api === 'https://api.githubcopilot.com') {
                this._apiEndpoint = '/github-copilot-api';
            } else if (endpoints.api === 'https://api.individual.githubcopilot.com') {
                this._apiEndpoint = '/github-copilot-individual-api';
            } else {
                this._apiEndpoint = endpoints.api;
            }
        }

        this._setStatus('LOGGED_IN');
        this._scheduleTokenRefresh(data.refresh_in ?? 1500);
    }

    private _scheduleTokenRefresh(refreshInSeconds: number) {
        this._stopRefreshTimer();
        const delay = Math.max((refreshInSeconds * 1000) - TOKEN_REFRESH_BUFFER_MS, 30_000);
        this._refreshTimer = setTimeout(() => {
            this._fetchCopilotToken().catch((err) => {
                console.error('[GitHubCopilotProvider] Token refresh failed:', err);
            });
        }, delay);
    }

    private _stopRefreshTimer() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }

    // ── Copilot request headers ───────────────────────────────────

    private _getCopilotHeaders(): Record<string, string> {
        return {
            'authorization': `Bearer ${this._copilotToken}`,
            'content-type': 'application/json',
            'editor-version': EDITOR_VERSION,
            'editor-plugin-version': EDITOR_PLUGIN_VERSION,
            'user-agent': USER_AGENT,
            'openai-intent': 'conversation-panel',
            'openai-organization': 'github-copilot',
            'copilot-integration-id': 'vscode-chat',
            'x-request-id': crypto.randomUUID(),
            'vscode-sessionid': crypto.randomUUID(),
            'vscode-machineid': this._machineId,
        };
    }

    // ── Models ────────────────────────────────────────────────────

    async getAvailableModels(): Promise<AIModel[]> {
        if (!this._copilotToken) return [];

        try {
            const resp = await fetch(`${this._apiEndpoint}/models`, {
                headers: this._getCopilotHeaders(),
            });

            if (!resp.ok) return this._getDefaultModels();

            const data = await resp.json();
            console.log('[GitHubCopilotProvider] Raw models response:', data);
            if (data && Array.isArray(data.data)) {
                return data.data.map((m: any) => ({
                    id: m.id,
                    name: m.name || m.id,
                }));
            }
        } catch (err) {
            console.warn('[GitHubCopilotProvider] Failed to fetch models:', err);
            if (err instanceof Error) {
                console.error('[GitHubCopilotProvider] Detailed error:', err.message, err.stack);
            }
        }

        return this._getDefaultModels();
    }

    private _getDefaultModels(): AIModel[] {
        return [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        ];
    }

    // ── Inference (streaming) ─────────────────────────────────────

    async sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>> {
        if (!this._copilotToken) {
            throw new Error('Not authenticated — please sign in with GitHub Copilot first');
        }

        // Check if token is near expiry, refresh if needed
        if (Date.now() > this._tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
            await this._fetchCopilotToken();
        }

        this._abortController = new AbortController();

        const body = {
            model: request.model || this._defaultModel || 'gpt-4o',
            messages: [
                { role: 'system', content: request.systemPrompt },
                ...request.messages.map(m => ({ role: m.role, content: m.content })),
            ],
            stream: true,
            temperature: (request.parameters?.temperature as number) ?? 0,
            top_p: (request.parameters?.topP as number) ?? 1,
            n: 1,
        };

        console.log('[GitHubCopilotProvider] Sending request:', {
            endpoint: this._apiEndpoint,
            model: body.model
        });

        let response = await fetch(`${this._apiEndpoint}/chat/completions`, {
            method: 'POST',
            headers: this._getCopilotHeaders(),
            body: JSON.stringify(body),
            signal: this._abortController.signal,
        });

        // If the individual endpoint fails with model_not_supported, try the main endpoint
        if (!response.ok && response.status === 400 && this._apiEndpoint.includes('individual')) {
            const errorData = await response.clone().json().catch(() => ({}));
            if (errorData.error?.code === 'model_not_supported') {
                console.warn('[GitHubCopilotProvider] Model not supported on individual endpoint, falling back to main endpoint');
                response = await fetch(`/github-copilot-api/chat/completions`, {
                    method: 'POST',
                    headers: this._getCopilotHeaders(),
                    body: JSON.stringify(body),
                    signal: this._abortController.signal,
                });
            }
        }

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Copilot API error: ${response.status} ${err}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        return {
            async *[Symbol.asyncIterator]() {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        yield { delta: '', done: true };
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;
                        const data = trimmed.slice(6);
                        if (data === '[DONE]') {
                            yield { delta: '', done: true };
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content ?? '';
                            if (delta) {
                                yield { delta, done: false };
                            }
                        } catch {
                            // skip malformed chunks
                        }
                    }
                }
            },
        };
    }

    cancelRequest(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    // ── Token persistence (localStorage) ──────────────────────────

    private _loadAccessToken(): string | null {
        try {
            return localStorage.getItem(`${LS_PREFIX}gh-copilot:access-token`);
        } catch {
            return null;
        }
    }

    private _saveAccessToken(token: string): void {
        try {
            localStorage.setItem(`${LS_PREFIX}gh-copilot:access-token`, token);
        } catch { /* ignore */ }
    }

    private _removeAccessToken(): void {
        try {
            localStorage.removeItem(`${LS_PREFIX}gh-copilot:access-token`);
        } catch { /* ignore */ }
    }

    private _getOrCreateMachineId(): string {
        const key = `${LS_PREFIX}gh-copilot:machine-id`;
        try {
            let id = localStorage.getItem(key);
            if (!id) {
                id = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 1);
                localStorage.setItem(key, id);
            }
            return id;
        } catch {
            return crypto.randomUUID().replace(/-/g, '');
        }
    }
}
