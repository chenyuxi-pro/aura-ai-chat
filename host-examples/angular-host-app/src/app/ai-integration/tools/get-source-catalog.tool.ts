import type { AuraTool } from 'aura-ai-chat';
import { DashboardService } from '../../core/services/dashboard.service';
import { textResult } from './tool-utils';

export function createGetSourceCatalogTool(dashboardService: DashboardService): AuraTool {
  return {
    name: 'dashboard.get_source_catalog',
    title: 'Get Data Source Catalog',
    description: 'Returns available data sources and examples.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return textResult({
        sources: dashboardService.getSourceCatalogForAi(),
      });
    },
  };
}
