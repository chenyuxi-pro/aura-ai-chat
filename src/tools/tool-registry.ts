/* ──────────────────────────────────────────────────────────────────
 *  Tool Registry
 * ────────────────────────────────────────────────────────────────── */

import type { Tool, ToolSummary, ToolResult } from '../types/index.js';

export class ToolRegistry {
    private _tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        this._tools.set(tool.name, { enabled: true, ...tool });
    }

    registerAll(tools: Tool[]): void {
        for (const tool of tools) {
            this.register(tool);
        }
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

    getEnabled(): Tool[] {
        return this.getAll().filter(t => t.enabled !== false);
    }

    getSummaries(): ToolSummary[] {
        return this.getEnabled().map(t => ({
            name: t.name,
            title: t.title,
            description: t.description,
        }));
    }

    /** Execute a tool by name with given input */
    async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
        const tool = this._tools.get(name);
        if (!tool) {
            return {
                content: [{ type: 'text', text: `Tool "${name}" not found.` }],
                isError: true,
            };
        }
        if (tool.enabled === false) {
            return {
                content: [{ type: 'text', text: `Tool "${name}" is disabled.` }],
                isError: true,
            };
        }
        try {
            return await tool.execute(input);
        } catch (err) {
            return {
                content: [{ type: 'text', text: `Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }

    setEnabled(name: string, enabled: boolean): void {
        const tool = this._tools.get(name);
        if (tool) {
            tool.enabled = enabled;
        }
    }

    /** Return tools that are referenced by any enabled skill */
    getLockedToolNames(skillTools: Map<string, string[]>): Map<string, string[]> {
        // Map: toolName → list of skill names that reference it
        const locked = new Map<string, string[]>();
        for (const [skillName, toolNames] of skillTools) {
            for (const toolName of toolNames) {
                if (!locked.has(toolName)) locked.set(toolName, []);
                locked.get(toolName)!.push(skillName);
            }
        }
        return locked;
    }

    clear(): void {
        this._tools.clear();
    }
}

export const toolRegistry = new ToolRegistry();
