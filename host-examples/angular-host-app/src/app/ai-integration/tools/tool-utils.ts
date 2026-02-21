import type { ToolResult } from 'aura-ai-chat';
import type { DataSourceId, PanelConfig, PanelType } from '../../core/models/panel.model';

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePanelType(value: unknown, fallback: PanelType = 'table'): PanelType {
  const type = readString(value);
  if (type === 'table' || type === 'line-chart' || type === 'bar-chart' || type === 'stat-card') {
    return type;
  }
  return fallback;
}

export function normalizeDataSource(value: unknown, fallback: DataSourceId = 'rest-countries.countries'): DataSourceId {
  const source = readString(value);
  if (source === 'open-meteo.weather' || source === 'rest-countries.countries') {
    return source;
  }
  return fallback;
}

export function normalizePanelConfigInput(raw: unknown): PanelConfig {
  const source = asRecord(raw);
  const size = asRecord(source['size']);
  const displayConfig = asRecord(source['displayConfig']);
  const query = asRecord(source['query']);

  const type = normalizePanelType(source['type']);
  const dataSource = normalizeDataSource(
    source['dataSource'],
    type === 'line-chart' || type === 'stat-card' ? 'open-meteo.weather' : 'rest-countries.countries',
  );

  return {
    type,
    title: readString(source['title'], type === 'stat-card' ? 'Stat Card' : 'Dashboard Panel'),
    dataSource,
    query,
    displayConfig: {
      xKey: readString(displayConfig['xKey']) || undefined,
      yKey: readString(displayConfig['yKey']) || undefined,
      metricLabel: readString(displayConfig['metricLabel']) || undefined,
      columns: Array.isArray(displayConfig['columns'])
        ? displayConfig['columns'].map((value) => readString(value)).filter(Boolean)
        : undefined,
      color: readString(displayConfig['color']) || undefined,
    },
    size: {
      width: Math.round(Math.max(260, Math.min(900, readNumber(size['width'], 420)))),
      height: Math.round(Math.max(180, Math.min(700, readNumber(size['height'], 300)))),
    },
  };
}

export function textResult(payload: unknown, isError = false): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
      },
    ],
    isError,
  };
}