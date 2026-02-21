import type { Tool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { asRecord, readString, textResult } from './tool-utils';

export function createRenamePanelTool(dashboardService: DashboardService): Tool {
  return {
    name: 'dashboard.panel.rename',
    title: 'Rename Panel',
    description: 'Renames a panel by id.',
    risk: 'safe',
    label: 'Rename panel',
    inputSchema: {
      type: 'object',
      properties: {
        panelId: { type: 'string', description: 'Panel id.' },
        title: { type: 'string', description: 'New panel title.' },
      },
      required: ['panelId', 'title'],
    },
    execute: async (input) => {
      const args = asRecord(input);
      const panelId = readString(args['panelId']);
      const title = readString(args['title']);

      const panel = dashboardService.renamePanel(panelId, title);
      if (!panel) {
        return textResult({ error: `Panel ${panelId} was not found.` }, true);
      }

      return textResult({
        panelId,
        title: panel.title,
      });
    },
  };
}