<div align="center">
  <h1>✨ Aura AI Chat</h1>
  <p><strong>A production-grade, framework-agnostic AI chat widget built as a Web Component.</strong></p>
  
  <!-- Add your badges here: -->
  <!-- <img src="https://img.shields.io/npm/v/aura-ai-chat?color=success&style=flat-square" alt="npm version" /> -->
</div>

---

Welcome to the **Aura AI Chat** monorepo! This workspace is orchestrated using `pnpm` workspaces and `TurboRepo`. 

Aura AI Chat allows you to easily drop a powerful, customizable AI assistant into any web application, regardless of the framework or the AI provider you choose.

## 🎯 Why I built this?

I wanted to create a resilient UI layer that leverages the existing ecosystem instead of starting from scratch every time. I was tired of "reinventing the wheel" for every AI project in the company. 

I set out with **5 core objectives**:
1. **Maximize reusability:** Provide a framework-agnostic, drop-in Web Component to effortlessly agentify any existing application.
2. **Consistent UI:** Give internal tools a unified, premium AI chat look and feel.
3. **Native Tooling/Skills:** Rely on progressive disclosure (client-side tool calling) rather than dumping massive state into the context window, saving a massive amount of tokens and latency.
4. **WebMCP Bridge:** Make the host website ready for Model Context Protocol integration right out of the box. 
5. **Enterprise Governance:** Provide dedicated channels for enterprise-level observability, custom UI injection, and human-in-the-loop (HITL) execution controls.

## 🎥 See it in Action

*See how Aura AI Chat uses skills configured by the host application through progressive disclosure, invokes Human-in-the-Loop interventions, and natively logs all AI actions within the conversation history and a live event console.*

https://github.com/user-attachments/assets/f07f171a-8c15-4a9e-8d99-de253450327f

## ⚡ Features

- **Framework Agnostic:** Built with Lit Web Components. Works natively in Angular, React, Vue, or Vanilla JS.
- **Agentic Loop:** Full iteration tracking, skills execution, and step-by-step timeline rendering.
- **Human-in-the-Loop:** Explicit support for `safe`, `moderate`, and `destructive` tool categorizations with inline approval/rejection UI.
- **Bring Your Own LLM:** Includes a built-in GitHub Copilot provider, and easily extensible interfaces for any custom LLM or API provider.
- **WebMCP Integration:** Effortlessly export Aura tools to the page and import compatible tools from your browser.

## 🏗️ Project Structure

This monorepo is divided into the core library and several host framework demonstrations:

| Directory | Description |
|---|---|
| 📦 **`packages/lib/`** | The core framework-agnostic AI chat widget and `playground` testbed. |
| 🅰️ **`demos/angular/`** | Angular integration demonstration showing a full dashboard. |
| ⚛️ **`demos/react/`** | React wrapper demonstration. |
| 💚 **`demos/vue/`** | Vue integration demonstration. |
| 🛠️ **`scripts/`** | Shared CLI orchestrator scripts (like `demo.js`). |

## 🚀 Getting Started

1. **Install Dependencies**
   Ensure you have installed `pnpm` globally (`npm i -g pnpm`), then run:
   ```bash
   pnpm install
   ```

2. **Core Development**
   Boot the vanilla playground natively using Vite:
   ```bash
   pnpm run dev
   ```

3. **Explore Framework Demos**
   Boot a specific framework dashboard demo (which automates building the core library first):
   ```bash
   pnpm run demo angular # runs on localhost:4200
   pnpm run demo react   # runs on localhost:4300
   pnpm run demo vue     # runs on localhost:4400
   ```
   Or run all demos in parallel:
   ```bash
   pnpm run demo
   ```

## 📦 Publishing

This is what to do to publish `aura-ai-chat` to npm:

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
