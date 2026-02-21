/* ──────────────────────────────────────────────────────────────────
 *  Tool Dispatcher — Routes tool calls based on risk level.
 *  All routing logic lives here, never scattered across components.
 * ────────────────────────────────────────────────────────────────── */

import type { Tool, CallToolResult } from '../types/index.js';
import { store } from '../store/aura-store.js';
import type { PendingActionQueue } from './pending-action-queue.js';

/**
 * Executes a query tool silently — result returned to AI only, no UI shown.
 */
async function executeQuerySilently(tool: Tool, args: Record<string, unknown>): Promise<CallToolResult> {
    store.emitEvent('tool:invoked', { toolName: tool.name, arguments: args });
    try {
        const result = await tool.execute(args);
        store.emitEvent('tool:result', { toolName: tool.name, result });
        return result;
    } catch (err) {
        const errorResult: CallToolResult = {
            content: [{ type: 'text', text: `Tool "${tool.name}" failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
        };
        store.emitEvent('tool:failed', { toolName: tool.name, error: err instanceof Error ? err.message : String(err) });
        return errorResult;
    }
}

/**
 * Executes a safe action tool immediately, shows brief toast.
 */
async function executeActionSilently(tool: Tool, args: Record<string, unknown>): Promise<CallToolResult> {
    store.emitEvent('tool:invoked', { toolName: tool.name, arguments: args });
    try {
        const result = await tool.execute(args);
        store.emitEvent('action:succeeded', { toolName: tool.name, arguments: args, result });
        return result;
    } catch (err) {
        const errorResult: CallToolResult = {
            content: [{ type: 'text', text: `Tool "${tool.name}" failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
        };
        store.emitEvent('action:failed', { toolName: tool.name, arguments: args, error: err instanceof Error ? err.message : String(err) });
        return errorResult;
    }
}

/**
 * Central dispatch function — routes tool calls by risk level.
 */
export function createDispatch(queue: PendingActionQueue) {
    return function dispatch(
        tool: Tool,
        args: Record<string, unknown>
    ): Promise<CallToolResult> {
        if (!tool.risk) {
            return executeQuerySilently(tool, args);
        }
        if (tool.risk === 'safe') {
            return executeActionSilently(tool, args);
        }
        // moderate or destructive → show ConfirmationBubble
        store.emitEvent('action:proposed', { toolName: tool.name, arguments: args });
        return queue.enqueue(tool, args);
    };
}
