/* ──────────────────────────────────────────────────────────────────
 *  Prompt Builder — Assembles the final system prompt per the
 *  Interaction Flow spec (see docs/interaction-flow.md).
 *
 *  Prompt assembly order:
 *    1. Master System Prompt (from master-system-prompt.md)
 *    2. App custom system prompt
 *    3. Security instructions
 *    4. Dynamic context (fresh every turn)
 *    5. Skills Summary (injected at session init — AI's primary map)
 *    6. Action tools block (query + action catalogs)
 *
 *  NOTE: Tool Summaries are NOT included here. Per the interaction flow,
 *  the AI must explicitly request them via LOAD_TOOLS_SUMMARY when no
 *  skill matches.
 *
 *  NOTE: Communication Protocol is managed by the CommunicationManager
 *  and injected via the actionToolBlock parameter.
 * ────────────────────────────────────────────────────────────────── */

import type { AIBehaviorConfig, Skill, SkillSummary } from '../types/index.js';
import { getSkillDisplayName } from '../types/index.js';

// ── Load master system prompt from .md file (Vite raw import) ────
import MASTER_SYSTEM_PROMPT from './master-system-prompt.md?raw';

// ── Build Skills Summary ────────────────────────────────────────

function buildSkillsSummary(skills: Skill[]): string {
    const enabled = skills.filter(s => s.enabled !== false);
    if (enabled.length === 0) return '';

    const summaries: SkillSummary[] = enabled.map(s => ({
        name: s.name,
        title: s.title,
        description: s.description,
    }));

    const lines = summaries.map(s =>
        `- **${getSkillDisplayName(s)}** (\`${s.name}\`): ${s.description}`
    );

    return `## Skills Summary\nThe following skills are available. Use this as your primary reference when interpreting user intent.\n\n${lines.join('\n')}`;
}

// ── Prompt Builder Class ────────────────────────────────────────

export class PromptBuilder {
    /**
     * Assembles the final system prompt following the Interaction Flow spec.
     *
     * @param behavior   - The AI behavior config from the host app
     * @param actionToolBlock - Optional block describing action tools (from ActionToolRegistry)
     */
    async build(behavior: AIBehaviorConfig, actionToolBlock?: string): Promise<string> {
        const sections: string[] = [];

        // 1. Master System Prompt (from master-system-prompt.md)
        sections.push(MASTER_SYSTEM_PROMPT.trim());

        // 2. App custom system prompt
        if (behavior.systemPrompt) {
            sections.push(`## Host Application Instructions\n${behavior.systemPrompt}`);
        }

        // 3. Security instructions
        if (behavior.securityInstructions) {
            sections.push(`## Security\n${behavior.securityInstructions}`);
        }

        // 4. Dynamic context (fresh every turn)
        if (behavior.dynamicContext) {
            try {
                const ctx = await behavior.dynamicContext();
                if (ctx) sections.push(`## Current Context\n${ctx}`);
            } catch {
                // Silently skip failed dynamic context
            }
        }

        // 5. Skills Summary (always in system prompt per interaction flow)
        if (behavior.skills?.length) {
            const skillsSummary = buildSkillsSummary(behavior.skills);
            if (skillsSummary) sections.push(skillsSummary);
        }

        // 6. Action tools block (query + action tool catalogs from ActionToolRegistry)
        if (actionToolBlock) {
            sections.push(actionToolBlock);
        }

        return sections.join('\n\n---\n\n');
    }
}

export const promptBuilder = new PromptBuilder();
