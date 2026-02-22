import { provideZoneChangeDetection } from "@angular/core";
import 'aura-ai-chat';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers]}).catch((error) => {
  console.error(error);
});