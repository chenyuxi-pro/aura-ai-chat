import { Injectable, inject } from '@angular/core';
import type { AuraTool } from 'aura-ai-chat';
import { DataService } from '../../core/services/data.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ThemeService } from '../../core/services/theme.service';
import { createChangeThemeTool } from './change-theme.tool';
import { createCreatePanelTool } from './create-panel.tool';
import { createDeletePanelTool } from './delete-panel.tool';
import { createFetchCountriesTool } from './fetch-countries.tool';
import { createFetchWeatherTool } from './fetch-weather.tool';
import { createGetPanelListTool } from './get-panel-list.tool';
import { createGetSourceCatalogTool } from './get-source-catalog.tool';
import { createRenamePanelTool } from './rename-panel.tool';
import { createUpdatePanelTool } from './update-panel.tool';

@Injectable({ providedIn: 'root' })
export class ToolRegistryService {
  private readonly dashboardService = inject(DashboardService);
  private readonly dataService = inject(DataService);
  private readonly themeService = inject(ThemeService);

  private readonly tools: AuraTool[] = [
    createGetPanelListTool(this.dashboardService),
    createGetSourceCatalogTool(this.dashboardService),
    createFetchWeatherTool(this.dataService),
    createFetchCountriesTool(this.dataService),
    createRenamePanelTool(this.dashboardService),
    createChangeThemeTool(this.themeService),
    createCreatePanelTool(this.dashboardService),
    createUpdatePanelTool(this.dashboardService),
    createDeletePanelTool(this.dashboardService),
  ];

  getAll(): AuraTool[] {
    return this.tools;
  }
}
