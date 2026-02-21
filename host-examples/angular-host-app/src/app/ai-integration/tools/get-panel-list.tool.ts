import type { Tool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { textResult } from './tool-utils';

export function createGetPanelListTool(dashboardService: DashboardService): Tool {
  return {
    name: 'dashboard.get_panel_list',
    title: 'Get Dashboard Panel List',
    description: 'Returns current panels with id, type, title, and data source.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return textResult({
        panels: dashboardService.getPanelListForAi(),
        count: dashboardService.panelCount(),
      });
    },
  };
}