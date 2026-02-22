/* ------------------------------------------------------------------
 * Action Tool Registry
 * Validates and manages action tools, and builds system prompt blocks.
 * ------------------------------------------------------------------ */

import type { Tool } from '../types/index.js';

export class ActionToolRegistry {
    private _tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        if (this._tools.has(tool.name)) {
            throw new Error(`ActionToolRegistry: duplicate tool name "${tool.name}"`);
        }

        if ((tool.risk === 'moderate' || tool.risk === 'destructive') && !tool.preview) {
            throw new Error(
                `ActionToolRegistry: tool "${tool.name}" has risk "${tool.risk}" but no preview. ` +
                'Preview is required for moderate and destructive tools.'
            );
        }

        if (!tool.risk && (tool.preview || tool.undo)) {
            throw new Error(
                `ActionToolRegistry: tool "${tool.name}" has no risk but defines preview or undo. ` +
                'Only action tools (with risk) may have preview or undo.'
            );
        }

        this._tools.set(tool.name, tool);
    }

    unregister(name: string): void {
        this._tools.delete(name);
    }

    get(name: string): Tool | undefined {
        return this._tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this._tools.values());
    }

    clear(): void {
        this._tools.clear();
    }

    /**
     * Validates AI-proposed args against the tool's inputSchema.
     */
    validateArgs(toolName: string, args: Record<string, unknown>): { valid: boolean; errors: string[] } {
        const tool = this._tools.get(toolName);
        if (!tool) {
            return { valid: false, errors: [`Tool "${toolName}" not found in action registry.`] };
        }

        const errors: string[] = [];
        const schema = tool.inputSchema;

        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in args)) {
                    errors.push(`Missing required field: "${field}"`);
                }
            }
        }

        if (schema.properties) {
            for (const key of Object.keys(args)) {
                if (!(key in schema.properties)) {
                    errors.push(`Unknown field: "${key}"`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Returns formatted sections for injection into the AI system prompt.
     * Never exposes execute, preview.buildProps, or undo to the AI.
     *
     * Uses the canonical intent types from interaction-flow.md:
     *   EXECUTE_TOOL       → non-risky, execute immediately
     *   EXECUTE_TOOL_RISKY → risky, triggers Confirmation Bubble
     */
    buildSystemPromptBlock(): string {
        const all = this.getAll();
        if (all.length === 0) return '';

        const queryTools = all.filter(t => !t.risk);
        const actionTools = all.filter(t => !!t.risk);

        const sections: string[] = [];

        if (queryTools.length > 0) {
            const lines = queryTools.map(t =>
                `- \`${t.name}\`  ${t.description || ''}`
            );
            sections.push(
                `## Query Tools\nRead-only tools. Use EXECUTE_TOOL intent — Aura executes immediately without confirmation.\n\n${lines.join('\n')}`
            );
        }

        if (actionTools.length > 0) {
            const rules = `These tools modify the host application. Follow these rules without exception:

- **Non-risky (safe) actions:** Use the EXECUTE_TOOL intent. Aura executes immediately.
- **Risky (moderate/destructive) actions:** Use the EXECUTE_TOOL_RISKY intent with a clear \`summary\` field describing what will change, what is affected, and the severity. Aura renders a Confirmation Bubble and waits for user approval.
- risk "safe"        → EXECUTE_TOOL — Aura executes immediately.
- risk "moderate"    → EXECUTE_TOOL_RISKY — Aura shows Confirmation Bubble (Approve/Cancel).
- risk "destructive" → EXECUTE_TOOL_RISKY — Aura shows Confirmation Bubble + requires typed "confirm".
- Never invoke more than one tool per response.
- Never invoke a tool not in the catalog below.
- If a requested capability has no matching tool, tell the user it is unavailable.
- If tool execution returns isError: true, explain the error clearly and ask how to proceed.`;

            const catalog = actionTools.map(t =>
                `- \`${t.name}\`  [${t.risk}]  ${t.description || ''}`
            );

            sections.push(
                `## Action Tools\n${rules}\n\n${catalog.join('\n')}`
            );
        }

        return sections.join('\n\n');
    }
}

export const actionToolRegistry = new ActionToolRegistry();