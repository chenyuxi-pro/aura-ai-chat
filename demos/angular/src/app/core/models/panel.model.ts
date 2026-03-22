export type PanelType = 'table' | 'line-chart' | 'bar-chart' | 'stat-card';

export type DataSourceId = 'open-meteo.weather' | 'rest-countries.countries';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelDisplayConfig {
  xKey?: string;
  yKey?: string;
  metricLabel?: string;
  columns?: string[];
  color?: string;
}

export interface PanelConfig {
  type: PanelType;
  title: string;
  dataSource: DataSourceId;
  query?: Record<string, unknown>;
  displayConfig: PanelDisplayConfig;
  size: PanelSize;
}

export interface ChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface PanelData {
  rows?: Array<Record<string, string | number | boolean | null>>;
  chart?: {
    points: ChartPoint[];
    xLabel: string;
    yLabel: string;
    seriesName: string;
  };
  stat?: {
    label: string;
    value: string;
    subLabel?: string;
    delta?: string;
  };
  raw?: unknown;
}

export interface DashboardPanel extends PanelConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
  data?: PanelData;
  loading?: boolean;
  error?: string;
}

export interface SourceCatalogEntry {
  id: DataSourceId;
  title: string;
  description: string;
  sampleQueries: string[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  theme: {
    preference: ThemePreference;
    resolved: 'light' | 'dark';
  };
  panelCount: number;
  panels: Array<{
    id: string;
    type: PanelType;
    title: string;
    dataSource: DataSourceId;
    query: Record<string, unknown>;
    size: PanelSize;
  }>;
  sources: SourceCatalogEntry[];
}
