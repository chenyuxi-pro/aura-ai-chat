import "./components/aura-chat/aura-chat.js";
import "./components/aura-event-monitor/aura-event-monitor.js";

export type {
  AuraConfig,
  AuraIdentityConfig,
  AuraAppearanceConfig,
  AuraAgentConfig,
  AgentConfig,
  AppMetadata,
  AIProvider,
  ProviderConfig,
  BuiltInProviderConfig,
  CustomProviderConfig,
  ProviderOptions,
  ProviderMessage,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ToolDefinition,
  ToolCallRequest,
  Skill,
  AuraTool,
  ToolExecutionContext,
  AuraToolResult,
  ToolResultContent,
  TextContent,
  ImageContent,
  AudioContent,
  EmbeddedResource,
  CustomElementContent,
  ContentAnnotations,
  TextResourceContents,
  BlobResourceContents,
  ToolAnnotations,
  AuraToolRiskType,
  AuraResource,
  ChatMessage,
  Conversation,
  IConversationManager,
  ToolCallLogEntry,
  AuraEvent,
  SuggestedPrompt,
  RichContent,
  MessageRoleType,
  Attachment,
  ModelInfo,
  ActionStatusType,
  PendingAction,
  AgentStep,
  AgentStepKindType,
  AgentStepStatusType,
} from "./types/index.js";

export {
  needsConfirmation,
  auraToMcpAnnotations,
  AuraEventType,
  AuraToolRisk,
  ActionStatus,
  AgentStepKind,
  AgentStepStatus,
  MessageRole,
} from "./types/index.js";

export { AuraChat } from "./components/aura-chat/aura-chat.js";
export { AuraMessagesElement } from "./components/aura-messages/aura-messages.js";
export { SuggestedPromptsElement } from "./components/suggested-prompts/suggested-prompts.js";
export { ConfirmationBubbleElement } from "./components/confirmation-bubble/confirmation-bubble.js";
export { FileAttachmentElement } from "./components/file-attachment/file-attachment.js";
export { ActionPreviewElement } from "./components/aura-action-preview/aura-action-preview.js";
export { AuraResultViewElement } from "./components/aura-result-view/aura-result-view.js";
export { AuraAgentIterationElement } from "./components/aura-agent-iteration/aura-agent-iteration.js";
export { AuraAgentStepElement } from "./components/aura-agent-step/aura-agent-step.js";
export { AuraEventMonitorElement } from "./components/aura-event-monitor/aura-event-monitor.js";

export { SkillRegistry } from "./services/skill-registry.js";
export {
  ToolDispatcher,
  contentToModelText,
} from "./services/tool-dispatcher.js";
export { ProviderManager } from "./services/provider-manager.js";
export { CommunicationManager } from "./services/communication-manager.js";
export type { OrchestratorCallbacks } from "./services/communication-manager.js";
export {
  WebMcpBridge,
  ToolExporter,
  ToolImporter,
  supportsWebMcp,
} from "./services/webmcp-bridge.js";

export {
  buildSystemPrompt,
  buildSkillSelectToolDef,
  buildSkillSwitchToolDef,
  buildAskUserToolDef,
  DEFAULT_MASTER_SYSTEM_PROMPT,
  SKILL_SELECT_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  SKILL_SWITCH_TOOL_NAME,
} from "./services/prompt-builder.js";

export {
  estimateTokens,
  estimateMessagesTokens,
  trimToTokenBudget,
} from "./services/tokenBudget.js";

export {
  createProviders,
  getProviderById,
  BaseProvider,
  GitHubCopilotProvider,
} from "./providers/index.js";

export type {
  CopilotLoginStatus,
  DeviceFlowInfo,
  GitHubCopilotProviderConfig,
} from "./providers/index.js";

export { EventBus, AUDIT_EVENT_NAME } from "./services/event-bus.js";

export type { AuraTheme } from "./themes/index.js";
export {
  lightTheme,
  darkTheme,
  professionalLightTheme,
} from "./themes/index.js";
