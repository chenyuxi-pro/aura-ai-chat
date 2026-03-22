
import { Component, Input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import type { DashboardPanel } from '../../../core/models/panel.model';

@Component({
    selector: 'app-line-chart-panel',
    imports: [NgxEchartsDirective],
    templateUrl: './line-chart-panel.component.html',
    styleUrl: './line-chart-panel.component.scss'
})
export class LineChartPanelComponent {
  @Input({ required: true }) panel!: DashboardPanel;

  get chartOptions(): EChartsOption {
    const points = this.panel.data?.chart?.points ?? [];
    const labels = points.map((point) => point.label);
    const values = points.map((point) => point.value);

    return {
      animationDuration: 400,
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#667085' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#667085' },
      },
      series: [
        {
          name: this.panel.data?.chart?.seriesName ?? this.panel.title,
          type: 'line',
          smooth: true,
          data: values,
          lineStyle: { width: 3, color: '#0f7d91' },
          itemStyle: { color: '#0f7d91' },
          areaStyle: {
            color: 'rgba(15, 125, 145, 0.14)',
          },
        },
      ],
      grid: {
        left: 12,
        right: 12,
        top: 24,
        bottom: 16,
        containLabel: true,
      },
    };
  }
}
