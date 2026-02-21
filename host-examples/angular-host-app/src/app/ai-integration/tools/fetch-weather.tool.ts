import type { Tool } from 'aura-ai-chat';
import { DataService } from '../../core/services/data.service';
import { asRecord, readNumber, readString, textResult } from './tool-utils';

export function createFetchWeatherTool(dataService: DataService): Tool {
  return {
    name: 'data.fetch_weather',
    title: 'Fetch Weather Data',
    description: 'Fetches weather time series for a city using Open-Meteo.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, for example Paris.' },
        days: { type: 'integer', description: 'History window in days (3-14).' },
      },
      required: ['city'],
    },
    execute: async (input) => {
      const args = asRecord(input);
      const city = readString(args['city'], 'Paris');
      const days = readNumber(args['days'], 7);

      const weather = await dataService.fetchWeather({ city, days });
      return textResult({
        city: weather.city,
        averageTemp: weather.averageTemp,
        minTemp: weather.minTemp,
        maxTemp: weather.maxTemp,
        sample: weather.points.slice(-7),
      });
    },
  };
}