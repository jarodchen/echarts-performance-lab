/**
 * 应用根组件：编排控制面板、两个图表容器与性能指标的完整流程
 *
 * 核心流程（对应提示词 9.2）：
 * 1. 从控制面板读取配置
 * 2. 生成/获取数据（带缓存）
 * 3. 左侧图表：直接渲染原始 option（无任何优化）
 * 4. 右侧图表：LTTB 采样 → 应用优化策略 → 渲染（支持增量更新复用实例）
 * 5. 测量指标、对比高亮、进度条与加载动画
 */
import { ControlPanel } from './components/ControlPanel.js';
import { ChartContainer } from './components/ChartContainer.js';
import { PerformanceStats } from './components/PerformanceStats.js';
import { HelpModal } from './components/HelpModal.js';
import { buildLineOption } from './charts/lineChart.js';
import { buildScatterOption } from './charts/scatterChart.js';
import { buildBarOption } from './charts/barChart.js';
import { applyOptimizations, formatStrategyTags } from './optimizations/applyOptimizations.js';
import { lttbSample } from './optimizations/sampling.js';
import { needsRecreate } from './optimizations/incrementalUpdate.js';
import { generateData, countPoints } from './utils/dataGenerator.js';
import { dataCache, buildCacheKey } from './utils/cache.js';
import { buildDataset } from './config/defaultOptions.js';
import { LTTB_THRESHOLD, OPTIMIZATION_PRESETS } from './config/optimizationPresets.js';

/** 指标悬停说明（对应提示词 3.3：悬停可查看策略贡献说明） */
const STAT_TIPS = {
  points: '当前参与渲染的数据点总数。LTTB 降采样可将其压缩至 5,000 点。',
  renderTime: '首帧呈现时间（setOption 到第一次绘制完成）。large / dataZoom / LTTB / 关闭动画可显著降低；progressive 分帧渲染下该值体现“快速首屏”优势。',
  fps: '最近 500ms 窗口的平均帧率。分片加载、progressive、关闭动画、tooltip 改为 click 可提升。',
  memory: '本次渲染的内存增量（渲染前后 JS 堆差值，仅 Chrome 支持）。TypedArray 与降采样可降低内存。',
  loadMode: '一次性加载将全部数据一次渲染；分片加载每批 5,000 条逐步追加。',
  tags: '当前生效的优化策略组合。'
};

export class App {
  /** @param {HTMLElement} root - #app 容器 */
  constructor(root) {
    this.root = root;
    this.seed = Date.now();
    this.lastConfig = null;
    this.renderSeq = 0; // 渲染序号：防止异步竞态

    this.buildLayout();

    this.panel = new ControlPanel(this.controlRoot, {
      onApply: (config) => this.apply(config),
      onRegenerate: () => this.apply(this.panel.getConfig(), { forceRegenerate: true }),
      onExport: (format) => this.exportReport(format)
    });

    this.beforeContainer = new ChartContainer({
      el: this.beforeChartEl,
      progressEl: this.beforeProgressEl,
      side: 'before',
      renderer: 'canvas',
      onStatsUpdate: (stats) => {
        this.beforeStats.update(stats);
        this.afterStats.setComparison(this.beforeStats.getData());
      }
    });

    this.afterContainer = new ChartContainer({
      el: this.afterChartEl,
      progressEl: this.afterProgressEl,
      side: 'after',
      renderer: 'canvas',
      onStatsUpdate: (stats) => {
        this.afterStats.update(stats);
      }
    });

    this.beforeStats = new PerformanceStats(this.beforeStatsEl, { side: 'before', getTip: (k) => STAT_TIPS[k] });
    this.afterStats = new PerformanceStats(this.afterStatsEl, { side: 'after', getTip: (k) => STAT_TIPS[k] });

    // 默认配置首次渲染
    this.apply(this.panel.getConfig());
  }

