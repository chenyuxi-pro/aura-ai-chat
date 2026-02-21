# `aura-ai-chat` — Full Consolidated Specification

---

## Overview

A **production-grade, framework-agnostic AI chat widget** built as a Web Component library. Integrates into any host application via a single custom element `<aura-chat>`. Supports pluggable AI providers, MCP-aligned tool definitions, a skill system, and a professional three-panel demo environment. Visual quality is **enterprise-grade** — clean, refined, polished. The name *Aura* informs the aesthetic: calm intelligence, ambient presence, refined glow.

---

## Tech Stack

| Concern | Technology |
|---|---|
| Component model | Web Components (Custom Elements v1, Shadow DOM) |
| Authoring | Lit 3.x |
| Build tool | Vite |
| Icons | Material Web (`@material/web`) |
| Markdown rendering | `marked` + `DOMPurify` |
| Styling | Per-component `.css` files, co-located with `.ts` source |
| Package output | ESM bundle + type declarations |

---

## Project Structure

```
aura-ai-chat/
├── src/
│   ├── components/
│   │   ├── aura-chat/
│   │   │   ├── aura-chat.ts
│   │   │   └── aura-chat.css
│   │   ├── aura-header/
│   │   │   ├── aura-header.ts
│   │   │   └── aura-header.css
│   │   ├── aura-messages/
│   │   │   ├── aura-messages.ts
│   │   │   └── aura-messages.css
│   │   ├── aura-input/
│   │   │   ├── aura-input.ts
│   │   │   └── aura-input.css
│   │   ├── aura-settings/
│   │   │   ├── aura-settings.ts
│   │   │   └── aura-settings.css
│   │   └── aura-history/
│   │       ├── aura-history.ts
│   │       └── aura-history.css
│   ├── providers/
│   │   ├── base-provider.ts          # Abstract base class + AIProvider interface
│   │   ├── openai-provider.ts
│   │   ├── anthropic-provider.ts
│   │   └── ollama-provider.ts
│   ├── prompt/
│   │   └── prompt-builder.ts         # Assembles final system prompt
│   ├── skills/
│   │   └── skill-registry.ts
│   ├── tools/
│   │   └── tool-registry.ts
│   ├── store/
│   │   └── aura-store.ts             # Reactive state + localStorage persistence
│   ├── types/
│   │   └── index.ts                  # All shared TypeScript interfaces/types
│   └── index.ts                      # Library entry point
├── demo/
│   ├── vanilla/                      # Plain HTML + JS demo
│   ├── react-demo/                   # React 18 test project
│   └── angular-demo/                 # Angular 17+ test project
├── README.md
└── vite.config.ts
```

---

## Type System

### JSON Schema (MCP-aligned)

```ts
type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

interface JSONSchema {
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
  [key: string]: unknown;    // Full JSON Schema extensions allowed
}
```

---

### Tool Result Content Blocks (MCP-aligned)

```ts
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  data: string;              // Base64-encoded
  mimeType: string;          // e.g. 'image/png'
}

interface EmbeddedResource {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;           // If text resource
    blob?: string;           // If binary resource (base64)
  };
}

type ToolResultContent = TextContent | ImageContent | EmbeddedResource;

interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;         // True if execution failed — AI handles gracefully
}
```

---

### Tool (MCP-aligned)

```ts
interface Tool {
  name: string;              // Identifier — snake_case, stable, used in AI function calls
  title?: string;            // Human-readable label for Settings UI and event log
  description: string;       // Guides AI on when and why to invoke this tool
  inputSchema: JSONSchema;   // Must be type: 'object' at root, per MCP spec
  enabled?: boolean;         // Default true; toggleable in Settings UI
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

// What the AI sees in the initial prompt — lean, no execute fn
interface ToolSummary {
  name: string;
  title?: string;
  description: string;
}

// Utility — use throughout widget UI
function getToolDisplayName(tool: Tool | ToolSummary): string {
  return tool.title ?? tool.name;
}
```

---

### Skill

