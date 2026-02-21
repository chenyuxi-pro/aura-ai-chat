/* ──────────────────────────────────────────────────────────────────
 *  Component Bridge — Creates host Custom Elements from ToolPreview
 *  descriptors, with graceful fallbacks.
 * ────────────────────────────────────────────────────────────────── */

import type { ToolPreview } from '../types/index.js';

export class ComponentBridge {

    /**
     * Checks whether a Custom Element tag is registered in the browser.
     */
    isRegistered(tagName: string): boolean {
        return customElements.get(tagName) !== undefined;
    }

    /**
     * Creates the preview Custom Element from a ToolPreview descriptor.
     * - Calls preview.buildProps(args) to enrich props
     * - Creates the Custom Element and assigns all props as object properties
     * - Returns the element ready for DOM insertion
     * - On failure: returns a fallback element with error details
     */
    async createElement(
        preview: ToolPreview,
        args: Record<string, unknown>
    ): Promise<HTMLElement> {
        const tagName = preview.element;

        // Check if custom element is registered
        if (!this.isRegistered(tagName)) {
            return this._createFallback(
                `Preview unavailable — host has not registered element <${tagName}>`,
                args
            );
        }

        try {
            const props = await preview.buildProps(args);
            const element = document.createElement(tagName);

            // Assign props via element[key] = value (not setAttribute)
            for (const [key, value] of Object.entries(props)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (element as any)[key] = value;
            }

            // Dispatch preview-rendered event for host observability
            element.dispatchEvent(new CustomEvent('preview-rendered', {
                bubbles: true,
                composed: true,
                detail: { tagName, props },
            }));

            return element;
        } catch (err) {
            return this._createFallback(
                `Preview error: ${err instanceof Error ? err.message : String(err)}`,
                args
            );
        }
    }

    /**
     * Creates a graceful fallback element when the preview cannot be rendered.
     */
    private _createFallback(message: string, args: Record<string, unknown>): HTMLElement {
        const container = document.createElement('div');
        container.className = 'aura-preview-fallback';

        const msgEl = document.createElement('p');
        msgEl.textContent = message;
        msgEl.style.cssText = 'margin: 0 0 8px; font-weight: 600; color: var(--aura-color-text-muted, #6b7280);';
        container.appendChild(msgEl);

        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(args, null, 2);
        pre.style.cssText = 'margin: 0; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.15); font-size: 12px; overflow-x: auto; white-space: pre-wrap;';
        container.appendChild(pre);

        container.style.cssText = 'padding: 12px; border: 1px dashed var(--aura-color-border, #3e3e42); border-radius: 8px;';
        return container;
    }
}

export const componentBridge = new ComponentBridge();
