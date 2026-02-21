import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import type { DashboardPanel } from '../../../core/models/panel.model';

@Component({
  selector: 'app-bar-chart-panel',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  templateUrl: './bar-chart-panel.component.html',
  styleUrl: './bar-chart-panel.component.scss',
})
export class BarChartPanelComponent {
  @Input({ required: true }) panel!: DashboardPanel;

  get chartOptions(): EChartsOption {
    const points = this.panel.data?.chart?.points ?? [];

    return {
      animationDuration: 400,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.label),
        axisLabel: {
          color: '#667085',
          rotate: points.length > 8 ? 24 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#667085' },
      },
      series: [
        {
          name: this.panel.data?.chart?.seriesName ?? this.panel.title,
          type: 'bar',
          data: points.map((point) => point.value),
          itemStyle: {
            color: '#ad5f3f',
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
      grid: {
        left: 12,
        right: 12,
        top: 24,
        bottom: 22,
        containLabel: true,
      },
    };
  }
}
