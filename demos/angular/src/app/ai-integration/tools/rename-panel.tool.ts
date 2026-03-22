import type { AuraTool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { asRecord, readString, textResult } from './tool-utils';

export function createRenamePanelTool(dashboardService: DashboardService): AuraTool {
  return {
    name: 'dashboard.panel.rename',
    title: 'Rename Panel',
    description: 'Renames a panel by id.',
    risk: 'safe',
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
