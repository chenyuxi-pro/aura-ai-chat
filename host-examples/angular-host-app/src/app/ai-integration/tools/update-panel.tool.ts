import type { AuraTool } from 'aura-ai-chat';
import type { PanelConfig } from '../../core/models/panel.model';
import { DashboardService } from '../../core/services/dashboard.service';
import {
  asRecord,
  customElementPreview,
  normalizeDataSource,
  normalizePanelType,
  readNumber,
  readString,
  textResult,
} from './tool-utils';

function normalizePatch(raw: unknown): Partial<PanelConfig> {
  const patch = asRecord(raw);
  const size = asRecord(patch['size']);
  const displayConfig = asRecord(patch['displayConfig']);

  const normalized: Partial<PanelConfig> = {};

  if (patch['type'] !== undefined) {
    normalized.type = normalizePanelType(patch['type']);
  }

  if (patch['title'] !== undefined) {
    normalized.title = readString(patch['title']);
  }

  if (patch['dataSource'] !== undefined) {
    normalized.dataSource = normalizeDataSource(patch['dataSource']);
  }

  if (patch['query'] !== undefined) {
    normalized.query = asRecord(patch['query']);
  }

  if (patch['displayConfig'] !== undefined) {
    normalized.displayConfig = {
      xKey: readString(displayConfig['xKey']) || undefined,
      yKey: readString(displayConfig['yKey']) || undefined,
      metricLabel: readString(displayConfig['metricLabel']) || undefined,
      columns: Array.isArray(displayConfig['columns'])
        ? displayConfig['columns'].map((item) => readString(item)).filter(Boolean)
        : undefined,
      color: readString(displayConfig['color']) || undefined,
    };
  }

  if (patch['size'] !== undefined) {
    normalized.size = {
      width: readNumber(size['width'], 420),
      height: readNumber(size['height'], 300),
    };
  }

  return normalized;
}

export function createUpdatePanelTool(dashboardService: DashboardService): AuraTool {
  return {
    name: 'dashboard.panel.update',
    title: 'Update Panel',
    description: 'Updates an existing panel with partial config patch.',
    risk: 'moderate',
    inputSchema: {
      type: 'object',
      properties: {
        panelId: { type: 'string', description: 'Panel id.' },
        patch: { type: 'object', description: 'Partial panel config patch.' },
      },
      required: ['panelId', 'patch'],
    },
    preview: {
      buildContent: async (args) => {
        const panelId = readString(args['panelId']);
        const patch = normalizePatch(args['patch']);
        const diff = dashboardService.previewUpdatedPanel(panelId, patch);

        return customElementPreview('data-diff-view', {
          before: diff.before,
          after: diff.after,
        });
      },
    },
    execute: async (input) => {
      const panelId = readString(input['panelId']);
      const patch = normalizePatch(input['patch']);
      const panel = await dashboardService.updatePanel(panelId, patch);

      if (!panel) {
        return textResult({ error: `Panel ${panelId} was not found.` }, true);
      }

      return textResult({
        updated: {
          id: panel.id,
          title: panel.title,
          type: panel.type,
          dataSource: panel.dataSource,
        },
      });
    },
  };
}
