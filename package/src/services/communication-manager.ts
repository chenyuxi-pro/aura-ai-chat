/* ──────────────────────────────────────────────────────────────────
 *  CommunicationManager — Owns the AI conversation workflow
 *
 *  Extracted from aura-chat.ts to separate UI orchestration from
 *  the multi-step AI interaction pipeline defined in
 *  docs/interaction-flow.md.
 *
 *  Responsibilities:
 *    - Multi-step interactive turn loop
 *    - AI response parsing (JSON command extraction)
 *    - Command handling (LOAD_SKILL_DETAIL, LOAD_TOOLS_SUMMARY, etc.)
 *    - Risky operation confirmation flow (explanation + bubble)
 *    - Communication Protocol prompt block
 * ────────────────────────────────────────────────────────────────── */

import type {
    Message,
    AIProvider,
    AIBehaviorConfig,
    CallToolResult,
    Tool,
} from '../types/index.js';
import { MessageRole, ActionCancelledError } from '../types/index.js';
import { store } from '../store/aura-store.js';
import { promptBuilder } from '../prompt/prompt-builder.js';
import { skillRegistry } from '../skills/skill-registry.js';
import type { ActionToolRegistry } from './action-tool-registry.js';
import type { PendingActionQueue } from './pending-action-queue.js';
import type { PendingProposal } from '../components/aura-messages/aura-messages.js';

// ── Communication Protocol ──────────────────────────────────────
// Injected into the system prompt to instruct the AI how to
// communicate structured intents back to Aura.

const COMMUNICATION_PROTOCOL = `## Communication Protocol with Aura

When you need Aura to perform an internal operation, reply with a JSON instruction. You MAY include a brief plain-language explanation before the JSON block for the user to see, but the JSON object MUST be clearly identifiable (either as bare JSON or inside a fenced code block).

For EXECUTE_TOOL_RISKY, place the full user-facing explanation in the \`summary\` field — Aura will display it to the user automatically as Part A of the Confirmation Bubble. You may also write a brief introduction before the JSON block.

### Available Intents

**1) LOAD_SKILL_DETAIL** — A matching skill was found; load its full detail + linked tools

\`\`\`
{
  "type": "LOAD_SKILL_DETAIL",
  "name": "<skill_name>"
}
\`\`\`

**2) LOAD_TOOLS_SUMMARY** — No skill matched; load the tools summary for direct lookup

\`\`\`
{
  "type": "LOAD_TOOLS_SUMMARY"
}
\`\`\`

**3) LOAD_TOOL_DETAIL** — A matching tool was found in the tools summary; load its full detail

\`\`\`
{
  "type": "LOAD_TOOL_DETAIL",
  "name": "<tool_name>"
}
\`\`\`

**4) EXECUTE_TOOL** — Non-risky operation; execute the tool immediately

\`\`\`
{
  "type": "EXECUTE_TOOL",
  "name": "<tool_name>",
  "arguments": { ... }
}
\`\`\`

**5) EXECUTE_TOOL_RISKY** — Risky operation; triggers Confirmation Bubble workflow before execution

\`\`\`
{
  "type": "EXECUTE_TOOL_RISKY",
  "name": "<tool_name>",
  "arguments": { ... },
  "summary": "<full plain-language explanation: what will change, what is affected, severity>"
}
\`\`\`

### Rules
- Always classify every tool call as risky or non-risky before sending the instruction.
- For EXECUTE_TOOL_RISKY, the \`summary\` field is mandatory — it must describe what will change, what is affected, and the severity. Aura renders this as the user-visible explanation with a Confirmation Bubble containing a Preview Component and Approve/Cancel buttons.
- If required arguments are missing, ask the user a concise follow-up question instead of guessing.
- If Aura reports a missing tool or skill, inform the user directly that the capability is unavailable.
- Never invoke more than one tool per response.
- Never invoke a tool that is not in the loaded skill detail or tools summary.`;

// ── Types ───────────────────────────────────────────────────────

/**
 * Canonical Aura intent types per interaction-flow.md §5.
 */