  /** 构建整体页面布局 DOM */
  buildLayout() {
    this.root.innerHTML = `
      <!-- 控制面板挂载点 -->
      <div id="control-root"></div>

      <main class="charts-area">
        <button type="button" class="panel-toggle" id="panel-toggle">☰ 控制面板</button>
        <header class="charts-header">
          <div>
            <h1>ECharts 性能优化对比实验室</h1>
            <p class="subtitle">左侧为未优化图表（红色系），右侧为优化后图表（绿色系）· 两组图表使用完全相同的原始数据</p>
          </div>
          <button type="button" class="btn btn-secondary help-btn" id="btn-help">📖 操作文档</button>
        </header>

        <div class="chart-columns">
          <!-- ======== 左侧：优化前 ======== -->
          <section class="chart-card before">
            <div class="chart-card-header">
              <div class="chart-card-title">
                <span class="badge before">优化前</span>未应用任何优化
              </div>
              <div class="chart-toolbar">
                <button type="button" class="btn btn-secondary" data-export-img="before">导出图片</button>
              </div>
            </div>
            <div class="chart-wrapper">
              <div class="chart-canvas" id="chart-before"></div>
              <div class="loading-mask">数据生成中...</div>
            </div>
            <div class="append-progress"><div class="bar"></div><span class="progress-text"></span></div>
            <div class="performance-stats" id="stats-before"></div>
          </section>

          <!-- ======== 右侧：优化后 ======== -->
          <section class="chart-card after">
            <div class="chart-card-header">
              <div class="chart-card-title">
                <span class="badge after">优化后</span>已应用优化策略
              </div>
              <div class="chart-toolbar">
                <button type="button" class="btn btn-secondary" data-export-img="after">导出图片</button>
              </div>
            </div>
            <div class="opt-tags" id="after-tags"></div>
            <div class="chart-wrapper">
              <div class="chart-canvas" id="chart-after"></div>
              <div class="loading-mask">数据生成中...</div>
            </div>
            <div class="append-progress"><div class="bar"></div><span class="progress-text"></span></div>
            <div class="performance-stats" id="stats-after"></div>
          </section>
        </div>
      </main>`;

    this.controlRoot = this.root.querySelector('#control-root');
    this.beforeChartEl = this.root.querySelector('#chart-before');
    this.afterChartEl = this.root.querySelector('#chart-after');
    this.beforeProgressEl = this.beforeChartEl.closest('.chart-card').querySelector('.append-progress');
    this.afterProgressEl = this.afterChartEl.closest('.chart-card').querySelector('.append-progress');
    this.beforeStatsEl = this.root.querySelector('#stats-before');
    this.afterStatsEl = this.root.querySelector('#stats-after');
    this.afterTagsEl = this.root.querySelector('#after-tags');

    // 响应式折叠面板开关
    this.root.querySelector('#panel-toggle').addEventListener('click', () => {
      this.root.querySelector('.control-panel').classList.toggle('open');
    });

    // 操作文档弹窗
    this.helpModal = new HelpModal(document.body);
    this.root.querySelector('#btn-help').addEventListener('click', () => this.helpModal.toggle());

    // 导出图片按钮
    this.root.querySelectorAll('[data-export-img]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.exportImg;
        (side === 'after' ? this.afterContainer : this.beforeContainer)?.exportImage();
      });
    });
  }

  /**
   * 获取数据（带缓存；forceRegenerate 时使用新随机种子强制重新生成）
   * @param {number} count
   * @param {string} format - 'array' | 'typed'
   * @param {boolean} forceRegenerate
   */
  getData(count, format, forceRegenerate = false) {
    if (forceRegenerate) {
      this.seed = Math.floor(Date.now() + Math.random() * 10000);
    }
    const key = buildCacheKey({ count, format, seed: this.seed });
    let data = dataCache.get(key);
    if (!data) {
      data = generateData(count, format === 'typed', this.seed);
      dataCache.set(key, data);
    }
    return data;
  }

  /**
   * 应用配置并渲染两个图表
   * @param {object} config - 完整配置
   * @param {object} options
   * @param {boolean} options.forceRegenerate - 是否强制重新生成数据
   */
  async apply(config, options = {}) {
    const seq = ++this.renderSeq;
    this.panel.setBusy(true);
    // 立即显示加载动画（数据生成与渲染期间保持）
    this.showLoading();

    // 1. 获取数据（10M 点生成耗时约 1-2 秒）
    let data = null;
    try {
      data = await this.scheduleTask(() => this.getData(config.count, config.format, options.forceRegenerate));
    } catch (err) {
      console.error('数据生成失败:', err);
      this.hideLoading();
      this.panel.setBusy(false);
      return;
    }
    if (seq !== this.renderSeq) return; // 用户已触发新渲染，交由新流程接管

    // 3. 左侧：无优化直接渲染
    const beforePoints = countPoints(data);
    try {
      await this.renderSide('before', this.beforeContainer, data, {
        config,
        points: beforePoints,
        tags: '',
        isBar: config.chartType === 'bar'
      });

      // 4. 右侧：应用优化策略
      await this.renderSide('after', this.afterContainer, data, {
        config,
        points: beforePoints,
        tags: '',
        isBar: config.chartType === 'bar',
        optimized: true
      });

      // 5. 对比高亮 + 优化标记
      this.afterStats.setComparison(this.beforeStats.getData());
      this.updateTags(config);
    } catch (err) {
      console.error('渲染失败:', err);
    } finally {
      this.hideLoading();
      this.panel.setBusy(false);
    }
    this.lastConfig = config;
  }

  /**
   * 渲染单个图表（处理数据注入、优化策略、增量更新）
   * @param {'before'|'after'} side
   * @param {ChartContainer} container
   * @param {Array|Float64Array} data
   * @param {object} ctx
   */
  async renderSide(side, container, data, ctx) {
    const { config, points, isBar, optimized } = ctx;
    const appendMode = config.loadMode === 'append';
    let renderData = data;
    let tags = [];

    // 每个侧别独立构建基础 option：isOptimized 决定主色（红/绿）与 series 名称（优化前/优化后）
    const baseOption = this.buildBaseOption(config, optimized);

    if (optimized) {
      // ---- 右侧：先做数据级优化（LTTB 降采样），再应用配置级优化 ----
      if (config.strategies.has('lttb')) {
        renderData = lttbSample(data, LTTB_THRESHOLD);
        tags.push('lttb');
      }
      const { applied } = applyOptimizations(baseOption, config.chartType, config.strategies);
      tags = applied;
    }

    // 决定是否需要重建图表实例
    const canIncremental =
      optimized &&
      config.strategies.has('incrementalUpdate') &&
      !appendMode &&
      !needsRecreate(this.lastConfig, { chartType: config.chartType, renderer: config.renderer, dataFormat: config.format });

    if (!canIncremental) {
      // 重建实例：切换渲染器 / 图表类型 / 数据格式时也必须重建
      container.renderer = config.renderer;
      container.createChart();
    } else {
      container.renderer = config.renderer;
    }

    const finalPoints = countPoints(renderData);
    const loadLabel = appendMode
      ? `${isBar ? '分片加载(模拟)' : '分片加载'} 0/${formatPoints(points)}`
      : '一次性加载';
    const tagsText = optimized ? formatStrategyTags(tags) : '';

    if (appendMode) {
      // 分片加载：dataset 不适用（appendData 需要 series.data），使用基础 option
      const pointsMeta = { points: finalPoints, tags: tagsText, loadMode: loadLabel };
      await container.renderWithAppend(baseOption, renderData, {
        ...pointsMeta,
        isBar
      });
    } else {
      // 一次性加载：通过 dataset 注入数据（普通数组 / TypedArray 均直接消费）
      const option = { ...baseOption, dataset: buildDataset(renderData) };
      const pointsMeta = { points: finalPoints, tags: tagsText, loadMode: loadLabel };
      await container.renderOnce(option, pointsMeta);
    }
  }

  /**
   * 构建当前图表类型的基础 option
   * @param {object} config - 完整配置
   * @param {boolean} [isOptimized] - 是否为优化侧（决定主色与 series 名称，缺省为 false）
   */
  buildBaseOption(config, isOptimized = false) {
    const opts = { tooltipTrigger: config.tooltipTrigger, isOptimized };
    switch (config.chartType) {
      case 'scatter':
        return buildScatterOption(opts);
      case 'bar':
        return buildBarOption(opts);
      case 'line':
      default:
        return buildLineOption(opts);
    }
  }

  /** 更新右侧优化标记列表 */
  updateTags(config) {
    const enabled = [...config.strategies]
      .map((k) => OPTIMIZATION_PRESETS[k])
      .filter((p) => p && p.applicable.includes(config.chartType))
      .map((p) => `<span class="opt-tag" title="${p.principle}">+${p.key}</span>`);
    this.afterTagsEl.innerHTML = enabled.join('') || '<span class="opt-tag" style="color:#5f6f93;border-color:#2a3a5e">无优化策略</span>';
  }

  /** 显示两个图表的加载动画 */
  showLoading() {
    this.beforeContainer.showLoading();
    this.afterContainer.showLoading();
  }

  /** 隐藏加载动画 */
  hideLoading() {
    this.beforeContainer.hideLoading();
    this.afterContainer.hideLoading();
  }

  /**
   * 将耗时任务调度到宏任务，让加载动画先绘制
   * @template T
   * @param {Function} task
   * @returns {Promise<T>}
   */
  scheduleTask(task) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(task());
        } catch (err) {
          reject(err);
        }
      }, 30);
    });
  }

  /**
   * 导出性能对比报告（CSV / JSON）
   * @param {'csv'|'json'} format
   */
  exportReport(format) {
    const before = this.beforeStats.getData();
    const after = this.afterStats.getData();
    const config = this.panel.getConfig();

    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        dataCount: config.count,
        dataFormat: config.format,
        loadMode: config.loadMode,
        renderer: config.renderer,
        chartType: config.chartType,
        tooltipTrigger: config.tooltipTrigger,
        strategies: [...config.strategies]
      },
      before: {
        points: before.points,
        renderTimeMs: before.renderTime,
        fps: before.fps,
        memoryMB: before.memory,
        loadMode: before.loadMode
      },
      after: {
        points: after.points,
        renderTimeMs: after.renderTime,
        fps: after.fps,
        memoryMB: after.memory,
        loadMode: after.loadMode,
        tags: after.tags
      },
      improvement: {
        renderTime: before.renderTime > 0 ? Math.round((1 - after.renderTime / before.renderTime) * 100) + '%' : '--',
        fps: before.fps > 0 ? Math.round((after.fps / before.fps - 1) * 100) + '%' : '--',
        memory: before.memory !== null && after.memory !== null ? Math.round((1 - after.memory / before.memory) * 100) + '%' : '--'
      }
    };

    const filename = `echarts-perf-report-${Date.now()}`;
    if (format === 'json') {
      this.downloadFile(`${filename}.json`, JSON.stringify(report, null, 2), 'application/json');
    } else {
      // CSV：\uFEFF BOM 保证 Excel 正确识别 UTF-8 中文
      const csv = [
        '指标,优化前,优化后,改善幅度',
        `数据点,${before.points},${after.points},--`,
        `渲染耗时(ms),${before.renderTime},${after.renderTime},${report.improvement.renderTime}`,
        `FPS,${before.fps},${after.fps},${report.improvement.fps}`,
                `内存增量(MB),${before.memory ?? '--'},${after.memory ?? '--'},${report.improvement.memory}`,
        `加载方式,${before.loadMode},${after.loadMode},`,
        `优化策略,,${after.tags || '无'},`
      ].join('\n');
      this.downloadFile(`${filename}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
    }
  }

  /** 触发浏览器下载 */
  downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

/** 千分位格式化（指标卡/加载标签用） */
function formatPoints(n) {
  return Math.round(n).toLocaleString('en-US');
}
