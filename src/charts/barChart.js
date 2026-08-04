/**
 * 柱状图 option 生成器
 *
 * 注意：柱状图不支持 appendData，分片加载模式会自动回退为分批 setOption 模拟流式加载。
 */
import * as echarts from 'echarts';
import { BASE_GRID, BASE_TOOLTIP, buildAxes } from '../config/defaultOptions.js';

/**
 * @param {object} params
 * @param {string} params.tooltipTrigger - 'mousemove' | 'click'
 * @param {boolean} params.isOptimized - 是否为优化侧
 * @returns {object} 基础 option（不含数据）
 */
export function buildBarOption({ tooltipTrigger, isOptimized }) {
  const color = isOptimized ? '#51cf66' : '#ff6b6b';

  return {
    animation: true,
    animationDuration: 300,
    tooltip: {
      ...BASE_TOOLTIP,
      trigger: 'axis',
      triggerOn: tooltipTrigger
    },
    grid: { ...BASE_GRID },
    ...buildAxes('value'),
    series: [
      {
        name: isOptimized ? '优化后' : '优化前',
        type: 'bar',
        // 大数据量下使用固定宽度，避免自适应计算开销
        barWidth: '60%',
        emphasis: { focus: 'none' },
        itemStyle: {
          borderRadius: [1, 1, 0, 0],
          // 渐变填充：离屏渐变是高开销样式，未优化版本刻意保留
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color },
            { offset: 1, color: isOptimized ? '#1b5e2a' : '#6b1a1a' }
          ]),
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.4)',
          shadowOffsetY: 2
        }
      }
    ]
  };
}