export type AuraCommand =
    | { type: 'LOAD_SKILL_DETAIL'; name: string }
    | { type: 'LOAD_TOOLS_SUMMARY' }
    | { type: 'LOAD_TOOL_DETAIL'; name: string }
    | { type: 'EXECUTE_TOOL'; name: string; arguments: Record<string, unknown> }
    | { type: 'EXECUTE_TOOL_RISKY'; name: string; arguments: Record<string, unknown>; summary: string };

interface AssistantTurnState {
    toolSummariesLoaded: boolean;
    loadedToolDetails: Set<string>;
    loadedSkills: Set<string>;
}

type CommandHandlingResult = 'continue' | 'stop' | 'cancelled';

// ── Callbacks ───────────────────────────────────────────────────

/**
 * Interface through which CommunicationManager updates AuraChat UI state.
 */
export interface CommunicationCallbacks {
    getMessages(): Message[];
    setMessages(msgs: Message[]): void;
    appendVisibleMessage(msg: Message): Promise<void>;
    setStreaming(streaming: boolean): void;
    setStreamingContent(content: string): void;
    setPendingProposal(proposal: PendingProposal | null): void;
}

// ── CommunicationManager ────────────────────────────────────────

export class CommunicationManager {
    constructor(
        private _actionToolRegistry: ActionToolRegistry,
        private _pendingActionQueue: PendingActionQueue,
        private _dispatch: (tool: Tool, args: Record<string, unknown>) => Promise<CallToolResult>,
        private _callbacks: CommunicationCallbacks,
    ) { }

    // ── Public API ──────────────────────────────────────────────

    /**
     * Returns the Communication Protocol block to append to the system prompt.
     */
    getCommunicationProtocol(): string {
        return COMMUNICATION_PROTOCOL;
    }

    /**
     * Main multi-step interactive turn per interaction-flow.md §2.
     *
     * Runs the AI in a loop: each step may produce a plain-text response
     * (rendered to user) or a structured AuraCommand that triggers
     * skill/tool loading or execution. The loop runs up to 12 steps
     * to prevent runaway conversations.
     */
    async runInteractiveTurn(
        provider: AIProvider,
        config: { behavior: AIBehaviorConfig },
        activeModel: string,
    ): Promise<void> {
        const state: AssistantTurnState = {
            toolSummariesLoaded: false,
            loadedToolDetails: new Set<string>(),
            loadedSkills: new Set<string>(),
        };

        try {
            for (let step = 0; step < 12; step++) {
                const responseText = await this._runAssistantStep(provider, config, activeModel);
                const command = this._parseAuraCommand(responseText);

                if (!command) {
                    const text = responseText.trim();
                    if (!text) {
                        const emptyMsg: Message = {
                            id: crypto.randomUUID(),
                            role: MessageRole.Assistant,
                            content: 'I could not generate a response. Please try again.',
                            createdAt: new Date().toISOString(),
                        };
                        await this._callbacks.appendVisibleMessage(emptyMsg);
                        store.emitEvent('ai:message', { message: emptyMsg });
                        return;
                    }

                    const aiMsg: Message = {
                        id: crypto.randomUUID(),
                        role: MessageRole.Assistant,
                        content: text,
                        createdAt: new Date().toISOString(),
                    };
                    await this._callbacks.appendVisibleMessage(aiMsg);
                    store.emitEvent('ai:message', { message: aiMsg });
                    return;
                }

                // For EXECUTE_TOOL_RISKY, extract and display any explanation
                // text the AI wrote around the JSON command (Part A of the
                // Confirmation Bubble per interaction-flow.md §3).
                if (command.type === 'EXECUTE_TOOL_RISKY') {
                    const explanationText = this._extractExplanationText(responseText);
                    if (explanationText) {
                        const explainMsg: Message = {
                            id: crypto.randomUUID(),
                            role: MessageRole.Assistant,
                            content: explanationText,
                            createdAt: new Date().toISOString(),
                        };
                        await this._callbacks.appendVisibleMessage(explainMsg);
                    }
                }

                const commandResult = await this._handleAuraCommand(command, state);
                if (commandResult === 'continue') {
                    continue;
                }
                return;
            }

            const limitMsg: Message = {
                id: crypto.randomUUID(),
                role: MessageRole.Error,
                content: 'I reached an internal planning limit for this turn. Please try a more specific request.',
                createdAt: new Date().toISOString(),
            };
            const msgs = this._callbacks.getMessages();
            this._callbacks.setMessages([...msgs, limitMsg]);
        } catch (err) {
            console.error('[CommunicationManager] AI request failed:', err);
            if ((err as Error).name !== 'AbortError') {
                store.emitEvent('error', { message: 'AI request failed', error: String(err) });
                const errorMsg: Message = {
                    id: crypto.randomUUID(),
                    role: MessageRole.Error,
                    content: `Sorry, something went wrong: ${(err as Error).message || 'Unknown error'}`,
                    createdAt: new Date().toISOString(),
                };
                const msgs = this._callbacks.getMessages();
                this._callbacks.setMessages([...msgs, errorMsg]);
            } else {
                store.emitEvent('ai:stream:cancel', {});
            }
        } finally {
            const msgs = this._callbacks.getMessages().filter(m => !this._isInternalMessage(m));
            this._callbacks.setMessages(msgs);
            this._callbacks.setStreaming(false);
            this._callbacks.setStreamingContent('');
        }
    }

