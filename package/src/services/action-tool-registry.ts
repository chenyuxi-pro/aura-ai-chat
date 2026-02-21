/* ──────────────────────────────────────────────────────────────────
 *  Action Tool Registry — Validates & manages action tools,
 *  builds AI system prompt blocks for query and action tools.
 * ────────────────────────────────────────────────────────────────── */

import type { Tool } from '../types/index.js';

export class ActionToolRegistry {
    private _tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        // Duplicate name check
        if (this._tools.has(tool.name)) {
            throw new Error(`ActionToolRegistry: duplicate tool name "${tool.name}"`);
        }

        // Validation: moderate/destructive requires preview
        if ((tool.risk === 'moderate' || tool.risk === 'destructive') && !tool.preview) {
            throw new Error(
                `ActionToolRegistry: tool "${tool.name}" has risk "${tool.risk}" but no preview. ` +
                `Preview is required for moderate and destructive tools.`
            );
        }

        // Validation: query tool (no risk) must not have preview or undo
        if (!tool.risk && (tool.preview || tool.undo)) {
            throw new Error(
                `ActionToolRegistry: tool "${tool.name}" has no risk but defines preview or undo. ` +
                `Only action tools (with risk) may have preview or undo.`
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
     * Returns { valid, errors } tuple.
     */
    validateArgs(toolName: string, args: Record<string, unknown>): { valid: boolean; errors: string[] } {
        const tool = this._tools.get(toolName);
        if (!tool) {
            return { valid: false, errors: [`Tool "${toolName}" not found in action registry.`] };
        }

        const errors: string[] = [];
        const schema = tool.inputSchema;

        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in args)) {
                    errors.push(`Missing required field: "${field}"`);
                }
            }
        }

        // Check properties type (basic validation)
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
     * Returns two formatted sections for injection into the AI system prompt.
     * Never exposes execute, preview.buildProps, or undo to the AI.
     */
    buildSystemPromptBlock(): string {
        const all = this.getAll();
        if (all.length === 0) return '';

        const queryTools = all.filter(t => !t.risk);
        const actionTools = all.filter(t => !!t.risk);

        const sections: string[] = [];

        // Query Tools section
        if (queryTools.length > 0) {
            const lines = queryTools.map(t =>
                `- \`${t.name}\`  ${t.description || ''}`
            );
            sections.push(
                `## Query Tools\nCall these freely to gather information. Silent — no confirmation needed.\n\n${lines.join('\n')}`
            );
        }

        // Action Tools section
        if (actionTools.length > 0) {
            const rules = `These modify the host application. Follow these rules without exception:

- risk "safe"        → invoke directly
- risk "moderate"    → DO NOT invoke. Respond ONLY with an action_proposal JSON block and nothing else. Stop. Wait for the user.
- risk "destructive" → same as moderate. User will also be required to type "confirm".
- Never propose more than one action per turn.
- Never propose an action not in the catalog below.
- If a requested capability has no matching action, tell the user it is unavailable.
- If execute returns isError: true, report the error clearly and ask how to proceed.

### Action Proposal Format
When proposing a moderate or destructive action your entire response must be
this JSON and nothing else:

\`\`\`json
{
  "type": "action_proposal",
  "name": "<tool name from catalog>",
  "arguments": { <args matching inputSchema> },
  "summary": "<one sentence describing exactly what will change>"
}
\`\`\``;

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
