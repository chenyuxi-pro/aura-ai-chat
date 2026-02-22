
import { Component, Input } from '@angular/core';
import type { DashboardPanel } from '../../../core/models/panel.model';

@Component({
    selector: 'app-stat-card-panel',
    imports: [],
    templateUrl: './stat-card-panel.component.html',
    styleUrl: './stat-card-panel.component.scss'
})
export class StatCardPanelComponent {
  @Input({ required: true }) panel!: DashboardPanel;
}