import type { AuraChatHistorySummary, Conversation } from "../types/index.js";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

export function summarizeHistories(
  conversations: Conversation[],
): ConversationSummary[] {
  return conversations.map((c) => {
    const nonSystem = c.messages.filter((m) => m.role !== "system");
    const firstUser = nonSystem.find((m) => m.role === "user");

    let title =
      c.title || (firstUser ? firstUser.content.substring(0, 50) : "New Conversation");
    if (title.length >= 50 && firstUser && firstUser.content.length > 50) {
      title += "...";
    }

    return {
      id: c.id,
      title,
      updatedAt: c.updatedAt,
      messageCount: nonSystem.length,
    };
  });
}

export function toAuraChatHistorySummaries(
  conversations: Conversation[],
): AuraChatHistorySummary[] {
  return conversations.map((c) => {
    const nonSystem = c.messages.filter((m) => m.role !== "system");
    const firstUser = nonSystem.find((m) => m.role === "user");
    const last = nonSystem[nonSystem.length - 1];

    return {
      id: c.id,
      title: firstUser
        ? firstUser.content.slice(0, 60) +
          (firstUser.content.length > 60 ? "..." : "")
        : "New conversation",
      preview: last
        ? last.content.slice(0, 80) + (last.content.length > 80 ? "..." : "")
        : "",
      updatedAt: c.updatedAt,
      messageCount: nonSystem.length,
    };
  });
}
