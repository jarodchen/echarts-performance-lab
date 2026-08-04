/**
 * 图表容器组件：封装单个 ECharts 图表的完整生命周期
 *
 * 职责：
 * - 创建/销毁 ECharts 实例（支持 Canvas / SVG 渲染器）
 * - 挂载 stats.js FPS 面板 + 自定义 rAF FPS 监控
 * - 渲染耗时测量（首帧呈现时间）
 * - 分片加载（appendData）流程编排
 * - 导出图片（chart.getDataURL）
 * - 汇总性能指标回调给上层
 */
import * as echarts from 'echarts';
import Stats from 'stats.js';
import { FPSMonitor, measureFirstPaintTime, measureAppendTime, readMemoryAfterGc } from '../utils/performance.js';
import { renderWithAppend } from '../optimizations/appendData.js';

export class ChartContainer {
  /**
   * @param {object} options
   * @param {HTMLElement} options.el - 图表挂载元素（.chart-canvas）
   * @param {HTMLElement} options.progressEl - 分片加载进度条容器（.append-progress）
   * @param {'before'|'after'} options.side - 图表侧别
   * @param {string} options.renderer - 'canvas' | 'svg'
   * @param {Function} options.onStatsUpdate - 指标更新回调 (stats) => void
   */
  constructor({ el, progressEl, side, renderer, onStatsUpdate }) {
    this.el = el;
    this.progressEl = progressEl;
    this.side = side;
    this.renderer = renderer;
    this.onStatsUpdate = onStatsUpdate;

    this.chart = null;
    this.statsPanel = null;
    this.fpsMonitor = null;
    this.lastFps = 0;
    this.lastRenderTime = 0;
    this.lastMemory = null;
    this.lastPoints = 0;
    this.lastLoadMode = '一次性加载';
    this.lastTags = '';
    this.generation = 0; // 渲染代数：防止并发渲染的旧结果覆盖新结果
  }

  /**
   * 创建（或重建）图表实例，并启动 FPS 监控
   */
  createChart() {
    // 销毁旧实例，避免内存泄漏
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    // ECharts 初始化：renderer 决定 Canvas 或 SVG 渲染管线
    this.chart = echarts.init(this.el, null, { renderer: this.renderer });

    // stats.js 独立 FPS 面板（图表右上角）
    if (this.statsPanel) {
      this.statsPanel.dom.remove();
    }
    this.statsPanel = new Stats();
    this.statsPanel.showPanel(0); // 0 = FPS 面板
    this.statsPanel.dom.className = 'stats-panel';
    this.statsPanel.dom.style.position = 'absolute';
    this.el.parentElement.appendChild(this.statsPanel.dom);

    // 自定义 rAF FPS 监控（统计窗口 500ms，回填指标卡数值）
    this.fpsMonitor = new FPSMonitor((fps) => {
      this.lastFps = fps;
      this.emitStats();
    }, 500);
    this.fpsMonitor.start();
  }

  /**
   * 一次性渲染 + 测量
   *
   * 测量口径：
   * - 渲染耗时 = 首帧呈现时间（setOption → 第一次 rendered）
   * - 内存 = 本次渲染的内存增量（渲染前后堆内存差值，负值钳制为 0）
   *   * 不用绝对值的原因：usedJSHeapSize 是整个页面进程的堆内存，
   *     先渲染的左侧数据仍在堆中，右侧读到的一定比左侧大，无法公平对比
   *   * 读数前先强制 GC：V8 的堆统计只在 GC 后刷新，不刷新则差值恒为 0
   * @param {object} option - 完整 option
   * @param {object} meta - 附加信息 { points, tags, loadMode }
   * @returns {Promise<number>} 渲染耗时（ms）
   */
  async renderOnce(option, meta = {}) {
    const gen = ++this.generation;
    this.lastPoints = meta.points ?? this.lastPoints;
    this.lastTags = meta.tags ?? this.lastTags;
    this.lastLoadMode = meta.loadMode ?? '一次性加载';
    this.resetFpsWindow();

    // 触发 GC 后读取基线，确保读数反映最新堆统计（V8 只在 GC 后刷新统计）
    const memBefore = readMemoryAfterGc();
    // 首帧呈现时间：progressive 分帧渲染下也能体现“快速首屏”优势
    const renderTime = await measureFirstPaintTime(this.chart, () => {
      this.chart.setOption(option, true);
    });
    if (gen !== this.generation) return renderTime; // 已被新渲染取代，跳过状态回填

    this.lastRenderTime = renderTime;
    this.lastMemory = this.measureMemoryDelta(memBefore);
    this.emitStats();
    return renderTime;
  }