```ts
interface Skill {
  name: string;              // Identifier — snake_case, stable
  title?: string;            // Human-readable label for Settings UI
  description: string;       // Guides AI on when to trigger this skill
  systemPrompt: string;      // Full instructions — only fetched when skill is activated
  tools?: Tool[];            // Tools scoped to this skill; surfaced to AI only on activation
  enabled?: boolean;         // Default true; toggleable in Settings UI
  icon?: string;
  category?: string;         // e.g. 'Productivity', 'Data', 'Communication'
  version?: string;
}

// What the AI sees in the initial prompt — name + description only
interface SkillSummary {
  name: string;
  title?: string;
  description: string;
}

function getSkillDisplayName(skill: Skill | SkillSummary): string {
  return skill.title ?? skill.name;
}
```

---

### AI Provider Interface

```ts
interface AIModel {
  id: string;
  name: string;
  description?: string;
}

interface AIRequest {
  systemPrompt: string;      // Fully assembled by PromptBuilder
  messages: Message[];
  model: string;
  parameters: Record<string, unknown>;
}

interface AIStreamChunk {
  delta: string;             // Incremental text
  done: boolean;
}

interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;

  // Auth lifecycle
  isAuthenticated(): Promise<boolean>;
  authenticate(rememberToken: boolean): Promise<void>;  // Opens OAuth popup/redirect
  onAuthComplete(): void;                               // Widget calls after detecting popup close
  logout(): void;

  // Model discovery
  getAvailableModels(): Promise<AIModel[]>;

  // Inference
  sendMessage(request: AIRequest): Promise<AsyncIterable<AIStreamChunk>>;
  cancelRequest(): void;
}
```

---

### AI Provider Config (Discriminated Union)

```ts
// Shape 1: Configure a built-in provider
interface BuiltInProviderConfig {
  type: 'built-in';
  providerId: 'openai' | 'anthropic' | 'ollama';

  // Auth
  apiKey?: string;           // Pre-injected by host app — skips manual login flow entirely
  authEndpoint?: string;
  rememberToken?: boolean;   // Default state of "Remember my token" checkbox

  // Overrides
  baseUrl?: string;          // Useful for proxies or self-hosted instances
  defaultModel?: string;
  defaultParameters?: Record<string, unknown>;

  // Optional display overrides
  displayName?: string;
  icon?: string;
}

// Shape 2: Inject a fully custom provider implementation
interface CustomProviderConfig {
  type: 'custom';
  instance: AIProvider;      // Only required field — everything else sourced from instance.*

  // Optional display overrides
  displayName?: string;
  icon?: string;
}

type AIProviderConfig = BuiltInProviderConfig | CustomProviderConfig;

// Widget-side resolution — exhaustive, compile-time safe
function resolveProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'built-in':
      return createBuiltInProvider(config.providerId, config);
    case 'custom':
      return config.instance;
    default:
      config satisfies never;
      throw new Error('Unknown provider config type');
  }
}
```

---

### Conversation & Message

```ts
interface ConversationMeta {
  id: string;
  title?: string;
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;           // Markdown string
  createdAt: string;
  metadata?: Record<string, unknown>;
}
```

---

### Custom Message Components

```ts
interface CustomMessageComponent {
  tag: string;               // Custom element tag name e.g. 'preview-card'
  schema: JSONSchema;        // Schema AI uses to produce valid parameters for this component
  description: string;       // Tells AI when and how to use this component in messages
}
```

---

### Conversation History Provider

Host app owns all persistence — widget delegates via this provider interface:

```ts
interface ConversationHistoryProvider {
  createConversation(): Promise<ConversationMeta>;
  listConversations(): Promise<ConversationMeta[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  saveMessage(conversationId: string, message: Message): Promise<void>;
  deleteConversation?(conversationId: string): Promise<void>;
  updateConversation?(conversationId: string, patch: Partial<ConversationMeta>): Promise<void>;
}

type AuraEventType =
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

interface AuraEvent {
  type: AuraEventType;
  timestamp: string;         // ISO 8601
  payload?: unknown;
}
```

---

### UI Config

```ts
// Patterns follow dot notation with regex support:
// 'identity'                          → entire group
// 'identity.appId'                    → specific field
// 'identity.*'                        → all fields in a group
// 'behavior.(temperature|maxTokens)'  → multiple fields via regex alternation
// '*'                                 → everything
// '*.systemPrompt'                    → field named systemPrompt in any group

interface SettingsRule {
  all: boolean;
  exclusions?: string[];
}

interface SettingsControl {
  readonly?:   SettingsRule;
  visibility?: SettingsRule;
}

interface UIConfig {
  theme?: 'light' | 'dark' | 'auto';
  customComponents?: CustomMessageComponent[];
  settings?: SettingsControl;
}
```

