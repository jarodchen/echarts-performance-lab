/**
 * 优化策略预设与策略元数据定义
 *
 * 每个策略包含：
 * - key: 策略唯一标识
 * - label: 面板显示名称
 * - description: 面板上的简短说明
 * - principle: 原理说明（用于指标悬停提示与导出报告）
 * - applicable: 适用的图表类型（部分策略仅对特定图表生效）
 */

/** 默认预设组合：large + progressive + dataZoom */
export const DEFAULT_PRESET = ['large', 'progressive', 'dataZoom'];

/**
 * 策略元数据表。
 * 新增策略时只需在此登记，并在 applyOptimizations.js 中实现对应逻辑。
 */
export const OPTIMIZATION_PRESETS = {
  large: {
    key: 'large',
    label: '大数据模式 (large)',
    description: '开启 large:true，largeThreshold:2000',
    principle:
      'ECharts 内置的大数据优化：当数据量超过阈值时切换为轻量级渲染管线，跳过逐点样式的精细计算，' +
      '显著降低 CPU 与内存开销。仅适用于折线图与散点图。',
    applicable: ['line', 'scatter']
  },
  progressive: {
    key: 'progressive',
    label: '渐进式渲染 (progressive)',
    description: 'progressive:500，progressiveThreshold:2000',
    principle:
      '分帧渲染：将数据绘制切分为每帧 500 点，避免单帧阻塞主线程，保证交互响应流畅。' +
      '数据量超过阈值 2000 时自动生效。',
    applicable: ['line', 'scatter', 'bar']
  },
  lttb: {
    key: 'lttb',
    label: '数据降采样 (LTTB)',
    description: 'LTTB 算法采样至 5,000 点',
    principle:
      'Largest-Triangle-Three-Buckets 算法：在保留波形趋势特征的前提下，将数据压缩至 5000 点。' +
      '渲染数据量直降 90%+，适合 5 万点以上的趋势展示。',
    applicable: ['line', 'scatter', 'bar']
  },
  sampling: {
    key: 'sampling',
    label: '内置采样 (sampling)',
    description: "ECharts 内置 sampling:'average'",
    principle:
      '渲染前的内置降采样：ECharts 在绘制折线时按像素宽度对数据取平均值采样，' +
      '只绘制屏幕可见分辨率下的有效点。仅对折线图生效。',
    applicable: ['line']
  },
  dataZoom: {
    key: 'dataZoom',
    label: '数据缩放 (dataZoom)',
    description: '滑块组件，初始显示前 20% 数据',
    principle:
      '只渲染可视区域：dataZoom 窗口外数据不参与绘制，首屏渲染提速 5-10 倍，' +
      '且滚动窗口时只重绘窗口内数据。',
    applicable: ['line', 'scatter', 'bar']
  },
  noAnimation: {
    key: 'noAnimation',
    label: '关闭动画 (animation)',
    description: 'animation:false',
    principle:
      '动画在大数据下会产生大量插值计算与重绘。关闭动画后首帧直接呈现，' +
      '渲染耗时与 FPS 均有提升，尤其适合实时监控类图表。',
    applicable: ['line', 'scatter', 'bar']
  },
  simpleStyle: {
    key: 'simpleStyle',
    label: '精简视觉样式',
    description: '移除阴影与渐变，改用纯色',
    principle:
      'shadowBlur / shadowColor / 渐变等效果会触发多次离屏绘制与模糊计算，' +
      '是 GPU 与 CPU 的双重负担。改为纯色后渲染开销大幅下降。',
    applicable: ['line', 'scatter', 'bar']
  },
  incrementalUpdate: {
    key: 'incrementalUpdate',
    label: '增量更新模式',
    description: '数据更新时复用实例，避免销毁重建',
    principle:
      '复用图表实例并使用 setOption 增量更新，避免 dispose + init 的全量重建开销。' +
      '多次更新时整体耗时显著低于全量重建。',
    applicable: ['line', 'scatter', 'bar']
  }
};

/** 策略面板展示顺序 */
export const STRATEGY_ORDER = [
  'large',
  'progressive',
  'lttb',
  'sampling',
  'dataZoom',
  'noAnimation',
  'simpleStyle',
  'incrementalUpdate'
];

/** 图表类型定义 */
export const CHART_TYPES = {
  line: { key: 'line', label: '折线图' },
  scatter: { key: 'scatter', label: '散点图' },
  bar: { key: 'bar', label: '柱状图' }
};

/** 数据格式定义 */
export const DATA_FORMATS = {
  array: { key: 'array', label: '普通 Array' },
  typed: { key: 'typed', label: 'TypedArray (Float64Array)' }
};

/** 加载模式定义 */
export const LOAD_MODES = {
  once: { key: 'once', label: '一次性加载' },
  append: { key: 'append', label: '分片加载 (流式)' }
};

/** 渲染器定义 */
export const RENDERERS = {
  canvas: { key: 'canvas', label: 'Canvas' },
  svg: { key: 'svg', label: 'SVG' }
};

/** Tooltip 触发方式定义 */
export const TOOLTIP_TRIGGERS = {
  mousemove: { key: 'mousemove', label: 'mousemove' },
  click: { key: 'click', label: 'click' }
};

/** 分片加载每批数据量 */
export const APPEND_BATCH_SIZE = 5000;

/** LTTB 降采样目标点数 */
export const LTTB_THRESHOLD = 5000;

/** 默认数据量 */
export const DEFAULT_DATA_COUNT = 10000;
