/**
 * 优化策略应用器：根据用户勾选的策略集合修改图表 option
 *
 * 所有策略只作用于右侧"优化后"图表；左侧始终使用未优化的原始 option。
 * 每个策略的配置项均附注释说明作用与原理（见各分支）。
 */
import { OPTIMIZATION_PRESETS } from '../config/optimizationPresets.js';

/**
 * 将配置对象非破坏性地合并到目标 option
 * @param {object} option - 目标 option（会被修改）
 * @param {string} path - 路径，如 'series.0.lineStyle'
 * @param {object} value - 合并的值
 */
function mergeInto(option, path, value) {
  const segments = path.split('.');
  let target = option;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const index = parseInt(seg, 10);
    const key = Number.isNaN(index) ? seg : index;
    if (target[key] === undefined || typeof target[key] !== 'object') {
      target[key] = Number.isNaN(index) ? {} : [];
    }
    target = target[key];
  }
  const lastSeg = segments[segments.length - 1];
  const lastIndex = parseInt(lastSeg, 10);
  const lastKey = Number.isNaN(lastIndex) ? lastSeg : lastIndex;
  target[lastKey] = value;
}

/**
 * 应用优化策略集合到 option
 * @param {object} option - 基础 option（会被修改）
 * @param {string} chartType - 图表类型 'line' | 'scatter' | 'bar'
 * @param {Set<string>} enabledStrategies - 已启用策略 key 集合
 * @returns {{ applied: Array<string>, ignored: Array<{key: string, reason: string}> }}
 *          applied: 实际生效的策略；ignored: 因图表类型不适用而跳过的策略
 */
export function applyOptimizations(option, chartType, enabledStrategies) {
  const applied = [];
  const ignored = [];

  const apply = (key) => {
    const preset = OPTIMIZATION_PRESETS[key];
    if (!preset) return;
    // 检查策略是否适用于当前图表类型
    if (!preset.applicable.includes(chartType)) {
      ignored.push({ key, reason: `不适用于${chartType}图表` });
      return;
    }
    applied.push(key);
  };

  // ---------- 1. 大数据模式 ----------
  if (enabledStrategies.has('large')) {
    apply('large');
    // 原理：数据量超过 largeThreshold 后切换为轻量渲染管线，跳过逐点样式计算
    mergeInto(option, 'series.0.large', true);
    mergeInto(option, 'series.0.largeThreshold', 2000);
  }

  // ---------- 2. 渐进式渲染 ----------
  if (enabledStrategies.has('progressive')) {
    apply('progressive');
    // 原理：分帧渲染，每帧绘制 500 点，避免阻塞主线程
    mergeInto(option, 'series.0.progressive', 500);
    mergeInto(option, 'series.0.progressiveThreshold', 2000);
  }

  // ---------- 3. 内置采样（仅折线图） ----------
  if (enabledStrategies.has('sampling')) {
    apply('sampling');
    // 原理：绘制前按像素宽度对数据取平均值，只渲染可见分辨率下的有效点
    mergeInto(option, 'series.0.sampling', 'average');
  }

  // ---------- 4. 数据缩放 ----------
  if (enabledStrategies.has('dataZoom')) {
    apply('dataZoom');
    // 原理：只渲染可视区域窗口内的数据，窗口外数据不参与绘制
    option.dataZoom = [
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: 20, // 初始显示前 20% 数据
        height: 18,
        bottom: 8,
        borderColor: '#2a3a5e',
        backgroundColor: 'rgba(15, 22, 48, 0.6)',
        fillerColor: 'rgba(77, 171, 247, 0.2)',
        handleStyle: { color: '#4dabf7' },
        textStyle: { color: '#8899bb' }
      },
      { type: 'inside', xAxisIndex: 0 }
    ];
  }

  // ---------- 5. 关闭动画 ----------
  if (enabledStrategies.has('noAnimation')) {
    apply('noAnimation');
    // 原理：大数据下动画会产生大量插值计算，关闭后首帧直接呈现
    option.animation = false;
  }

  // ---------- 6. 精简视觉样式 ----------
  if (enabledStrategies.has('simpleStyle')) {
    apply('simpleStyle');
    const series = option.series[0];
    // 原理：阴影与渐变会触发离屏绘制与模糊计算，改为纯色可大幅降低渲染开销
    if (series.lineStyle) {
      delete series.lineStyle.shadowBlur;
      delete series.lineStyle.shadowColor;
      delete series.lineStyle.shadowOffsetY;
    }
    if (series.itemStyle) {
      delete series.itemStyle.shadowBlur;
      delete series.itemStyle.shadowColor;
      delete series.itemStyle.shadowOffsetY;
    }
    delete series.areaStyle; // 移除渐变面积图
  }

  return { applied, ignored };
}

/**
 * 将策略 key 列表格式化为 "+key +key" 标记文本
 * @param {Array<string>} keys
 * @returns {string}
 */
export function formatStrategyTags(keys) {
  return keys.map((k) => `+${k}`).join(' ');
}