**Examples:**

```ts
// Lock everything readonly, exclude providers and two behavior fields
ui: {
  settings: {
    readonly: {
      all: true,
      exclusions: [
        'providers',
        'behavior.(temperature|maxTokens)'
      ]
    }
  }
}

// Show everything, hide sensitive fields
ui: {
  settings: {
    visibility: {
      all: true,
      exclusions: [
        'identity.(appId|ownerId|tenantId)',
        'behavior.systemPrompt'
      ]
    }
  }
}

// Both together
ui: {
  settings: {
    readonly: {
      all: true,
      exclusions: ['providers']
    },
    visibility: {
      all: true,
      exclusions: [
        'identity.(appId|ownerId|tenantId)',
        'behavior.systemPrompt'
      ]
    }
  }
}
```

**Resolution rules:**
- `visibility` is evaluated first — hidden groups/fields are not rendered at all
- `readonly` is then applied to whatever remains visible
- `all: true` with no `exclusions` applies the rule universally
- `all: false` with no `exclusions` has no effect — everything is editable/visible by default
- If all visible groups are `readonly`, the **Apply** button is hidden and a *"Managed by your administrator"* notice appears at the top of the modal

**Widget-side pattern resolver:**

```ts
function isExcluded(exclusions: string[], group: string, field?: string): boolean {
  const target = field ? `${group}.${field}` : group;
  return exclusions.some(pattern => {
    const normalized = pattern.replace(/\./g, '\\.').replace('*', '.*');
    return new RegExp(`^${normalized}$`).test(target);
  });
}
```

---

### AI Behavior Config

```ts
interface AIBehaviorConfig {
  systemPrompt?: string;                     // Merged into final prompt — see assembly order
  securityInstructions?: string;
  dynamicContext?: () => Promise<string>;    // Called fresh every turn
  skills?: Skill[];
  tools?: Tool[];                            // Global tools — available every turn as fallback
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  [key: string]: unknown;                    // Provider-specific extras
}
```

---

### Root Config

```ts
interface AuraConfig {
  identity:     IdentityConfig;
  header:       HeaderConfig;
  welcome:      WelcomeConfig;
  providers:    AIProviderConfig[];             // At least one required; first is active by default
  behavior:     AIBehaviorConfig;
  conversation: ConversationHistoryProvider;
  onEvent?:     (event: AuraEvent) => void;     // Widget-wide event/debug bus
  ui:           UIConfig;
}

interface IdentityConfig {
  appId: string;
  ownerId: string;
  tenantId: string;
  userId: string;
  aiName: string;
}

interface HeaderConfig {
  title: string;
  icon?: string;                             // URL or SVG string
}

interface WelcomeConfig {
  icon?: string;
  title: string;
  message: string;
  suggestedPrompts: SuggestedPrompt[];
}

interface SuggestedPrompt {
  label: string;
  prompt: string;
  icon?: string;
}
```

---

### Usage

```html
<aura-chat id="widget"></aura-chat>

<script type="module">
  import { AuraChat } from 'aura-ai-chat';

  const widget = document.getElementById('widget');

  widget.config = {
    identity: {
      appId: 'my-app',
      ownerId: 'org-123',
      tenantId: 'tenant-456',
      userId: 'user-789',
      aiName: 'Aria'
    },
    header: { title: 'Aria' },
    welcome: {
      title: 'Hello, how can I help?',
      message: 'Ask me anything about your workspace.',
      suggestedPrompts: [
        { label: 'Generate a report', prompt: 'Generate a sales report for this month' },
        { label: 'Summarise my tasks', prompt: 'What are my open tasks?' }
      ]
    },
    providers: [
      { type: 'built-in', providerId: 'openai', apiKey: 'sk-...', defaultModel: 'gpt-4o' },
      { type: 'custom', instance: new MyCompanyAIProvider(), displayName: 'Acme AI' }
    ],
    behavior: {
      systemPrompt: 'You are a helpful assistant for Acme Corp.',
      securityInstructions: 'Never reveal internal system details.',
      dynamicContext: async () => `Current user role: admin. Active project: Project X.`,
      skills: [generateReportSkill],
      tools: [getUserTool],
      temperature: 0.7
    },
    conversation: {
      createConversation: async () => myBackend.createConversation(),
      listConversations: async () => myBackend.listConversations(),
      getMessages: async (id) => myBackend.getMessages(id),
      saveMessage: async (id, msg) => myBackend.saveMessage(id, msg),
      deleteConversation: async (id) => myBackend.deleteConversation(id),
      updateConversation: async (id, patch) => myBackend.updateConversation(id, patch)
    },
    onEvent: (event) => console.log('[aura]', event),
    ui: {
      theme: 'auto',
      customComponents: [previewCardComponent]
    }
  };
</script>
```

