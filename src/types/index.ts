/* ──────────────────────────────────────────────────────────────────
 *  aura-ai-chat — Shared TypeScript Types
 *  All types exported from the library's public API surface.
 * ────────────────────────────────────────────────────────────────── */

// ── JSON Schema (MCP-aligned) ────────────────────────────────────

export type JSONSchemaType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'object'
    | 'array'
    | 'null';

export interface JSONSchema {
    type?: JSONSchemaType | JSONSchemaType[];
    description?: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    items?: JSONSchema;
    enum?: unknown[];
    default?: unknown;
    anyOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    $ref?: string;
    [key: string]: unknown;
}

// ── Tool Result Content Blocks (MCP-aligned) ─────────────────────

export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    data: string;
    mimeType: string;
}

export interface EmbeddedResource {
    type: 'resource';
    resource: {
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
}

export type ToolResultContent = TextContent | ImageContent | EmbeddedResource;

export interface ToolResult {
    content: ToolResultContent[];
    isError?: boolean;
}

// ── Tool (MCP-aligned) ───────────────────────────────────────────

export interface Tool {
    name: string;
    title?: string;
    description: string;
    inputSchema: JSONSchema;
    enabled?: boolean;
    execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolSummary {
    name: string;
    title?: string;
    description: string;
}

export function getToolDisplayName(tool: Tool | ToolSummary): string {
    return tool.title ?? tool.name;
}

// ── Skill ────────────────────────────────────────────────────────

export interface Skill {
    name: string;
    title?: string;
    description: string;
    systemPrompt: string;
    tools?: Tool[];
    enabled?: boolean;
    icon?: string;
    category?: string;
    version?: string;
}

export interface SkillSummary {
    name: string;
    title?: string;
    description: string;
}

export function getSkillDisplayName(skill: Skill | SkillSummary): string {
    return skill.title ?? skill.name;
}

// ── AI Provider ──────────────────────────────────────────────────

export interface AIModel {
    id: string;
    name: string;
    description?: string;
}

export interface AIRequest {
    systemPrompt: string;
    messages: Message[];
    model: string;
    parameters: Record<string, unknown>;
}

export interface AIStreamChunk {
    delta: string;
    done: boolean;
}

export interface AIProvider {
    readonly id: string;
    readonly name: string;
    readonly icon?: string;

    isAuthenticated(): Promise<boolean>;
    authenticate(rememberToken: boolean): Promise<void | any>;
    onAuthComplete(): void;
    logout(): void;

    getAvailableModels(): Promise<AIModel[]>;
    sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>>;
    cancelRequest(): void;
}

// ── AI Provider Config (Discriminated Union) ────────────────────

export interface BuiltInProviderConfig {
    type: 'built-in';
    providerId: 'openai' | 'anthropic' | 'ollama' | 'github-copilot';
    apiKey?: string;
    authEndpoint?: string;
    rememberToken?: boolean;
    baseUrl?: string;
    defaultModel?: string;
    defaultParameters?: Record<string, unknown>;
    displayName?: string;
    icon?: string;
}

export interface CustomProviderConfig {
    type: 'custom';
    instance: AIProvider;
    displayName?: string;
    icon?: string;
}

export type AIProviderConfig = BuiltInProviderConfig | CustomProviderConfig;

// ── Conversation & Message ───────────────────────────────────────

export interface ConversationMeta {
    id: string;
    title?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

// ── Custom Message Components ────────────────────────────────────

export interface CustomMessageComponent {
    tag: string;
    schema: JSONSchema;
    description: string;
}

// ── Conversation History Provider ────────────────────────────────

export interface ConversationHistoryProvider {
    createConversation(): Promise<ConversationMeta>;
    listConversations(): Promise<ConversationMeta[]>;
    getMessages(conversationId: string): Promise<Message[]>;
    saveMessage(conversationId: string, message: Message): Promise<void>;
    deleteConversation?(conversationId: string): Promise<void>;
    updateConversation?(conversationId: string, patch: Partial<ConversationMeta>): Promise<void>;
}

// ── Events ───────────────────────────────────────────────────────

export type AuraEventType =
    | 'user:message'
    | 'ai:message'
    | 'ai:stream:start'
    | 'ai:stream:end'
    | 'ai:stream:cancel'
    | 'skill:activated'
    | 'tool:invoked'
    | 'tool:result'
    | 'auth:required'
    | 'auth:complete'
    | 'conversation:new'
    | 'conversation:switched'
    | 'error'
    | 'debug';

export interface AuraEvent {
    type: AuraEventType;
    timestamp: string;
    payload?: unknown;
}

// ── Settings UI Config ───────────────────────────────────────────

export interface SettingsRule {
    all: boolean;
    exclusions?: string[];
}

export interface SettingsControl {
    readonly?: SettingsRule;
    visibility?: SettingsRule;
}

export type AuraTheme = 'light' | 'dark' | 'professional-light' | 'auto' | (string & {});

export interface UIConfig {
    theme?: AuraTheme;
    customComponents?: CustomMessageComponent[];
    settings?: SettingsControl;
}

// ── AI Behavior Config ──────────────────────────────────────────

export interface AIBehaviorConfig {
    systemPrompt?: string;
    securityInstructions?: string;
    dynamicContext?: () => Promise<string>;
    skills?: Skill[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    [key: string]: unknown;
}

// ── Root Config ──────────────────────────────────────────────────

export interface IdentityConfig {
    appId: string;
    ownerId: string;
    tenantId: string;
    userId: string;
    aiName: string;
}

export interface HeaderConfig {
    title: string;
    icon?: string;
}

export interface WelcomeConfig {
    icon?: string;
    title: string;
    message: string;
    suggestedPrompts: SuggestedPrompt[];
}

export interface SuggestedPrompt {
    label: string;
    prompt: string;
    icon?: string;
}

export interface AuraConfig {
    identity: IdentityConfig;
    header: HeaderConfig;
    welcome: WelcomeConfig;
    providers: AIProviderConfig[];
    behavior: AIBehaviorConfig;
    conversation: ConversationHistoryProvider;
    onEvent?: (event: AuraEvent) => void;
    ui: UIConfig;
}

// ── Utilities ────────────────────────────────────────────────────

export function isExcluded(exclusions: string[], group: string, field?: string): boolean {
    const target = field ? `${group}.${field}` : group;
    return exclusions.some(pattern => {
        const normalized = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${normalized}$`).test(target);
    });
}
