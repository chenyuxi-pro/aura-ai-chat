import { Injectable, inject } from '@angular/core';
import type { AuraConfig, SuggestedPrompt } from 'aura-ai-chat';
import { ConversationService } from '../core/services/conversation.service';
import { DashboardService } from '../core/services/dashboard.service';
import { ThemeService } from '../core/services/theme.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { dashboardBuilderSkill } from './skills/dashboard-builder.skill';
import { ToolRegistryService } from './tools/tool-registry.service';

const SYSTEM_PROMPT = [
  'You are Dash, a dashboard assistant for an Angular host app demo.',
  'Use concise language and prioritize actionable guidance.',
  'Always rely on tools before claiming dashboard state.',
  'Use tool results to produce natural confirmations with panel title and type when applicable.',
].join('\n');

@Injectable({ providedIn: 'root' })
export class WidgetConfigBuilder {
  private readonly dashboardService = inject(DashboardService);
  private readonly themeService = inject(ThemeService);
  private readonly conversationService = inject(ConversationService);
  private readonly toolRegistry = inject(ToolRegistryService);
  private readonly mockProvider = inject(MockAiProvider);

  private readonly suggestedPrompts: SuggestedPrompt[] = [
    { label: 'Build from scratch', prompt: 'Help me build a dashboard from scratch' },
    { label: 'Weather multi-city', prompt: 'I want to track weather data for multiple cities' },
    { label: 'Recommend next panel', prompt: 'What would you recommend adding to my current dashboard?' },
    { label: 'List current panels', prompt: 'What panels are on my dashboard?' },
    { label: 'Add Paris line chart', prompt: 'Add a line chart showing Paris temperature for the last 7 days' },
    { label: 'Switch dark mode', prompt: 'Switch the app to dark mode' },
    { label: 'Europe population table', prompt: 'Show me a table of European countries by population' },
    { label: 'Update to Asia', prompt: 'Update the table to show Asian countries instead' },
    { label: 'Delete bar chart', prompt: 'Delete the bar chart panel' },
    { label: 'Analyze dashboard', prompt: "Analyze what's currently on my dashboard" },
  ];

  buildConfig(): AuraConfig {
    const theme = this.themeService.resolvedTheme();

    return {
      identity: {
        appId: 'angular-demo',
        ownerId: 'host-examples',
        tenantId: 'local-dev',
        userId: 'demo-user',
        aiName: 'Dash',
      },
      header: {
        title: 'Dashboard Assistant',
      },
      welcome: {
        title: "Hi, I'm Dash",
        message: 'Ask me to analyze data or add panels.',
        suggestedPrompts: this.suggestedPrompts,
      },
      providers: [
        {
          type: 'built-in',
          providerId: 'github-copilot',
          displayName: 'GitHub Copilot',
        },
        {
          type: 'custom',
          instance: this.mockProvider,
          displayName: 'Dash Mock',
          icon: 'smart_toy',
        },
      ],
      behavior: {
        systemPrompt: SYSTEM_PROMPT,
        dynamicContext: async () => {
          const snapshot = this.dashboardService.snapshotDashboard(
            this.themeService.preference(),
            this.themeService.resolvedTheme(),
          );

          return JSON.stringify(snapshot, null, 2);
        },
        skills: [dashboardBuilderSkill],
        tools: this.toolRegistry.getAll(),
        temperature: 0.2,
        maxTokens: 1200,
      },
      conversation: this.conversationService.getCallbacks(),
      ui: {
        theme,
      },
      onEvent: (event) => {
        if (event.type === 'error') {
          console.error('[aura-ai-chat]', event.payload);
        }
      },
    };
  }
}