import { marked, type Tokens } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    link({ href, text }: Tokens.Link): string {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

let idCounter = 0;

export function uniqueId(prefix = "aura"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function renderMarkdown(content: string): string {
  if (!content) return "";
  return marked.parse(content, { async: false }) as string;
}

export function renderBasicMarkdown(text: string): string {
  return renderMarkdown(text);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function generateId(): string {
  return uniqueId("id");
}

export function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
