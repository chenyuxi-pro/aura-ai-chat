import type {
  AuraConfig,
  Attachment,
  ChatMessage,
  PendingAction,
  ProviderMessage,
  ProviderResponse,
  Skill,
  ToolCallRequest,
  ToolDefinition,
  ToolExecutionContext,
  AgentStep,
  AgentStepKindType,
  AuraTool,
  ToolResultContent,
  AuraResource,
} from "../types/index.js";
import { AuraEventType, needsConfirmation } from "../types/index.js";
import type { SkillRegistry } from "../skills/skill-registry.js";
import type { ToolDispatcher } from "./tool-dispatcher.js";
import { contentToModelText } from "./tool-dispatcher.js";
import type { ProviderManager } from "./provider-manager.js";
import type { HistoryManager } from "./history-manager.js";
import type { EventBus } from "../logging/event-bus.js";
import {
  buildSystemPrompt,
  type SystemPromptArgs,
  buildSkillSelectToolDef,
  buildSkillSwitchToolDef,
  buildAskUserToolDef,
  SKILL_SELECT_TOOL_NAME,
  SKILL_SWITCH_TOOL_NAME,
  ASK_USER_TOOL_NAME,
} from "../prompt/prompt-builder.js";
import { trimToTokenBudget } from "./tokenBudget.js";

export interface OrchestratorCallbacks {
  onStepStart(step: AgentStep): void;
  onStepUpdate(step: AgentStep): void;
  onStreamDelta(delta: string): void;
  onMessagePushed(): void;
  requestHumanInTheLoop(step: AgentStep): Promise<HumanInTheLoopResult>;
}

export interface HumanInTheLoopResult {
  approved?: boolean;
  text?: string;
  timedOut?: boolean;
}

let stepIdCounter = 0;

function nextStepId(): string {
  return `step_${Date.now()}_${++stepIdCounter}`;
}

function createUserMessage(
  text: string,
  attachments?: Attachment[],
): ChatMessage {
  return {
    id: `msg_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "user",
    content: text,
    timestamp: Date.now(),
    attachments: attachments?.length ? attachments : undefined,
  };
}

function createAssistantMessage(content: string | null): ChatMessage {
  return {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: content ?? "",
    timestamp: Date.now(),
  };
}

function createAssistantMessageWithToolCalls(
  response: ProviderResponse,
): ChatMessage {
  return {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: response.content ?? "",
    timestamp: Date.now(),
    toolCalls: response.toolCalls,
  };
}

function createToolResultMessage(
  toolCall: ToolCallRequest,
  resultContent: string,
  resultItems?: ToolResultContent[],
): ChatMessage {
  const msg: ChatMessage = {
    id: `msg_tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "tool",
    content: resultContent,
    timestamp: Date.now(),
    toolCallId: toolCall.callId,
    metadata: {
      toolId: toolCall.id,
    },
  };

  if (resultItems && resultItems.some((c) => c.type !== "text")) {
    msg.metadata = {
      ...msg.metadata,
      showResultInChat: true,
      resultContent: resultItems,
    };
  }
  return msg;
}