---

## System Prompt Assembly

The final prompt sent to the AI is assembled in this fixed order by `PromptBuilder`:

```
1. [Master system prompt]        ← Hardcoded in library; not overridable by host app
2. [App custom system prompt]    ← behavior.systemPrompt
3. [Security instructions]       ← behavior.securityInstructions
4. [Dynamic context]             ← await behavior.dynamicContext() — fresh every turn
5. [Skills index]                ← SkillSummary[] — name + description only
6. [Tools index]                 ← ToolSummary[] — global tools, name + description only
7. [Meta-instructions]           ← Teaches AI how to request skill detail and invoke tools
```

---

## Skill / Tool Resolution Flow

```
User sends message
       ↓
AI receives assembled prompt (SkillSummary[] + ToolSummary[] only)
       ↓
AI checks skills index
       ↓
  ┌─── Skill matched? ──────────────────────────────────────────────┐
  │ YES                                                             │ NO
  ↓                                                                 ↓
AI calls get_skill_detail(name)                     AI calls list_tools() → receives full
       ↓                                             Tool[]{name, description, inputSchema}
Widget returns:                                                      ↓
  skill.systemPrompt                                    Tool matched?
  skill.tools[]{name, description, inputSchema}    ┌─── YES ────┐ NO
       ↓                                           ↓            ↓
AI follows skill prompt              AI calls tool    AI tells user
AI invokes scoped tool(s)            Widget calls     no capability
Widget calls tool.execute(input)     tool.execute()   found
Returns ToolResult to AI             Returns result
```

---

## Authentication Flow

1. Provider's `isAuthenticated()` returns `false` → messages area replaced with **auth prompt card**:
   - Provider name + logo
   - Explanation message
   - **"Sign in with [Provider]"** primary button
   - **"Remember my access token"** checkbox
2. User clicks sign-in → `provider.authenticate(rememberToken)` → opens OAuth flow in popup/tab.
3. Widget listens via `BroadcastChannel` or `storage` event for auth completion → calls `provider.onAuthComplete()`.
4. If `rememberToken` was checked → token persisted to `localStorage` under `aura-ai-chat:token:{providerId}`.
5. On subsequent loads → expired token detected → auth prompt reappears automatically.
6. If `apiKey` is present in `BuiltInProviderConfig` → auth flow is skipped entirely.

---

## Conversation Management

- All persistence is delegated to the host app via `ConversationHistoryProvider` — widget holds in-memory state for the active conversation only.
- **New conversation:** Header "Add" button → `conversation.createConversation()` → widget resets to welcome screen.
- **History:** Header "History" button → opens side drawer → `conversation.listConversations()` → user selects → `conversation.getMessages(id)`.
- **Delete conversation:** Available in history drawer → `conversation.deleteConversation(id)` (optional — widget hides delete UI if not provided).
- **Rename conversation:** Available in history drawer → `conversation.updateConversation(id, patch)` (optional — widget hides rename UI if not provided).
- Widget emits `conversation:new` and `conversation:switched` events via top-level `onEvent`.

---

## localStorage Persistence

All keys namespaced under `aura-ai-chat:` to avoid host app collisions:

| Key | Value |
|---|---|
| `aura-ai-chat:provider` | Active provider id |
| `aura-ai-chat:model` | Active model id |
| `aura-ai-chat:input-height` | Chat input section height in px |
| `aura-ai-chat:token:{providerId}` | Stored auth token (if rememberToken) |
| `aura-ai-chat:theme` | User-selected theme override |

