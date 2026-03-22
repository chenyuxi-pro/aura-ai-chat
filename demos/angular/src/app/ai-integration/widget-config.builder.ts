import { Injectable, inject } from '@angular/core';
import type { AuraConfig, AuraEvent, AuraResource, SuggestedPrompt } from 'aura-ai-chat';
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
    { title: 'Build from scratch', promptText: 'Help me build a dashboard from scratch' },
    { title: 'Weather multi-city', promptText: 'I want to track weather data for multiple cities' },
    { title: 'Recommend next panel', promptText: 'What would you recommend adding to my current dashboard?' },
    { title: 'List current panels', promptText: 'What panels are on my dashboard?' },
    { title: 'Add Paris line chart', promptText: 'Add a line chart showing Paris temperature for the last 7 days' },
    { title: 'Switch dark mode', promptText: 'Switch the app to dark mode' },
    { title: 'Europe population table', promptText: 'Show me a table of European countries by population' },
    { title: 'Update to Asia', promptText: 'Update the table to show Asian countries instead' },
    { title: 'Delete bar chart', promptText: 'Delete the bar chart panel' },
    { title: 'Analyze dashboard', promptText: "Analyze what's currently on my dashboard" },
  ];

  buildConfig(): AuraConfig {
    return {
      identity: {
        appMetadata: {
          appId: 'angular-demo',
          teamId: 'host-examples',
          tenantId: 'local-dev',
          userId: 'demo-user',
        },
        aiName: 'Dash',
      },
      appearance: {
        headerTitle: 'Dashboard Assistant',
        welcomeMessageTitle: "Hi, I'm Dash",
        welcomeMessage: 'Ask me to analyze data, create panels, or update the current layout.',
        inputPlaceholder: 'Ask Dash to build or refine your dashboard...',
        suggestedPrompts: this.suggestedPrompts,
        theme: this.getAuraTheme(),
      },
      providers: [
        {
          type: 'custom',
          id: this.mockProvider.id,
          config: this.mockProvider,
        },
        {
          type: 'built-in',
          id: 'github-copilot',
          config: {
            rememberToken: true,
          },
        },
      ],
      agent: {
        appSystemPrompt: SYSTEM_PROMPT,
        resources: [this.createDashboardSnapshotResource()],
        skills: [dashboardBuilderSkill],
        tools: this.toolRegistry.getAll(),
        conversationManager: this.conversationService.getManager(),
        enableStreaming: true,
        maxContextTokens: 4096,
        maxIterations: 8,
        showThinkingProcess: true,
        toolTimeout: 30000,
        confirmationTimeoutMs: 65000,
        enableWebMcp: false,
      },
      onAuraEvent: (event: AuraEvent) => {
        if (event.type === 'error') {
          console.error('[aura-ai-chat]', event.payload);
        }
      },
    };
  }

  private getAuraTheme(): 'dark' | 'professional-light' | 'auto' {
    const preference = this.themeService.preference();
    if (preference === 'dark') {
      return 'dark';
    }

    if (preference === 'system') {
      return 'auto';
    }

    return 'professional-light';
  }

  private createDashboardSnapshotResource(): AuraResource {
    return {
      uri: 'local://angular-dashboard/snapshot',
      name: 'dashboard-snapshot',
      description: 'Current Angular host dashboard state, theme, and available sources.',
      read: async () => {
        const snapshot = this.dashboardService.snapshotDashboard(
          this.themeService.preference(),
          this.themeService.resolvedTheme(),
        );

        return {
          uri: 'local://angular-dashboard/snapshot',
          mimeType: 'application/json',
          text: JSON.stringify(snapshot, null, 2),
        };
      },
    };
  }
}
