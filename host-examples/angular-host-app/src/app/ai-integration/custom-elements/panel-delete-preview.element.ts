import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { DashboardPanel } from '../../core/models/panel.model';

@Component({
  selector: 'app-panel-delete-preview-element',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="delete-card">
      <header>
        <strong>Delete Panel</strong>
      </header>

      <div class="target">
        <div class="title">{{ panel?.title ?? 'Unknown panel' }}</div>
        <div class="meta">Type: {{ panel?.type ?? 'n/a' }}</div>
        <div class="meta">Source: {{ panel?.dataSource ?? 'n/a' }}</div>
      </div>

      <p class="warning">This cannot be undone.</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .delete-card {
        border: 1px solid #f2a7a7;
        border-radius: 10px;
        background: #fff2f2;
        padding: 0.75rem;
        color: #742121;
      }

      .target {
        margin-top: 0.5rem;
        border: 1px solid #f3c2c2;
        border-radius: 8px;
        padding: 0.55rem;
        background: #ffffff;
      }

      .title {
        font-weight: 700;
      }

      .meta {
        margin-top: 0.2rem;
        font-size: 0.78rem;
        color: #9a3f3f;
      }

      .warning {
        margin: 0.55rem 0 0;
        font-size: 0.78rem;
        color: #b72626;
        font-weight: 700;
      }
    `,
  ],
})
export class PanelDeletePreviewElementComponent {
  @Input() panel: DashboardPanel | null = null;
}