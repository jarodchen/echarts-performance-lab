/**
 * 折线图 option 生成器
 *
 * 未优化版本刻意保留高开销视觉样式（阴影 + 渐变面积图 + 动画），
 * 以便与优化版本形成直观对比。数据通过 dataset（一次性加载）
 * 或 series.data + appendData（分片加载）注入。
 */
import * as echarts from 'echarts';
import { BASE_GRID, BASE_TOOLTIP, buildAxes } from '../config/defaultOptions.js';

/**
 * @param {object} params
 * @param {string} params.tooltipTrigger - 'mousemove' | 'click'（映射 ECharts tooltip.triggerOn）
 * @param {boolean} params.isOptimized - 是否为优化侧（决定主色与基础样式）
 * @returns {object} 基础 option（不含数据）
 */
export function buildLineOption({ tooltipTrigger, isOptimized }) {
  const color = isOptimized ? '#51cf66' : '#ff6b6b';

  return {
    // 动画默认开启；数据超过 animationThreshold(2000) 时 ECharts 自动关闭
    animation: true,
    animationDuration: 300,
    animationEasing: 'cubicOut',
    tooltip: {
      ...BASE_TOOLTIP,
      trigger: 'axis',
      // triggerOn: 'mousemove' 高频触发 / 'click' 按需触发，直接决定重绘频率
      triggerOn: tooltipTrigger
    },
    grid: { ...BASE_GRID },
    ...buildAxes('value'),
    series: [
      {
        name: isOptimized ? '优化后' : '优化前',
        type: 'line',
        // 大数据量下关闭数据点符号，避免海量符号绘制
        symbol: 'none',
        emphasis: { focus: 'none' },
        lineStyle: {
          width: 1.2,
          color,
          // 阴影会触发额外模糊计算，未优化版本刻意保留以体现视觉开销
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          shadowOffsetY: 4
        },
        // 渐变面积图：离屏渐变填充，同样为高开销样式
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isOptimized ? 'rgba(81, 207, 102, 0.35)' : 'rgba(255, 107, 107, 0.35)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' }
          ])
        }
      }
    ]
  };
}
