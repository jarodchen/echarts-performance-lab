/**
 * 散点图 option 生成器
 */
import { BASE_GRID, BASE_TOOLTIP, buildAxes } from '../config/defaultOptions.js';

/**
 * @param {object} params
 * @param {string} params.tooltipTrigger - 'mousemove' | 'click'
 * @param {boolean} params.isOptimized - 是否为优化侧
 * @returns {object} 基础 option（不含数据）
 */
export function buildScatterOption({ tooltipTrigger, isOptimized }) {
  const color = isOptimized ? '#51cf66' : '#ff6b6b';

  return {
    animation: true,
    animationDuration: 300,
    tooltip: {
      ...BASE_TOOLTIP,
      trigger: 'item',
      triggerOn: tooltipTrigger
    },
    grid: { ...BASE_GRID },
    ...buildAxes('value'),
    series: [
      {
        name: isOptimized ? '优化后' : '优化前',
        type: 'scatter',
        // 统一符号尺寸，避免逐点 symbolSize 带来的额外开销（保证公平对比）
        symbolSize: 2.5,
        emphasis: { focus: 'none' },
        itemStyle: {
          color,
          opacity: 0.75,
          // 阴影：大数据量下海量符号阴影是主要性能负担之一
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.4)'
        }
      }
    ]
  };
}

