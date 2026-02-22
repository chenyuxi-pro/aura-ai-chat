import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  runInInjectionContext,
} from '@angular/core';

import type { AuraConfig } from 'aura-ai-chat';
import { AngularSplitModule } from 'angular-split';
import type { IOutputData } from 'angular-split';
import { DashboardService } from '../core/services/dashboard.service';
import { ThemeService } from '../core/services/theme.service';
import type { DashboardPanel, PanelType } from '../core/models/panel.model';
import { WidgetConfigBuilder } from '../ai-integration/widget-config.builder';
import { registerPreviewCustomElements } from '../ai-integration/custom-elements/register-preview-elements';
import { TablePanelComponent } from './panels/table-panel/table-panel.component';
import { LineChartPanelComponent } from './panels/line-chart-panel/line-chart-panel.component';
import { BarChartPanelComponent } from './panels/bar-chart-panel/bar-chart-panel.component';
import { StatCardPanelComponent } from './panels/stat-card-panel/stat-card-panel.component';

interface AuraWidgetElement extends HTMLElement {
  config: AuraConfig;
}

@Component({
    selector: 'app-dashboard',
    imports: [
    AngularSplitModule,
    TablePanelComponent,
    LineChartPanelComponent,
    BarChartPanelComponent,
    StatCardPanelComponent
],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private readonly injector = inject(Injector);
  readonly dashboardService = inject(DashboardService);
  readonly themeService = inject(ThemeService);
  private readonly widgetConfigBuilder = inject(WidgetConfigBuilder);

  @ViewChild('chatWidget') chatWidget?: ElementRef<AuraWidgetElement>;

  readonly addMenuOpen = signal(false);
  readonly panelTypes: PanelType[] = ['table', 'line-chart', 'bar-chart', 'stat-card'];
  readonly themeLabel = computed(() => this.themeService.getLabel());

  private stopConfigEffect?: { destroy: () => void };
  private resizing:
    | {
        panelId: string;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
      }
    | null = null;

  private readonly onWindowMouseMove = (event: MouseEvent) => {
    if (!this.resizing) {
      return;
    }

    const deltaX = event.clientX - this.resizing.startX;
    const deltaY = event.clientY - this.resizing.startY;
    this.dashboardService.resizePanel(this.resizing.panelId, {
      width: this.resizing.startWidth + deltaX,
      height: this.resizing.startHeight + deltaY,
    });
  };

  private readonly onWindowMouseUp = () => {
    this.resizing = null;
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  };

  constructor() {
    registerPreviewCustomElements(this.injector);
  }

  ngAfterViewInit(): void {
    this.injectConfig();

    runInInjectionContext(this.injector, () => {
      this.stopConfigEffect = effect(() => {
        this.dashboardService.panels();
        this.themeService.preference();
        this.themeService.resolvedTheme();
        this.dashboardService.panelCount();

        this.injectConfig();
      });
    });
  }

  ngOnDestroy(): void {
    this.stopConfigEffect?.destroy();
    this.onWindowMouseUp();
  }

  toggleTheme(): void {
    this.themeService.cycleTheme();
  }

  toggleChatSidebar(): void {
    const collapsed = this.dashboardService.sidebarCollapsed();
    this.dashboardService.setSidebarCollapsed(!collapsed);

    if (collapsed && this.dashboardService.sidebarWidth() < 320) {
      this.dashboardService.setSidebarWidth(420);
    }
  }

  async addPanel(type: PanelType): Promise<void> {
    this.addMenuOpen.set(false);
    const config = this.dashboardService.createDefaultPanelConfig(type);
    await this.dashboardService.createPanel(config);
  }

  removePanel(panelId: string): void {
    this.dashboardService.deletePanel(panelId);
  }

  renamePanel(panelId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dashboardService.renamePanel(panelId, input.value);
  }

  onSplitDragEnd(event: IOutputData): void {
    const sizes = event.sizes;
    if (!Array.isArray(sizes) || sizes.length < 2) {
      return;
    }

    const sidebarSize = sizes[1];
    if (typeof sidebarSize === 'number') {
      this.dashboardService.setSidebarWidth(sidebarSize);
    }
  }

  startResize(event: MouseEvent, panel: DashboardPanel): void {
    event.preventDefault();
    event.stopPropagation();

    this.resizing = {
      panelId: panel.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panel.size.width,
      startHeight: panel.size.height,
    };

    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  panelTypeLabel(type: PanelType): string {
    switch (type) {
      case 'line-chart':
        return 'Line chart';
      case 'bar-chart':
        return 'Bar chart';
      case 'stat-card':
        return 'Stat card';
      default:
        return 'Table';
    }
  }

  private injectConfig(): void {
    const widget = this.chatWidget?.nativeElement;
    if (!widget) {
      return;
    }

    widget.config = this.widgetConfigBuilder.buildConfig();
  }
}