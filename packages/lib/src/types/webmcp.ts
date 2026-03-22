export interface WebMcpContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: any;
}

export interface WebMcpToolResult {
  content: WebMcpContent[];
  isError?: boolean;
}

export interface WebMcpContext {
  clearContext(): void;
  getContext(): any;
}
