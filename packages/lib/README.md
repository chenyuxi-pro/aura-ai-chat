# @aura-ai-chat

Aura AI Chat is a framework-agnostic AI chat widget built as a Web Component library with Lit 3. Drop `<aura-chat>` into a browser app and wire it up with providers, skills, tools, conversation storage, and host-controlled approvals.

> **Note**: This package is the core library of the Aura AI Chat monorepo.

## Latest changes

- The widget now runs an agentic loop with iteration tracking, skill selection, tool calls, human-in-the-loop steps, and step-by-step timeline rendering.
- Human-in-the-loop flows support `safe`, `moderate`, and `destructive` tool risk levels, preview content, timeout handling, and inline approval/rejection UI.
- A new `aura-event-monitor` component can display live widget events, including agent loop and tool telemetry.
- WebMCP support can export Aura tools to the page and import compatible tools from `navigator.mcp`.
- The demo has been refreshed around multi-skill orchestration, close-trade approvals, and a richer event log.

## Install

```bash
npm install aura-ai-chat
```

## Quick start

```html
<script type="module">
  import "aura-ai-chat";

  const memory = new Map();

  const conversationManager = {
    async createConversation(conversation) {
      const value = conversation ?? {
        id: crypto.randomUUID(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "New conversation",
      };
      memory.set(value.id, value);
      return value;
    },
    async loadConversation(id) {
      return memory.get(id) ?? null;
    },
    async listConversations() {
      return [...memory.values()];
    },
    async saveMessage(id, message) {
      const conversation =
        memory.get(id) ??
        (await this.createConversation({
          id,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

      conversation.messages.push(message);
      conversation.updatedAt = Date.now();
      memory.set(id, conversation);
    },
  };

  const tool = {
    name: "lookup_order",
    description: "Fetch an order summary by id.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
      },
      required: ["orderId"],
    },
    async execute(args, ctx) {
      return {
        content: [
          {
            type: "json",
            label: "Order",
            data: {
              orderId: args.orderId,
              status: "processing",
              requestedBy: ctx.userId ?? "unknown",
            },
          },
        ],
      };
    },
  };

  const widget = document.querySelector("aura-chat");
  widget.config = {
    identity: {
      appMetadata: {
        appId: "orders-app",
        teamId: "operations",
        tenantId: "tenant-1",
        userId: "user-42",
      },
      aiName: "Aster",
    },
    appearance: {
      headerTitle: "Aster",
      welcomeMessageTitle: "Need help?",
      welcomeMessage: "Ask about orders, approvals, or operational follow-up.",
      inputPlaceholder: "Message Aster...",
      suggestedPrompts: [
        {
          title: "Check an order",
          promptText: "Look up order ORD-1042",
        },
      ],
      theme: "professional-light",
    },
    providers: [
      {
        type: "built-in",
        id: "gitHubCopilot",
        config: {
          rememberToken: true,
        },
      },
    ],
    agent: {
      appSystemPrompt: "You are a helpful operations assistant.",
      tools: [tool],
      conversationManager,
      enableStreaming: true,
      maxContextTokens: 4096,
      maxIterations: 8,
      showThinkingProcess: true,
      toolTimeout: 30000,
      confirmationTimeoutMs: 65000,
      enableWebMcp: false,
    },
    onAuraEvent(event) {
      console.log("Aura event", event.type, event.payload);
    },
  };
</script>

<aura-chat></aura-chat>
```

## Configuration

```ts
interface AuraConfig {
  identity: AuraIdentityConfig;
  appearance?: AuraAppearanceConfig;
  providers?: ProviderConfig[];
  agent?: AuraAgentConfig;
  history?: { manager?: IConversationManager };
  onAuraEvent?: (event: AuraEvent) => void;
  settingsModalConfig?: SettingsModalConfig;
}
```

### `identity`

```ts
interface AuraIdentityConfig {
  appMetadata: {
    appId: string;
    teamId: string;
    tenantId?: string;
    userId?: string;
  };
  aiName?: string;
}
```