    // ── AI Streaming Step ───────────────────────────────────────

    private async _runAssistantStep(
        provider: AIProvider,
        config: { behavior: AIBehaviorConfig },
        activeModel: string,
    ): Promise<string> {
        this._callbacks.setStreaming(true);
        this._callbacks.setStreamingContent('');
        store.emitEvent('ai:stream:start', {});

        try {
            const systemPrompt = await promptBuilder.build(
                config.behavior,
                this._buildFullPromptBlock(),
            );

            const request = {
                systemPrompt,
                messages: this._callbacks.getMessages(),
                model: activeModel,
                parameters: {
                    temperature: config.behavior.temperature,
                    maxTokens: config.behavior.maxTokens,
                    topP: config.behavior.topP,
                },
            };

            const stream = await provider.sendMessage(request);
            let content = '';
            for await (const chunk of stream) {
                if (chunk.done) break;
                content += chunk.delta;
                this._callbacks.setStreamingContent(content);
            }
            return content;
        } finally {
            this._callbacks.setStreaming(false);
            this._callbacks.setStreamingContent('');
            store.emitEvent('ai:stream:end', {});
        }
    }

    /**
     * Combines the action tool registry block with the Communication Protocol.
     */
    private _buildFullPromptBlock(): string {
        const toolBlock = this._actionToolRegistry.buildSystemPromptBlock();
        const parts = [toolBlock, COMMUNICATION_PROTOCOL].filter(Boolean);
        return parts.join('\n\n');
    }

    // ── Command Parsing ─────────────────────────────────────────

    /**
     * Parse AI response into an AuraCommand using the 5 canonical intents
     * defined in interaction-flow.md §5.
     *
     * Also supports legacy snake_case intents for backward compatibility.
     */
    private _parseAuraCommand(content: string): AuraCommand | null {
        const payload = this._extractJsonPayload(content);
        if (!payload) return null;

        const rawType = typeof payload.type === 'string' ? payload.type.trim() : '';
        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        const args = this._asRecord(payload.arguments);
        const summary = typeof payload.summary === 'string' ? payload.summary : '';

        // Normalize legacy snake_case to canonical UPPER_CASE intents
        const type = this._normalizeIntentType(rawType);

        switch (type) {
            case 'LOAD_SKILL_DETAIL':
                return name ? { type: 'LOAD_SKILL_DETAIL', name } : null;

            case 'LOAD_TOOLS_SUMMARY':
                return { type: 'LOAD_TOOLS_SUMMARY' };

            case 'LOAD_TOOL_DETAIL':
                return name ? { type: 'LOAD_TOOL_DETAIL', name } : null;

            case 'EXECUTE_TOOL':
                return name ? { type: 'EXECUTE_TOOL', name, arguments: args } : null;

            case 'EXECUTE_TOOL_RISKY':
                return name ? { type: 'EXECUTE_TOOL_RISKY', name, arguments: args, summary } : null;

            default:
                return null;
        }
    }

