/* ──────────────────────────────────────────────────────────────────
 *  Pending Action Queue — Manages a single pending action awaiting
 *  user approval or cancellation.
 * ────────────────────────────────────────────────────────────────── */

import type { Tool, CallToolResult, PendingAction } from '../types/index.js';
import { ActionCancelledError } from '../types/index.js';

export class PendingActionQueue {
    private _pending: PendingAction | null = null;

    /**
     * Called by dispatch for moderate/destructive tools.
     * Returns a Promise that resolves with CallToolResult on approve
     * or rejects with ActionCancelledError on cancel.
     */
    enqueue(tool: Tool, args: Record<string, unknown>): Promise<CallToolResult> {
        if (this._pending) {
            // Only one pending action at a time — reject the new one
            return Promise.resolve({
                content: [{ type: 'text' as const, text: 'Another action is already pending. Please wait for the user to respond before proposing a new action.' }],
                isError: true,
            });
        }

        return new Promise<CallToolResult>((resolve, reject) => {
            this._pending = { tool, args, resolve, reject };
        });
    }

    /**
     * User approved the pending action.
     * Executes tool.execute(args) and resolves the promise.
     */
    async approve(): Promise<void> {
        if (!this._pending) return;

        const { tool, args, resolve } = this._pending;
        this._pending = null;

        try {
            const result = await tool.execute(args);
            resolve(result);
        } catch (err) {
            // Tool errors returned as CallToolResult with isError: true
            resolve({
                content: [{ type: 'text', text: `Tool "${tool.name}" failed: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            });
        }
    }

    /**
     * User cancelled the pending action.
     * Rejects with ActionCancelledError.
     */
    cancel(): void {
        if (!this._pending) return;

        const { reject } = this._pending;
        this._pending = null;
        reject(new ActionCancelledError());
    }

    hasPending(): boolean {
        return this._pending !== null;
    }

    getPending(): PendingAction | null {
        return this._pending;
    }
}

export const pendingActionQueue = new PendingActionQueue();