### `appearance`

Use `appearance` to control titles, welcome content, input copy, attachments, and theme.

```ts
interface AuraAppearanceConfig {
  headerTitle?: string;
  headerIcon?: string;
  welcomeMessageTitle?: string;
  welcomeMessage?: string;
  suggestedPrompts?: SuggestedPrompt[];
  inputPlaceholder?: string;
  loadingMessage?: string;
  errorMessage?: string;
  retryLabel?: string;
  enableAttachments?: boolean;
  maxAttachmentSize?: number;
  allowedAttachmentTypes?: string[];
  theme?: "light" | "dark" | "professional-light" | "auto";
  primaryColor?: string;
  fontFamily?: string;
}
```

### `agent`

`agent` is the current control surface for system prompting, skills, tools, conversation storage, and orchestration behavior.

```ts
interface AuraAgentConfig {
  appSystemPrompt?: string;
  additionalSafetyInstructions?: string;
  resources?: AuraResource[];
  skills?: Skill[];
  tools?: AuraTool[];
  conversationManager?: IConversationManager;
  conversationId?: string;
  maxContextTokens?: number;
  enableStreaming?: boolean;
  maxIterations?: number;
  showThinkingProcess?: boolean;
  toolTimeout?: number;
  confirmationTimeoutMs?: number;
  enableWebMcp?: boolean;
}
```

Notes:

- `conversationManager` is the preferred place for chat persistence. `history.manager` is still supported as a fallback.
- `showThinkingProcess` controls whether iteration messages remain visible after the agent finishes. Waiting approvals and user-input steps still stay visible.
- `resources` are read before each run and injected into the prompt as extra working context.

## Providers

### Built-in provider

The built-in provider currently shipped in this package is GitHub Copilot:

```ts
providers: [
  {
    type: "built-in",
    id: "gitHubCopilot",
    config: {
      rememberToken: true,
    },
  },
];
```

The provider defaults to same-origin proxy paths:

- `/github/login/device/code`
- `/github/login/oauth/access_token`
- `/github-api/copilot_internal/v2/token`
- `/github-copilot-api/chat/completions`
- `/github-copilot-api/models`
- `/github-copilot-individual-api/models`

The included Vite demo wires these routes in [`vite.config.ts`](./vite.config.ts). If your host app uses different routes, override them in the provider config.

### Custom providers

You can pass any custom provider that implements `AIProvider`. Extending `BaseProvider` is the easiest path:

```ts
import { BaseProvider } from "aura-ai-chat";

class DemoProvider extends BaseProvider {
  readonly id = "demo-provider";
  readonly type = "custom";
  readonly name = "Demo Provider";

  async getModels() {
    return [{ id: "demo-model", name: "Demo Model" }];
  }

  async chat() {
    return {
      content: "Hello from a custom provider.",
      toolCalls: [],
    };
  }

  async *streamChat() {
    yield { contentDelta: "Hello " };
    yield { contentDelta: "from a custom provider." };
    yield { done: true };
  }
}

providers: [
  {
    type: "custom",
    id: "demo-provider",
    config: new DemoProvider(),
  },
];
```

## Skills, tools, and approvals

Skills are named bundles of instructions plus tool ids:

```ts
const skills = [
  {
    name: "Risk Manager",
    description: "Checks limits before execution.",
    instructions: "Use exposure tools before recommending a trade.",
    tools: ["get_portfolio_exposure", "check_risk_limits"],
  },
];
```

Tools use `AuraTool`:

```ts
const closeTradeTool = {
  name: "close_trade_position",
  title: "Close Trade Position",
  description: "Close one open position after approval.",
  risk: AuraToolRisk.Destructive,
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
    },
    required: ["symbol"],
  },
  preview: {
    async buildContent(args) {
      return [
        {
          type: "text",
          text: `Close ${String(args.symbol)} after user approval.`,
        },
      ];
    },
  },
  async execute(args) {
    return {
      content: [
        {
          type: "text",
          text: `Closed ${String(args.symbol)}.`,
        },
      ],
    };
  },
};
```