function createIterationMessage(iterationNumber: number): ChatMessage {
  return {
    id: `msg_iter_${iterationNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: "",
    timestamp: Date.now(),
    metadata: {
      isIteration: true,
      iterationNumber,
      agentSteps: [],
    },
  };
}

function withPreviewTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

const PREVIEW_TIMEOUT_MS = 10_000;

async function buildPendingAction(
  tool: AuraTool,
  toolCall: ToolCallRequest,
): Promise<PendingAction> {
  const action: PendingAction = {
    id: toolCall.callId,
    toolCall,
    toolName: tool.name,
    title: tool.title,
    risk: tool.risk,
    status: "pending",
    description: tool.description,
  };

  if (tool.preview) {
    try {
      const previewContent = await withPreviewTimeout(
        tool.preview.buildContent(toolCall.arguments),
        PREVIEW_TIMEOUT_MS,
      );
      if (previewContent) {
        action.previewContent = previewContent;
      }
    } catch {
      /* ignore preview errors */
    }
  }

  return action;
}

async function readResources(
  resources?: AuraResource[],
): Promise<
  Array<{ uri: string; name: string; description?: string; text: string }>
> {
  if (!resources || resources.length === 0) return [];
  const results = await Promise.all(
    resources.map(async (r) => {
      try {
        const contents = await r.read();
        const text =
          "text" in contents
            ? contents.text
            : `[binary: ${contents.mimeType ?? "unknown"}]`;
        return { uri: r.uri, name: r.name, description: r.description, text };
      } catch {
        return {
          uri: r.uri,
          name: r.name,
          description: r.description,
          text: "[resource read failed]",
        };
      }
    }),
  );

  return results;
}

function buildToolContext(
  config: AuraConfig,
  historyManager: HistoryManager,
  resources?: AuraResource[],
): ToolExecutionContext {
  return {
    conversationId: historyManager.getConversation().id,
    userId: config.identity.appMetadata.userId,
    appMetadata: config.identity.appMetadata,
    resources,
  };
}

function extractAskUserQuestion(args: Record<string, unknown>): string {
  const direct = args["question"];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "Please provide the information needed to continue.";
}

export class CommunicationManager {
  private activeSkill: Skill | null = null;
  private abortController: AbortController | null = null;
  private currentIterationMsg: ChatMessage | null = null;

  constructor(
    private readonly skillManager: SkillRegistry,
    private readonly toolRunner: ToolDispatcher,
    private readonly providerManager: ProviderManager,
    private readonly historyManager: HistoryManager,
    private readonly eventBus: EventBus,
    private readonly config: AuraConfig,
    private readonly callbacks: OrchestratorCallbacks,
  ) { }

  async run(text: string, attachments?: Attachment[]): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const { skillManager, toolRunner, historyManager, eventBus, config } = this;
    const maxIter = config.agent?.maxIterations ?? 10;
    const loopStart = Date.now();

    const userMsg = createUserMessage(text, attachments);
    await historyManager.pushAndPersistMessage(userMsg);
    eventBus.emit(AuraEventType.MessageSent, { message: userMsg });
    this.callbacks.onMessagePushed();

    eventBus.emit(AuraEventType.AgentLoopStarted, {
      conversationId: historyManager.getConversation().id,
    });

    for (let iteration = 1; iteration <= maxIter; iteration++) {
      this.checkAborted(signal);

      const iterMsg = createIterationMessage(iteration);
      this.currentIterationMsg = iterMsg;
      historyManager.pushMessage(iterMsg);
      this.callbacks.onMessagePushed();

      const resources = config.agent?.resources;
      const resourceContents = await readResources(resources);

      const { tools, systemPromptArgs } =
        this.resolveToolSet(resourceContents);

      const systemPrompt = buildSystemPrompt({
        ...systemPromptArgs,
        agenticMode: true,
      });

      const providerMessages = this.buildProviderMessages(systemPrompt);
      const trimmed = config.agent?.maxContextTokens
        ? trimToTokenBudget(providerMessages, {
          maxTokens: config.agent.maxContextTokens,
        })
        : providerMessages;

      const thinkStep = await this.emitStep(
        iteration,
        "thinking",
        "Reasoning...",
      );
      let response: ProviderResponse;
      try {
        response = await this.callProvider(trimmed, tools, signal);
      } catch (err) {
        if (thinkStep) await this.failStep(thinkStep, String(err));
        throw err;
      }
      if (thinkStep) await this.completeStep(thinkStep);

      if (response.toolCalls.length === 0) {
        const assistantMsg = createAssistantMessage(response.content);
        await historyManager.pushAndPersistMessage(assistantMsg);
        eventBus.emit(AuraEventType.MessageReceived, {
          message: assistantMsg,
        });
        this.callbacks.onMessagePushed();
        eventBus.emit(AuraEventType.AgentLoopCompleted, {
          conversationId: historyManager.getConversation().id,
          stats: {
            iterations: iteration,
            durationMs: Date.now() - loopStart,
          },
        });
        return;
      }

      const assistantMsg = createAssistantMessageWithToolCalls(response);
      await historyManager.pushAndPersistMessage(assistantMsg);
      this.callbacks.onMessagePushed();

      let shouldContinue = true;
      for (const toolCall of response.toolCalls) {
        this.checkAborted(signal);

        if (
          toolCall.id === SKILL_SELECT_TOOL_NAME ||
          toolCall.id === SKILL_SWITCH_TOOL_NAME
        ) {
          const toolArgs = toolCall.arguments as Record<string, unknown>;
          const skillName = String(
            toolArgs.skillName ?? toolArgs.skill_name ?? "none",
          );
          this.activeSkill =
            skillName === "none"
              ? null
              : (skillManager.getSkill(skillName) ?? null);
          eventBus.emit(AuraEventType.SkillSelected, {
            skillName: skillName === "none" ? null : skillName,
          });
          const step = await this.emitStep(
            iteration,
            "skill-select",
            `Selected skill "${skillName}"`,
          );
          await this.completeStep(step);

          const resultMsg = createToolResultMessage(
            toolCall,
            `Skill "${skillName}" activated.`,
          );
          await historyManager.pushAndPersistMessage(resultMsg);
          this.callbacks.onMessagePushed();
          continue;
        }

        if (toolCall.id === ASK_USER_TOOL_NAME) {
          const question = extractAskUserQuestion(
            toolCall.arguments as Record<string, unknown>,
          );
          let askStep: AgentStep | null = null;
          askStep = await this.emitStep(
            iteration,
            "ask-user",
            question,
            toolCall,
          );
          await this.updateStep(askStep, {
            status: "waiting",
            userInputQuestion: question,
          });

          const hitlResult = askStep
            ? await this.callbacks.requestHumanInTheLoop(askStep)
            : { text: "" };

          if (hitlResult.timedOut) {
            if (askStep) {
              askStep.status = "timed-out";
              askStep.summary = "Timed out waiting for user response";
              askStep.durationMs = Date.now() - askStep.timestamp;
              await this.updateIterationMessage(askStep);
              this.callbacks.onStepUpdate({ ...askStep });
            }
            const timeoutMsg = createToolResultMessage(
              toolCall,
              JSON.stringify({
                timedOut: true,
                message:
                  "The request timed out while waiting for user input. " +
                  "Please try again when you are back.",
              }),
            );
            await historyManager.pushAndPersistMessage(timeoutMsg);
            this.callbacks.onMessagePushed();

            shouldContinue = false;
            break;
          }

          const answer = hitlResult.text ?? "";
          if (askStep) {
            await this.completeStep(askStep, answer);
            const userId =
              config.identity.appMetadata?.userId ?? "unknown";
            const timestamp = new Date().toLocaleString();
            await this.updateStep(askStep, {
              summary: `User ${userId} replied at ${timestamp}`,
            });
          }

          const toolResultMsg = createToolResultMessage(toolCall, answer);
          await historyManager.pushAndPersistMessage(toolResultMsg);
          this.callbacks.onMessagePushed();
          continue;
        }

        const tool = skillManager.getTool(toolCall.id);
        if (!tool) {
          const errorResult = createToolResultMessage(
            toolCall,
            JSON.stringify({
              error: `Tool "${toolCall.id}" is not registered.`,
            }),
          );
          await historyManager.pushAndPersistMessage(errorResult);
          this.callbacks.onMessagePushed();
          continue;
        }

        const toolStep = await this.emitStep(
          iteration,
          "tool-call",
          `Calling ${tool.name}...`,
          toolCall,
        );

        if (needsConfirmation(tool)) {
          const pendingAction = await buildPendingAction(tool, toolCall);
          if (toolStep) {
            await this.updateStep(toolStep, {
              status: "waiting",
              type: "approval",
              summary: `Awaiting approval for ${tool.name}`,
              pendingAction,
            });
          }

          const hitlResult = toolStep
            ? await this.callbacks.requestHumanInTheLoop(toolStep)
            : { approved: true };

          if (hitlResult.timedOut) {
            if (toolStep?.pendingAction) {
              toolStep.pendingAction = {
                ...toolStep.pendingAction,
                status: "timed-out",
              };
            }
            if (toolStep) {
              toolStep.status = "timed-out";
              toolStep.summary = `Timed out waiting for approval of ${tool.name}`;
              toolStep.durationMs = Date.now() - toolStep.timestamp;
              await this.updateIterationMessage(toolStep);
              this.callbacks.onStepUpdate({ ...toolStep });
            }
            const timeoutResult = createToolResultMessage(
              toolCall,
              JSON.stringify({
                timedOut: true,
                message: `Confirmation for "${tool.name}" timed out. Please try again when you are back.`,
              }),
            );
            await historyManager.pushAndPersistMessage(timeoutResult);
            this.callbacks.onMessagePushed();
            shouldContinue = false;
            break;
          }

          const approved = hitlResult.approved ?? true;

          if (toolStep?.pendingAction) {
            toolStep.pendingAction = {
              ...toolStep.pendingAction,
              status: approved ? "executing" : "rejected",
            };
          }

          if (!approved) {
            const rejResult = createToolResultMessage(
              toolCall,
              JSON.stringify({
                rejected: true,
                message: `User rejected "${tool.name}".`,
              }),
            );
            await historyManager.pushAndPersistMessage(rejResult);
            this.callbacks.onMessagePushed();
            if (toolStep) {
              const userId =
                config.identity.appMetadata?.userId ?? "unknown";
              const timestamp = new Date().toLocaleString();
              toolStep.status = "rejected";
              toolStep.summary = `Skip ${tool.name} - rejected by ${userId} at ${timestamp}`;
              toolStep.durationMs = Date.now() - toolStep.timestamp;
              toolStep.detail = `User "${userId}" rejected "${tool.name}" at ${timestamp}`;
              await this.updateIterationMessage(toolStep);
              this.callbacks.onStepUpdate({ ...toolStep });
            }
            continue;
          }
        }

        if (toolStep) {
          const userId = config.identity.appMetadata?.userId ?? "unknown";
          const timestamp = new Date().toLocaleString();
          await this.updateStep(toolStep, {
            status: "running",
            summary: `Executing ${tool.name} - approved by ${userId} at ${timestamp}`,
          });
        }

        const ctx = buildToolContext(config, historyManager, resources);
        const result = await toolRunner.execute(toolCall, ctx);
        eventBus.emit(AuraEventType.ToolCalled, {
          entry: result.logEntry,
        });

        if (toolStep) {
          if (!result.logEntry?.error) {
            const userId =
              config.identity.appMetadata?.userId ?? "unknown";
            const approvedAt = toolStep.pendingAction
              ? ` - approved by ${userId} at ${new Date().toLocaleString()}`
              : "";
            await this.updateStep(toolStep, {
              summary: `Executed ${tool.name}${approvedAt}`,
            });
          } else {
            await this.failStep(
              toolStep,
              `Error: ${String(result.logEntry?.error ?? "Unknown error")}`,
            );
          }
        }

        const modelText = contentToModelText(result.content);
        const toolResultMsg = createToolResultMessage(
          toolCall,
          modelText,
          result.content,
        );
        await historyManager.pushAndPersistMessage(toolResultMsg);
        this.callbacks.onMessagePushed();
        if (toolStep) await this.completeStep(toolStep, modelText);
      }

      if (!shouldContinue) {
        if (this.currentIterationMsg) {
          await this.historyManager.persistExistingMessage(
            this.currentIterationMsg.id,
          );
        }
        this.currentIterationMsg = null;
        const timeoutMsg = createAssistantMessage(
          "This action was cancelled as no response was received in time. " +
          "Please try again when you're ready.",
        );
        await historyManager.pushAndPersistMessage(timeoutMsg);
        eventBus.emit(AuraEventType.MessageReceived, {
          message: timeoutMsg,
        });
        this.callbacks.onMessagePushed();
        eventBus.emit(AuraEventType.AgentLoopCompleted, {
          conversationId: historyManager.getConversation().id,
          stats: {
            iterations: iteration,
            durationMs: Date.now() - loopStart,
          },
        });
        return;
      }

      if (this.currentIterationMsg) {
        await this.historyManager.persistExistingMessage(
          this.currentIterationMsg.id,
        );
      }
      this.currentIterationMsg = null;
    }

    const limitMsg = createAssistantMessage(
      "I've reached the maximum number of reasoning steps. " +
      "Here's what I've accomplished so far - please let me know " +
      "if you'd like me to continue.",
    );
    await historyManager.pushAndPersistMessage(limitMsg);
    eventBus.emit(AuraEventType.MessageReceived, { message: limitMsg });
    this.callbacks.onMessagePushed();
    eventBus.emit(AuraEventType.AgentLoopCompleted, {
      conversationId: historyManager.getConversation().id,
      stats: { iterations: maxIter, durationMs: Date.now() - loopStart },
    });
  }

  cancel(): void {
    this.abortController?.abort();
  }

  reset(): void {
    this.activeSkill = null;
    this.currentIterationMsg = null;
    this.cancel();
  }

  private resolveToolSet(
    resourceContents?: Array<{
      uri: string;
      name: string;
      description?: string;
      text: string;
    }>,
  ): {
    tools: ToolDefinition[];
    systemPromptArgs: SystemPromptArgs;
  } {
    const { skillManager, config } = this;
    const allSkills = skillManager.getAllSkills();
    const askUserTool = buildAskUserToolDef();

    if (this.activeSkill) {
      const skillTools = skillManager.getToolDefinitionsForSkill(
        this.activeSkill.name,
      );
      const switchTool = buildSkillSwitchToolDef(
        allSkills.map((s) => s.name),
      );
      return {
        tools: [...skillTools, switchTool, askUserTool],
        systemPromptArgs: {
          appSystemPrompt: config.agent?.appSystemPrompt,
          resourceContents,
          activeSkill: this.activeSkill,
          additionalSafetyInstructions:
            config.agent?.additionalSafetyInstructions,
        },
      };
    }

    if (allSkills.length > 0) {
      const selectTool = buildSkillSelectToolDef(
        allSkills.map((s) => s.name),
      );
      return {
        tools: [selectTool, askUserTool],
        systemPromptArgs: {
          appSystemPrompt: config.agent?.appSystemPrompt,
          resourceContents,
          skills: skillManager.getSkillsSummary(),
          additionalSafetyInstructions:
            config.agent?.additionalSafetyInstructions,
        },
      };
    }

    return {
      tools: [...skillManager.getActiveToolDefinitions(), askUserTool],
      systemPromptArgs: {
        appSystemPrompt: config.agent?.appSystemPrompt,
        resourceContents,
        additionalSafetyInstructions:
          config.agent?.additionalSafetyInstructions,
      },
    };
  }

  private buildProviderMessages(systemPrompt: string): ProviderMessage[] {
    const msgs: ProviderMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    for (const m of this.historyManager.getMessages()) {
      if (m.metadata?.["isIteration"]) continue;

      const pm: ProviderMessage = {
        role: m.role as ProviderMessage["role"],
        content: m.content,
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        pm.toolCalls = m.toolCalls;
      }
      if (m.toolCallId) {
        pm.toolCallId = m.toolCallId;
        pm.name =
          (m.metadata?.["toolId"] as string | undefined) ?? undefined;
      }
      msgs.push(pm);
    }
    return msgs;
  }

  private async callProvider(
    messages: ProviderMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
  ): Promise<ProviderResponse> {
    const { providerManager, config } = this;
    const useStreaming =
      config.agent?.enableStreaming && providerManager.supportsStreaming();

    const request = {
      messages,
      tools: tools.length > 0 ? tools : undefined,
    };
    if (useStreaming) {
      return this.streamProvider(request, signal);
    }

    return providerManager.sendMessages(request);
  }

  private async streamProvider(
    request: { messages: ProviderMessage[]; tools?: ToolDefinition[] },
    signal: AbortSignal,
  ): Promise<ProviderResponse> {
    const { providerManager } = this;
    let fullContent = "";
    const toolCallsMap = new Map<
      number,
      { callId: string; id: string; arguments: string }
    >();

    const stream = providerManager.streamMessages(request);
    for await (const chunk of stream) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (chunk.contentDelta) {
        fullContent += chunk.contentDelta;
        this.callbacks.onStreamDelta(chunk.contentDelta);
      }
      if (chunk.toolCallDeltas) {
        for (let i = 0; i < chunk.toolCallDeltas.length; i++) {
          const delta = chunk.toolCallDeltas[i];
          if (!delta) continue;
          const existing = toolCallsMap.get(i);
          if (existing) {
            if (delta.arguments) {
              const argStr =
                typeof delta.arguments === "string"
                  ? delta.arguments
                  : JSON.stringify(delta.arguments);
              existing.arguments += argStr;
            }
          } else {
            toolCallsMap.set(i, {
              callId: delta.callId ?? `call_${Date.now()}_${i}`,
              id: delta.id ?? "",
              arguments:
                typeof delta.arguments === "string"
                  ? delta.arguments
                  : delta.arguments
                    ? JSON.stringify(delta.arguments)
                    : "",
            });
          }
        }
      }
      if (chunk.tool_calls?.length) {
        for (let i = 0; i < chunk.tool_calls.length; i++) {
          const toolCall = chunk.tool_calls[i];
          toolCallsMap.set(i, {
            callId: toolCall.callId,
            id: toolCall.id,
            arguments: JSON.stringify(toolCall.arguments ?? {}),
          });
        }
      }
    }

    const toolCalls: ToolCallRequest[] = [];
    for (const [, tc] of toolCallsMap) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {};
      } catch {
        parsedArgs = { _raw: tc.arguments };
      }
      toolCalls.push({
        callId: tc.callId,
        id: tc.id,
        arguments: parsedArgs,
      });
    }
    return {
      content: fullContent || null,
      toolCalls,
    };
  }

  private async updateIterationMessage(step: AgentStep): Promise<void> {
    if (!this.currentIterationMsg?.metadata) return;
    const steps = this.currentIterationMsg.metadata[
      "agentSteps"
    ] as AgentStep[];
    const nextStep: AgentStep = {
      ...step,
      pendingAction: step.pendingAction
        ? { ...step.pendingAction }
        : undefined,
      toolArgs: step.toolArgs ? { ...step.toolArgs } : undefined,
    };
    const existingIndex = steps.findIndex((s) => s.id === step.id);
    if (existingIndex >= 0) {
      steps[existingIndex] = nextStep;
    } else {
      steps.push(nextStep);
    }
    const newMetadata = {
      ...this.currentIterationMsg.metadata,
      agentSteps: [...(steps ?? [])],
    };
    this.currentIterationMsg.metadata = newMetadata;
    this.historyManager?.replaceMessage(this.currentIterationMsg.id, {
      metadata: newMetadata,
    });
  }

  private async emitStep(
    iteration: number,
    type: AgentStepKindType,
    summary: string,
    toolCall?: ToolCallRequest,
  ): Promise<AgentStep> {
    const step: AgentStep = {
      id: nextStepId(),
      iteration,
      type,
      summary,
      status: "running",
      timestamp: Date.now(),
      toolName: toolCall?.id,
      toolArgs: toolCall?.arguments,
    };
    await this.updateIterationMessage(step);
    this.callbacks.onStepStart(step);
    this.eventBus.emit(AuraEventType.AgentStepStarted, { step });
    return step;
  }

  private async updateStep(
    step: AgentStep,
    updates: Partial<
      Pick<
        AgentStep,
        | "status"
        | "summary"
        | "type"
        | "detail"
        | "pendingAction"
        | "userInputQuestion"
      >
    >,
  ): Promise<void> {
    Object.assign(step, updates);
    await this.updateIterationMessage(step);
    this.callbacks.onStepUpdate({ ...step });
  }

  private async completeStep(
    step: AgentStep,
    result?: string,
  ): Promise<void> {
    step.status = "complete";
    step.durationMs = Date.now() - step.timestamp;
    if (result !== undefined) step.toolResult = result;
    if (step.pendingAction) {
      step.pendingAction = { ...step.pendingAction, status: "completed" };
    }
    await this.updateIterationMessage(step);
    this.callbacks.onStepUpdate({ ...step });
    this.eventBus.emit(AuraEventType.AgentStepCompleted, { step });
  }

  private async failStep(
    step: AgentStep,
    error: string,
  ): Promise<void> {
    step.status = "error";
    step.durationMs = Date.now() - step.timestamp;
    step.detail = error;
    if (step.pendingAction) {
      step.pendingAction = { ...step.pendingAction, status: "failed" };
    }
    await this.updateIterationMessage(step);
    this.callbacks.onStepUpdate({ ...step });
    this.eventBus.emit(AuraEventType.AgentStepCompleted, { step });
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
  }
}
