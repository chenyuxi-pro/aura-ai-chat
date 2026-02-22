
import { Component, Input } from '@angular/core';

interface DiffRow {
  key: string;
  before: string;
  after: string;
  changed: boolean;
}

@Component({
    selector: 'app-data-diff-view-element',
    imports: [],
    template: `
    <section class="diff-card">
      <header>
        <strong>Panel Update Preview</strong>
      </header>

      <div class="columns">
        <div class="column-head">Before</div>
        <div class="column-head">After</div>
      </div>

      <div class="rows">
        @for (row of rows; track row.key) {
          <div class="row" [class.changed]="row.changed">
            <div class="meta">{{ row.key }}</div>
            <div class="value">{{ row.before }}</div>
            <div class="value">{{ row.after }}</div>
          </div>
        }
      </div>
    </section>
  `,
    styles: [
        `
      :host {
        display: block;
      }

      .diff-card {
        border: 1px solid #d5dee6;
        border-radius: 10px;
        background: #fffdfa;
        padding: 0.75rem;
        color: #1f3445;
      }

      .columns {
        display: grid;
        grid-template-columns: 120px 1fr 1fr;
        gap: 0.4rem;
        margin-top: 0.55rem;
        font-size: 0.72rem;
        color: #6b7e8d;
      }

      .column-head {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .column-head:first-child {
        visibility: hidden;
      }

      .rows {
        margin-top: 0.35rem;
        display: grid;
        gap: 0.32rem;
      }

      .row {
        display: grid;
        grid-template-columns: 120px 1fr 1fr;
        gap: 0.4rem;
        border: 1px solid #dce5ec;
        border-radius: 8px;
        padding: 0.4rem;
        background: #ffffff;
      }

      .row.changed {
        border-color: #f0b861;
        background: #fff8ec;
      }

      .meta {
        font-size: 0.72rem;
        color: #607787;
        font-weight: 700;
      }

      .value {
        font-size: 0.78rem;
        line-height: 1.25;
        color: #253d4d;
        word-break: break-word;
      }
    `,
    ]
})
export class DataDiffViewElementComponent {
  @Input() before: unknown;
  @Input() after: unknown;

  get rows(): DiffRow[] {
    const beforeMap = this.flatten('', this.before);
    const afterMap = this.flatten('', this.after);
    const keys = new Set<string>([...Object.keys(beforeMap), ...Object.keys(afterMap)]);

    return Array.from(keys)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 20)
      .map((key) => {
        const beforeValue = beforeMap[key] ?? 'undefined';
        const afterValue = afterMap[key] ?? 'undefined';

        return {
          key,
          before: beforeValue,
          after: afterValue,
          changed: beforeValue !== afterValue,
        };
      });
  }

  private flatten(prefix: string, source: unknown): Record<string, string> {
    if (source === null || source === undefined) {
      return prefix ? { [prefix]: String(source) } : {};
    }

    if (typeof source !== 'object' || Array.isArray(source)) {
      return prefix ? { [prefix]: this.stringifyValue(source) } : { value: this.stringifyValue(source) };
    }

    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(source)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flatten(path, value));
      } else {
        result[path] = this.stringifyValue(value);
      }
    }

    return result;
  }

  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (value === null || value === undefined) {
      return String(value);
    }
    return JSON.stringify(value);
  }
}