Risk handling:

- No `risk` or `risk: "safe"` executes immediately.
- `risk: "moderate"` waits for explicit user approval.
- `risk: "destructive"` also waits for explicit user approval and is marked destructive for tool annotations.

The agent loop also includes a built-in `aura_ask_user` tool. When the model needs blocking clarification, the widget renders an inline reply field and resumes once the user answers.

### Tool result content

Aura tools can return mixed content:

- `text`
- `json`
- `image`
- `audio`
- `resource`
- `custom-element`

`custom-element` is useful for rich previews in approval cards or tool result rendering.

## Agent timeline and events

Each agent run can emit iteration metadata with step types such as:

- `thinking`
- `skill-select`
- `tool-call`
- `ask-user`
- `approval`

Widget events include:

- `conversation-started`
- `conversation-ended`
- `conversation-deleted`
- `history-cleared`
- `message-sent`
- `message-received`
- `tool-called`
- `tool-start`
- `tool-success`
- `tool-error`
- `skill-selected`
- `agent-loop-started`
- `agent-loop-completed`
- `agent-step-started`
- `agent-step-completed`
- `debug`
- `error`

Use `onAuraEvent` to observe them, or connect them to the event monitor component:

```html
<aura-chat id="chat"></aura-chat>
<aura-event-monitor id="monitor"></aura-event-monitor>

<script type="module">
  const chat = document.getElementById("chat");
  const monitor = document.getElementById("monitor");

  chat.config = {
    /* ... */
    onAuraEvent(event) {
      monitor.pushEvent(event);
    },
  };
</script>
```

## WebMCP

Set `agent.enableWebMcp = true` to enable WebMCP bridging.

Current behavior:

- Aura exports registered tools to `navigator.mcp` as `aura:<toolName>`.
- Aura imports compatible page-level MCP tools and makes them available to the agent.
- Exported tool annotations are derived from `title` and `risk`.

If `navigator.mcp` is missing, the bridge quietly does nothing.

## Themes and host control

Built-in themes:

- `light`
- `dark`
- `professional-light`
- `auto`

The package also exports the theme modules and types from [`src/index.ts`](./src/index.ts).

For settings control, use `settingsModalConfig`:

```ts
settingsModalConfig: {
  readonly: true,
  editableFields: ["theme", "copilotRemember"],
}
```

## Demo

The package demo now showcases:

- one-skill, multi-tool orchestration
- multi-skill handoff across research, risk, and execution
- human-in-the-loop close-trade approval with a custom preview element
- fallback tool usage when no specialist skill is selected
- live event monitoring

Run the vanilla playground locally from the monorepo root:

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:5178/`.

For a production bundle:

```bash
pnpm run build
```

## Exports

Main exports include:

- `AuraChat`
- `AuraEventMonitorElement`
- `AuraAgentIterationElement`
- `AuraAgentStepElement`
- `ActionPreviewElement`
- `ConfirmationBubbleElement`
- `SkillRegistry`
- `ToolDispatcher`
- `ProviderManager`
- `CommunicationManager`
- `WebMcpBridge`
- `BaseProvider`
- `GitHubCopilotProvider`

See [`src/index.ts`](./src/index.ts) for the current export surface.

## Publishing

This is what to do to publish `aura-ai-chat` to npm (run from monorepo root):

```bash
# 1. login to npm (one time only)
npm login

# 2. describe your change
pnpm changeset
# → prompts: patch / minor / major
# → prompts: describe the change

# 3. bump version + generate CHANGELOG
pnpm version

# 4. build + publish
pnpm release
```

After step 4, anyone can install it with:
```bash
npm install aura-ai-chat
```

Only the compiled `dist/` folder, `custom-elements.json`, and `package.json` are packaged. Source `.ts` files and the development playground are excluded via the strict `.npmignore`.

## License

MIT