  /**
   * 分片加载渲染 + 测量总耗时
   * @param {object} baseOption - 不含数据的基础 option
   * @param {Array<Array<number>>|Float64Array} data - 完整数据
   * @param {object} meta - { points, tags, loadMode, isBar }
   * @returns {Promise<number>} 总耗时（ms）
   */
  async renderWithAppend(baseOption, data, meta = {}) {
    const gen = ++this.generation;
    this.lastPoints = meta.points ?? this.lastPoints;
    this.lastTags = meta.tags ?? this.lastTags;
    this.lastLoadMode = meta.loadMode ?? '分片加载';
    this.resetFpsWindow();

    // 显示进度条
    this.setProgress(0, true);
    // 触发 GC 后读取基线
    const memBefore = readMemoryAfterGc();


    // 总耗时 = 所有批次追加完成 + 最后一次渲染 finished
    const totalTime = await measureAppendTime(this.chart, () =>
      renderWithAppend(this.chart, baseOption, data, {
        isBar: meta.isBar,
        onProgress: (percent, loaded) => {
          this.setProgress(percent, true);
          // 分片过程中实时更新已加载点数
          this.lastPoints = loaded;
          this.emitStats();
        }
      })
    );
    this.setProgress(100, false);
    if (gen !== this.generation) return totalTime;

    this.lastRenderTime = totalTime;
    this.lastMemory = this.measureMemoryDelta(memBefore);
    this.emitStats();
    return totalTime;
  }

  /**
   * 计算本次渲染的内存增量（渲染后 - 渲染前），负值（GC 回收）钳制为 0
   * 读数前先强制 GC，确保两次读数都是 GC 后的统计值
   * @param {number|null} memBefore - 渲染前堆内存（MB），不支持时为 null
   * @returns {number|null} 内存增量（MB）
   */
  measureMemoryDelta(memBefore) {
    const memAfter = readMemoryAfterGc();
    if (memBefore === null || memAfter === null) return null;
    return Math.max(0, memAfter - memBefore);
  }

  /** 重置 FPS 统计窗口（新渲染后从 0 重新统计） */
  resetFpsWindow() {
    if (this.fpsMonitor) {
      this.fpsMonitor.frames = 0;
      this.fpsMonitor.lastTime = performance.now();
    }
  }

  /**
   * 更新进度条
   * @param {number} percent - 0~100
   * @param {boolean} active - 是否显示
   */
  setProgress(percent, active) {
    if (!this.progressEl) return;
    this.progressEl.classList.toggle('active', active);
    const bar = this.progressEl.querySelector('.bar');
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    const text = this.progressEl.querySelector('.progress-text');
    if (text) text.textContent = `${Math.min(100, Math.round(percent))}%`;
  }

  /** 汇总并上报当前指标 */
  emitStats() {
    this.onStatsUpdate?.({
      points: this.lastPoints,
      renderTime: this.lastRenderTime,
      fps: this.lastFps,
      memory: this.lastMemory,
      loadMode: this.lastLoadMode,
      tags: this.lastTags
    });
  }

  /** 显示 ECharts 加载动画 */
  showLoading() {
    this.chart?.showLoading({
      text: '渲染中...',
      color: '#4dabf7',
      textColor: '#8899bb',
      maskColor: 'rgba(26, 26, 46, 0.6)'
    });
  }

  /** 隐藏 ECharts 加载动画 */
  hideLoading() {
    this.chart?.hideLoading();
  }

  /**
   * 导出图表为 PNG 图片
   * @param {string} filename
   */
  exportImage(filename = `echarts-${this.side}-${Date.now()}.png`) {
    if (!this.chart) return;
    const url = this.chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#16213e'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }

  /** 销毁实例与监控（释放内存） */
  dispose() {
    this.generation++;
    this.fpsMonitor?.stop();
    this.statsPanel?.dom.remove();
    this.statsPanel = null;
    this.chart?.dispose();
    this.chart = null;
  }
}
