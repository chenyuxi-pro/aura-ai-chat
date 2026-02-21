import { Injector, Type } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { DashboardPanelPreviewElementComponent } from './dashboard-panel-preview.element';
import { DataDiffViewElementComponent } from './data-diff-view.element';
import { PanelDeletePreviewElementComponent } from './panel-delete-preview.element';

const PREVIEW_ELEMENTS: Array<{ tag: string; component: Type<unknown> }> = [
  { tag: 'dashboard-panel-preview', component: DashboardPanelPreviewElementComponent },
  { tag: 'data-diff-view', component: DataDiffViewElementComponent },
  { tag: 'panel-delete-preview', component: PanelDeletePreviewElementComponent },
];

export function registerPreviewCustomElements(injector: Injector): void {
  for (const item of PREVIEW_ELEMENTS) {
    if (!customElements.get(item.tag)) {
      const element = createCustomElement(item.component, { injector });
      customElements.define(item.tag, element);
    }
  }
}