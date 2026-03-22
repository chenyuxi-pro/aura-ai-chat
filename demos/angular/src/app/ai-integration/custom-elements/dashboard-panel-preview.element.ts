
import { Component, Input } from '@angular/core';
import type { PanelConfig, PanelData } from '../../core/models/panel.model';

@Component({
    selector: 'app-dashboard-panel-preview-element',
    imports: [],
    template: `
    <section class="preview-card">
      <header class="preview-header">
        <span class="preview-type">{{ panelConfig?.type }}</span>
        <strong>{{ panelConfig?.title }}</strong>
      </header>

      <p class="preview-source">Source: {{ panelConfig?.dataSource }}</p>

      @if (panelConfig?.type === 'table') {
        <div class="table-preview">
          @for (row of sampleRows; track $index) {
            <div class="row">{{ row }}</div>
          }
        </div>
      } @else if (panelConfig?.type === 'stat-card') {
        <div class="stat-preview">
          <div class="label">{{ dataPreview?.stat?.label ?? 'Metric' }}</div>
          <div class="value">{{ dataPreview?.stat?.value ?? '--' }}</div>
        </div>
      } @else {
        <div class="chart-preview">
          @for (point of sampleChart; track point.label) {
            <div class="bar" [style.height.px]="point.height"></div>
          }
        </div>
      }

      <footer class="preview-footnote">
        Size: {{ panelConfig?.size?.width }} x {{ panelConfig?.size?.height }}
      </footer>
    </section>
  `,
    styles: [
        `
      :host {
        display: block;
      }

      .preview-card {
        border: 1px solid #d5dee6;
        border-radius: 10px;
        background: linear-gradient(160deg, #f8fbfd, #fefcf8);
        padding: 0.75rem;
        color: #1f3445;
      }

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .preview-type {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #0f7d91;
      }

      .preview-source {
        margin: 0.4rem 0 0.75rem;
        font-size: 0.78rem;
        color: #476074;
      }

      .table-preview {
        display: grid;
        gap: 0.25rem;
      }

      .table-preview .row {
        font-size: 0.74rem;
        border: 1px solid #dce5ec;
        border-radius: 6px;
        padding: 0.25rem 0.45rem;
        background: #ffffff;
      }

      .stat-preview {
        border: 1px solid #dce5ec;
        border-radius: 8px;
        padding: 0.6rem;
        background: #ffffff;
      }

      .stat-preview .label {
        font-size: 0.76rem;
        color: #476074;
      }

      .stat-preview .value {
        margin-top: 0.3rem;
        font-size: 1.35rem;
        font-weight: 700;
      }

      .chart-preview {
        display: flex;
        align-items: flex-end;
        gap: 0.4rem;
        min-height: 76px;
        padding: 0.4rem;
        border: 1px solid #dce5ec;
        border-radius: 8px;
        background: #ffffff;
      }

      .bar {
        width: 14px;
        min-height: 10px;
        border-radius: 5px 5px 2px 2px;
        background: linear-gradient(180deg, #0f7d91, #29af8f);
      }

      .preview-footnote {
        margin-top: 0.6rem;
        font-size: 0.72rem;
        color: #61798b;
      }
    `,
    ]
})
export class DashboardPanelPreviewElementComponent {
  @Input() panelConfig: PanelConfig | null = null;
  @Input() dataPreview: PanelData | null = null;

  get sampleRows(): string[] {
    const rows = this.dataPreview?.rows ?? [];
    if (rows.length === 0) {
      return ['No preview rows available'];
    }

    return rows.slice(0, 4).map((row) =>
      Object.entries(row)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | '),
    );
  }

  get sampleChart(): Array<{ label: string; height: number }> {
    const points = this.dataPreview?.chart?.points ?? [];
    if (points.length === 0) {
      return [
        { label: 'a', height: 24 },
        { label: 'b', height: 40 },
        { label: 'c', height: 32 },
      ];
    }

    const maxValue = Math.max(...points.map((point) => point.value), 1);
    return points.slice(0, 8).map((point) => ({
      label: point.label,
      height: Math.max(12, Math.round((point.value / maxValue) * 68)),
    }));
  }
}
