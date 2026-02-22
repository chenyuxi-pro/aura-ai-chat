import { css } from "lit";

export const lightTheme = css`
  :host([data-theme="light"]),
  :host(:not([data-theme])) {
    --aura-bg: #ffffff;
    --aura-fg: #1a1a1a;
    --aura-accent: #187aba;
    --aura-accent-hover: #126a9e;
    --aura-border-color: #e5e7eb;
    --aura-muted-color: #6b7280;
    --aura-header-bg: #fafafa;
    --aura-header-fg: #1a1a1a;
    --aura-input-bg: #ffffff;
    --aura-input-border: #d1d5db;
    --aura-msg-user-bg: #f3f4f6;
    --aura-msg-user-fg: #1a1a1a;
    --aura-msg-asst-bg: #eff6ff;
    --aura-msg-asst-fg: #1a1a1a;
    --aura-msg-error-bg: #fef2f2;
    --aura-msg-error-fg: #991b1b;
    --aura-code-bg: #f8f9fa;
    --aura-radius: 8px;
    --aura-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    --aura-font-sans: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
    --aura-font-mono: "Cascadia Code", "Fira Code", "Consolas", monospace;
  }
`;
