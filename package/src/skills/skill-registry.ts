/* ──────────────────────────────────────────────────────────────────
 *  Skill Registry
 * ────────────────────────────────────────────────────────────────── */

import type { Skill, SkillSummary, Tool } from '../types/index.js';
import { toolRegistry } from '../tools/tool-registry.js';

export class SkillRegistry {
    private _skills: Map<string, Skill> = new Map();

    register(skill: Skill): void {
        this._skills.set(skill.name, { enabled: true, ...skill });
    }

    registerAll(skills: Skill[]): void {
        for (const skill of skills) {
            this.register(skill);
        }
    }

    unregister(name: string): void {
        this._skills.delete(name);
    }

    get(name: string): Skill | undefined {
        return this._skills.get(name);
    }

    getAll(): Skill[] {
        return Array.from(this._skills.values());
    }

    getEnabled(): Skill[] {
        return this.getAll().filter(s => s.enabled !== false);
    }

    getSummaries(): SkillSummary[] {
        return this.getEnabled().map(s => ({
            name: s.name,
            title: s.title,
            description: s.description,
        }));
    }

    /** Returns the full skill detail with tools — used by the AI's get_skill_detail call */
    getDetail(name: string): { systemPrompt: string; tools: Tool[] } | null {
        const skill = this._skills.get(name);
        if (!skill || skill.enabled === false) return null;

        const resolvedTools: Tool[] = [];
        for (const toolName of (skill.tools ?? [])) {
            const tool = toolRegistry.get(toolName);
            if (tool && tool.enabled !== false) {
                resolvedTools.push(tool);
            }
        }

        return {
            systemPrompt: skill.systemPrompt,
            tools: resolvedTools,
        };
    }

    setEnabled(name: string, enabled: boolean): void {
        const skill = this._skills.get(name);
        if (skill) {
            skill.enabled = enabled;
        }
    }

    clear(): void {
        this._skills.clear();
    }
}

export const skillRegistry = new SkillRegistry();
