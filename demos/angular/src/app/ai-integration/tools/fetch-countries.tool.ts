import type { AuraTool } from 'aura-ai-chat';
import { DataService } from '../../core/services/data.service';
import { asRecord, readNumber, readString, textResult } from './tool-utils';

export function createFetchCountriesTool(dataService: DataService): AuraTool {
  return {
    name: 'data.fetch_countries',
    title: 'Fetch Country Statistics',
    description: 'Fetches country statistics optionally filtered by region.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name such as europe or asia.' },
        limit: { type: 'integer', description: 'Maximum number of countries to return.' },
      },
      required: [],
    },
    execute: async (input) => {
      const args = asRecord(input);
      const region = readString(args['region'], 'all');
      const limit = readNumber(args['limit'], 12);

      const countries = await dataService.fetchCountries({ region, limit });
      return textResult({
        region: countries.region,
        totalPopulation: countries.totalPopulation,
        rows: countries.countries,
      });
    },
  };
}
