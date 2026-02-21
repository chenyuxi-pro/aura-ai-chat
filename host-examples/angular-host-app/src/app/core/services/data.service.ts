import { Injectable } from '@angular/core';
import type { DataSourceId, SourceCatalogEntry } from '../models/panel.model';

export interface WeatherRequest {
  city: string;
  days?: number;
}

export interface WeatherPoint {
  date: string;
  temperatureC: number;
}

export interface WeatherPreview {
  city: string;
  points: WeatherPoint[];
  averageTemp: number;
  minTemp: number;
  maxTemp: number;
  source: DataSourceId;
}

export interface CountriesRequest {
  region?: string;
  limit?: number;
}

export interface CountryRecord {
  name: string;
  region: string;
  capital: string;
  population: number;
  areaKm2: number;
  countryCode: string;
}

export interface CountriesPreview {
  region: string;
  countries: CountryRecord[];
  totalPopulation: number;
  source: DataSourceId;
}

interface CityCoordinates {
  label: string;
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly cities: Record<string, CityCoordinates> = {
    paris: { label: 'Paris', latitude: 48.8566, longitude: 2.3522 },
    london: { label: 'London', latitude: 51.5072, longitude: -0.1276 },
    'new york': { label: 'New York', latitude: 40.7128, longitude: -74.006 },
    tokyo: { label: 'Tokyo', latitude: 35.6764, longitude: 139.6501 },
    berlin: { label: 'Berlin', latitude: 52.52, longitude: 13.405 },
    madrid: { label: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    sydney: { label: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
    singapore: { label: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
    toronto: { label: 'Toronto', latitude: 43.6532, longitude: -79.3832 },
    'san francisco': { label: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
  };

  getSourceCatalog(): SourceCatalogEntry[] {
    return [
      {
        id: 'open-meteo.weather',
        title: 'Open-Meteo Weather',
        description: 'Daily weather trends for supported cities. No API key required.',
        sampleQueries: [
          'Paris temperature last 7 days',
          'Tokyo weather trend',
          'New York weather table',
        ],
      },
      {
        id: 'rest-countries.countries',
        title: 'REST Countries',
        description: 'Country-level population and area statistics by region.',
        sampleQueries: [
          'European countries by population',
          'Asian countries bar chart',
          'Top 10 countries by area',
        ],
      },
    ];
  }

  async fetchWeather(request: WeatherRequest): Promise<WeatherPreview> {
    const cityKey = this.normalizeCityKey(request.city);
    const city = this.cities[cityKey] ?? this.cities['paris'];
    const days = this.clampNumber(request.days ?? 7, 3, 14);

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(city.latitude));
      url.searchParams.set('longitude', String(city.longitude));
      url.searchParams.set('hourly', 'temperature_2m');
      url.searchParams.set('past_days', String(days));
      url.searchParams.set('forecast_days', '1');
      url.searchParams.set('timezone', 'auto');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Weather API failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        hourly?: { time?: string[]; temperature_2m?: number[] };
      };

      const points = this.toDailyWeatherPoints(
        payload.hourly?.time ?? [],
        payload.hourly?.temperature_2m ?? [],
        days,
      );

      if (points.length === 0) {
        throw new Error('Weather API returned no data points.');
      }

      const values = points.map((point) => point.temperatureC);
      return {
        city: city.label,
        points,
        averageTemp: this.roundToOne(values.reduce((sum, value) => sum + value, 0) / values.length),
        minTemp: this.roundToOne(Math.min(...values)),
        maxTemp: this.roundToOne(Math.max(...values)),
        source: 'open-meteo.weather',
      };
    } catch {
      return this.createWeatherFallback(city.label, days);
    }
  }

  async fetchCountries(request: CountriesRequest): Promise<CountriesPreview> {
    const region = this.normalizeRegion(request.region);
    const limit = this.clampNumber(request.limit ?? 12, 3, 30);

    try {
      const fields = 'name,region,population,area,capital,cca2';
      const endpoint =
        region === 'all'
          ? `https://restcountries.com/v3.1/all?fields=${fields}`
          : `https://restcountries.com/v3.1/region/${region}?fields=${fields}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Countries API failed with status ${response.status}`);
      }

      const payload = (await response.json()) as Array<{
        name?: { common?: string };
        region?: string;
        capital?: string[];
        population?: number;
        area?: number;
        cca2?: string;
      }>;

      const countries = payload
        .map((country) => ({
          name: country.name?.common ?? 'Unknown',
          region: country.region ?? 'Unknown',
          capital: country.capital?.[0] ?? 'N/A',
          population: Number(country.population ?? 0),
          areaKm2: Number(country.area ?? 0),
          countryCode: country.cca2 ?? '--',
        }))
        .filter((country) => country.population > 0)
        .sort((a, b) => b.population - a.population)
        .slice(0, limit);

      if (countries.length === 0) {
        throw new Error('Countries API returned no rows.');
      }

      const totalPopulation = countries.reduce((sum, country) => sum + country.population, 0);

      return {
        region,
        countries,
        totalPopulation,
        source: 'rest-countries.countries',
      };
    } catch {
      return this.createCountriesFallback(region, limit);
    }
  }

  private toDailyWeatherPoints(times: string[], temperatures: number[], days: number): WeatherPoint[] {
    const dailyBuckets = new Map<string, number[]>();

    for (let index = 0; index < Math.min(times.length, temperatures.length); index += 1) {
      const isoTimestamp = times[index];
      const value = temperatures[index];
      if (!isoTimestamp || Number.isNaN(value)) {
        continue;
      }

      const day = isoTimestamp.slice(0, 10);
      const bucket = dailyBuckets.get(day) ?? [];
      bucket.push(value);
      dailyBuckets.set(day, bucket);
    }

    return Array.from(dailyBuckets.entries())
      .slice(-days)
      .map(([date, values]) => ({
        date,
        temperatureC: this.roundToOne(values.reduce((sum, value) => sum + value, 0) / values.length),
      }));
  }

  private createWeatherFallback(city: string, days: number): WeatherPreview {
    const now = new Date();
    const points: WeatherPoint[] = [];

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      const baseline = 12 + Math.sin(index / 2) * 6;
      points.push({
        date: date.toISOString().slice(0, 10),
        temperatureC: this.roundToOne(baseline + (index % 3)),
      });
    }

    const values = points.map((point) => point.temperatureC);
    return {
      city,
      points,
      averageTemp: this.roundToOne(values.reduce((sum, value) => sum + value, 0) / values.length),
      minTemp: this.roundToOne(Math.min(...values)),
      maxTemp: this.roundToOne(Math.max(...values)),
      source: 'open-meteo.weather',
    };
  }

  private createCountriesFallback(region: string, limit: number): CountriesPreview {
    const base: CountryRecord[] = [
      { name: 'France', region: 'Europe', capital: 'Paris', population: 68000000, areaKm2: 551695, countryCode: 'FR' },
      { name: 'Germany', region: 'Europe', capital: 'Berlin', population: 84000000, areaKm2: 357022, countryCode: 'DE' },
      { name: 'Japan', region: 'Asia', capital: 'Tokyo', population: 124000000, areaKm2: 377975, countryCode: 'JP' },
      { name: 'India', region: 'Asia', capital: 'New Delhi', population: 1430000000, areaKm2: 3287263, countryCode: 'IN' },
      { name: 'Brazil', region: 'Americas', capital: 'Brasilia', population: 203000000, areaKm2: 8515767, countryCode: 'BR' },
      { name: 'Canada', region: 'Americas', capital: 'Ottawa', population: 41000000, areaKm2: 9984670, countryCode: 'CA' },
    ];

    const filtered = region === 'all'
      ? base
      : base.filter((country) => country.region.toLowerCase() === region)
          .concat(base.filter((country) => country.region.toLowerCase() !== region));

    const countries = filtered.slice(0, limit);
    const totalPopulation = countries.reduce((sum, country) => sum + country.population, 0);

    return {
      region,
      countries,
      totalPopulation,
      source: 'rest-countries.countries',
    };
  }

  private normalizeCityKey(input: string): string {
    return String(input ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private normalizeRegion(input: string | undefined): string {
    const normalized = String(input ?? 'all').trim().toLowerCase();
    if (!normalized) {
      return 'all';
    }

    const aliases: Record<string, string> = {
      america: 'americas',
      americas: 'americas',
      europe: 'europe',
      asia: 'asia',
      africa: 'africa',
      oceania: 'oceania',
      antarctic: 'antarctic',
      all: 'all',
      global: 'all',
      world: 'all',
    };

    return aliases[normalized] ?? 'all';
  }

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  private roundToOne(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
