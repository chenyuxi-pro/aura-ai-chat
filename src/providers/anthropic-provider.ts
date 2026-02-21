/* ──────────────────────────────────────────────────────────────────
 *  Anthropic Provider
 * ────────────────────────────────────────────────────────────────── */

import type { AIModel, AIRequest, AIStreamChunk, BuiltInProviderConfig } from '../types/index.js';
import { BaseProvider } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic';
    readonly icon = '🧠';

    constructor(config: BuiltInProviderConfig) {
        super(config, 'https://api.anthropic.com/v1');
    }

    protected _getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this._apiKey ?? '',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        };
    }

    async getAvailableModels(): Promise<AIModel[]> {
        return [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        ];
    }

    async sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>> {
        this._abortController = new AbortController();

        const body = {
            model: request.model || this._defaultModel || 'claude-sonnet-4-20250514',
            system: request.systemPrompt,
            messages: request.messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
            stream: true,
            max_tokens: (request.parameters.maxTokens as number) ?? 4096,
            ...this._defaultParameters,
        };

        const response = await fetch(`${this._baseUrl}/messages`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(body),
            signal: this._abortController.signal,
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic API error: ${response.status} ${err}`);
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
                        if (!trimmed.startsWith('data: ')) continue;
                        const data = trimmed.slice(6);
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content_block_delta') {
                                const delta = parsed.delta?.text ?? '';
                                if (delta) yield { delta, done: false };
                            } else if (parsed.type === 'message_stop') {
                                yield { delta: '', done: true };
                                return;
                            }
                        } catch {
                            // skip malformed
                        }
                    }
                }
            },
        };
    }
}
