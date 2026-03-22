import { Injectable } from '@angular/core';
import { BaseProvider } from 'aura-ai-chat';
import type {
  ModelInfo,
  ProviderMessage,
  ProviderOptions,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ToolCallRequest,
  ToolDefinition,
} from 'aura-ai-chat';
import type { DataSourceId, PanelConfig, PanelType } from '../../core/models/panel.model';
import { readString } from '../tools/tool-utils';

interface WorkflowState {
  intent: 'create' | 'update' | 'delete' | 'list';
  userRequest: string;
  panelDraft?: PanelConfig;
  updatePatch?: Partial<PanelConfig>;
  targetHint?: 'table' | 'line-chart' | 'bar-chart' | 'stat-card';
}

interface PanelSummary {
  id: string;
  type: PanelType;
  title: string;
  dataSource: DataSourceId;
}

interface ProviderDecision {
  content: string | null;
  toolCalls: ToolCallRequest[];
}

@Injectable({ providedIn: 'root' })
export class MockAiProvider extends BaseProvider {
  readonly id = 'mock-dash';
  readonly type = 'custom';
  readonly name = 'Dash Mock';
  override readonly icon = 'smart_toy';

  private activeWorkflow: WorkflowState | null = null;
  private abortController: AbortController | null = null;

  async getModels(_options?: ProviderOptions): Promise<ModelInfo[]> {
    return [
      {
        id: 'dash-mock-v2',
        name: 'Dash Mock v2',
        description: 'Local deterministic workflow provider for the Angular dashboard host.',
      },
    ];
  }

  async chat(request: ProviderRequest, _options?: ProviderOptions): Promise<ProviderResponse> {
    const decision = this.generateDecision(request);
    return {
      content: decision.content,
      toolCalls: decision.toolCalls,
    };
  }

