import type {
  ModelInfo,
  ProviderOptions,
  ProviderMessage,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ToolDefinition,
  ToolCallRequest,
} from "../types/index.js";
import { BaseProvider } from "./base-provider.js";

export type CopilotLoginStatus =
  | "not_logged_in"
  | "checking"
  | "activating_device"
  | "polling"
  | "logged_in"
  | "error";

export interface DeviceFlowInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface GitHubCopilotProviderConfig {
  clientId?: string;
  githubDeviceCodeUrl?: string;
  githubAccessTokenUrl?: string;
  copilotTokenUrl?: string;
  copilotChatUrl?: string;
  copilotModelsUrl?: string;
  copilotIndividualModelsUrl?: string;
  rememberToken?: boolean;
  editorVersion?: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

type CopilotToken = {
  token: string;
  expires_at: number;
};

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const value = payload.trim();
    return value || null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item);
      if (message) return message;
    }
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.message,
    record.error_description,
    record.detail,
    record.title,
  ];

  for (const candidate of candidates) {
    const message = extractErrorMessage(candidate);
    if (message) return message;
  }

  const errorValue = record.error;
  if (typeof errorValue === "string") {
    const value = errorValue.trim();
    if (value) return value;
  }

  if (errorValue && typeof errorValue === "object") {
    const message = extractErrorMessage(errorValue);
    if (message) return message;
  }

  for (const key of ["errors", "details", "issues"]) {
    const message = extractErrorMessage(record[key]);
    if (message) return message;
  }

  return null;
}

function toCopilotMessages(messages: ProviderMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    const toolCalls = message.tool_calls ?? message.toolCalls;
    return {
      role: message.role,
      content: message.content,
      name: message.name,
      tool_call_id: message.tool_call_id ?? message.toolCallId,
      tool_calls: toolCalls?.map((toolCall) => ({
        id: toolCall.callId,
        type: "function",
        function: {
          name: toolCall.id,
          arguments: JSON.stringify(toolCall.arguments ?? {}),
        },
      })),
    };
  });
}

