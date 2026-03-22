import type {
  AIProvider,
  ProviderConfig,
  ProviderOptions,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
} from "../types/index.js";
import { createProviders } from "../providers/index.js";

export class ProviderManager {
  private providers: AIProvider[] = [];
  private activeProviderId: string | null = null;
  private activeModelId: string | null = null;
  private providerOptions: ProviderOptions = {};

  constructor(configs?: ProviderConfig[]) {
    this.providers = createProviders(configs);
    if (this.providers.length > 0) {
      this.activeProviderId = this.providers[0].id;
    }
  }

  getProviders(): AIProvider[] {
    return this.providers;
  }

  getActiveProvider(): AIProvider | undefined {
    return this.providers.find((p) => p.id === this.activeProviderId);
  }

  supportsStreaming(): boolean {
    const provider = this.getActiveProvider();
    return !!provider?.streamMessages;
  }

  setActiveProvider(id: string): void {
    this.switchProvider(id);
  }

  switchProvider(id: string): void {
    const p = this.providers.find((prov) => prov.id === id);
    if (p) {
      this.activeProviderId = id;
      this.activeModelId = null;
    }
  }

  getActiveModelId(): string | undefined {
    return this.activeModelId || undefined;
  }

  getActiveModel(): string {
    return this.activeModelId ?? "";
  }

  setActiveModel(id: string | null): void {
    this.setModel(id ?? "");
  }

  setModel(id: string): void {
    this.activeModelId = id;
  }

  setProviderOptions(options: ProviderOptions): void {
    this.providerOptions = options;
    for (const provider of this.providers) {
      provider.configure(options);
    }
  }

  async sendMessages(request: ProviderRequest): Promise<ProviderResponse> {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No active provider");

    const mergedRequest: ProviderRequest = {
      modelId: request.modelId || this.activeModelId || undefined,
      messages: request.messages,
      tools: request.tools,
      options: {
        ...this.providerOptions,
        ...request.options,
      },
    };

    return provider.sendMessages(mergedRequest);
  }

  async *streamMessages(
    request: ProviderRequest,
  ): AsyncIterable<ProviderResponseChunk> {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No active provider");

    const mergedRequest: ProviderRequest = {
      modelId: request.modelId || this.activeModelId || undefined,
      messages: request.messages,
      tools: request.tools,
      options: {
        ...this.providerOptions,
        ...request.options,
      },
    };

    if (provider.streamMessages) {
      yield* provider.streamMessages(mergedRequest, mergedRequest.options);
      return;
    }

    const response = await provider.sendMessages(mergedRequest);
    if (response.content) {
      yield {
        delta: response.content,
        contentDelta: response.content,
      };
    }
    if (response.toolCalls?.length) {
      yield {
        tool_calls: response.toolCalls,
      };
    }
    yield { done: true };
  }
}