    /**
     * Maps legacy snake_case intent names to canonical UPPER_CASE intents.
     */
    private _normalizeIntentType(type: string): string {
        const LEGACY_MAP: Record<string, string> = {
            'get_skill_detail': 'LOAD_SKILL_DETAIL',
            'list_tools': 'LOAD_TOOLS_SUMMARY',
            'get_tool_detail': 'LOAD_TOOL_DETAIL',
            'tool_call': 'EXECUTE_TOOL',
            'action_proposal': 'EXECUTE_TOOL_RISKY',
        };
        return LEGACY_MAP[type] ?? type;
    }

    private _extractJsonPayload(content: string): Record<string, unknown> | null {
        const trimmed = content.trim();
        if (!trimmed) return null;

        const candidates: string[] = [trimmed];

        // Try fenced code blocks first (```json ... ``` or ``` ... ```)
        const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
        if (codeBlockMatch?.[1]) {
            candidates.push(codeBlockMatch[1].trim());
        }

        // Try to find a JSON object embedded in surrounding prose text.
        // This handles the common case where the AI writes explanation
        // text around the JSON command.
        const braceStart = trimmed.indexOf('{');
        const braceEnd = trimmed.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            candidates.push(trimmed.substring(braceStart, braceEnd + 1));
        }

        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                    return parsed as Record<string, unknown>;
                }
            } catch {
                // Ignore malformed JSON candidate.
            }
        }

        return null;
    }

    /**
     * Extracts explanation text from an AI response that also contains a
     * JSON command. Strips fenced code blocks and bare JSON objects,
     * returning only the prose the AI wrote for the user to see.
     */
    private _extractExplanationText(content: string): string {
        // Remove fenced code blocks
        let text = content.replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/gi, '');

        // Remove bare JSON objects
        const braceStart = text.indexOf('{');
        const braceEnd = text.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            const jsonCandidate = text.substring(braceStart, braceEnd + 1);
            try {
                JSON.parse(jsonCandidate);
                text = text.substring(0, braceStart) + text.substring(braceEnd + 1);
            } catch {
                // Not valid JSON — keep text as-is
            }
        }

        return text.trim();
    }

    // ── Command Handling ────────────────────────────────────────

    private async _handleAuraCommand(command: AuraCommand, state: AssistantTurnState): Promise<CommandHandlingResult> {
        switch (command.type) {
            case 'LOAD_SKILL_DETAIL':
                return this._handleLoadSkillDetail(command, state);
            case 'LOAD_TOOLS_SUMMARY':
                return this._handleLoadToolsSummary(state);
            case 'LOAD_TOOL_DETAIL':
                return this._handleLoadToolDetail(command, state);
            case 'EXECUTE_TOOL':
                return this._handleExecuteTool(command, state);
            case 'EXECUTE_TOOL_RISKY':
                return this._handleExecuteToolRisky(command, state);
            default:
                return 'stop';
        }
    }

    /**
     * LOAD_SKILL_DETAIL — Load full skill detail + linked tools into context.
     * Per interaction-flow.md §2 Step 1.
     */
    private async _handleLoadSkillDetail(
        command: Extract<AuraCommand, { type: 'LOAD_SKILL_DETAIL' }>,
        state: AssistantTurnState,
    ): Promise<CommandHandlingResult> {
        const skill = skillRegistry.get(command.name);
        const detail = skillRegistry.getDetail(command.name);
        if (!skill || !detail) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'LOAD_SKILL_DETAIL',
                message: `Skill "${command.name}" not found or disabled.`,
                availableSkills: skillRegistry.getSummaries(),
            });
            return 'continue';
        }

        state.loadedSkills.add(skill.name);
        for (const tool of detail.tools) {
            state.loadedToolDetails.add(tool.name);
        }

        this._appendInternalMessage({
            type: 'skill_detail_loaded',
            skill: {
                name: skill.name,
                title: skill.title,
                description: skill.description,
                systemPrompt: detail.systemPrompt,
            },
            tools: detail.tools.map(t => this._serializeTool(t)),
        });

        store.emitEvent('skill:activated', { skillName: skill.name });
        return 'continue';
    }

    /**
     * LOAD_TOOLS_SUMMARY — Load the tools summary for direct lookup.
     * Per interaction-flow.md §2 Step 2.
     */
    private async _handleLoadToolsSummary(state: AssistantTurnState): Promise<CommandHandlingResult> {
        const tools = this._actionToolRegistry.getAll().filter(t => t.enabled !== false);
        state.toolSummariesLoaded = true;

        this._appendInternalMessage({
            type: 'tools_summary_loaded',
            tools: tools.map(t => ({
                name: t.name,
                title: t.title,
                description: t.description,
                risk: t.risk ?? 'query',
            })),
        });

        return 'continue';
    }

    /**
     * LOAD_TOOL_DETAIL — Load full tool detail before execution.
     * Per interaction-flow.md §2 Step 2: AI must load tool detail before invoking.
     */
    private async _handleLoadToolDetail(
        command: Extract<AuraCommand, { type: 'LOAD_TOOL_DETAIL' }>,
        state: AssistantTurnState,
    ): Promise<CommandHandlingResult> {
        if (!state.toolSummariesLoaded && state.loadedSkills.size === 0) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'LOAD_TOOL_DETAIL',
                message: 'You must send LOAD_TOOLS_SUMMARY first, or load a skill that includes this tool.',
            });
            return 'continue';
        }

        const tool = this._actionToolRegistry.get(command.name);
        if (!tool || tool.enabled === false) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'LOAD_TOOL_DETAIL',
                message: `Tool "${command.name}" not found or disabled.`,
            });
            return 'continue';
        }

        state.loadedToolDetails.add(tool.name);
        this._appendInternalMessage({
            type: 'tool_detail_loaded',
            tool: this._serializeTool(tool),
        });

        return 'continue';
    }

    /**
     * EXECUTE_TOOL — Non-risky operation. Execute immediately.
     * Per interaction-flow.md §2 "Tool Execution Decision" → Non-Risky.
     */
    private async _handleExecuteTool(
        command: Extract<AuraCommand, { type: 'EXECUTE_TOOL' }>,
        state: AssistantTurnState,
    ): Promise<CommandHandlingResult> {
        const tool = this._actionToolRegistry.get(command.name);
        if (!tool || tool.enabled === false) {
            const msg: Message = {
                id: crypto.randomUUID(),
                role: MessageRole.Assistant,
                content: `Sorry, the requested capability is unavailable — tool "${command.name}" is not registered.`,
                createdAt: new Date().toISOString(),
            };
            await this._callbacks.appendVisibleMessage(msg);
            store.emitEvent('tool:failed', { toolName: command.name, error: 'Tool not found' });
            return 'stop';
        }

        if (!state.loadedToolDetails.has(tool.name)) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'EXECUTE_TOOL',
                message: `Tool detail for "${tool.name}" has not been loaded. Send LOAD_TOOL_DETAIL or LOAD_SKILL_DETAIL first.`,
            });
            return 'continue';
        }

        const validation = this._actionToolRegistry.validateArgs(tool.name, command.arguments);
        if (!validation.valid) {
            this._appendInternalMessage({
                type: 'tool_validation_error',
                toolName: tool.name,
                errors: validation.errors,
            });
            return 'continue';
        }

        // Non-risky: execute immediately via dispatcher
        try {
            const result = await this._dispatch(tool, command.arguments);
            this._appendToolResultMessage(tool.name, result);
            return 'continue';
        } catch (err) {
            this._appendInternalMessage({
                type: 'tool_error',
                toolName: tool.name,
                error: err instanceof Error ? err.message : String(err),
            });
            return 'continue';
        }
    }

    /**
     * EXECUTE_TOOL_RISKY — Risky operation. Shows Confirmation Bubble.
     * Per interaction-flow.md §3 "Risky Operation Confirmation Flow".
     */
    private async _handleExecuteToolRisky(
        command: Extract<AuraCommand, { type: 'EXECUTE_TOOL_RISKY' }>,
        state: AssistantTurnState,
    ): Promise<CommandHandlingResult> {
        const tool = this._actionToolRegistry.get(command.name);
        if (!tool || tool.enabled === false) {
            const msg: Message = {
                id: crypto.randomUUID(),
                role: MessageRole.Assistant,
                content: `Sorry, the requested capability is unavailable — tool "${command.name}" is not registered.`,
                createdAt: new Date().toISOString(),
            };
            await this._callbacks.appendVisibleMessage(msg);
            store.emitEvent('tool:failed', { toolName: command.name, error: 'Tool not found' });
            return 'stop';
        }

        if (!state.loadedToolDetails.has(tool.name)) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'EXECUTE_TOOL_RISKY',
                message: `Tool detail for "${tool.name}" has not been loaded. Send LOAD_TOOL_DETAIL or LOAD_SKILL_DETAIL first.`,
            });
            return 'continue';
        }

        const validation = this._actionToolRegistry.validateArgs(tool.name, command.arguments);
        if (!validation.valid) {
            this._appendInternalMessage({
                type: 'tool_validation_error',
                toolName: tool.name,
                errors: validation.errors,
            });
            return 'continue';
        }

        if (this._pendingActionQueue.hasPending()) {
            this._appendInternalMessage({
                type: 'command_error',
                source: 'EXECUTE_TOOL_RISKY',
                message: 'Another action is already pending user confirmation. Wait for the user to respond.',
            });
            return 'continue';
        }

        const summary = command.summary?.trim()
            || `Execute ${tool.label || tool.title || tool.name}.`;

        // Show Confirmation Bubble
        this._callbacks.setPendingProposal({ tool, args: command.arguments, summary });
        store.emitEvent('action:proposed', { toolName: tool.name, arguments: command.arguments, summary });

        try {
            const result = await this._dispatch(tool, command.arguments);
            this._callbacks.setPendingProposal(null);

            store.emitEvent('action:succeeded', {
                toolName: tool.name,
                arguments: command.arguments,
                result,
            });

            this._appendToolResultMessage(tool.name, result);
            return 'continue';
        } catch (err) {
            this._callbacks.setPendingProposal(null);

            if (err instanceof ActionCancelledError) {
                store.emitEvent('action:cancelled', {
                    toolName: tool.name,
                    arguments: command.arguments,
                });
                return 'cancelled';
            }

            store.emitEvent('action:failed', {
                toolName: tool.name,
                arguments: command.arguments,
                error: err instanceof Error ? err.message : String(err),
            });

            this._appendInternalMessage({
                type: 'tool_error',
                toolName: tool.name,
                error: err instanceof Error ? err.message : String(err),
            });
            return 'continue';
        }
    }

    // ── Message Helpers ─────────────────────────────────────────

    private _appendToolResultMessage(toolName: string, result: CallToolResult): void {
        const resultText = result.content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map(c => c.text)
            .join('\n');

        const resultMsg: Message = {
            id: crypto.randomUUID(),
            role: MessageRole.System,
            content: result.isError
                ? `Tool error: ${resultText}`
                : `Tool result: ${resultText}`,
            createdAt: new Date().toISOString(),
            metadata: { internal: true, type: 'tool_result', toolName, result },
        };

        const msgs = this._callbacks.getMessages();
        this._callbacks.setMessages([...msgs, resultMsg]);
    }

    private _appendInternalMessage(payload: Record<string, unknown>): void {
        const msg: Message = {
            id: crypto.randomUUID(),
            role: MessageRole.System,
            content: JSON.stringify(payload, null, 2),
            createdAt: new Date().toISOString(),
            metadata: { internal: true, type: payload.type ?? 'internal' },
        };

        const msgs = this._callbacks.getMessages();
        this._callbacks.setMessages([...msgs, msg]);
    }

    private _isInternalMessage(message: Message): boolean {
        if (!message.metadata) return false;
        return (message.metadata as Record<string, unknown>).internal === true;
    }

    private _serializeTool(tool: Tool): Record<string, unknown> {
        return {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            risk: tool.risk ?? 'query',
            label: tool.label ?? tool.title ?? tool.name,
        };
    }

    private _asRecord(value: unknown): Record<string, unknown> {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
        return {};
    }
}
