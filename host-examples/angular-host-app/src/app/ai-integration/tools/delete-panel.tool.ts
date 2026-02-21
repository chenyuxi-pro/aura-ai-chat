import type { Tool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { readString, textResult } from './tool-utils';

export function createDeletePanelTool(dashboardService: DashboardService): Tool {
  return {
    name: 'dashboard.panel.delete',
    title: 'Delete Panel',
    description: 'Deletes a panel by id.',
    label: 'Delete panel',
    risk: 'destructive',
    inputSchema: {
      type: 'object',
      properties: {
        panelId: { type: 'string', description: 'Panel id to delete.' },
      },
      required: ['panelId'],
    },
    preview: {
      element: 'panel-delete-preview',
      buildProps: async (args) => {
        const panelId = readString(args['panelId']);
        const panel = dashboardService.getPanelById(panelId);

        if (!panel) {
          throw new Error(`Panel ${panelId} was not found.`);
        }

        return { panel };
      },
    },
    execute: async (input) => {
      const panelId = readString(input['panelId']);
      const deleted = dashboardService.deletePanel(panelId);

      if (!deleted) {
        return textResult({ error: `Panel ${panelId} was not found.` }, true);
      }

      return textResult({
        deleted: {
          id: deleted.id,
          title: deleted.title,
          type: deleted.type,
        },
      });
    },
  };
}