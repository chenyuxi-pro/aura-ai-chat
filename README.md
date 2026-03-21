# Aura AI Chat Repo

This repository contains the `aura-ai-chat` Web Component package plus host-app examples used to validate it in real application flows.

## What is here

- [`package/`](./package) - the publishable `aura-ai-chat` library, demo app, and package-level documentation
- [`host-examples/angular-host-app/`](./host-examples/angular-host-app) - an Angular host app that integrates the widget in a more realistic UI
- [`LICENSE`](./LICENSE) - MIT license

## Main package

The core library lives in [`package/`](./package).

It includes:

- the `<aura-chat>` widget
- the `aura-event-monitor` component
- agentic loop support with skills, tools, and human-in-the-loop steps
- WebMCP bridging
- a Vite demo app

Start here for API details and package usage:

- [`package/README.md`](./package/README.md)
- [`package/docs/ui-action-schemas.md`](./package/docs/ui-action-schemas.md)
- [`package/docs/interaction-flow.md`](./package/docs/interaction-flow.md)

## Repo structure

```text
. 
|-- package/
|-- host-examples/
|   `-- angular-host-app/
|-- LICENSE
`-- README.md
```

## Local development

### Run the package demo

```bash
cd package
npm install
npm run start
```

Open `http://localhost:5178/`.

### Build the package

```bash
cd package
npm install
npm run build
```

### Run the Angular host example

Build the package first, then start the host app:

```bash
cd package
npm install
npm run build

cd ../host-examples/angular-host-app
npm install
npm run start
```

Open `http://localhost:4200/`.

More details are in [`host-examples/angular-host-app/README.md`](./host-examples/angular-host-app/README.md).

## Where to look next

- If you want to use the widget in another app, start with [`package/README.md`](./package/README.md).
- If you want a realistic integration reference, use [`host-examples/angular-host-app/`](./host-examples/angular-host-app).
- If you want to inspect the current demo wiring, look at [`package/main.ts`](./package/main.ts).

## License

MIT
