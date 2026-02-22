import type { AIProvider, ProviderConfig } from "../types/index.js";
import { GitHubCopilotProvider } from "./github-copilot-provider.js";

export { BaseProvider } from "./base-provider.js";
export { GitHubCopilotProvider } from "./github-copilot-provider.js";
export type {
  CopilotLoginStatus,
  DeviceFlowInfo,
  GitHubCopilotProviderConfig,
} from "./github-copilot-provider.js";

export function createProviders(configs?: ProviderConfig[]): AIProvider[] {
  if (!configs) return [];

  return configs
    .map((cfg) => {
      if (cfg.type === "custom") {
        return cfg.config;
      }

      const providerId = cfg.id.toLowerCase();
      if (providerId === "github-copilot" || providerId === "githubcopilot") {
        return new GitHubCopilotProvider(cfg.config as any);
      }

      return undefined;
    })
    .filter((provider): provider is AIProvider => Boolean(provider));
}

export function getProviderById(
  providers: AIProvider[],
  id: string,
): AIProvider | undefined {
  return providers.find((p) => p.id === id);
}
