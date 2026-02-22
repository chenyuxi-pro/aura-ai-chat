import type { AuraTheme } from "../themes/index.js";

export interface AppMetadata {
  appId: string;
  teamId: string;
  tenantId?: string;
  userId?: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  icon?: string;
  description?: string;
}

export interface ProviderOptions extends Record<string, unknown> {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
  apiKey?: string;
  authToken?: string | (() => Promise<string>);
  signal?: AbortSignal;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  tool_call_id?: string;
  name?: string;
  toolCalls?: ToolCallRequest[];
  tool_calls?: ToolCallRequest[];
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  type?: "function";
  function?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  annotations?: ToolAnnotations;
}

export interface ToolCallRequest {
  id: string;
  callId: string;
  arguments: Record<string, unknown>;
}

export interface ProviderRequest {
  modelId?: string;
  messages: ProviderMessage[];
  tools?: ToolDefinition[];
  options?: ProviderOptions;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderResponse {
  content: string | null;
  toolCalls: ToolCallRequest[];
  usage?: TokenUsage;
  meta?: Record<string, unknown>;
}

export interface ProviderResponseChunk {
  delta?: string;
  contentDelta?: string;
  tool_calls?: ToolCallRequest[];
  toolCallDeltas?: Partial<ToolCallRequest>[];
  done?: boolean;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly type?: string;
  readonly name?: string;
  configure(config: ProviderOptions): void;
  getConfig(): ProviderOptions;
  listModels(options?: ProviderOptions): Promise<ModelInfo[]>;
  sendMessages(request: ProviderRequest): Promise<ProviderResponse>;
  streamMessages?(
    request: ProviderRequest,
    options?: ProviderOptions,
  ): AsyncIterable<ProviderResponseChunk>;
}

export interface BuiltInProviderConfig {
  type: "built-in";
  id: string;
  config?: ProviderOptions;
}

export interface CustomProviderConfig {
  type: "custom";
  id: string;
  config: AIProvider;
}

export type ProviderConfig = BuiltInProviderConfig | CustomProviderConfig;

export interface ContentAnnotations {
  audience?: Array<"user" | "assistant">;
  priority?: number;
  [key: string]: unknown;
}

export interface TextContent {
  type: "text";
  text: string;
  annotations?: ContentAnnotations;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
  annotations?: ContentAnnotations;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
  annotations?: ContentAnnotations;
}

export interface TextResourceContents {
  uri: string;
  mimeType?: string;
  text: string;
}

export interface BlobResourceContents {
  uri: string;
  mimeType?: string;
  blob: string;
}

export interface EmbeddedResource {
  type: "resource";
  resource: TextResourceContents | BlobResourceContents;
  annotations?: ContentAnnotations;
}

export interface JsonContent {
  type: "json";
  data: unknown;
  label?: string;
  annotations?: ContentAnnotations;
}

export interface CustomElementContent {
  type: "custom-element";
  element: string;
  props: Record<string, unknown>;
  annotations?: ContentAnnotations;
}

export type ToolResultContent =
  | TextContent
  | ImageContent
  | AudioContent
  | EmbeddedResource
  | JsonContent
  | CustomElementContent;

export interface AuraToolResult {
  content: ToolResultContent[];
  structuredContent?: Record<string, unknown>;
  logEntry?: ToolCallLogEntry;
  isError?: boolean;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export const AuraToolRisk = {
  Safe: "safe",
  Moderate: "moderate",
  Destructive: "destructive",
} as const;

export type AuraToolRiskType = (typeof AuraToolRisk)[keyof typeof AuraToolRisk];

export interface AuraResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  read(): Promise<TextResourceContents | BlobResourceContents>;
}

export interface ToolExecutionContext {
  conversationId: string;
  userId?: string;
  appMetadata: AppMetadata;
  resources?: AuraResource[];
}

export interface AuraTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ) => Promise<AuraToolResult>;
  title?: string;
  risk?: AuraToolRiskType;
  timeout?: number;
  preview?: {
    buildContent: (
      args: Record<string, unknown>,
    ) => Promise<ToolResultContent[]>;
  };
}

