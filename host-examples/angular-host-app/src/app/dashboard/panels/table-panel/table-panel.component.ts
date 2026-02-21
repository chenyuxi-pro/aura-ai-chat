import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef } from 'ag-grid-community';
import type { DashboardPanel } from '../../../core/models/panel.model';

@Component({
  selector: 'app-table-panel',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './table-panel.component.html',
  styleUrl: './table-panel.component.scss',
})
export class TablePanelComponent {
  @Input({ required: true }) panel!: DashboardPanel;

  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 110,
  };

  get rowData(): Array<Record<string, string | number | boolean | null>> {
    return this.panel.data?.rows ?? [];
  }

  get columnDefs(): ColDef[] {
    const firstRow = this.rowData[0];
    if (!firstRow) {
      return [];
    }

    return Object.keys(firstRow).map((key) => ({
      field: key,
      headerName: this.humanizeKey(key),
    }));
  }

  private humanizeKey(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}