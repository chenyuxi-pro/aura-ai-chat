import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AuraEvent } from "../../types/index.js";
import { AuraEventType } from "../../types/index.js";
import {
  lightTheme,
  darkTheme,
  professionalLightTheme,
} from "../../themes/index.js";
import "@material/web/icon/icon.js";
import "../aura-json-view/aura-json-view.js";
import styles from "./aura-event-monitor.css?inline";

interface MonitorEntry {
  id: number;
  event: AuraEvent;
}

@customElement("aura-event-monitor")
export class AuraEventMonitorElement extends LitElement {
  static override styles = [
    unsafeCSS(styles),
    lightTheme,
    darkTheme,
    professionalLightTheme,
  ];

  @property({ attribute: false }) events: AuraEvent[] = [];
  @property({ type: String }) title = "Event Log";

  @state() private entries: MonitorEntry[] = [];
  @state() private expandedEntryIds: number[] = [];
  @state() private selectedTypes: string[] = [];
  @state() private searchQuery = "";

  private nextEntryId = 1;
  private skipNextEventSync = false;
  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const filterMenu = this.filterMenuElement;
    if (!filterMenu?.open) return;

    const eventPath = event.composedPath();
    if (eventPath.includes(filterMenu)) return;

    filterMenu.open = false;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
  }

  override disconnectedCallback(): void {
    document.removeEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
    );
    super.disconnectedCallback();
  }

  override updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has("events")) {
      if (this.skipNextEventSync) {
        this.skipNextEventSync = false;
        return;
      }

      this.entries = this.events.map((event) => ({
        id: this.nextStepId(),
        event,
      }));
      this.pruneExpandedEntries();
    }
  }

  pushEvent(event: AuraEvent): void {
    this.skipNextEventSync = true;
    this.events = [event, ...this.events];
    this.entries = [{ id: this.nextStepId(), event }, ...this.entries];
  }

  clearEvents(): void {
    this.events = [];
    this.entries = [];
    this.expandedEntryIds = [];
    this.selectedTypes = [];
  }

  override render(): TemplateResult {
    const filteredEntries = this.filteredEntries;
    const eventTypes = this.availableTypes;

    return html`
      <div class="event-header">
        <div class="event-heading">
          <span class="event-title">${this.title}</span>
          <span class="event-count">${filteredEntries.length}/${this.entries.length}</span>
        </div>
        <button class="clear-btn" @click=${this.handleClear}>Clear</button>
      </div>
      <div class="event-toolbar">
        <input
          id="event-search"
          class="search-input"
          type="search"
          placeholder="Search logs"
          .value=${this.searchQuery}
          @input=${this.handleSearchInput}
        />
        <div class="filter-row">
          <details class="filter-menu">
            <summary class="filter-trigger">${this.typeFilterLabel}</summary>
            <div class="filter-popover" @click=${this.preventToggle}>
              <label class="filter-check filter-check--all">
                <input
                  type="checkbox"
                  .checked=${this.selectedTypes.length === 0}
                  @change=${this.handleShowAllTypes}
                />
                <span>All</span>
              </label>
              ${eventTypes.length === 0
                ? html`<div class="filter-empty">No event types</div>`
                : eventTypes.map(
                    (type) => html`
                      <label
                        class="filter-check ${this.selectedTypes.includes(type)
                          ? "active"
                          : ""}"
                      >
                        <input
                          type="checkbox"
                          .checked=${this.selectedTypes.includes(type)}
                          @change=${(event: Event) =>
                            this.handleTypeToggle(event, type)}
                        />
                        <span>${type}</span>
                      </label>
                    `,
                  )}
            </div>
          </details>
        </div>
        <div class="filter-summary">Selected: ${this.selectedTypesSummary}</div>
      </div>
      <div class="event-list ${filteredEntries.length === 0 ? "event-list--empty" : ""}">
        ${filteredEntries.length === 0
          ? html`<div class="empty-state">No events yet</div>`
          : filteredEntries.map((entry) => this.renderEntry(entry))}
      </div>
    `;
  }

  private renderEntry(entry: MonitorEntry): TemplateResult {
    const expanded = this.expandedEntryIds.includes(entry.id);
    const eventTypeClass = this.getEventTypeClass(entry.event.type);

    return html`
      <div
        class="event-item ${expanded ? "expanded" : ""}"
        @click=${() => this.toggleEntry(entry.id)}
      >
        <div class="event-row">
          <md-icon class="event-expand ${expanded ? "event-expand--open" : ""}"
            >chevron_right</md-icon
          >
          <span class="event-time">${this.formatTime(entry.event.timestamp)}</span>
          <span class="event-content">
            <span class="event-type ${eventTypeClass}">${entry.event.type}</span>
            <span class="event-summary">${this.formatSummary(entry.event)}</span>
          </span>
        </div>
        ${expanded
          ? html`
              <div class="event-payload" @click=${this.preventToggle}>
                <aura-json-view
                  .data=${entry.event}
                  data-theme=${this.currentTheme}
                  style=${this.jsonViewStyle}
                ></aura-json-view>
              </div>
            `
          : html``}
      </div>
    `;
  }

  private handleClear = (): void => {
    this.clearEvents();
  };

  private handleShowAllTypes(event: Event): void {
    event.stopPropagation();
    this.selectedTypes = [];
    this.pruneExpandedEntries();
  }

  private handleTypeToggle(event: Event, type: string): void {
    event.stopPropagation();
    this.selectedTypes = this.selectedTypes.includes(type)
      ? this.selectedTypes.filter((selectedType) => selectedType !== type)
      : [...this.selectedTypes, type];
    this.pruneExpandedEntries();
  }

  private handleSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.pruneExpandedEntries();
  }

  private preventToggle(event: Event): void {
    event.stopPropagation();
  }

  private toggleEntry(id: number): void {
    this.expandedEntryIds = this.expandedEntryIds.includes(id)
      ? this.expandedEntryIds.filter((entryId) => entryId !== id)
      : [...this.expandedEntryIds, id];
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private getEventTypeClass(type: string): string {
    return `event-type--${type.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  }

  private get filteredEntries(): MonitorEntry[] {
    const normalizedQuery = this.searchQuery.trim().toLowerCase();

    return this.entries.filter((entry) => {
      const matchesType =
        this.selectedTypes.length === 0 ||
        this.selectedTypes.includes(entry.event.type);

      if (!matchesType) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        entry.event.type,
        this.formatSummary(entry.event),
        this.stringifyCompact(entry.event.payload),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }

  private get availableTypes(): string[] {
    return [...new Set(this.entries.map((entry) => entry.event.type))].sort();
  }

  private get typeFilterLabel(): string {
    return "Choose event types";
  }

  private get selectedTypesSummary(): string {
    if (this.selectedTypes.length === 0) return "all";
    return this.selectedTypes.join(", ");
  }

  private get jsonViewStyle(): string {
    return [
      "--aura-json-bg: var(--aura-input-bg, #ffffff)",
      "--aura-json-view-max-height: 220px",
    ].join("; ");
  }

  private get currentTheme(): string {
    return this.getAttribute("data-theme") ?? "light";
  }

  private get filterMenuElement(): HTMLDetailsElement | null {
    return this.renderRoot.querySelector(".filter-menu");
  }

  private formatSummary(event: AuraEvent): string {
    const payload = event.payload as Record<string, unknown>;

    switch (event.type) {
      case AuraEventType.MessageSent:
      case AuraEventType.MESSAGE_SENT:
        return this.toInlineText(
          `[User] ${this.extractMessageContent(payload["message"])}`,
        );
      case AuraEventType.MessageReceived:
      case AuraEventType.MESSAGE_RECEIVED:
        return this.toInlineText(
          `[AI] ${this.extractMessageContent(payload["message"])}`,
        );
      case AuraEventType.ToolCalled: {
        const entry = payload["entry"] as Record<string, unknown> | undefined;
        return this.toInlineText(
          `[Tool] ${`${String(entry?.["toolName"] ?? entry?.["tool"] ?? "tool")} ${String(entry?.["status"] ?? "").trim()}`.trim()}`,
        );
      }
      case AuraEventType.ToolStart:
        return this.toInlineText(
          `[Tool] ${`${String(payload["tool"] ?? "tool")} ${String(payload["callId"] ?? "")}`.trim()}`,
        );
      case AuraEventType.ToolSuccess:
        return this.toInlineText(
          `[Tool] ${String(payload["tool"] ?? "tool")} completed`,
        );
      case AuraEventType.ToolError:
        return this.toInlineText(
          `[Tool] ${String(payload["tool"] ?? "tool")} failed: ${String(payload["error"] ?? "")}`,
        );
      case AuraEventType.SkillSelected:
        return this.toInlineText(
          `[System] skill=${String(payload["skillName"] ?? "none")}`,
        );
      case AuraEventType.AgentLoopStarted:
      case AuraEventType.AgentLoopCompleted:
        return this.toInlineText(`[System] ${this.formatLoopSummary(payload)}`);
      case AuraEventType.AgentStepStarted:
      case AuraEventType.AgentStepCompleted: {
        const step = payload["step"] as Record<string, unknown> | undefined;
        return this.toInlineText(
          `[System] ${`${String(step?.["status"] ?? "").trim()} ${String(step?.["summary"] ?? "").trim()}`.trim()}`,
        );
      }
      case AuraEventType.Error:
      case AuraEventType.ERROR:
        return this.toInlineText(
          `[System] ${this.extractErrorMessage(payload["error"])}`,
        );
      case AuraEventType.Debug:
        return this.toInlineText(`[Debug] ${String(payload["message"] ?? "debug")}`);
      default:
        return this.toInlineText(`[System] ${this.stringifyCompact(payload)}`);
    }
  }

  private formatLoopSummary(payload: Record<string, unknown>): string {
    const stats = payload["stats"] as Record<string, unknown> | undefined;
    if (!stats) return "agent loop";

    const iterations = stats["iterations"];
    const durationMs = stats["durationMs"];
    const parts = [];

    if (iterations != null) parts.push(`iterations=${iterations}`);
    if (durationMs != null) parts.push(`duration=${durationMs}ms`);
    return parts.join(" ");
  }

  private extractMessageContent(message: unknown): string {
    if (typeof message === "string") return message;
    if (message && typeof message === "object") {
      const content = (message as Record<string, unknown>)["content"];
      if (typeof content === "string") return content;
    }
    return "";
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>)["message"];
      if (typeof message === "string") return message;
    }
    return "Unknown error";
  }

  private stringifyCompact(value: unknown): string {
    try {
      return JSON.stringify(value) ?? "";
    } catch {
      return String(value ?? "");
    }
  }

  private toInlineText(value: string): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized || "-";
  }

  private pruneExpandedEntries(): void {
    const visibleIds = new Set(this.filteredEntries.map((entry) => entry.id));
    this.expandedEntryIds = this.expandedEntryIds.filter((id) =>
      visibleIds.has(id),
    );
  }

  private nextStepId(): number {
    return this.nextEntryId++;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-event-monitor": AuraEventMonitorElement;
  }
}