export const ActionStatus = {
  Pending: "pending",
  Executing: "executing",
  Completed: "completed",
  Failed: "failed",
  Rejected: "rejected",
  TimedOut: "timed-out",
} as const;

export type ActionStatusType = (typeof ActionStatus)[keyof typeof ActionStatus];

export interface PendingAction {
  id: string;
  toolCall: ToolCallRequest;
  toolName: string;
  toolDisplayName?: string;
  title?: string;
  risk?: AuraToolRiskType;
  status: ActionStatusType;
  previewContent?: ToolResultContent[];
  description: string;
  error?: string;
  type?: "tool_call";
}

export interface Skill {
  name: string;
  description: string;
  instructions?: string;
  tools: string[];
  metadata?: Record<string, unknown>;
}

export const AgentStepKind = {
  Thinking: "thinking",
  SkillSelect: "skill-select",
  ToolCall: "tool-call",
  ToolResult: "tool-result",
  AskUser: "ask-user",
  Approval: "approval",
  Response: "response",
} as const;

export type AgentStepKindType =
  (typeof AgentStepKind)[keyof typeof AgentStepKind];

export const AgentStepStatus = {
  Running: "running",
  Complete: "complete",
  Success: "success",
  Error: "error",
  Waiting: "waiting",
  Rejected: "rejected",
  TimedOut: "timed-out",
} as const;

export type AgentStepStatusType =
  (typeof AgentStepStatus)[keyof typeof AgentStepStatus];

export interface AgentStep {
  id: string;
  iteration?: number;
  type?: AgentStepKindType;
  kind?: AgentStepKindType;
  summary: string;
  detail?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  status: AgentStepStatusType;
  timestamp: number;
  durationMs?: number;
  pendingAction?: PendingAction;
  userInputQuestion?: string;
  error?: string;
  result?: unknown;
  toolCall?: ToolCallRequest;
}

export const MessageRole = {
  User: "user",
  Assistant: "assistant",
  System: "system",
  Tool: "tool",
} as const;

export type MessageRoleType = (typeof MessageRole)[keyof typeof MessageRole];

export interface Attachment {
  id: string;
  fileName?: string;
  name?: string;
  mimeType?: string;
  type?: string;
  size: number;
  url?: string;
  data?: string;
  file?: File;
}

export interface ChatMessage {
  id: string;
  role: MessageRoleType;
  content: string;
  timestamp: number;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  title?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuraChatHistorySummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  messageCount: number;
}

export interface ToolCallLogEntry {
  callId: string;
  conversationId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
  timestamp: number;
  userId?: string;
  appMetadata: AppMetadata;
}

export interface IConversationManager {
  createConversation?(conversation: Conversation): Promise<Conversation>;
  getConversation?(id: string): Promise<Conversation | undefined>;
  loadConversation?(conversationId: string): Promise<Conversation | null>;
  loadConversationByContext?(contextId: string): Promise<Conversation | null>;
  listConversations?(): Promise<Conversation[]>;
  saveMessage(
    conversationId: string,
    message: ChatMessage,
  ): Promise<void> | Promise<unknown>;
  deleteConversation?(conversationId: string): Promise<void>;
  clearHistory?(): Promise<void>;
  saveToolCall?(entry: ToolCallLogEntry): Promise<void>;
}

export type ConversationManager = IConversationManager;

export enum AuraEventType {
  ConversationStarted = "conversation-started",
  ConversationEnded = "conversation-ended",
  ConversationDeleted = "conversation-deleted",
  HistoryCleared = "history-cleared",
  MessageSent = "message-sent",
  MessageReceived = "message-received",
  ToolCalled = "tool-called",
  ToolStart = "tool-start",
  ToolSuccess = "tool-success",
  ToolError = "tool-error",
  SkillSelected = "skill-selected",
  AgentLoopStarted = "agent-loop-started",
  AgentLoopCompleted = "agent-loop-completed",
  AgentStepStarted = "agent-step-started",
  AgentStepCompleted = "agent-step-completed",
  Debug = "debug",
  Error = "error",
  MESSAGE_SENT = "message-sent",
  MESSAGE_RECEIVED = "message-received",
  CONVERSATION_STARTED = "conversation-started",
  CONVERSATION_DELETED = "conversation-deleted",
  HISTORY_CLEARED = "history-cleared",
  ERROR = "error",
}

