import { AuraEventType } from "../types/index.js";
import type { AuraEvent } from "../types/index.js";

export const AUDIT_EVENT_NAME = "aura:audit";

export class EventBus {
  private static globalTarget = new EventTarget();

  constructor(
    private hostTarget?: EventTarget,
    private onAuraEvent: ((event: AuraEvent) => void) | undefined = undefined,
  ) {}

  static subscribe(listener: (event: AuraEvent) => void): () => void {
    const handler = (evt: Event): void => {
      listener((evt as CustomEvent<AuraEvent>).detail);
    };
    EventBus.globalTarget.addEventListener(AUDIT_EVENT_NAME, handler);
    return () => EventBus.globalTarget.removeEventListener(AUDIT_EVENT_NAME, handler);
  }

  emit(type: AuraEventType, payload: Record<string, unknown> = {}): void {
    const stamped: AuraEvent = {
      type,
      timestamp: Date.now(),
      payload,
      event: payload,
    };

    this.onAuraEvent?.(stamped);

    const auditEvent = new CustomEvent(AUDIT_EVENT_NAME, {
      bubbles: true,
      composed: true,
      detail: stamped,
    });

    EventBus.globalTarget.dispatchEvent(auditEvent);
    this.hostTarget?.dispatchEvent(auditEvent);
  }
}
