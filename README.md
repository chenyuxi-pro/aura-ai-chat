# Aura AI Chat Monorepo

Welcome to the **Aura AI Chat** monorepo! This workspace is orchestrated using `pnpm` workspaces and `TurboRepo`.

## Project Structure

- `packages/lib/`: The core framework-agnostic AI chat widget and `playground` testbed.
- `demos/`:
  - `angular/`: Angular integration demonstration.
  - `react/`: React wrapper demonstration.
  - `vue/`: Vue integration demonstration.
- `scripts/`: Shared CLI scripts (like `demo.js`).
- `docs/`: Documentation site.

## Getting Started

1. **Install Dependencies**
   Ensure you have installed pnpm globally (`npm i -g pnpm`), then run:
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

## Publishing

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
