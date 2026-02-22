import type { ProviderMessage, ChatMessage } from "../types/index.js";

export interface TrimOptions {
  maxTokens: number;
  estimator?: (text: string) => number;
}

export function estimateTokens(text: string): number {
  // Rough estimate: 4 chars per token
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: ProviderMessage[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content) + 4; // +4 for role/overhead
  }, 0);
}

export class TokenBudgetService {
  async prepareMessages(
    systemPrompt: string,
    history: ChatMessage[],
    maxBudget: number,
  ): Promise<ProviderMessage[]> {
    const messages: ProviderMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as any,
        content: m.content,
      })),
    ];

    return trimToTokenBudget(messages, { maxTokens: maxBudget });
  }
}

export function trimToTokenBudget(
  messages: ProviderMessage[],
  options: TrimOptions,
): ProviderMessage[] {
  const { maxTokens, estimator = estimateTokens } = options;

  let currentTokens = 0;
  const systemMsg = messages.find((m) => m.role === "system");
  if (systemMsg) {
    currentTokens += estimator(systemMsg.content) + 4;
  }

  const result: ProviderMessage[] = systemMsg ? [systemMsg] : [];
  const others = messages.filter((m) => m.role !== "system");

  // Keep most recent messages first
  const keptOthers: ProviderMessage[] = [];
  for (let i = others.length - 1; i >= 0; i--) {
    const msg = others[i];
    const tokens = estimator(msg.content) + 4;
    if (currentTokens + tokens <= maxTokens) {
      keptOthers.unshift(msg);
      currentTokens += tokens;
    } else {
      break;
    }
  }

  return [...result, ...keptOthers];
}
