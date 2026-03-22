import { LitElement, html, unsafeCSS, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgentStep, ChatMessage } from "../../types/index.js";
import "@material/web/icon/icon.js";
import "../aura-agent-step/aura-agent-step.js";
import styles from "./aura-agent-iteration.css?inline";

@customElement("aura-agent-iteration")
export class AuraAgentIterationElement extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @property({ type: Object }) message!: ChatMessage;

  @state() private expanded = false;

  override render(): TemplateResult | typeof nothing {
    const msg = this.message;
    if (!msg?.metadata?.["isIteration"]) return nothing;

    const steps = (msg.metadata["agentSteps"] as AgentStep[]) ?? [];
    const nonThinkingSteps = steps.filter((step) => step.type !== "thinking");
    const visibleSteps = nonThinkingSteps.length > 0 ? nonThinkingSteps : steps;
    if (visibleSteps.length === 0) return nothing;

    const isThinkingOnly = nonThinkingSteps.length === 0;
    const isRunning = steps.some(
      (s) => s.status === "running" || s.status === "waiting",
    );
    if (isThinkingOnly && !isRunning) return nothing;

    const isAwaitingApproval = steps.some(
      (s) => s.type === "approval" && s.status === "waiting",
    );
    const isAwaitingUserInput = steps.some(
      (s) => s.type === "ask-user" && s.status === "waiting",
    );

    const isExpanded =
      this.expanded || isAwaitingApproval || isAwaitingUserInput;
    const completedCount = visibleSteps.filter(
      (s) => s.status === "complete" || s.status === "rejected",
    ).length;
    const totalCount = visibleSteps.length;
    const hasErrors = visibleSteps.some((s) => s.status === "error");
    const hasRejections = visibleSteps.some((s) => s.status === "rejected");

    const names = [
      ...new Set(
        visibleSteps.map((s) => s.toolName ?? s.summary).filter(Boolean),
      ),
    ];
    const nameList =
      names.length <= 3
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} + ${names.length - 2} more`;

    let summaryLabel: string;
    if (isThinkingOnly) {
      summaryLabel = "Reasoning...";
    } else if (isAwaitingApproval) {
      const waitingStep = visibleSteps.find(
        (s) => s.type === "approval" && s.status === "waiting",
      );
      const action = waitingStep?.toolName ?? waitingStep?.summary ?? "action";
      summaryLabel = `Awaiting approval for ${action}`;
    } else if (isAwaitingUserInput) {
      summaryLabel = "Waiting for your reply";
    } else if (isRunning) {
      const runningStep = visibleSteps.find((s) => s.status === "running");
      const action = runningStep?.toolName ?? runningStep?.summary ?? "working";
      summaryLabel =
        `Executing ${action}` +
        (totalCount > 1 ? ` (${completedCount}/${totalCount})` : "");
    } else if (hasErrors) {
      summaryLabel = nameList
        ? `Executed: ${nameList} (with errors)`
        : `Executed ${totalCount} step${totalCount !== 1 ? "s" : ""} (with errors)`;
    } else {
      summaryLabel = nameList
        ? `Executed: ${nameList}`
        : `Executed ${totalCount} step${totalCount !== 1 ? "s" : ""}`;
    }

    const iteration = (msg.metadata["iterationNumber"] as number) ?? 0;

    return html`
      <div
        class="iteration-message"
        role="log"
        aria-label="Iteration ${iteration}"
        part="message message-iteration"
      >
        <div
          class="iter ${isRunning ? "iter--running" : ""} ${hasErrors
            ? "iter--error"
            : hasRejections
              ? "iter--warning"
              : ""}"
        >
          <button
            class="iter__header"
            @click=${() => {
              this.expanded = !this.expanded;
            }}
            aria-expanded=${isExpanded}
            part="iteration-header"
          >
            <span
              class="iter__chevron ${isExpanded ? "iter__chevron--open" : ""}"
            >
              <md-icon>chevron_right</md-icon>
            </span>
            ${isRunning
              ? html`<span class="iter__spinner"></span>`
              : hasErrors
                ? html`<md-icon
                    class="iter__status-icon iter__status-icon--error"
                    >warning</md-icon
                  >`
                : html`<md-icon
                    class="iter__status-icon iter__status-icon--done"
                    >check</md-icon
                  >`}
            <span class="iter__summary">${summaryLabel}</span>
          </button>
          ${isExpanded
            ? html`
                <div class="iter__steps" part="iteration-steps">
                  ${visibleSteps.map(
                    (step) => html`
                      <aura-agent-step .step=${step}></aura-agent-step>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-agent-iteration": AuraAgentIterationElement;
  }
}
