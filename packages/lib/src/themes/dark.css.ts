import { css } from "lit";

export const darkTheme = css`
  :host([data-theme="dark"]) {
    --aura-bg: #1e1e1e;
    --aura-fg: #d4d4d4;
    --aura-accent: #187aba;
    --aura-accent-hover: #2997ff;
    --aura-border-color: #3e3e42;
    --aura-muted-color: #9ca3af;
    --aura-header-bg: #252526;
    --aura-header-fg: #ffffff;
    --aura-input-bg: #2d2d2d;
    --aura-input-border: #454545;
    --aura-msg-user-bg: #2d2d2d;
    --aura-msg-user-fg: #d4d4d4;
    --aura-msg-asst-bg: #263238;
    --aura-msg-asst-fg: #d4d4d4;
    --aura-msg-error-bg: #4b1111;
    --aura-msg-error-fg: #fca5a5;
    --aura-code-bg: #111111;
    --aura-skill-card-bg: #2a2d2e;
    --aura-skill-card-border: #414141;
    --aura-skill-card-color: #cccccc;
    --aura-tool-badge-bg: #37373d;
    --aura-tool-badge-color: #858585;
    --aura-code-font: "Cascadia Code", "Fira Code", "Consolas", monospace;
  }
`;
