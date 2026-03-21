import type { AuraTool } from 'aura-ai-chat';
import { ThemeService } from '../../core/services/theme.service';
import type { ThemePreference } from '../../core/models/panel.model';
import { asRecord, readString, textResult } from './tool-utils';

export function createChangeThemeTool(themeService: ThemeService): AuraTool {
  return {
    name: 'app.theme.change',
    title: 'Change App Theme',
    description: 'Switches app theme between light, dark, or system.',
    risk: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['light', 'dark', 'system'],
          description: 'Theme mode.',
        },
      },
      required: ['mode'],
    },
    execute: async (input) => {
      const args = asRecord(input);
      const rawMode = readString(args['mode'], 'system').toLowerCase();
      const mode: ThemePreference =
        rawMode === 'light' || rawMode === 'dark' || rawMode === 'system' ? rawMode : 'system';

      themeService.setTheme(mode);

      return textResult({
        mode,
        resolved: themeService.resolvedTheme(),
      });
    },
  };
}
