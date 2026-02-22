import type {
  AuraTool,
  ToolCallRequest,
  ToolExecutionContext,
  AuraToolResult,
  ToolResultContent,
  TextContent,
  ToolCallLogEntry,
} from "../types/index.js";
import type { SkillRegistry } from "../skills/skill-registry.js";

export function contentToModelText(
  content: ToolResultContent | ToolResultContent[],
): string {
  if (Array.isArray(content)) {
    return content
      .filter((item): item is TextContent => item.type === "text")
      .map((item) => item.text)
      .join("\n");
  }

  if (content.type === "text") return content.text;
  return JSON.stringify(content);
}

export class ToolDispatcher {
  private globalTimeoutMs = 30000;

  constructor(
    private skillRegistry: SkillRegistry,
    options?: { globalTimeoutMs?: number } | number,
  ) {
    if (typeof options === "number") {
      this.globalTimeoutMs = options;
    } else if (options?.globalTimeoutMs) {
      this.globalTimeoutMs = options.globalTimeoutMs;
    }
  }

  getTool(id: string): AuraTool | undefined {
    return this.skillRegistry.getTool(id);
  }

  async execute(
    toolCall: ToolCallRequest,
    context: ToolExecutionContext,
  ): Promise<AuraToolResult> {
    const startTime = Date.now();
    const result = await this.dispatch(toolCall, context);
    const logEntry: ToolCallLogEntry = {
      callId: toolCall.callId,
      conversationId: context.conversationId,
      toolId: toolCall.id,
      arguments: toolCall.arguments,
      result: result.content,
      error: result.isError ? (result.content[0] as TextContent)?.text : undefined,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      userId: context.userId,
      appMetadata: context.appMetadata,
    };
    return { ...result, logEntry };
  }

  async dispatch(
    toolCall: ToolCallRequest,
    context: ToolExecutionContext,
  ): Promise<AuraToolResult> {
    const tool = this.getTool(toolCall.id);

    if (!tool) {
      const errorMsg = `Tool "${toolCall.id}" is not registered.`;
      return {
        content: [{ type: "text", text: errorMsg }],
        isError: true,
      };
    }

    try {
      const executePromise = tool.execute(toolCall.arguments, context);
      const timeoutMs = tool.timeout ?? this.globalTimeoutMs;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Tool execution timed out after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        ),
      );

      const result = await Promise.race([executePromise, timeoutPromise]);
      return {
        ...result,
        content: Array.isArray(result.content) ? result.content : [result.content],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: (err as Error).message }],
        isError: true,
      };
    }
  }
}
