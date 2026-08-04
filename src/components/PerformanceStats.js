/**
 * 性能指标卡片组件
 *
 * 每个图表下方展示 6 项实时指标：
 * - 数据点数量 / 渲染耗时（首帧） / FPS / 内存增量 / 加载方式 / 优化标记（仅优化侧）
 *
 * 对比高亮逻辑：右侧图表某项指标优于左侧 30% 以上时，
 * 该数值以绿色高亮并附加 ▲ 标记；劣于 30% 以上则红色 + ▼。
 * 鼠标悬停指标可查看该指标与优化策略的关联说明。
 */
import { formatNumber, formatMB } from '../utils/performance.js';
import { OPTIMIZATION_PRESETS } from '../config/optimizationPresets.js';

/** 对比高亮阈值：差异超过 30% 才高亮（避免微小波动误报） */
const IMPROVEMENT_THRESHOLD = 0.3;

/**
 * 指标项定义
 * better: 'lower' | 'higher' 表示该指标数值越低/越高代表性能越好
 */
const METRICS = [
  { key: 'points', label: '数据点', better: 'lower' },
  { key: 'renderTime', label: '渲染耗时', better: 'lower' },
  { key: 'fps', label: 'FPS', better: 'higher' },
  { key: 'memory', label: '内存增量', better: 'lower' },
  { key: 'loadMode', label: '加载方式', better: null },
  { key: 'tags', label: '优化标记', better: null }
];

export class PerformanceStats {
  /**
   * @param {HTMLElement} container - 指标卡挂载容器（.performance-stats）
   * @param {object} options
   * @param {'before'|'after'} options.side - 图表侧别
   * @param {Function} options.getTip - 可选：自定义悬停说明 (key) => string
   */
  constructor(container, { side, getTip }) {
    this.container = container;
    this.side = side;
    this.getTip = getTip || (() => '');
    this.current = {
      points: 0,
      renderTime: 0,
      fps: 0,
      memory: null,
      loadMode: '一次性加载',
      tags: ''
    };
    this.render();
  }

  /** 构建指标卡 DOM */
  render() {
    this.container.innerHTML = '';
    this.valueEls = {};
    for (const metric of METRICS) {
      if (metric.key === 'tags' && this.side === 'before') continue; // 优化标记仅右侧显示

      const item = document.createElement('div');
      item.className = 'stat-item';
      item.dataset.key = metric.key;

      const label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = metric.label;

      const value = document.createElement('span');
      value.className = 'stat-value';
      value.textContent = '--';
      this.valueEls[metric.key] = value;

      // 悬停提示：展示该指标与优化策略的关联说明
      const tip = document.createElement('div');
      tip.className = 'stat-tip';
      tip.textContent = this.getTip(metric.key) || '该指标无额外说明';

      item.append(label, value, tip);
      this.container.appendChild(item);
    }
  }

  /**
   * 更新指标数值
   * @param {object} stats - { points, renderTime, fps, memory, loadMode, tags }
   */
  update(stats) {
    this.current = { ...this.current, ...stats };

    if (this.valueEls.points) {
      this.valueEls.points.textContent = formatNumber(this.current.points);
    }
    if (this.valueEls.renderTime) {
      this.valueEls.renderTime.textContent = `${this.current.renderTime.toFixed(0)} ms`;
    }
    if (this.valueEls.fps) {
      this.valueEls.fps.textContent = `${this.current.fps.toFixed(0)} FPS`;
    }
    if (this.valueEls.memory) {
      const m = this.current.memory;
      if (m === null || m === undefined) {
        this.valueEls.memory.textContent = '--';
      } else if (m < 0.1) {
        // 增量过小（小于 0.1MB）时如实展示，避免 0.0 误导
        this.valueEls.memory.textContent = '< 0.1 MB';
      } else {
        this.valueEls.memory.textContent = formatMB(m);
      }
    }
    if (this.valueEls.loadMode) {
      this.valueEls.loadMode.textContent = this.current.loadMode;
    }
    if (this.valueEls.tags) {
      this.valueEls.tags.textContent = this.current.tags || '无';
      this.valueEls.tags.title = this.current.tags
        ? this.current.tags.split(' ').map((t) => t.slice(1)).filter(Boolean)
            .map((k) => OPTIMIZATION_PRESETS[k]?.principle || '')
            .join('\n')
        : '';
    }
  }

  /**
   * 对比高亮：比较左右两侧指标，为差异显著的数值附加标记
   * @param {object} beforeStats - 左侧（未优化）指标
   */
  setComparison(beforeStats) {
    const compare = (key, better, beforeValue, afterValue) => {
      const el = this.valueEls[key];
      if (!el) return;
      // 清除旧标记
      el.classList.remove('improved', 'worse');

      if (beforeValue === undefined || afterValue === undefined || beforeValue === null || afterValue === null) return;
      if (typeof afterValue !== 'number' || typeof beforeValue !== 'number') return;
      if (beforeValue === 0 && afterValue === 0) return;

      // 相对差异
      const base = Math.max(Math.abs(beforeValue), 0.001);
      const diff = (afterValue - beforeValue) / base;

      if (better === 'lower' && diff <= -IMPROVEMENT_THRESHOLD) {
        el.classList.add('improved'); // 耗时/内存下降 30%+
      } else if (better === 'higher' && diff >= IMPROVEMENT_THRESHOLD) {
        el.classList.add('improved'); // FPS 提升 30%+
      } else if (diff >= IMPROVEMENT_THRESHOLD && better === 'lower') {
        el.classList.add('worse');
      } else if (diff <= -IMPROVEMENT_THRESHOLD && better === 'higher') {
        el.classList.add('worse');
      }
    };

    compare('points', 'lower', beforeStats.points, this.current.points);
    compare('renderTime', 'lower', beforeStats.renderTime, this.current.renderTime);
    compare('fps', 'higher', beforeStats.fps, this.current.fps);
    compare('memory', 'lower', beforeStats.memory, this.current.memory);
  }

  /** 获取当前指标快照（用于导出报告） */
  getData() {
    return { ...this.current };
  }

  /** 重置为初始状态 */
  reset() {
    this.current = {
      points: 0,
      renderTime: 0,
      fps: 0,
      memory: null,
      loadMode: '一次性加载',
      tags: ''
    };
    this.update(this.current);
    this.render();
  }
}