  async *streamChat(
    request: ProviderRequest,
    _options?: ProviderOptions,
  ): AsyncIterable<ProviderResponseChunk> {
    const decision = this.generateDecision(request);
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    if (decision.content) {
      for (const chunk of this.chunkText(decision.content, 36)) {
        if (signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
        yield {
          delta: chunk,
          contentDelta: chunk,
        };
      }
    }

    if (decision.toolCalls.length > 0) {
      yield {
        tool_calls: decision.toolCalls,
      };
    }

    yield { done: true };
  }

  private generateDecision(request: ProviderRequest): ProviderDecision {
    const availableTools = new Map((request.tools ?? []).map((tool) => [tool.name, tool]));
    const latest = this.getLatestMessage(request.messages);

    if (!latest) {
      return this.textOnly('Tell me what dashboard panel you want to build or modify.');
    }

    if (latest.role === 'user') {
      if (availableTools.has('aura_select_skill')) {
        const skillName = this.getToolEnumValue(availableTools.get('aura_select_skill'), 'skillName');
        return skillName
          ? this.callTool('aura_select_skill', { skillName })
          : this.textOnly('I am ready to help with the dashboard.');
      }

      return this.handleUserMessage(latest.content, availableTools);
    }

    if (latest.role === 'tool') {
      const toolName = readString(latest.name);

      if (toolName === 'aura_select_skill' || toolName === 'aura_switch_skill') {
        const latestUser = this.getLatestUserMessage(request.messages);
        return latestUser
          ? this.handleUserMessage(latestUser.content, availableTools)
          : this.textOnly('Dashboard mode is ready. What should I change?');
      }

      if (toolName === 'aura_ask_user') {
        return this.handleUserMessage(latest.content, availableTools);
      }

      return this.handleToolResult(toolName, latest.content, availableTools);
    }

    return this.textOnly('Ready for the next dashboard action.');
  }

  private handleUserMessage(
    content: string,
    availableTools: Map<string, ToolDefinition>,
  ): ProviderDecision {
    const normalized = content.toLowerCase().trim();

    if (!normalized) {
      return this.askUser(availableTools, 'What would you like to change on the dashboard?');
    }

    if (this.matchesAny(normalized, ['switch', 'set', 'change']) && normalized.includes('theme')) {
      const mode = normalized.includes('dark')
        ? 'dark'
        : normalized.includes('light')
          ? 'light'
          : 'system';

      this.activeWorkflow = null;
      return this.callNamedTool(
        availableTools,
        'app.theme.change',
        { mode },
        `Switch the application theme to ${mode}.`,
      );
    }

    if (
      this.matchesAny(normalized, ['what panels', 'panel list', 'currently on my dashboard', 'analyze']) ||
      normalized === 'dashboard'
    ) {
      this.activeWorkflow = {
        intent: 'list',
        userRequest: content,
      };

      return this.callNamedTool(
        availableTools,
        'dashboard.get_panel_list',
        {},
        'Checking the current dashboard panels.',
      );
    }

    if (this.matchesAny(normalized, ['delete', 'remove'])) {
      const hint = this.extractTypeHint(normalized);
      this.activeWorkflow = {
        intent: 'delete',
        userRequest: content,
        targetHint: hint,
      };

      return this.callNamedTool(
        availableTools,
        'dashboard.get_panel_list',
        {},
        'Looking up the current panels before deleting anything.',
      );
    }

    if (this.matchesAny(normalized, ['update', 'modify', 'change']) && !normalized.includes('theme')) {
      const patch = this.extractUpdatePatch(normalized);
      if (!patch) {
        return this.askUser(
          availableTools,
          'Which panel should I update, and what should change?',
        );
      }

      this.activeWorkflow = {
        intent: 'update',
        userRequest: content,
        updatePatch: patch,
        targetHint: this.extractTypeHint(normalized),
      };

      return this.callNamedTool(
        availableTools,
        'dashboard.get_panel_list',
        {},
        'Finding the target panel before preparing an update.',
      );
    }

    if (this.matchesAny(normalized, ['build', 'create', 'add'])) {
      const panelDraft = this.extractCreateDraft(normalized);

      if (!panelDraft) {
        return this.askUser(
          availableTools,
          'What data would you like to visualize first?',
        );
      }

      this.activeWorkflow = {
        intent: 'create',
        userRequest: content,
        panelDraft,
      };

      return this.callNamedTool(
        availableTools,
        'dashboard.get_panel_list',
        {},
        'Checking the current dashboard before proposing a new panel.',
      );
    }

    return this.textOnly(
      'I can add, update, rename, or remove dashboard panels. Try asking for a weather chart or countries table.',
    );
  }

  private handleToolResult(
    toolName: string,
    content: string,
    availableTools: Map<string, ToolDefinition>,
  ): ProviderDecision {
    const payload = this.parseToolPayload(content);
    const record = this.asRecord(payload);

    if (record['rejected'] === true) {
      this.activeWorkflow = null;
      return this.textOnly('No problem. I cancelled that action. I can suggest a safer alternative if you want.');
    }

    if (record['timedOut'] === true) {
      this.activeWorkflow = null;
      return this.textOnly('That request timed out while waiting for confirmation. We can try again whenever you are ready.');
    }

    if (record['error']) {
      this.activeWorkflow = null;
      return this.textOnly(`I hit a problem: ${readString(record['error'], 'Unknown error')}`);
    }

    if (toolName === 'app.theme.change') {
      this.activeWorkflow = null;
      const mode = readString(record['mode'], 'system');
      return this.textOnly(`Theme updated to ${mode}. Want me to tune the dashboard layout next?`);
    }

    if (toolName === 'dashboard.panel.create') {
      this.activeWorkflow = null;
      const created = this.asRecord(record['created']);
      const title = readString(created['title'], 'the new panel');
      const type = readString(created['type'], 'panel');
      return this.textOnly(`Done. ${title} (${type}) is now live. Would you like another panel or a quick rename?`);
    }

    if (toolName === 'dashboard.panel.update') {
      this.activeWorkflow = null;
      const updated = this.asRecord(record['updated']);
      const title = readString(updated['title'], 'the panel');
      return this.textOnly(`${title} is updated. Want me to compare it with another region or add a related stat card?`);
    }

    if (toolName === 'dashboard.panel.delete') {
      this.activeWorkflow = null;
      const deleted = this.asRecord(record['deleted']);
      const title = readString(deleted['title'], 'the panel');
      return this.textOnly(`${title} was removed. I can add a replacement panel if you want.`);
    }

    if (toolName === 'dashboard.get_panel_list') {
      return this.handlePanelListResult(payload, availableTools);
    }

    if (toolName === 'dashboard.get_source_catalog') {
      return this.handleSourceCatalogResult(payload, availableTools);
    }

    if (toolName === 'data.fetch_weather' || toolName === 'data.fetch_countries') {
      return this.handleDataPreviewResult(toolName, payload, availableTools);
    }

    return this.textOnly('Tool result received. What should I do next?');
  }

  private handlePanelListResult(
    payload: unknown,
    availableTools: Map<string, ToolDefinition>,
  ): ProviderDecision {
    const panels = this.extractPanels(payload);

    if (!this.activeWorkflow) {
      return this.textOnly(this.describePanels(panels));
    }

    if (this.activeWorkflow.intent === 'list') {
      this.activeWorkflow = null;
      return this.textOnly(this.describePanels(panels));
    }

    if (this.activeWorkflow.intent === 'create') {
      const draft = this.activeWorkflow.panelDraft;
      if (!draft) {
        this.activeWorkflow = null;
        return this.askUser(availableTools, 'What should this panel show?');
      }

      const duplicate = panels.find(
        (panel) => panel.type === draft.type && panel.dataSource === draft.dataSource,
      );

      if (duplicate) {
        this.activeWorkflow = null;
        return this.textOnly(
          `You already have a ${duplicate.type} panel for this data source (${duplicate.title}). I can rename or update it instead.`,
        );
      }

      return this.callNamedTool(
        availableTools,
        'dashboard.get_source_catalog',
        {},
        'Verifying the requested data source before fetching a preview.',
      );
    }

    if (this.activeWorkflow.intent === 'update') {
      const target = this.pickTargetPanel(panels, this.activeWorkflow.targetHint);
      const patch = this.activeWorkflow.updatePatch;

      if (!target || !patch) {
        this.activeWorkflow = null;
        return this.askUser(availableTools, 'I could not identify the panel to update. Which panel title should I use?');
      }

      return this.callNamedTool(
        availableTools,
        'dashboard.panel.update',
        {
          panelId: target.id,
          patch,
        },
        `Updating ${target.title} with the requested changes.`,
      );
    }

    if (this.activeWorkflow.intent === 'delete') {
      const target = this.pickTargetPanel(panels, this.activeWorkflow.targetHint);
      if (!target) {
        this.activeWorkflow = null;
        return this.askUser(availableTools, 'I could not find a matching panel to delete. Which panel title should I remove?');
      }

      return this.callNamedTool(
        availableTools,
        'dashboard.panel.delete',
        { panelId: target.id },
        `Deleting ${target.title} (${target.type}).`,
      );
    }

    return this.textOnly(this.describePanels(panels));
  }

  private handleSourceCatalogResult(
    payload: unknown,
    availableTools: Map<string, ToolDefinition>,
  ): ProviderDecision {
    if (!this.activeWorkflow || this.activeWorkflow.intent !== 'create' || !this.activeWorkflow.panelDraft) {
      const sources = this.extractSources(payload).map((source) => source.id).join(', ');
      return this.textOnly(`Available data sources: ${sources || 'none'}.`);
    }

    const draft = this.activeWorkflow.panelDraft;
    const sources = this.extractSources(payload);

    if (!sources.some((source) => source.id === draft.dataSource)) {
      this.activeWorkflow = null;
      return this.textOnly('That data source is not available. Try Open-Meteo weather or REST Countries data.');
    }

    if (draft.dataSource === 'open-meteo.weather') {
      return this.callNamedTool(
        availableTools,
        'data.fetch_weather',
        {
          city: readString(draft.query?.['city'], 'Paris'),
          days: Number(draft.query?.['days'] ?? 7),
        },
        'Fetching a weather preview before creating the panel.',
      );
    }

    return this.callNamedTool(
      availableTools,
      'data.fetch_countries',
      {
        region: readString(draft.query?.['region'], 'all'),
        limit: Number(draft.query?.['limit'] ?? 12),
      },
      'Fetching a country statistics preview before creating the panel.',
    );
  }

  private handleDataPreviewResult(
    toolName: string,
    payload: unknown,
    availableTools: Map<string, ToolDefinition>,
  ): ProviderDecision {
    if (!this.activeWorkflow || this.activeWorkflow.intent !== 'create' || !this.activeWorkflow.panelDraft) {
      return this.textOnly('Preview data loaded. What panel should I create with it?');
    }

    const draft = this.activeWorkflow.panelDraft;

    if (toolName === 'data.fetch_weather') {
      const weather = this.asRecord(payload);
      const city = readString(weather['city'], readString(draft.query?.['city'], 'the city'));
      const avg = readString(weather['averageTemp'], 'n/a');
      return this.callNamedTool(
        availableTools,
        'dashboard.panel.create',
        { panelConfig: draft },
        `Preview looks good: ${city} weather loaded, average ${avg} C. Creating ${draft.title}.`,
      );
    }

    const countries = this.asRecord(payload);
    const region = readString(countries['region'], readString(draft.query?.['region'], 'all'));
    const rows = Array.isArray(countries['rows']) ? countries['rows'].length : 0;
    return this.callNamedTool(
      availableTools,
      'dashboard.panel.create',
      { panelConfig: draft },
      `Preview looks good: ${rows} ${region} countries loaded. Creating ${draft.title}.`,
    );
  }

  private extractCreateDraft(normalizedPrompt: string): PanelConfig | null {
    const source = this.inferDataSource(normalizedPrompt);
    const panelType = this.inferPanelType(normalizedPrompt, source);

    if (!source && !panelType) {
      return null;
    }

    const resolvedSource = source ?? (panelType === 'line-chart' ? 'open-meteo.weather' : 'rest-countries.countries');
    const resolvedType = panelType ?? (resolvedSource === 'open-meteo.weather' ? 'line-chart' : 'table');

    if (resolvedSource === 'open-meteo.weather') {
      const city = this.extractCity(normalizedPrompt);
      const days = normalizedPrompt.includes('14') ? 14 : normalizedPrompt.includes('30') ? 14 : 7;
      return {
        type: resolvedType,
        title: `${city} Weather ${resolvedType === 'table' ? 'Table' : resolvedType === 'stat-card' ? 'Summary' : 'Trend'}`,
        dataSource: resolvedSource,
        query: { city, days },
        displayConfig: {
          xKey: 'date',
          yKey: 'temperatureC',
          metricLabel: 'Temperature (C)',
        },
        size: resolvedType === 'stat-card' ? { width: 320, height: 220 } : { width: 460, height: 320 },
      };
    }

    const region = this.extractRegion(normalizedPrompt);
    return {
      type: resolvedType,
      title: `${this.capitalize(region)} Countries ${resolvedType === 'bar-chart' ? 'Population' : resolvedType === 'stat-card' ? 'Summary' : 'Table'}`,
      dataSource: resolvedSource,
      query: { region, limit: resolvedType === 'bar-chart' ? 10 : 12 },
      displayConfig: {
        xKey: 'name',
        yKey: 'population',
        metricLabel: 'Population',
      },
      size: resolvedType === 'stat-card' ? { width: 320, height: 220 } : { width: 460, height: 320 },
    };
  }

  private extractUpdatePatch(normalizedPrompt: string): Partial<PanelConfig> | null {
    const patch: Partial<PanelConfig> = {};

    if (normalizedPrompt.includes('asian') || normalizedPrompt.includes('asia')) {
      patch.query = { region: 'asia', limit: 12 };
      patch.title = 'Asian Countries by Population';
      patch.dataSource = 'rest-countries.countries';
    }

    if (normalizedPrompt.includes('europe')) {
      patch.query = { region: 'europe', limit: 12 };
      patch.title = 'European Countries by Population';
      patch.dataSource = 'rest-countries.countries';
    }

    if (normalizedPrompt.includes('dark')) {
      patch.displayConfig = { color: '#0a0f22' };
    }

    if (Object.keys(patch).length === 0) {
      return null;
    }

    return patch;
  }

  private inferDataSource(prompt: string): DataSourceId | null {
    if (this.matchesAny(prompt, ['weather', 'temperature', 'forecast', 'city'])) {
      return 'open-meteo.weather';
    }

    if (this.matchesAny(prompt, ['country', 'countries', 'population', 'region', 'europe', 'asia'])) {
      return 'rest-countries.countries';
    }

    return null;
  }

  private inferPanelType(prompt: string, source: DataSourceId | null): PanelType | null {
    if (prompt.includes('line')) {
      return 'line-chart';
    }
    if (prompt.includes('bar')) {
      return 'bar-chart';
    }
    if (prompt.includes('table')) {
      return 'table';
    }
    if (this.matchesAny(prompt, ['stat', 'kpi', 'summary', 'card'])) {
      return 'stat-card';
    }

    if (source === 'open-meteo.weather') {
      return 'line-chart';
    }

    if (source === 'rest-countries.countries') {
      return 'table';
    }

    return null;
  }

  private extractTypeHint(prompt: string): PanelType | undefined {
    return this.inferPanelType(prompt, null) ?? undefined;
  }

  private extractCity(prompt: string): string {
    const knownCities = [
      'paris',
      'london',
      'tokyo',
      'berlin',
      'madrid',
      'new york',
      'san francisco',
      'sydney',
      'singapore',
      'toronto',
    ];

    const city = knownCities.find((name) => prompt.includes(name));
    if (!city) {
      return 'Paris';
    }

    return city
      .split(' ')
      .map((word) => this.capitalize(word))
      .join(' ');
  }

  private extractRegion(prompt: string): string {
    if (prompt.includes('asia') || prompt.includes('asian')) {
      return 'asia';
    }
    if (prompt.includes('europe') || prompt.includes('european')) {
      return 'europe';
    }
    if (prompt.includes('africa')) {
      return 'africa';
    }
    if (prompt.includes('america')) {
      return 'americas';
    }
    if (prompt.includes('oceania')) {
      return 'oceania';
    }
    return 'all';
  }

  private pickTargetPanel(panels: PanelSummary[], hint?: PanelType): PanelSummary | undefined {
    if (panels.length === 0) {
      return undefined;
    }

    if (!hint) {
      return panels[0];
    }

    return panels.find((panel) => panel.type === hint) ?? panels[0];
  }

  private describePanels(panels: PanelSummary[]): string {
    if (panels.length === 0) {
      return 'Your dashboard is empty right now. Want me to add a first panel?';
    }

    const summary = panels
      .map((panel) => `${panel.title} (${panel.type})`)
      .join(', ');

    return `You currently have ${panels.length} panel(s): ${summary}.`;
  }

  private extractPanels(payload: unknown): PanelSummary[] {
    const data = this.asRecord(payload);
    const list = Array.isArray(data['panels']) ? data['panels'] : [];

    return list
      .map((entry) => {
        const item = this.asRecord(entry);
        const type = this.mapPanelType(item['type']);
        const source = this.mapDataSource(item['dataSource']);

        if (!type || !source) {
          return null;
        }

        return {
          id: readString(item['id']),
          title: readString(item['title'], 'Untitled'),
          type,
          dataSource: source,
        };
      })
      .filter((panel): panel is PanelSummary => panel !== null);
  }

  private extractSources(payload: unknown): Array<{ id: string }> {
    const data = this.asRecord(payload);
    const list = Array.isArray(data['sources']) ? data['sources'] : [];
    return list.map((source) => ({ id: readString(this.asRecord(source)['id']) })).filter((source) => !!source.id);
  }

  private parseToolPayload(content: string): unknown {
    const trimmed = content.trim();

    if (!trimmed) {
      return {};
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return { raw: trimmed };
    }
  }

  private askUser(
    availableTools: Map<string, ToolDefinition>,
    question: string,
  ): ProviderDecision {
    if (!availableTools.has('aura_ask_user')) {
      return this.textOnly(question);
    }

    return this.callTool('aura_ask_user', { question });
  }

  private callNamedTool(
    availableTools: Map<string, ToolDefinition>,
    name: string,
    args: Record<string, unknown>,
    content: string,
  ): ProviderDecision {
    if (!availableTools.has(name)) {
      return this.textOnly(`I need ${name}, but it is not available right now.`);
    }

    return this.callTool(name, args, content);
  }

  private callTool(
    name: string,
    args: Record<string, unknown>,
    content: string | null = null,
  ): ProviderDecision {
    return {
      content,
      toolCalls: [
        {
          id: name,
          callId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          arguments: args,
        },
      ],
    };
  }

  private textOnly(content: string): ProviderDecision {
    return {
      content,
      toolCalls: [],
    };
  }

  private getLatestMessage(messages: ProviderMessage[]): ProviderMessage | undefined {
    return [...messages].reverse().find((message) => message.role !== 'system');
  }

  private getLatestUserMessage(messages: ProviderMessage[]): ProviderMessage | undefined {
    return [...messages].reverse().find((message) => message.role === 'user');
  }

  private getToolEnumValue(
    tool: ToolDefinition | undefined,
    fieldName: string,
  ): string | undefined {
    const schema = this.asRecord(tool?.inputSchema);
    const properties = this.asRecord(schema['properties']);
    const field = this.asRecord(properties[fieldName]);
    const values = Array.isArray(field['enum']) ? field['enum'] : [];
    const first = values.find((value) => typeof value === 'string');
    return typeof first === 'string' ? first : undefined;
  }

  private matchesAny(value: string, terms: string[]): boolean {
    return terms.some((term) => value.includes(term));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private mapPanelType(value: unknown): PanelType | null {
    const text = readString(value);
    if (text === 'table' || text === 'line-chart' || text === 'bar-chart' || text === 'stat-card') {
      return text;
    }
    return null;
  }

  private mapDataSource(value: unknown): DataSourceId | null {
    const text = readString(value);
    if (text === 'open-meteo.weather' || text === 'rest-countries.countries') {
      return text;
    }
    return null;
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private chunkText(value: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let index = 0; index < value.length; index += chunkSize) {
      chunks.push(value.slice(index, index + chunkSize));
    }

    if (chunks.length === 0) {
      chunks.push('');
    }

    return chunks;
  }
}
