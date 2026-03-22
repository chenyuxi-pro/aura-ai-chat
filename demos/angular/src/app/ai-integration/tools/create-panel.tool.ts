import type { AuraTool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { customElementPreview, normalizePanelConfigInput, textResult } from './tool-utils';

export function createCreatePanelTool(dashboardService: DashboardService): AuraTool {
  return {
    name: 'dashboard.panel.create',
    title: 'Create Panel',
    description: 'Creates a new dashboard panel.',
    risk: 'moderate',
    inputSchema: {
      type: 'object',
      properties: {
        panelConfig: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            dataSource: { type: 'string' },
            query: { type: 'object' },
            displayConfig: { type: 'object' },
            size: { type: 'object' },
          },
          required: ['type', 'title', 'dataSource', 'displayConfig', 'size'],
        },
      },
      required: ['panelConfig'],
    },
    preview: {
      buildContent: async (args) => {
        const panelConfig = normalizePanelConfigInput(args['panelConfig']);
        const dataPreview = await dashboardService.previewPanelData(panelConfig);
        return customElementPreview('dashboard-panel-preview', {
          panelConfig,
          dataPreview,
        });
      },
    },
    execute: async (input) => {
      const panelConfig = normalizePanelConfigInput(input['panelConfig']);
      const panel = await dashboardService.createPanel(panelConfig);

      return textResult({
        created: {
          id: panel.id,
          title: panel.title,
          type: panel.type,
          dataSource: panel.dataSource,
        },
      });
    },
  };
}
