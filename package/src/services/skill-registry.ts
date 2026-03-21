import type { Skill, AuraTool, ToolDefinition } from "../types/index.js";

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private tools = new Map<string, AuraTool>();

  registerSkills(skills: Skill[]): void {
    for (const skill of skills) this.registerSkill(skill);
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  registerTools(tools: AuraTool[]): void {
    for (const tool of tools) this.registerTool(tool);
  }

  registerTool(tool: AuraTool): void {
    this.tools.set(tool.name, tool);
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getTool(name: string): AuraTool | undefined {
    return this.tools.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkillsSummary(): { name: string; description: string }[] {
    return this.getAllSkills().map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  getAllTools(): AuraTool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitionsForSkill(skillName: string): ToolDefinition[] {
    const skill = this.getSkill(skillName);
    if (!skill) return [];
    return skill.tools
      .map<ToolDefinition | null>((toolName) => {
        const tool = this.getTool(toolName);
        if (!tool) return null;
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        };
      })
      .filter((t): t is ToolDefinition => t !== null);
  }

  getActiveToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const skill of this.getAllSkills()) {
      defs.push(...this.getToolDefinitionsForSkill(skill.name));
    }
    return defs;
  }

  clear(): void {
    this.skills.clear();
    this.tools.clear();
  }
}
