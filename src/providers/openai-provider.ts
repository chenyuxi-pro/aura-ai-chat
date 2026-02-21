/* ──────────────────────────────────────────────────────────────────
 *  OpenAI Provider
 * ────────────────────────────────────────────────────────────────── */

import type { AIModel, AIRequest, AIStreamChunk, BuiltInProviderConfig } from '../types/index.js';
import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI';
    readonly icon = '🤖';

    constructor(config: BuiltInProviderConfig) {
        super(config, 'https://api.openai.com/v1');
    }

    protected _getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._apiKey}`,
        };
    }

    async getAvailableModels(): Promise<AIModel[]> {
        try {
            const res = await fetch(`${this._baseUrl}/models`, {
                headers: this._getHeaders(),
            });
            if (!res.ok) return this._defaultModels();
            const data = await res.json();
            return (data.data ?? [])
                .filter((m: { id: string }) => m.id.startsWith('gpt'))
                .map((m: { id: string }) => ({ id: m.id, name: m.id }))
                .sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name));
        } catch {
            return this._defaultModels();
        }
    }

    private _defaultModels(): AIModel[] {
        return [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ];
    }

    async sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>> {
        this._abortController = new AbortController();

        const body = {
            model: request.model || this._defaultModel || 'gpt-4o',
            messages: [
                { role: 'system', content: request.systemPrompt },
                ...request.messages.map(m => ({ role: m.role, content: m.content })),
            ],
            stream: true,
            ...this._defaultParameters,
            ...request.parameters,
        };

        const response = await fetch(`${this._baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(body),
            signal: this._abortController.signal,
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${err}`);
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
}
