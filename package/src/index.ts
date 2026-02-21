/* ──────────────────────────────────────────────────────────────────
 *  aura-ai-chat — Library Entry Point
 *  Exports all public types and the <aura-chat> custom element.
 * ────────────────────────────────────────────────────────────────── */

// Components
export { AuraChat } from './components/aura-chat/aura-chat.js';
export { AuraHeader } from './components/aura-header/aura-header.js';
export { AuraMessages } from './components/aura-messages/aura-messages.js';
export { AuraInput } from './components/aura-input/aura-input.js';
export { AuraSettings } from './components/aura-settings/aura-settings.js';
export { AuraHistory } from './components/aura-history/aura-history.js';

// Types — re-export everything
export type {
    JSONSchemaType,
    JSONSchema,
    TextContent,
    ImageContent,
    EmbeddedResource,
    ToolResultContent,
    ToolResult,
    Tool,
    ToolSummary,
    Skill,
    SkillSummary,
    AIModel,
    AIRequest,
    AIStreamChunk,
    AIProvider,
    BuiltInProviderConfig,
    CustomProviderConfig,
    AIProviderConfig,
    ConversationMeta,
    Message,
    CustomMessageComponent,
    ConversationHistoryProvider,
    AuraEventType,
    AuraEvent,
    SettingsRule,
    SettingsControl,
    UIConfig,
    AIBehaviorConfig,
    IdentityConfig,
    HeaderConfig,
    WelcomeConfig,
    SuggestedPrompt,
    AuraConfig,
} from './types/index.js';

// Utility functions
export {
    getToolDisplayName,
    getSkillDisplayName,
    isExcluded,
} from './types/index.js';

// Providers — for direct usage or extension
export { BaseProvider } from './providers/base-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { OllamaProvider } from './providers/ollama-provider.js';
export { GitHubCopilotProvider } from './providers/github-copilot-provider.js';
export type { CopilotLoginStatus, DeviceFlowInfo } from './providers/github-copilot-provider.js';

// Infrastructure — advanced usage
export { store } from './store/aura-store.js';
export { promptBuilder } from './prompt/prompt-builder.js';
export { skillRegistry } from './skills/skill-registry.js';
export { toolRegistry } from './tools/tool-registry.js';
