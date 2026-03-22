import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  DashboardPanel,
  PanelConfig,
  PanelData,
  PanelDisplayConfig,
  PanelSize,
  PanelType,
  DataSourceId,
  DashboardSnapshot,
  ThemePreference,
} from '../models/panel.model';
import type { CountryRecord, CountriesPreview, WeatherPreview } from './data.service';
import { DataService } from './data.service';

const PANELS_STORAGE_KEY = 'angular-host-app:panels';
const SIDEBAR_WIDTH_STORAGE_KEY = 'angular-host-app:sidebar-width';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'angular-host-app:sidebar-collapsed';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly dataService = inject(DataService);

  readonly panels = signal<DashboardPanel[]>(this.restorePanels());
  readonly sidebarWidth = signal<number>(this.restoreNumber(SIDEBAR_WIDTH_STORAGE_KEY, 420));
  readonly sidebarCollapsed = signal<boolean>(this.restoreBoolean(SIDEBAR_COLLAPSED_STORAGE_KEY, false));
  readonly sourceCatalog = this.dataService.getSourceCatalog();

  readonly panelCount = computed(() => this.panels().length);

  constructor() {
    if (this.panels().length === 0) {
      void this.seedDefaultPanels();
    }

    effect(() => {
      localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(this.panels()));
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(this.sidebarWidth()));
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(this.sidebarCollapsed()));
    });
  }

  createDefaultPanelConfig(type: PanelType): PanelConfig {
    if (type === 'table') {
      return {
        type,
        title: 'European Countries',
        dataSource: 'rest-countries.countries',
        query: { region: 'europe', limit: 12 },
        displayConfig: { columns: ['name', 'capital', 'population', 'areaKm2'] },
        size: { width: 440, height: 320 },
      };
    }

    if (type === 'line-chart') {
      return {
        type,
        title: 'Paris Temperature Trend',
        dataSource: 'open-meteo.weather',
        query: { city: 'Paris', days: 7 },
        displayConfig: { xKey: 'date', yKey: 'temperatureC', metricLabel: 'Temperature (C)' },
        size: { width: 440, height: 320 },
      };
    }

    if (type === 'bar-chart') {
      return {
        type,
        title: 'Asia Population Comparison',
        dataSource: 'rest-countries.countries',
        query: { region: 'asia', limit: 10 },
        displayConfig: { xKey: 'name', yKey: 'population', metricLabel: 'Population' },
        size: { width: 440, height: 320 },
      };
    }

    return {
      type,
      title: 'Average Paris Temperature',
      dataSource: 'open-meteo.weather',
      query: { city: 'Paris', days: 7 },
      displayConfig: { metricLabel: 'Average Temperature' },
      size: { width: 300, height: 220 },
    };
  }

  getPanelById(panelId: string): DashboardPanel | undefined {
    return this.panels().find((panel) => panel.id === panelId);
  }

  getPanelListForAi(): Array<{ id: string; type: PanelType; title: string; dataSource: DataSourceId }> {
    return this.panels().map((panel) => ({
      id: panel.id,
      type: panel.type,
      title: panel.title,
      dataSource: panel.dataSource,
    }));
  }

  getSourceCatalogForAi() {
    return this.sourceCatalog;
  }

  hasDuplicatePanel(config: PanelConfig): boolean {
    const normalizedQuery = this.stableJson(config.query ?? {});
    return this.panels().some(
      (panel) =>
        panel.type === config.type &&
        panel.dataSource === config.dataSource &&
        this.stableJson(panel.query ?? {}) === normalizedQuery,
    );
  }

  async createPanel(config: PanelConfig, allowDuplicates = false): Promise<DashboardPanel> {
    const normalized = this.normalizePanelConfig(config);

    if (!allowDuplicates && this.hasDuplicatePanel(normalized)) {
      throw new Error('A panel with the same type and data source already exists.');
    }

    const now = new Date().toISOString();
    const panel: DashboardPanel = {
      id: crypto.randomUUID(),
      ...normalized,
      createdAt: now,
      updatedAt: now,
      loading: true,
    };

    this.panels.update((items) => [...items, panel]);

    try {
      const data = await this.loadPanelData(panel);
      this.panels.update((items) =>
        items.map((item) =>
          item.id === panel.id
            ? { ...item, data, loading: false, error: undefined, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (error) {
      this.panels.update((items) =>
        items.map((item) =>
          item.id === panel.id
            ? {
                ...item,
                loading: false,
                error: error instanceof Error ? error.message : 'Could not load panel data',
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    }

    return this.getPanelById(panel.id) ?? panel;
  }

  async updatePanel(panelId: string, patch: Partial<PanelConfig>): Promise<DashboardPanel | null> {
    const before = this.getPanelById(panelId);
    if (!before) {
      return null;
    }

    const merged = this.buildUpdatedPanel(before, patch);
    const shouldReload =
      patch.dataSource !== undefined ||
      patch.type !== undefined ||
      patch.query !== undefined ||
      patch.displayConfig !== undefined;

    this.panels.update((items) =>
      items.map((item) =>
        item.id === panelId
          ? {
              ...merged,
              id: item.id,
              createdAt: item.createdAt,
              updatedAt: new Date().toISOString(),
              loading: shouldReload,
              error: undefined,
              data: shouldReload ? item.data : item.data,
            }
          : item,
      ),
    );

    if (shouldReload) {
      try {
        const refreshedPanel = this.getPanelById(panelId);
        if (refreshedPanel) {
          const data = await this.loadPanelData(refreshedPanel);
          this.panels.update((items) =>
            items.map((item) =>
              item.id === panelId
                ? { ...item, data, loading: false, error: undefined, updatedAt: new Date().toISOString() }
                : item,
            ),
          );
        }
      } catch (error) {
        this.panels.update((items) =>
          items.map((item) =>
            item.id === panelId
              ? {
                  ...item,
                  loading: false,
                  error: error instanceof Error ? error.message : 'Could not refresh panel data',
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      }
    }

    return this.getPanelById(panelId) ?? null;
  }

  previewUpdatedPanel(panelId: string, patch: Partial<PanelConfig>): { before: DashboardPanel; after: DashboardPanel } {
    const before = this.getPanelById(panelId);
    if (!before) {
      throw new Error(`Panel ${panelId} was not found.`);
    }

    const after = {
      ...before,
      ...this.buildUpdatedPanel(before, patch),
      updatedAt: new Date().toISOString(),
    };

    return { before, after };
  }

  renamePanel(panelId: string, title: string): DashboardPanel | null {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return null;
    }

    this.panels.update((items) =>
      items.map((item) =>
        item.id === panelId
          ? {
              ...item,
              title: normalizedTitle,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    return this.getPanelById(panelId) ?? null;
  }

  deletePanel(panelId: string): DashboardPanel | null {
    const panel = this.getPanelById(panelId);
    if (!panel) {
      return null;
    }

    this.panels.update((items) => items.filter((item) => item.id !== panelId));
    return panel;
  }

  deleteAllPanels(): void {
    this.panels.set([]);
  }

  resizePanel(panelId: string, size: PanelSize): void {
    const normalizedSize = this.normalizeSize(size);

    this.panels.update((items) =>
      items.map((item) =>
        item.id === panelId
          ? {
              ...item,
              size: normalizedSize,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  setSidebarWidth(width: number): void {
    this.sidebarWidth.set(Math.max(320, Math.min(760, Math.round(width))));
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  async previewPanelData(config: PanelConfig): Promise<PanelData> {
    const normalized = this.normalizePanelConfig(config);
    const panel: DashboardPanel = {
      id: 'preview-panel',
      ...normalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.loadPanelData(panel);
  }

  snapshotDashboard(preference: ThemePreference, resolved: 'light' | 'dark'): DashboardSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      theme: {
        preference,
        resolved,
      },
      panelCount: this.panels().length,
      panels: this.panels().map((panel) => ({
        id: panel.id,
        type: panel.type,
        title: panel.title,
        dataSource: panel.dataSource,
        query: panel.query ?? {},
        size: panel.size,
      })),
      sources: this.sourceCatalog,
    };
  }

  private async seedDefaultPanels(): Promise<void> {
    const defaults: PanelConfig[] = [
      this.createDefaultPanelConfig('table'),
      this.createDefaultPanelConfig('line-chart'),
      this.createDefaultPanelConfig('stat-card'),
    ];

    for (const config of defaults) {
      await this.createPanel(config, true);
    }
  }

  private buildUpdatedPanel(current: DashboardPanel, patch: Partial<PanelConfig>): PanelConfig {
    const merged: PanelConfig = {
      type: patch.type ?? current.type,
      title: patch.title ?? current.title,
      dataSource: patch.dataSource ?? current.dataSource,
      query: {
        ...(current.query ?? {}),
        ...(patch.query ?? {}),
      },
      displayConfig: {
        ...current.displayConfig,
        ...(patch.displayConfig ?? {}),
      },
      size: {
        ...current.size,
        ...(patch.size ?? {}),
      },
    };

    return this.normalizePanelConfig(merged);
  }

  private normalizePanelConfig(config: PanelConfig): PanelConfig {
    const type = this.normalizePanelType(config.type);
    const dataSource = this.normalizeDataSource(config.dataSource, type);
    const title = this.normalizeTitle(config.title, type);
    const displayConfig = this.normalizeDisplayConfig(config.displayConfig);

    return {
      type,
      title,
      dataSource,
      query: { ...(config.query ?? {}) },
      displayConfig,
      size: this.normalizeSize(config.size),
    };
  }

  private normalizePanelType(type: PanelType): PanelType {
    if (type === 'table' || type === 'line-chart' || type === 'bar-chart' || type === 'stat-card') {
      return type;
    }
    return 'table';
  }

  private normalizeDataSource(dataSource: DataSourceId, type: PanelType): DataSourceId {
    if (dataSource === 'open-meteo.weather' || dataSource === 'rest-countries.countries') {
      return dataSource;
    }
    return type === 'line-chart' || type === 'stat-card' ? 'open-meteo.weather' : 'rest-countries.countries';
  }

  private normalizeTitle(title: string, type: PanelType): string {
    const normalized = String(title ?? '').trim();
    if (normalized) {
      return normalized;
    }

    switch (type) {
      case 'line-chart':
        return 'Line Chart';
      case 'bar-chart':
        return 'Bar Chart';
      case 'stat-card':
        return 'Stat Card';
      default:
        return 'Table Panel';
    }
  }

  private normalizeDisplayConfig(config: PanelDisplayConfig | undefined): PanelDisplayConfig {
    return {
      xKey: config?.xKey,
      yKey: config?.yKey,
      metricLabel: config?.metricLabel,
      columns: config?.columns,
      color: config?.color,
    };
  }

  private normalizeSize(size: PanelSize | undefined): PanelSize {
    const width = Number(size?.width ?? 420);
    const height = Number(size?.height ?? 300);

    return {
      width: Math.max(260, Math.min(900, Math.round(width))),
      height: Math.max(180, Math.min(700, Math.round(height))),
    };
  }

  private async loadPanelData(panel: DashboardPanel): Promise<PanelData> {
    if (panel.dataSource === 'open-meteo.weather') {
      const city = String(panel.query?.['city'] ?? 'Paris');
      const days = this.toNumber(panel.query?.['days'], 7);
      const weather = await this.dataService.fetchWeather({ city, days });
      return this.mapWeatherToPanelData(panel.type, weather);
    }

    const region = String(panel.query?.['region'] ?? 'all');
    const limit = this.toNumber(panel.query?.['limit'], 12);
    const countries = await this.dataService.fetchCountries({ region, limit });
    return this.mapCountriesToPanelData(panel.type, countries);
  }

  private mapWeatherToPanelData(type: PanelType, weather: WeatherPreview): PanelData {
    if (type === 'table') {
      return {
        rows: weather.points.map((point) => ({
          date: point.date,
          temperatureC: point.temperatureC,
          city: weather.city,
        })),
        raw: weather,
      };
    }

    if (type === 'stat-card') {
      return {
        stat: {
          label: `${weather.city} Avg Temp`,
          value: `${weather.averageTemp.toFixed(1)} C`,
          subLabel: `${weather.points.length} days sampled`,
          delta: `Low ${weather.minTemp.toFixed(1)} / High ${weather.maxTemp.toFixed(1)}`,
        },
        raw: weather,
      };
    }

    return {
      chart: {
        points: weather.points.map((point) => ({
          label: point.date.slice(5),
          value: point.temperatureC,
        })),
        xLabel: 'Date',
        yLabel: 'Temperature (C)',
        seriesName: weather.city,
      },
      raw: weather,
    };
  }

  private mapCountriesToPanelData(type: PanelType, countries: CountriesPreview): PanelData {
    const sortedByPopulation = [...countries.countries].sort((left, right) => right.population - left.population);

    if (type === 'stat-card') {
      const averagePopulation = sortedByPopulation.length
        ? Math.round(countries.totalPopulation / sortedByPopulation.length)
        : 0;

      return {
        stat: {
          label: `${this.capitalize(countries.region)} Avg Population`,
          value: this.formatCompactNumber(averagePopulation),
          subLabel: `${sortedByPopulation.length} countries`,
          delta: `Total ${this.formatCompactNumber(countries.totalPopulation)}`,
        },
        raw: countries,
      };
    }

    if (type === 'line-chart' || type === 'bar-chart') {
      return {
        chart: {
          points: sortedByPopulation.map((country) => ({
            label: country.name,
            value: country.population,
            secondaryValue: country.areaKm2,
          })),
          xLabel: 'Country',
          yLabel: 'Population',
          seriesName: `${this.capitalize(countries.region)} Population`,
        },
        raw: countries,
      };
    }

    return {
      rows: sortedByPopulation.map((country) => ({
        name: country.name,
        capital: country.capital,
        region: country.region,
        population: country.population,
        areaKm2: country.areaKm2,
      })),
      raw: countries,
    };
  }

  private restorePanels(): DashboardPanel[] {
    const raw = localStorage.getItem(PANELS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as DashboardPanel[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((panel) => typeof panel?.id === 'string')
        .map((panel) => ({
          ...panel,
          type: this.normalizePanelType(panel.type),
          dataSource: this.normalizeDataSource(panel.dataSource, panel.type),
          size: this.normalizeSize(panel.size),
          displayConfig: this.normalizeDisplayConfig(panel.displayConfig),
          query: { ...(panel.query ?? {}) },
          loading: false,
        }));
    } catch {
      return [];
    }
  }

  private restoreNumber(key: string, fallback: number): number {
    const value = Number(localStorage.getItem(key));
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return value;
  }

  private restoreBoolean(key: string, fallback: boolean): boolean {
    const value = localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === 'true';
  }

  private stableJson(value: unknown): string {
    return JSON.stringify(value, Object.keys((value ?? {}) as Record<string, unknown>).sort());
  }

  private toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private capitalize(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return 'All';
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private formatCompactNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
}
