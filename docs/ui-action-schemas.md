# Aura AI Chat — UI Action Schema
## Developer Reference v1.0

This document defines every JSON message the AI can emit, and exactly how the UI must handle each one.

---

## Message Envelope

Every AI response is a single JSON object:

```ts
interface AuraMessage {
  schema_version: "1.0";
  request_id: string;           // Echo of user request_id, or AI-generated UUID
  intent: IntentType;
  payload: IntentPayload;       // Shape depends on intent
}

type IntentType =
  | "CHAT_MESSAGE"
  | "LOAD_SKILL_DETAIL"
  | "LOAD_TOOLS_SUMMARY"
  | "LOAD_TOOL_DETAIL"
  | "ASK_USER"
  | "EXECUTE_TOOL"
  | "EXECUTE_TOOL_RISKY"
  | "TOOL_RESULT"
  | "ERROR";
```

---

## Intent Handlers

### `CHAT_MESSAGE`
**UI Action:** Render a standard assistant chat bubble.

```ts
interface ChatMessagePayload {
  message: string;              // Supports markdown
}
```

**Rendering:**
- Display as a normal AI chat message bubble
- Render markdown (bold, italics, lists, code blocks)
- No action buttons required

---

### `LOAD_SKILL_DETAIL`
**UI Action:** Show a loading state, then fetch and inject skill detail into AI context.

```ts
interface LoadSkillDetailPayload {
  skill_id: string;
  message: string;              // Show this while loading
}
```

**Rendering:**
- Show `message` in an assistant bubble with a loading spinner
- Fetch skill detail from backend by `skill_id`
- Inject skill detail + linked tools into AI context as a system message
- Re-invoke AI with updated context
- On error: emit `ERROR` with code `SKILL_LOAD_FAILED`

---

### `LOAD_TOOLS_SUMMARY`
**UI Action:** Show a loading state, fetch Tools Summary, inject into AI context.

```ts
interface LoadToolsSummaryPayload {
  message: string;
}
```

**Rendering:**
- Show `message` in an assistant bubble with a loading spinner
- Fetch the full Tools Summary from backend
- Inject into AI context as a system message
- Re-invoke AI with updated context

---

### `LOAD_TOOL_DETAIL`
**UI Action:** Show a loading state, fetch full tool definition, inject into AI context.

```ts
interface LoadToolDetailPayload {
  tool_id: string;
  message: string;
}
```

**Rendering:**
- Show `message` in an assistant bubble with a loading spinner
- Fetch tool detail from backend by `tool_id`
- Inject into AI context as a system message
- Re-invoke AI with updated context
- On error: emit `ERROR` with code `TOOL_LOAD_FAILED`

---

### `ASK_USER`
**UI Action:** Render an inline form inside the chat for the user to fill in missing values.

```ts
interface AskUserPayload {
  message: string;
  fields: AskUserField[];
}

interface AskUserField {
  field_id: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "textarea" | "select" | "boolean";
  placeholder?: string;
  required: boolean;
  current_value?: any;           // Pre-fill if known
  options?: SelectOption[];      // Required when type === "select"
}

interface SelectOption {
  value: string;
  label: string;
}
```

**Rendering:**
- Show `message` as an assistant bubble above the form
- Render each field according to its `type`
- Pre-populate `current_value` if not null
- Show a **Submit** button that is disabled until all `required` fields are filled
- On submit: send field values back to AI context and re-invoke AI
- Submitted values should be formatted as: `"User provided: field_label = value"`

---

### `EXECUTE_TOOL`
**UI Action:** Show execution status, call the tool via backend, then wait for result.

```ts
interface ExecuteToolPayload {
  tool_id: string;
  message: string;               // "Fetching your data..." etc.
  parameters: Record<string, any>;
}
```

**Rendering:**
- Show `message` in a bubble with a loading/progress indicator
- Call backend tool execution API with `{ tool_id, parameters }`
- On success: inject result into AI context, re-invoke AI (AI will emit `TOOL_RESULT`)
- On failure: emit `ERROR` with code `TOOL_EXECUTION_FAILED`
- On tool not found: emit `ERROR` with code `TOOL_NOT_FOUND`

---

### `EXECUTE_TOOL_RISKY`
**UI Action:** Render a full Confirmation Bubble. Do NOT execute anything yet.

```ts
interface ExecuteToolRiskyPayload {
  tool_id: string;
  parameters: Record<string, any>;
  confirmation: ConfirmationConfig;
}

interface ConfirmationConfig {
  title: string;
  message: string;               // Supports markdown
  impact_level: "low" | "medium" | "high" | "critical";
  impact_tags?: string[];        // e.g. ["permanent", "data-loss", "sends-email"]
  preview?: PreviewConfig;
  approve_label: string;
  cancel_label: string;
}

type PreviewConfig = HostComponentPreview | KeyValuePreview;

interface HostComponentPreview {
  type: "host_component";
  component_id: string;          // Registered host app component name
  component_props: Record<string, any>;
  fallback: KeyValuePreview;     // Required: used if component fails to render
}

interface KeyValuePreview {
  type: "key_value";
  data: Record<string, string | number | boolean>;
}
```

**Rendering:**
- Render a **Confirmation Bubble** card in the chat (NOT a modal)
- Structure of the card:

  ```
  ┌─────────────────────────────────────────┐
  │ ⚠️  [title]                 [impact_level badge] │
  │                                         │
  │ [message — markdown rendered]           │
  │                                         │
  │ [impact_tags as small chips if present] │
  │                                         │
  │ ┌─────────────────────────────────────┐ │
  │ │  PREVIEW AREA                       │ │
  │ │  (host_component or key_value)      │ │
  │ └─────────────────────────────────────┘ │
  │                                         │
  │ [cancel_label]        [approve_label]   │
  └─────────────────────────────────────────┘
  ```