function toCopilotTools(tools?: ToolDefinition[]): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: tool.function ?? {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function parseToolCalls(toolCalls?: Array<Record<string, any>>): ToolCallRequest[] {
  if (!toolCalls || toolCalls.length === 0) return [];

  return toolCalls.map((toolCall, index) => {
    const rawArgs = toolCall?.function?.arguments;
    let argumentsObj: Record<string, unknown> = {};
    try {
      argumentsObj =
        typeof rawArgs === "string"
          ? (JSON.parse(rawArgs) as Record<string, unknown>)
          : ((rawArgs ?? {}) as Record<string, unknown>);
    } catch {
      argumentsObj = { _raw: rawArgs };
    }

    return {
      callId:
        (typeof toolCall?.id === "string" && toolCall.id) ||
        `call_${Date.now()}_${index}`,
      id: String(toolCall?.function?.name ?? ""),
      arguments: argumentsObj,
    };
  });
}

export class GitHubCopilotProvider extends BaseProvider {
  static readonly id = "github-copilot";

  readonly id = GitHubCopilotProvider.id;
  readonly type = "built-in";
  readonly name = "GitHub Copilot";
  readonly icon = "smart_toy";

  loginStatus: CopilotLoginStatus = "not_logged_in";
  onLoginStatusChange?: (status: CopilotLoginStatus) => void;

  private clientId = "Iv1.b507a08c87ecfe98";
  // Defaults target same-origin proxy routes to avoid browser CORS issues.
  private githubDeviceCodeUrl = "/github/login/device/code";
  private githubAccessTokenUrl = "/github/login/oauth/access_token";
  private copilotTokenUrl = "/github-api/copilot_internal/v2/token";
  private copilotChatUrl = "/github-copilot-api/chat/completions";
  private copilotModelsUrl = "/github-copilot-api/models";
  private copilotIndividualModelsUrl = "/github-copilot-individual-api/models";
  private rememberToken = true;
  private editorVersion = "vscode/1.85.1";

  private accessToken: string | null = null;
  private copilotToken: CopilotToken | null = null;
  private loginAttemptId = 0;

  constructor(config?: GitHubCopilotProviderConfig) {
    super();
    if (config?.clientId) this.clientId = config.clientId;
    if (config?.githubDeviceCodeUrl) {
      this.githubDeviceCodeUrl = config.githubDeviceCodeUrl;
    }
    if (config?.githubAccessTokenUrl) {
      this.githubAccessTokenUrl = config.githubAccessTokenUrl;
    }
    if (config?.copilotTokenUrl) this.copilotTokenUrl = config.copilotTokenUrl;
    if (config?.copilotChatUrl) this.copilotChatUrl = config.copilotChatUrl;
    if (config?.copilotModelsUrl) this.copilotModelsUrl = config.copilotModelsUrl;
    if (config?.copilotIndividualModelsUrl) {
      this.copilotIndividualModelsUrl = config.copilotIndividualModelsUrl;
    }
    if (config?.rememberToken !== undefined) {
      this.rememberToken = config.rememberToken;
    }
    if (config?.editorVersion) this.editorVersion = config.editorVersion;

    this.refreshStoredLoginState();
  }

  setRememberToken(remember: boolean): void {
    this.rememberToken = remember;
    if (!remember) {
      localStorage.removeItem("aura_github_token");
    } else if (this.accessToken) {
      localStorage.setItem("aura_github_token", this.accessToken);
    }
  }

  getRememberToken(): boolean {
    return this.rememberToken;
  }

  override configure(config: ProviderOptions): void {
    super.configure(config);
    if (typeof config["rememberToken"] === "boolean") {
      this.setRememberToken(Boolean(config["rememberToken"]));
    }
  }

  private setLoginStatus(status: CopilotLoginStatus): void {
    this.loginStatus = status;
    this.onLoginStatusChange?.(status);
  }

  private refreshStoredLoginState(): void {
    this.setLoginStatus("checking");
    const stored = localStorage.getItem("aura_github_token");
    if (this.rememberToken && stored) {
      this.accessToken = stored;
      this.setLoginStatus("logged_in");
      return;
    }
    this.accessToken = null;
    this.setLoginStatus("not_logged_in");
  }

  async login(): Promise<DeviceFlowInfo> {
    this.setLoginStatus("activating_device");

    const response = await fetch(this.githubDeviceCodeUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: "read:user",
      }).toString(),
    });

    if (!response.ok) {
      this.setLoginStatus("error");
      throw new Error("Failed to start GitHub device flow.");
    }

    const deviceCode = (await response.json()) as DeviceCodeResponse;
    const info: DeviceFlowInfo = {
      userCode: deviceCode.user_code,
      verificationUri: deviceCode.verification_uri,
      expiresIn: deviceCode.expires_in,
      interval: deviceCode.interval,
    };

    this.setLoginStatus("polling");
    const attemptId = ++this.loginAttemptId;
    void this.pollForAccessToken(deviceCode)
      .then((token) => {
        if (attemptId !== this.loginAttemptId) return;
        this.accessToken = token;
        if (this.rememberToken) {
          localStorage.setItem("aura_github_token", token);
        }
        this.setLoginStatus("logged_in");
      })
      .catch((err) => {
        if (attemptId !== this.loginAttemptId) return;
        console.error("[GH Copilot] Device flow polling failed:", err);
        this.setLoginStatus("error");
      });
    return info;
  }

  private async pollForAccessToken(
    deviceCode: DeviceCodeResponse,
  ): Promise<string> {
    const deadline = Date.now() + deviceCode.expires_in * 1000;

    while (Date.now() < deadline) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, deviceCode.interval * 1000),
      );

      const response = await fetch(this.githubAccessTokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          device_code: deviceCode.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }).toString(),
      });

      if (!response.ok) continue;

      const payload = (await response.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (payload.access_token) return payload.access_token;
      if (payload.error && payload.error !== "authorization_pending") {
        this.setLoginStatus("error");
        throw new Error(payload.error_description || payload.error);
      }
    }

    this.setLoginStatus("error");
    throw new Error("GitHub device authorisation timed out.");
  }

  private async getCopilotToken(): Promise<string> {
    if (
      this.copilotToken &&
      this.copilotToken.expires_at > Date.now() / 1000 + 60
    ) {
      return this.copilotToken.token;
    }

    if (!this.accessToken) {
      this.setLoginStatus("not_logged_in");
      throw new Error("GitHub Copilot is not authenticated.");
    }

    const response = await fetch(this.copilotTokenUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Editor-Version": this.editorVersion,
      },
    });

    if (!response.ok) {
      this.setLoginStatus("error");
      throw await this.buildApiError(
        response,
        "Failed to acquire GitHub Copilot token",
      );
    }

    const payload = (await response.json()) as CopilotToken;
    this.copilotToken = payload;
    return payload.token;
  }

  async getModels(_options?: ProviderOptions): Promise<ModelInfo[]> {
    if (!this.accessToken) return [];

    try {
      const token = await this.getCopilotToken();
      const endpoints = [
        this.copilotModelsUrl,
        this.copilotIndividualModelsUrl,
      ].filter((value, index, arr) => value && arr.indexOf(value) === index);

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Editor-Version": this.editorVersion,
          },
        });
        if (!response.ok) continue;

        const payload = (await response.json()) as
          | Array<Record<string, unknown>>
          | { data?: Array<Record<string, unknown>>; models?: Array<Record<string, unknown>> };

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.models)
              ? payload.models
              : [];

        const models = list
          .map((model) => {
            const idCandidate =
              (typeof model.id === "string" && model.id) ||
              (typeof model.model === "string" && model.model) ||
              (typeof model.name === "string" && model.name) ||
              "";
            if (!idCandidate) return null;
            return {
              id: idCandidate,
              name:
                typeof model.name === "string" && model.name
                  ? model.name
                  : idCandidate,
              description:
                typeof model.description === "string"
                  ? model.description
                  : undefined,
            } as ModelInfo;
          })
          .filter((model): model is ModelInfo => model !== null);

        if (models.length > 0) return models;
      }

      return [];
    } catch {
      return [];
    }
  }

  async chat(
    request: ProviderRequest,
    _options?: ProviderOptions,
  ): Promise<ProviderResponse> {
    const token = await this.getCopilotToken();

    const response = await fetch(this.copilotChatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Editor-Version": this.editorVersion,
      },
      body: JSON.stringify({
        messages: toCopilotMessages(request.messages),
        model: request.modelId,
        tools: toCopilotTools(request.tools),
        tool_choice: request.tools?.length ? "auto" : undefined,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw await this.buildApiError(response, "Copilot chat request failed");
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: "assistant";
          content?: string;
          tool_calls?: Array<Record<string, unknown>>;
        };
      }>;
    };

    const message = payload.choices?.[0]?.message;
    const content = message?.content ?? "";
    return {
      content,
      toolCalls: parseToolCalls(message?.tool_calls as Array<Record<string, any>> | undefined),
    };
  }

  async *streamChat(
    request: ProviderRequest,
    _options?: ProviderOptions,
  ): AsyncIterable<ProviderResponseChunk> {
    const token = await this.getCopilotToken();

    const response = await fetch(this.copilotChatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Editor-Version": this.editorVersion,
      },
      body: JSON.stringify({
        messages: toCopilotMessages(request.messages),
        model: request.modelId,
        tools: toCopilotTools(request.tools),
        tool_choice: request.tools?.length ? "auto" : undefined,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw await this.buildApiError(response, "Copilot stream request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const line = event
          .split("\n")
          .map((part) => part.trim())
          .find((part) => part.startsWith("data: "));

        if (!line) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const payload = JSON.parse(data) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: ToolCallRequest[];
              };
            }>;
          };

          const delta = payload.choices?.[0]?.delta;
          if (delta?.content) {
            yield { delta: delta.content, contentDelta: delta.content };
          }
          if (delta?.tool_calls?.length) {
            const mapped = delta.tool_calls.map((tc: any) => ({
              callId: tc.id,
              id: tc.function?.name,
              arguments: tc.function?.arguments,
            }));
            yield { toolCallDeltas: mapped };
          }
        } catch {
          // Ignore malformed stream lines.
        }
      }
    }
  }

  logout(): void {
    this.accessToken = null;
    this.copilotToken = null;
    localStorage.removeItem("aura_github_token");
    this.setLoginStatus("not_logged_in");
  }

  private async buildApiError(
    response: Response,
    fallbackPrefix: string,
  ): Promise<Error> {
    const apiMessage = await this.readApiErrorMessage(response);
    if (apiMessage) return new Error(apiMessage);
    return new Error(`${fallbackPrefix}: ${this.formatHttpError(response)}`);
  }

  private async readApiErrorMessage(response: Response): Promise<string | null> {
    try {
      const raw = (await response.text()).trim();
      if (!raw) return null;

      try {
        return extractErrorMessage(JSON.parse(raw)) ?? raw;
      } catch {
        return raw;
      }
    } catch {
      return null;
    }
  }

  private formatHttpError(response: Response): string {
    const statusText = response.statusText.trim();
    if (statusText) return `HTTP ${response.status} ${statusText}`;
    return `HTTP ${response.status}`;
  }
}
