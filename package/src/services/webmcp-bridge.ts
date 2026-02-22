import type { SkillRegistry } from "../skills/skill-registry.js";
import type {
  AppMetadata,
  AuraTool,
  AuraToolResult,
  ToolExecutionContext,
  ToolResultContent,
} from "../types/index.js";
import type {
  WebMcpContent,
  WebMcpToolDefinition,
  WebMcpToolResult,
} from "../types/webmcp.js";
import { auraToMcpAnnotations } from "../types/index.js";

type NavigatorWithMcp = Navigator & {
  mcp?: {
    registerTool: (
      definition: WebMcpToolDefinition,
      execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>,
    ) => Promise<void> | void;
    unregisterTool?: (name: string) => Promise<void> | void;
    listTools: () => Promise<WebMcpToolDefinition[]>;
    callTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<WebMcpToolResult>;
  };
};

export function supportsWebMcp(): boolean {
  return typeof (navigator as NavigatorWithMcp).mcp !== "undefined";
}

export class WebMcpBridge {
  private exportedToolNames = new Set<string>();

  constructor(
    private skillRegistry: SkillRegistry,
    private appMetadata: AppMetadata = {
      appId: "webmcp-host",
      teamId: "webmcp",
    },
    private conversationId = "webmcp",
  ) {}

  async expose(): Promise<void> {
    await this.exportTools();
  }

  async importPageTools(): Promise<void> {
    await ToolImporter.import(this.skillRegistry);
  }

  async teardown(): Promise<void> {
    if (!supportsWebMcp()) return;
    const nav = navigator as NavigatorWithMcp;
    if (!nav.mcp?.unregisterTool) return;

    const unregisters = Array.from(this.exportedToolNames).map((toolName) =>
      Promise.resolve(nav.mcp!.unregisterTool!(toolName)),
    );
    await Promise.allSettled(unregisters);
    this.exportedToolNames.clear();
  }

  async exportTools(): Promise<void> {
    if (!supportsWebMcp()) return;

    const nav = navigator as NavigatorWithMcp;
    if (!nav.mcp) return;

    const tools = this.skillRegistry.getAllTools();
    for (const tool of tools) {
      const definition = this.auraToWebMcpToolDefinition(tool);
      const fullName = definition.name;

      await Promise.resolve(
        nav.mcp.registerTool(definition, async (args: Record<string, unknown>) => {
          const context: ToolExecutionContext = {
            conversationId: this.conversationId,
            userId: this.appMetadata.userId,
            appMetadata: this.appMetadata,
          };
          const result = await tool.execute(args, context);
          return this.auraToWebMcpResult(result);
        }),
      );

      this.exportedToolNames.add(fullName);
    }
  }

  private auraToWebMcpToolDefinition(tool: AuraTool): WebMcpToolDefinition {
    return {
      name: `aura:${tool.name}`,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: auraToMcpAnnotations(tool),
    };
  }

  private auraToWebMcpResult(result: AuraToolResult): WebMcpToolResult {
    return {
      content: this.auraToWebMcpContent(result.content),
      isError: result.isError,
    };
  }

  private auraToWebMcpContent(content: ToolResultContent[]): WebMcpContent[] {
    return content.map((item) => {
      if (item.type === "text") return { type: "text", text: item.text };
      if (item.type === "image") {
        return { type: "image", data: item.data, mimeType: item.mimeType };
      }
      if (item.type === "audio") {
        return {
          type: "audio",
          data: item.data,
          mimeType: item.mimeType,
        } as unknown as WebMcpContent;
      }
      if (item.type === "resource") {
        return {
          type: "resource",
          uri: item.resource.uri,
          mimeType: item.resource.mimeType,
          text: "text" in item.resource ? item.resource.text : undefined,
          data: "blob" in item.resource ? item.resource.blob : undefined,
        };
      }
      if (item.type === "json") {
        return { type: "text", text: JSON.stringify(item.data) };
      }
      return {
        type: "text",
        text: `[custom-element:${item.element}]`,
      };
    });
  }
}

export class ToolExporter {
  static async export(skillRegistry: SkillRegistry): Promise<void> {
    const bridge = new WebMcpBridge(skillRegistry);
    await bridge.exportTools();
  }
}

export class ToolImporter {
  static async import(skillRegistry: SkillRegistry): Promise<void> {
    if (!supportsWebMcp()) return;
    const nav = navigator as NavigatorWithMcp;
    if (!nav.mcp) return;

    try {
      const mcpTools = await nav.mcp.listTools();
      for (const mcpTool of mcpTools) {
        if (mcpTool.name.startsWith("aura:")) continue;

        const tool: AuraTool = {
          name: mcpTool.name,
          description: mcpTool.description,
          inputSchema: mcpTool.inputSchema,
          execute: async (args) => {
            const res = await nav.mcp!.callTool(mcpTool.name, args);
            return {
              content: res.content
                .map((item) =>
                  item.type === "text"
                    ? { type: "text", text: item.text ?? "" }
                    : {
                        type: "json",
                        data: item,
                      },
                ) as ToolResultContent[],
              isError: res.isError,
            };
          },
        };
        skillRegistry.registerTool(tool);
      }
    } catch (err) {
      console.error("Failed to import WebMCP tools:", err);
    }
  }
}
