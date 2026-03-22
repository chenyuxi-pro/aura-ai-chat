# Angular Host App Demo for `aura-ai-chat`

This app is a realistic Angular 21 standalone host for the `aura-ai-chat` web component.
It demonstrates dashboard workflows, AI tools, preview elements, conversation persistence, and built-in GitHub Copilot auth with Angular dev-server proxying.

## Purpose

Use this project to validate `aura-ai-chat` in a real Angular UI, not a minimal toy page.

It covers:
- A real dashboard canvas with removable, resizable, renameable panels.
- Mixed panel renderers: AG Grid, ECharts (line/bar), and stat cards.
- Dynamic AI context from live Angular state.
- Tool execution paths across query, safe, moderate, and destructive actions.
- Confirmation previews rendered through Angular Custom Elements.
- Local conversation history persistence and reload.
- Built-in `github-copilot` provider plus a local mock provider.

## Tech Stack

- Angular 21 standalone components + signals
- `@aura-ai-chat` (monorepo workspace dependency: `workspace:*`)
- `ag-grid-angular` + `ag-grid-community`
- `ngx-echarts` + `echarts`
- `angular-split`
- Public APIs: Open-Meteo and REST Countries
- `localStorage` for dashboard/layout/theme/conversation persistence

## App Layout

- Top bar: logo, add panel, show/hide assistant, theme toggle
- Main area: dashboard canvas with panel grid
- Right sidebar: `<aura-chat>` widget, resizable and collapsible (min width 320px)

Primary host files:
- `src/app/dashboard/dashboard.component.ts`
- `src/app/dashboard/dashboard.component.html`
- `src/app/dashboard/dashboard.component.scss`

## How `aura-ai-chat` Is Used in This Project

1. Register web component bundle
- `src/main.ts` imports `aura-ai-chat`:
  - `import 'aura-ai-chat';`

2. Mount widget in Angular template
- `src/app/dashboard/dashboard.component.html` renders:
  - `<aura-chat #chatWidget class="assistant-widget"></aura-chat>`

3. Register preview custom elements before widget mount
- `DashboardComponent` constructor calls:
  - `registerPreviewCustomElements(this.injector);`
- Registration file:
  - `src/app/ai-integration/custom-elements/register-preview-elements.ts`
- Registered tags:
  - `dashboard-panel-preview`
  - `data-diff-view`
  - `panel-delete-preview`

4. Build full widget config
- `src/app/ai-integration/widget-config.builder.ts` assembles:
  - identity/header/welcome/suggested prompts
  - providers (`github-copilot` built-in + `MockAiProvider`)
  - behavior (`systemPrompt`, `dynamicContext`, `skills`, `tools`)
  - conversation callbacks
  - UI theme sync

5. Inject config after widget exists, and re-inject on signal changes
- `DashboardComponent.ngAfterViewInit()` calls `injectConfig()`.
- A signal `effect()` re-injects whenever panel/theme signals change.
- This keeps dynamic context current on each AI turn.

6. Skill and tools
- Skill: `src/app/ai-integration/skills/dashboard-builder.skill.ts`
- Tools: `src/app/ai-integration/tools/*.ts`
- Registry: `src/app/ai-integration/tools/tool-registry.service.ts`

## Tools in This Demo

Query tools:
- `dashboard.get_panel_list`
- `dashboard.get_source_catalog`
- `data.fetch_weather`
- `data.fetch_countries`

Safe actions:
- `dashboard.panel.rename`
- `app.theme.change`

Moderate actions:
- `dashboard.panel.create` (preview: `dashboard-panel-preview`)
- `dashboard.panel.update` (preview: `data-diff-view`)

Destructive actions:
- `dashboard.panel.delete` (preview: `panel-delete-preview`)

## Data and Persistence

Dashboard state:
- `src/app/core/services/dashboard.service.ts`
- Persists panel list and sidebar preferences in `localStorage`

Conversation state:
- `src/app/core/services/conversation.service.ts`
- Implements `ConversationHistoryProvider` backed by `localStorage`

Theme state:
- `src/app/core/services/theme.service.ts`
- Persists light/dark/system preference and applies resolved theme to DOM dataset

## Local Setup

### 1) Start the Angular host app

From the monorepo root run the following command to automatically build the core library and boot the Angular demo:

```bash
pnpm run demo angular
```

Open `http://localhost:4200`

Note:
- This app depends on `@aura-ai-chat` via `workspace:*`. Rebuild the lib by restarting the `demo angular` script after core widget changes.

## GitHub Provider Proxy: Why `/github` Must Be Last

The built-in GitHub Copilot provider in `package/src/providers/github-copilot-provider.ts` uses multiple path prefixes:

- `/github/login/device/code` and `/github/login/oauth/access_token` (GitHub web)
- `/github-api/copilot_internal/v2/token` (GitHub REST)
- `/github-copilot-api/*` and `/github-copilot-individual-api/*` (Copilot APIs)

Your Angular proxy file (`proxy.conf.json`) must keep route order from most specific to most general:

1. `/github-copilot-individual-api`
2. `/github-copilot-api`
3. `/github-api`
4. `/github`  <-- keep this last

Why:
- If `/github` appears before `/github-api`, requests beginning with `/github-api` can be matched by `/github` first.
- That rewrites to the wrong upstream (`github.com` instead of `api.github.com`) and causes 404s.

## Troubleshooting 404s

If you see:
- `POST http://localhost:4200/github/login/device/code 404`
- `GET http://localhost:4200/github-api/copilot_internal/v2/token 404`

Check:
- You are running Angular dev server with proxy enabled (`ng serve` from this app; `angular.json` already points to `proxy.conf.json`).
- `proxy.conf.json` route order is unchanged (`/github` last).
- Dev server restarted after proxy edits.
- Network tab shows proxied requests hitting the intended upstream host.
