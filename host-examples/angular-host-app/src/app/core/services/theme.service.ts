import { Injectable, computed, effect, signal } from '@angular/core';
import type { ThemePreference } from '../models/panel.model';

const THEME_STORAGE_KEY = 'angular-host-app:theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemPrefersDark = signal(this.getSystemDarkPreference());
  readonly preference = signal<ThemePreference>(this.loadThemePreference());

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const preference = this.preference();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  constructor() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      this.systemPrefersDark.set(event.matches);
    };

    mediaQuery.addEventListener('change', listener);

    effect(() => {
      const preference = this.preference();
      const resolved = this.resolvedTheme();

      localStorage.setItem(THEME_STORAGE_KEY, preference);
      document.documentElement.dataset['theme'] = resolved;
      document.body.dataset['theme'] = resolved;
    });
  }

  setTheme(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  cycleTheme(): void {
    const current = this.preference();
    if (current === 'light') {
      this.preference.set('dark');
      return;
    }

    if (current === 'dark') {
      this.preference.set('system');
      return;
    }

    this.preference.set('light');
  }

  getLabel(): string {
    const preference = this.preference();
    if (preference === 'system') {
      return 'Theme: System';
    }
    return preference === 'dark' ? 'Theme: Dark' : 'Theme: Light';
  }

  private loadThemePreference(): ThemePreference {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private getSystemDarkPreference(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
