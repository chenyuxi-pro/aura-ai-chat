import type {
  AIProvider,
  ModelInfo,
  ProviderOptions,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
} from "../types/index.js";

const SOLVING_PROTOCOL = `You are an autonomous agent that solves problems step-by-step.
For every request:
1. **THINK**: Analyze what information or actions are needed. State your reasoning.
2. **ACT**: Execute the necessary tools to gather data or perform actions.
3. **OBSERVE**: Review the returned data and determine the next step.
**REPEAT** steps 1-3 until the problem is fully solved.
If you're missing critical context, ask the user. NEVER guess.`;

export abstract class BaseProvider implements AIProvider {
  abstract readonly id: string;
  abstract readonly type: string;
  abstract readonly name: string;
  readonly icon?: string;

  protected config: ProviderOptions = {};

  get label(): string {
    return this.name;
  }

  configure(config: ProviderOptions): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ProviderOptions {
    return { ...this.config };
  }

  abstract getModels(options?: ProviderOptions): Promise<ModelInfo[]>;
  abstract chat(
    request: ProviderRequest,
    options?: ProviderOptions,
  ): Promise<ProviderResponse>;
  abstract streamChat(
    request: ProviderRequest,
    options?: ProviderOptions,
  ): AsyncIterable<ProviderResponseChunk>;

  async listModels(options?: ProviderOptions): Promise<ModelInfo[]> {
    return this.getModels(options);
  }

  async sendMessages(request: ProviderRequest): Promise<ProviderResponse> {
    return this.chat(request, request.options);
  }

  async *streamMessages(
    request: ProviderRequest,
    options?: ProviderOptions,
  ): AsyncIterable<ProviderResponseChunk> {
    yield* this.streamChat(request, options ?? request.options);
  }

  protected buildFullSystemPrompt(
    appSystemPrompt?: string,
    additionalSafety?: string,
  ): string {
    let prompt = appSystemPrompt || "You are a helpful AI assistant.";

    if (additionalSafety) {
      prompt += `\n\nSafety Instructions:\n${additionalSafety}`;
    }

    prompt += `\n\n${SOLVING_PROTOCOL}`;
    return prompt;
  }
}
