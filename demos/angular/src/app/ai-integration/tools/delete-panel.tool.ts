import type { AuraTool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { customElementPreview, readString, textResult } from './tool-utils';

export function createDeletePanelTool(dashboardService: DashboardService): AuraTool {
  return {
    name: 'dashboard.panel.delete',
    title: 'Delete Panel',
    description: 'Deletes a panel by id.',
    risk: 'destructive',
    inputSchema: {
      type: 'object',
      properties: {
        panelId: { type: 'string', description: 'Panel id to delete.' },
      },
      required: ['panelId'],
    },
    preview: {
      buildContent: async (args) => {
        const panelId = readString(args['panelId']);
        const panel = dashboardService.getPanelById(panelId);

        return customElementPreview('panel-delete-preview', {
          panel: panel ?? null,
        });
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
