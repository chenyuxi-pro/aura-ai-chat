/* ──────────────────────────────────────────────────────────────────
 *  Ollama Provider — Local/self-hosted LLM
 * ────────────────────────────────────────────────────────────────── */

import type { AIModel, AIRequest, AIStreamChunk, BuiltInProviderConfig } from '../types/index.js';
import { BaseProvider } from './base-provider.js';

export class OllamaProvider extends BaseProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama';
    readonly icon = '🦙';

    constructor(config: BuiltInProviderConfig) {
        super(config, 'http://localhost:11434');
        // Ollama is typically unauthenticated
        if (!this._apiKey) this._apiKey = 'local';
    }

    async isAuthenticated(): Promise<boolean> {
        return true; // Ollama doesn't require auth
    }

    async authenticate(_rememberToken: boolean): Promise<void> {
        // No-op for Ollama
    }

    async getAvailableModels(): Promise<AIModel[]> {
        try {
            const res = await fetch(`${this._baseUrl}/api/tags`);
            if (!res.ok) return this._defaultModels();
            const data = await res.json();
            return (data.models ?? []).map((m: { name: string }) => ({
                id: m.name,
                name: m.name,
            }));
        } catch {
            return this._defaultModels();
        }
    }

    private _defaultModels(): AIModel[] {
        return [
            { id: 'llama3.2', name: 'Llama 3.2' },
            { id: 'mistral', name: 'Mistral' },
            { id: 'codellama', name: 'Code Llama' },
        ];
    }

    async sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>> {
        this._abortController = new AbortController();

        const body = {
            model: request.model || this._defaultModel || 'llama3.2',
            messages: [
                { role: 'system', content: request.systemPrompt },
                ...request.messages.map(m => ({ role: m.role, content: m.content })),
            ],
            stream: true,
        };

        const response = await fetch(`${this._baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: this._abortController.signal,
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${err}`);
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
                        if (!trimmed) continue;
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (parsed.done) {
                                yield { delta: '', done: true };
                                return;
                            }
                            const delta = parsed.message?.content ?? '';
                            if (delta) yield { delta, done: false };
                        } catch {
                            // skip malformed
                        }
                    }
                }
            },
        };
    }
}