export interface AuraEvent {
  type: AuraEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  event?: Record<string, unknown>;
}

export interface SuggestedPrompt {
  title: string;
  description?: string;
  promptText: string;
  icon?: string;
}

export type RichContent = string;

export interface AuraAgentConfig {
  appSystemPrompt?: string;
  resources?: AuraResource[];
  skills?: Skill[];
  tools?: AuraTool[];
  conversationManager?: IConversationManager;
  conversationId?: string;
  maxContextTokens?: number;
  enableStreaming?: boolean;
  additionalSafetyInstructions?: string;
  maxIterations?: number;
  showThinkingProcess?: boolean;
  toolTimeout?: number;
  confirmationTimeoutMs?: number;
  enableWebMcp?: boolean;
}

export type AgentConfig = AuraAgentConfig & {
  providerConfigs?: ProviderConfig[];
};

export interface AuraIdentityConfig {
  appMetadata: AppMetadata;
  aiName?: string;
}

export interface AuraAppearanceConfig {
  headerTitle?: string;
  headerIcon?: string;
  welcomeMessageTitle?: string;
  welcomeMessage?: string | RichContent;
  suggestedPrompts?: SuggestedPrompt[];
  inputPlaceholder?: string;
  loadingMessage?: string;
  errorMessage?: string;
  retryLabel?: string;
  enableAttachments?: boolean;
  maxAttachmentSize?: number;
  allowedAttachmentTypes?: string[];
  theme?: AuraTheme;
  primaryColor?: string;
  fontFamily?: string;
}

export type SettingsFieldId =
  | "appId"
  | "teamId"
  | "tenantId"
  | "userId"
  | "aiName"
  | "headerTitle"
  | "headerIcon"
  | "welcomeTitle"
  | "welcomeMessage"
  | "inputPlaceholder"
  | "enableStreaming"
  | "enableAttachments"
  | "maxAttachmentSize"
  | "copilotRemember"
  | "systemPrompt"
  | "safetyInstructions"
  | "maxContextTokens"
  | "enableTools"
  | "loadingMessage"
  | "errorMessage"
  | "retryLabel"
  | "maxIterations"
  | "showThinkingProcess"
  | "toolTimeout"
  | "confirmationTimeoutMs"
  | "enableWebMcp"
  | "theme";

export interface SettingsModalConfig {
  readonly: boolean;
  editableFields?: SettingsFieldId[];
}

export interface AuraConfig {
  identity: AuraIdentityConfig;
  appearance?: AuraAppearanceConfig;
  providers?: ProviderConfig[];
  agent?: AuraAgentConfig;
  history?: {
    manager?: IConversationManager;
  };
  onAuraEvent?: (event: AuraEvent) => void;
  settingsModalConfig?: SettingsModalConfig;
}

export function auraToMcpAnnotations(
  tool?: Pick<AuraTool, "title" | "risk">,
): ToolAnnotations | undefined {
  if (!tool) return undefined;

  const base: ToolAnnotations = {};
  if (tool.title) base.title = tool.title;

  switch (tool.risk) {
    case "safe":
      base.readOnlyHint = true;
      base.destructiveHint = false;
      base.idempotentHint = true;
      base.openWorldHint = false;
      break;
    case "moderate":
      base.readOnlyHint = false;
      base.destructiveHint = false;
      base.idempotentHint = false;
      base.openWorldHint = false;
      break;
    case "destructive":
      base.readOnlyHint = false;
      base.destructiveHint = true;
      base.idempotentHint = false;
      base.openWorldHint = false;
      break;
    default:
      break;
  }

  return base;
}

export function needsConfirmation(
  tool?: Pick<AuraTool, "title" | "risk">,
): boolean {
  if (!tool?.risk) return false;
  return tool.risk !== "safe";
}

export function auraToolToMcpToolDefinition(
  tool: Pick<AuraTool, "name" | "description" | "inputSchema" | "title" | "risk">,
): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
    annotations: auraToMcpAnnotations(tool),
  };
}
