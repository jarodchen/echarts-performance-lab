/**
 * 默认图表配置（未优化侧使用，刻意保留高开销的视觉样式以便直观对比）
 */

/** 深色主题通用文本与坐标轴样式 */
export const BASE_TEXT_STYLE = {
  color: '#8899bb',
  fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
};

/** 坐标轴通用配置 */
export const BASE_AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#2a3a5e' } },
  axisLabel: { color: '#8899bb' },
  splitLine: { lineStyle: { color: 'rgba(42, 58, 94, 0.5)' } },
  nameTextStyle: BASE_TEXT_STYLE
};

/** 图例与网格通用配置 */
export const BASE_GRID = {
  left: 56,
  right: 24,
  top: 40,
  bottom: 48
};

/** Tooltip 基础配置（深色主题） */
export const BASE_TOOLTIP = {
  backgroundColor: 'rgba(15, 22, 48, 0.92)',
  borderColor: '#3d5a8f',
  textStyle: { color: '#e8e8e8', fontSize: 12 },
  confine: true
};

/**
 * 构建坐标轴配置
 * @param {string} xAxisType - 'value' 或 'category'（柱状图大数据量下使用 value 轴避免生成海量刻度）
 */
export function buildAxes(xAxisType = 'value') {
  return {
    xAxis: {
      type: xAxisType,
      ...BASE_AXIS_STYLE,
      // 大数据量下关闭轴刻度标签，避免刻度计算成为性能瓶颈
      axisLabel: { ...BASE_AXIS_STYLE.axisLabel, show: xAxisType === 'category' ? true : false }
    },
    yAxis: { type: 'value', ...BASE_AXIS_STYLE }
  };
}

/**
 * 数据系列通用配置（折线图未优化样式：带阴影 + 渐变面积，刻意增加渲染负担）
 */
export const BASE_SERIES_COMMON = {
  // 未优化侧保持动画，直观体现动画开销
  animation: true,
  animationDuration: 300,
  animationEasing: 'cubicOut',
  // 大数据量时关闭 tooltip 高亮细节（仍保留 tooltip 能力）
  emphasis: { focus: 'none' }
};

/**
 * 构建 dataset 配置：统一承载普通数组与 TypedArray
 *
 * - 普通二维数组 [[x,y],...]：ECharts 自动推断列名
 * - 扁平 Float64Array [x0,y0,x1,y1,...]：必须显式声明 dimensions（每 2 个数字 1 组 [x,y]）
 *   直接传入 TypedArray 可避免转换为嵌套数组的额外内存开销
 */
export function buildDataset(data) {
  const isTyped = data instanceof Float64Array || data instanceof Float32Array;
  return {
    dimensions: isTyped ? ['x', 'y'] : undefined,
    source: data
  };
}

/**
 * 将数据转换为适合分片加载（appendData）的普通数组格式
 * appendData 每次追加一批数据，TypedArray 需要先转为普通数组以便切片
 */
export function toPlainArray(data) {
  if (data instanceof Float64Array || data instanceof Float32Array) {
    return Array.from(data);
  }
  return data;
}
