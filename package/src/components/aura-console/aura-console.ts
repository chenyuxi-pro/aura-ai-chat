import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { AuraEventType } from "../../types/index.js";
import type { AuraEvent } from "../../types/index.js";
import { EventBus } from "../../logging/event-bus.js";
import "@material/web/icon/icon.js";
import styles from "./aura-console.css?inline";

type LogLevel = "all" | "info" | "warn" | "error" | "debug";

@customElement("aura-console")
export class AuraConsole extends LitElement {
  static override styles = [unsafeCSS(styles)];

  @state() private events: AuraEvent[] = [];
  @state() private filter: LogLevel = "all";
  @state() private autoScroll = true;

  @query(".log-container") private logContainerEl!: HTMLDivElement;

  private eventBusUnsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.eventBusUnsubscribe = EventBus.subscribe((event: AuraEvent) => {
      this.events = [...this.events, event];
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.logContainerEl) {
        this.logContainerEl.scrollTop = this.logContainerEl.scrollHeight;
      }
    }, 0);
  }

  private handleClear(): void {
    this.events = [];
  }

  private toggleAutoScroll(): void {
    this.autoScroll = !this.autoScroll;
  }

  private setFilter(level: LogLevel): void {
    this.filter = level;
  }

  private get filteredEvents(): AuraEvent[] {
    if (this.filter === "all") return this.events;
    return this.events.filter((e) => {
      if (this.filter === "error") return e.type === AuraEventType.Error;
      if (this.filter === "warn") return false; // Aura currently doesn't have a specific 'warn' event type
      if (this.filter === "info")
        return (
          e.type !== AuraEventType.Error &&
          e.type !== AuraEventType.Debug &&
          e.type !== AuraEventType.ToolStart &&
          e.type !== AuraEventType.ToolSuccess &&
          e.type !== AuraEventType.ToolError
        );
      if (this.filter === "debug")
        return (
          e.type === AuraEventType.Debug ||
          e.type === AuraEventType.ToolStart ||
          e.type === AuraEventType.ToolSuccess ||
          e.type === AuraEventType.ToolError
        );
      return true;
    });
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toTimeString().split(" ")[0];
  }

  private getEventLevel(type: AuraEventType): string {
    switch (type) {
      case AuraEventType.Error:
      case AuraEventType.ToolError:
        return "error";
      case AuraEventType.Debug:
      case AuraEventType.ToolStart:
      case AuraEventType.ToolSuccess:
        return "debug";
      default:
        return "info";
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="header">
        <div class="header__title">
          <md-icon>terminal</md-icon>
          Event Log
        </div>
        <div class="header__actions">
          <button
            class="header__btn ${this.autoScroll ? "header__btn--active" : ""}"
            @click=${this.toggleAutoScroll}
            title="Toggle Auto-scroll"
          >
            <md-icon>vertical_align_bottom</md-icon>
          </button>
          <button
            class="header__btn"
            @click=${this.handleClear}
            title="Clear Logs"
          >
            <md-icon>block</md-icon>
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          <button
            class="filter-btn"
            ?active=${this.filter === "all"}
            @click=${() => this.setFilter("all")}
          >
            All
          </button>
          <button
            class="filter-btn info"
            ?active=${this.filter === "info"}
            @click=${() => this.setFilter("info")}
          >
            Info
          </button>
          <button
            class="filter-btn debug"
            ?active=${this.filter === "debug"}
            @click=${() => this.setFilter("debug")}
          >
            Debug
          </button>
          <button
            class="filter-btn warn"
            ?active=${this.filter === "warn"}
            @click=${() => this.setFilter("warn")}
          >
            Warn
          </button>
          <button
            class="filter-btn error"
            ?active=${this.filter === "error"}
            @click=${() => this.setFilter("error")}
          >
            Error
          </button>
        </div>
        <div class="stats">${this.filteredEvents.length} events</div>
      </div>

      <div class="log-container">
        ${this.filteredEvents.length === 0
          ? html`
              <div class="empty-logs">
                <md-icon>Inbox</md-icon>
                No events recorded
              </div>
            `
          : this.filteredEvents.map((e) => this.renderEvent(e))}
      </div>
    `;
  }

  private renderEvent(event: AuraEvent): TemplateResult {
    const level = this.getEventLevel(event.type);
    return html`
      <div class="event-row event-row--${level}">
        <span class="event-time">${this.formatTime(event.timestamp)}</span>
        <span class="event-level">${level}</span>
        <span class="event-msg">${this.formatMessage(event)}</span>
      </div>
    `;
  }

  private formatMessage(event: AuraEvent): string {
    const payload = event.payload as Record<string, any>;

    switch (event.type) {
      case AuraEventType.MessageSent:
        return `[User] ${payload.text ?? ""}`;
      case AuraEventType.MessageReceived:
        return `[AI] ${(payload.message?.content ?? "").substring(0, 100)}...`;
      case AuraEventType.ToolStart:
        return `[Tool] Starting ${payload.tool} (${payload.callId})`;
      case AuraEventType.ToolSuccess:
        return `[Tool] Success ${payload.tool} (${payload.callId})`;
      case AuraEventType.ToolError:
        return `[Tool] Error ${payload.tool}: ${payload.error}`;
      case AuraEventType.Error:
        return `[System] Error: ${payload.error?.message ?? payload.error ?? "Unknown error"}`;
      case AuraEventType.Debug:
        return `[Debug] ${payload.message ?? ""}`;
      default:
        return `[${event.type}] ${JSON.stringify(payload)}`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "aura-console": AuraConsole;
  }
}