- **Impact level badge colors:**
  - `low` → Blue
  - `medium` → Yellow/Amber
  - `high` → Orange
  - `critical` → Red

- **Preview rendering:**
  - Try to render `host_component` by looking up `component_id` in the host app's registered component registry and passing `component_props`
  - If component is not found or throws, fall back to rendering `fallback` as a key-value table
  - If `preview` is omitted, render no preview area

- **On Approve:**
  - Disable both buttons immediately (prevent double-click)
  - Show a loading indicator on the Approve button
  - Execute the tool: `POST /execute-tool { tool_id, parameters }`
  - On success: inject result into AI context, re-invoke AI (AI emits `TOOL_RESULT`)
  - On failure: inject error into AI context, re-invoke AI (AI emits `ERROR`)

- **On Cancel:**
  - Disable both buttons
  - Show "Operation cancelled." in a muted style inside the bubble
  - Inject `"User cancelled the operation."` into AI context
  - Re-invoke AI — AI will emit a `CHAT_MESSAGE` acknowledging the cancellation
  - **Do NOT execute the tool under any circumstances**

---

### `TOOL_RESULT`
**UI Action:** Display the tool's output to the user.

```ts
interface ToolResultPayload {
  tool_id: string;
  message: string;              // Summary of what happened
  result_display?: PreviewConfig; // Optional rich display of result data
}
```

**Rendering:**
- Show `message` as a standard assistant bubble
- If `result_display` is present:
  - Try to render `host_component` from the host app registry
  - Fall back to `key_value` table if needed
- If `result_display` is absent, show only the message

---

### `ERROR`
**UI Action:** Display a friendly error message to the user.

```ts
interface ErrorPayload {
  error_code: ErrorCode;
  message: string;              // Plain language, no technical jargon
  recoverable: boolean;
  suggestions?: string[];
}

type ErrorCode =
  | "TOOL_NOT_FOUND"
  | "SKILL_LOAD_FAILED"
  | "TOOL_LOAD_FAILED"
  | "TOOL_EXECUTION_FAILED"
  | "MISSING_PARAMETERS"
  | "NO_CAPABILITY_FOUND"
  | "PERMISSION_DENIED"
  | "CANCELLED";
```

**Rendering:**
- Render as an error-styled assistant bubble (e.g. red left border or icon)
- Show `message` prominently
- If `suggestions` is present, render as a bulleted list below the message
- If `recoverable` is `false`, show a note that the user may need to contact support
- If `recoverable` is `true`, allow the user to type a new message to retry

---

## UI Processing Loop

```
AI Response Received (JSON)
         │
         ▼
   Parse & validate JSON
         │
         ├── Invalid JSON → Show generic parse error to user
         │
         ▼
   Route by intent
         │
         ├── CHAT_MESSAGE       → Render bubble, done
         ├── LOAD_SKILL_DETAIL  → Fetch + inject + re-invoke AI
         ├── LOAD_TOOLS_SUMMARY → Fetch + inject + re-invoke AI
         ├── LOAD_TOOL_DETAIL   → Fetch + inject + re-invoke AI
         ├── ASK_USER           → Render form, wait for submit → re-invoke AI
         ├── EXECUTE_TOOL       → Execute → inject result → re-invoke AI
         ├── EXECUTE_TOOL_RISKY → Render confirmation bubble, wait for user
         │     ├── Approved     → Execute → inject result → re-invoke AI
         │     └── Cancelled    → Inject cancellation → re-invoke AI
         ├── TOOL_RESULT        → Render result, done
         └── ERROR              → Render error, done
```

---

## Host App Component Registry

The host app must maintain a registry of renderable components that can be referenced by `component_id` in preview and result displays.

```ts
// Host app registers components on init
AuraUI.registerComponent("ProjectCard", ProjectCardComponent);
AuraUI.registerComponent("InvoiceCard", InvoiceCardComponent);
AuraUI.registerComponent("CustomerListTable", CustomerListTableComponent);

// Aura UI resolves at render time
const Component = AuraUI.getComponent(component_id);
if (Component) {
  render(<Component {...component_props} />);
} else {
  render(<KeyValueTable data={fallback.data} />);
}
```

---

## TypeScript Union Type — Full Schema

```ts
type AuraMessage =
  | { schema_version: "1.0"; request_id: string; intent: "CHAT_MESSAGE"; payload: ChatMessagePayload }
  | { schema_version: "1.0"; request_id: string; intent: "LOAD_SKILL_DETAIL"; payload: LoadSkillDetailPayload }
  | { schema_version: "1.0"; request_id: string; intent: "LOAD_TOOLS_SUMMARY"; payload: LoadToolsSummaryPayload }
  | { schema_version: "1.0"; request_id: string; intent: "LOAD_TOOL_DETAIL"; payload: LoadToolDetailPayload }
  | { schema_version: "1.0"; request_id: string; intent: "ASK_USER"; payload: AskUserPayload }
  | { schema_version: "1.0"; request_id: string; intent: "EXECUTE_TOOL"; payload: ExecuteToolPayload }
  | { schema_version: "1.0"; request_id: string; intent: "EXECUTE_TOOL_RISKY"; payload: ExecuteToolRiskyPayload }
  | { schema_version: "1.0"; request_id: string; intent: "TOOL_RESULT"; payload: ToolResultPayload }
  | { schema_version: "1.0"; request_id: string; intent: "ERROR"; payload: ErrorPayload };
```