---

## UI Component Spec

### Layout (top to bottom)

```
┌─────────────────────────────────────────────────────┐
│  HEADER  (56px fixed)                               │
│  [Icon] [Title]          [+] [⏱] [⚙] [✕]          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MESSAGES  (flex-grow, scrollable)                  │
│                                                     │
│  — Empty state: centered icon, headline,            │
│    subheadline, suggested prompt chips              │
│                                                     │
│  — User messages: right-aligned                     │
│  — AI messages: left-aligned with avatar            │
│  — Streaming: 3-dot typing indicator                │
│  — Markdown rendered + sanitised                    │
│  — Code blocks: copy button + syntax hints          │
│  — Custom components rendered inline                │
│  — Confirmation blocks: preview + Approve/Cancel    │
│                                                     │
├─────────────────────────────────────────────────────┤  ← drag handle
│  INPUT  (resizable height, min/max clamped)         │
│  ┌─────────────────────────────────────────────┐   │
│  │  Textarea (auto-grow, Shift+Enter=newline)  │   │
│  ├─────────────────────────────────────────────┤   │
│  │  [Provider ▼]  [Model ▼]      [Send▶/✕]   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Settings Modal (`<aura-settings>`)

```
┌─────────────────────────────────────────────────────┐
│  Chat Settings                                  [✕] │
├─────────────────────────────────────────────────────┤
│  ▾ Identity                                         │  ← collapsible groups
│      appId, ownerId, tenantId, userId, aiName       │
│  ▾ Header                                           │
│      title, icon                                    │
│  ▾ Welcome                                          │
│      icon, title, message, suggested prompts editor │
│  ▾ AI Providers                                     │
│      active provider selection, token entry         │
│  ▾ AI Behavior                                      │
│      system prompt, security instructions,          │
│      temperature, maxTokens, topP                   │
│  ▾ Skills                                           │
│      [✓] Generate Report  (category: Data)          │
│          └─ [✓] fetch_data   [✓] format_report      │
│  ▾ Tools                                            │
│      [✓] get_current_user                           │
│      [🔒] get_weather  ← used by: Generate Report   │
├─────────────────────────────────────────────────────┤
│  [Expand all] [Collapse all]    [Cancel] [Apply]    │
└─────────────────────────────────────────────────────┘
```

**Tools group rules:**
- A global tool that is referenced by one or more **enabled** skills has its checkbox locked (🔒) and cannot be unchecked
- Hovering the locked checkbox shows a tooltip: *"Used by: Generate Report — disable that skill first"*
- Once all skills referencing a tool are disabled, the tool's checkbox becomes freely toggleable
- Tools nested inside a skill (scoped tools) are not shown in the global Tools group — they are only shown indented under their parent skill in the Skills group

### Theming

All CSS custom properties prefixed `--aura-*`:

```css
:host {
  --aura-color-bg:           #0f1117;
  --aura-color-surface:      #1a1d27;
  --aura-color-border:       #2a2d3a;
  --aura-color-primary:      #7c6af7;
  --aura-color-primary-fg:   #ffffff;
  --aura-color-text:         #e2e4ed;
  --aura-color-text-muted:   #6b7280;
  --aura-color-user-bubble:  #2a2d3a;
  --aura-color-ai-bubble:    #1e2130;
  --aura-color-error:        #ef4444;
  --aura-radius-widget:      12px;
  --aura-radius-bubble:      16px;
  --aura-font-family:        'DM Sans', sans-serif;
  --aura-font-size-base:     14px;
  --aura-shadow:             0 8px 32px rgba(0,0,0,0.4);
  --aura-header-height:      56px;
  --aura-input-min-height:   80px;
  --aura-input-max-height:   320px;
}
```

---

## MCP Server Interoperability

Because `Tool` aligns with MCP, a host app can wrap an MCP server with a thin adapter:

```ts
async function mcpServerToTools(mcpClient: MCPClient): Promise<Tool[]> {
  const { tools } = await mcpClient.listTools();

  return tools.map(mcpTool => ({
    name: mcpTool.name,
    title: mcpTool.title,
    description: mcpTool.description,
    inputSchema: mcpTool.inputSchema,
    execute: async (input) => {
      const result = await mcpClient.callTool({ name: mcpTool.name, arguments: input });
      return { content: result.content, isError: result.isError };
    }
  }));
}
```

---

## Demo Environment

### `demo/vanilla/` — Pure HTML + JS

Three-panel layout:

```
┌──────────────────────┬─────────────────────────┬──────────────────┐
│  LEFT SIDEBAR        │  CENTER                 │  RIGHT SIDEBAR   │
│  (resizable)         │                         │  (resizable)     │
│                      │                         │                  │
│  Aura Widget v1.0.0  │  <aura-chat>            │  Event Log       │
│  ──────────────────  │                         │                  │
│  [Toggle: Full size] │  Full size = flex-grow  │  Scrollable      │
│  [Toggle: Event log] │  Fixed = 600px centred  │  entries with    │
│                      │                         │  timestamp +     │
│  ──────────────────  │                         │  type badge:     │
│  SETTINGS            │                         │  USER / AI /     │
│  ──────────────────  │                         │  WIDGET / ERROR  │
│  ▾ Identity          │                         │  + collapsible   │
│      appId           │                         │  payload         │
│      ownerId         │                         │                  │
│      tenantId        │                         │                  │
│      userId          │                         │                  │
│      aiName          │                         │                  │
│  ▾ Header            │                         │                  │
│      title, icon     │                         │                  │
│  ▾ Welcome           │                         │                  │
│      icon, title,    │                         │                  │
│      message,        │                         │                  │
│      prompts editor  │                         │                  │
│  ▾ AI Providers      │                         │                  │
│      provider list,  │                         │                  │
│      token entry     │                         │                  │
│  ▾ AI Behavior       │                         │                  │
│      system prompt,  │                         │                  │
│      instructions,   │                         │                  │
│      temperature etc │                         │                  │
│  ▾ Skills            │                         │                  │
│      [✓] skill name  │                         │                  │
│  ▾ Tools             │                         │                  │
│      [✓] tool name   │                         │                  │
│  ──────────────────  │                         │                  │
│  [Apply to widget]   │                         │                  │
└──────────────────────┴─────────────────────────┴──────────────────┘
```

- Left sidebar settings groups mirror the widget's `<aura-settings>` groups exactly — same structure, same fields, rendered directly in the sidebar for rapid config changes during testing without opening a modal.
- Changes are staged locally; the **"Apply to widget"** button at the bottom pushes the updated config to the widget live.
- Groups are individually collapsible/expandable; collapse state is persisted in `localStorage` for the demo session.
- The sidebar settings are always fully editable regardless of the widget's `settingsReadonly` config — it is a demo tool, not a production UI.

### `demo/react-demo/` — React 18

Standard Vite React project demonstrating:
- Config injection via `useEffect` + `ref`
- `<aura-chat>` wrapped in a typed React component
- Callback wiring with simulated backend
- Custom provider injection

### `demo/angular-demo/` — Angular 17+

Standard Angular CLI project with `CUSTOM_ELEMENTS_SCHEMA` demonstrating:
- Config binding via `@ViewChild`
- Service-backed callbacks

---

## README Requirements

1. Project overview with screenshot/GIF placeholder
2. Quick start — install + basic usage snippet
3. Full `AuraConfig` type reference
4. AI Provider guide — how to implement a custom provider
5. Skills guide — how to define and register skills
6. Tools guide — MCP alignment, how to define tools, MCP server adapter
7. Custom message components — how to register and use them
8. Theming — full `--aura-*` CSS custom properties reference
9. Demo instructions — how to run each demo
10. Architecture overview — prompt assembly order + skill/tool resolution flow (Mermaid diagram)
11. Contributing + License

---

## Non-Functional Requirements

- **Zero runtime dependencies** other than Lit — providers are optional peer deps
- **Accessibility** — all interactive elements have ARIA labels; fully keyboard navigable
- **Performance** — streaming via `ReadableStream`; never blocks main thread
- **Security** — all AI-generated HTML sanitised with `DOMPurify` before DOM insertion
- **localStorage** — all keys namespaced under `aura-ai-chat:` to avoid host app collisions
- **Type safety** — no `any` in the public API surface; all types exported from `index.ts`
- **Exhaustiveness** — all discriminated union switches use `satisfies never` guard
