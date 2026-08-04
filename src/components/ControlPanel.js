/**
 * 控制面板组件：构建并管理左侧边栏的所有控件
 *
 * 控件清单（对应提示词第 2 节）：
 * - 数据控制区：数据量滑块+数字输入、快捷按钮、数据格式、加载模式、生成数据
 * - 优化策略区：8 个优化策略复选框（仅作用于右侧图表）
 * - 交互控制区：渲染器单选、图表类型、Tooltip 触发
 * - 操作按钮：应用配置 / 重置为默认 / 导出 CSV / 导出 JSON
 */
import {
  OPTIMIZATION_PRESETS,
  STRATEGY_ORDER,
  CHART_TYPES,
  DATA_FORMATS,
  LOAD_MODES,
  RENDERERS,
  TOOLTIP_TRIGGERS,
  DEFAULT_PRESET,
  DEFAULT_DATA_COUNT
} from '../config/optimizationPresets.js';

/** 应用默认配置 */
export const DEFAULT_CONFIG = {
  count: DEFAULT_DATA_COUNT,
  format: 'array',
  loadMode: 'once',
  strategies: new Set(DEFAULT_PRESET),
  renderer: 'canvas',
  chartType: 'line',
  tooltipTrigger: 'mousemove'
};

/** 快捷数据量按钮 */
const QUICK_COUNTS = [1000, 10000, 100000, 1000000, 10000000];

/**
 * 滑块值 → 数据量（分段线性映射，严格满足提示词步长要求）：
 * - 滑块 1~100    → 1k~100k   步长 1,000
 * - 滑块 100~190  → 100k~1M   步长 10,000
 * - 滑块 190~280  → 1M~10M    步长 100,000
 * @param {number} v - 滑块位置
 * @returns {number}
 */
export function sliderToCount(v) {
  if (v <= 100) return v * 1000;
  if (v <= 190) return 100000 + (v - 100) * 10000;
  return 1000000 + (v - 190) * 100000;
}

/**
 * 数据量 → 滑块位置（sliderToCount 的反函数）
 * @param {number} count
 * @returns {number}
 */
export function countToSlider(count) {
  if (count <= 100000) return count / 1000;
  if (count <= 1000000) return 100 + (count - 100000) / 10000;
  return 190 + (count - 1000000) / 100000;
}

export class ControlPanel {
  /**
   * @param {HTMLElement} root - 面板挂载容器
   * @param {object} handlers
   * @param {Function} handlers.onApply - 点击"应用配置" (config)
   * @param {Function} handlers.onRegenerate - 点击"生成数据"（重新生成随机数据）
   * @param {Function} handlers.onExport - 导出报告 (format: 'csv'|'json')
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.refs = {};
    this.build();
    this.bindEvents();
    this.setConfig(structuredClone(DEFAULT_CONFIG, { transfer: [] }));
  }

  /** 构建控件 DOM */
  build() {
    this.root.innerHTML = `
      <div class="control-panel">
        <!-- ======== 数据控制区 ======== -->
        <section class="panel-section">
          <h3>数据控制</h3>

          <div class="control-group">
            <label class="control-label" for="count-slider">
              数据量 <span class="label-value" id="count-label">10,000</span>
            </label>
            <div class="slider-row">
              <input type="range" id="count-slider" min="1" max="280" step="1" value="10" />
              <input type="number" id="count-input" class="num-input" min="1000" max="10000000" step="1000" value="10000" />
            </div>
            <div class="quick-counts" id="quick-counts">
              ${QUICK_COUNTS.map((c) => `<button data-count="${c}">${formatCount(c)}</button>`).join('')}
            </div>
          </div>

          <div class="control-group">
            <label class="control-label" for="data-format">数据格式</label>
            <select id="data-format">
              ${Object.values(DATA_FORMATS).map((f) => `<option value="${f.key}">${f.label}</option>`).join('')}
            </select>
          </div>

          <div class="control-group">
            <label class="control-label" for="load-mode">加载模式</label>
            <select id="load-mode">
              ${Object.values(LOAD_MODES).map((m) => `<option value="${m.key}">${m.label}</option>`).join('')}
            </select>
          </div>

          <button type="button" class="btn btn-secondary" id="btn-regenerate">🔄 生成数据</button>
        </section>

        <!-- ======== 优化策略区（仅右侧图表） ======== -->
        <section class="panel-section">
          <h3>优化策略（仅右侧）</h3>
          <div id="strategy-list">
            ${STRATEGY_ORDER.map((key) => {
              const p = OPTIMIZATION_PRESETS[key];
              return `
                <label class="checkbox-item">
                  <input type="checkbox" value="${key}" />
                  <span class="checkbox-text">${p.label}<span class="checkbox-desc">${p.description}</span></span>
                </label>`;
            }).join('')}
          </div>
        </section>

        <!-- ======== 交互控制区 ======== -->
        <section class="panel-section">
          <h3>交互控制</h3>

          <div class="control-group">
            <span class="control-label">渲染器</span>
            <div class="radio-group" id="renderer-group">
              ${Object.values(RENDERERS).map(
                (r) => `
                  <label>
                    <input type="radio" name="renderer" value="${r.key}" />
                    <span class="radio-text">${r.label}</span>
                  </label>`
              ).join('')}
            </div>
          </div>

          <div class="control-group">
            <label class="control-label" for="chart-type">图表类型</label>
            <select id="chart-type">
              ${Object.values(CHART_TYPES).map((t) => `<option value="${t.key}">${t.label}</option>`).join('')}
            </select>
          </div>

          <div class="control-group">
            <label class="control-label" for="tooltip-trigger">Tooltip 触发</label>
            <select id="tooltip-trigger">
              ${Object.values(TOOLTIP_TRIGGERS).map((t) => `<option value="${t.key}">${t.label}</option>`).join('')}
            </select>
          </div>
        </section>

        <!-- ======== 操作按钮 ======== -->
        <section class="panel-actions">
          <button type="button" class="btn btn-primary" id="btn-apply">⚡ 应用配置</button>
          <button type="button" class="btn btn-secondary" id="btn-reset">↺ 重置为默认</button>
          <div class="export-row">
            <button type="button" class="btn btn-export" id="btn-export-csv">导出 CSV</button>
            <button type="button" class="btn btn-export" id="btn-export-json">导出 JSON</button>
          </div>
        </section>
      </div>`;

    this.refs = {
      slider: this.root.querySelector('#count-slider'),
      input: this.root.querySelector('#count-input'),
      label: this.root.querySelector('#count-label'),
      quickCounts: this.root.querySelector('#quick-counts'),
      dataFormat: this.root.querySelector('#data-format'),
      loadMode: this.root.querySelector('#load-mode'),
      chartType: this.root.querySelector('#chart-type'),
      tooltipTrigger: this.root.querySelector('#tooltip-trigger'),
      rendererGroup: this.root.querySelector('#renderer-group'),
      strategyList: this.root.querySelector('#strategy-list'),
      btnRegenerate: this.root.querySelector('#btn-regenerate'),
      btnApply: this.root.querySelector('#btn-apply'),
      btnReset: this.root.querySelector('#btn-reset'),
      btnExportCsv: this.root.querySelector('#btn-export-csv'),
      btnExportJson: this.root.querySelector('#btn-export-json')
    };
  }

  /** 绑定所有控件事件 */
  bindEvents() {
    // 滑块拖动：实时更新数值显示与输入框
    this.refs.slider.addEventListener('input', () => {
      const count = sliderToCount(parseInt(this.refs.slider.value, 10));
      this.updateCountDisplay(count);
      this.clearQuickActive();
    });

    // 数字输入框：修改后反算滑块位置
    this.refs.input.addEventListener('change', () => {
      const raw = parseInt(this.refs.input.value, 10);
      if (Number.isNaN(raw)) {
        this.refs.input.value = this.getConfig().count;
        return;
      }
      const count = Math.min(10000000, Math.max(1000, Math.round(raw)));
      this.refs.input.value = count;
      this.refs.slider.value = Math.round(countToSlider(count));
      this.updateCountDisplay(count);
      this.clearQuickActive();
    });

    // 快捷按钮
    this.refs.quickCounts.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-count]');
      if (!btn) return;
      const count = parseInt(btn.dataset.count, 10);
      this.refs.slider.value = Math.round(countToSlider(count));
      this.refs.input.value = count;
      this.updateCountDisplay(count);
      this.refs.quickCounts
        .querySelectorAll('button')
        .forEach((b) => b.classList.toggle('active', b === btn));
    });

    // 操作按钮
    this.refs.btnApply.addEventListener('click', () => this.handlers.onApply?.(this.getConfig()));
    this.refs.btnReset.addEventListener('click', () => {
      this.setConfig(structuredClone(DEFAULT_CONFIG, { transfer: [] }));
      this.handlers.onApply?.(this.getConfig());
    });
    this.refs.btnRegenerate.addEventListener('click', () => this.handlers.onRegenerate?.());
    this.refs.btnExportCsv.addEventListener('click', () => this.handlers.onExport?.('csv'));
    this.refs.btnExportJson.addEventListener('click', () => this.handlers.onExport?.('json'));
  }

  /** 更新数据量显示（label + 输入框） */
  updateCountDisplay(count) {
    this.refs.label.textContent = formatCount(count);
    this.refs.input.value = count;
  }

  /** 清除快捷按钮选中态 */
  clearQuickActive() {
    this.refs.quickCounts.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
  }

  /**
   * 读取当前配置
   * @returns {object} 完整配置对象
   */
  getConfig() {
    const strategies = new Set(
      [...this.refs.strategyList.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value)
    );
    return {
      count: parseInt(this.refs.input.value, 10) || DEFAULT_DATA_COUNT,
      format: this.refs.dataFormat.value,
      loadMode: this.refs.loadMode.value,
      strategies,
      renderer: this.refs.rendererGroup.querySelector('input:checked')?.value || 'canvas',
      chartType: this.refs.chartType.value,
      tooltipTrigger: this.refs.tooltipTrigger.value
    };
  }

  /**
   * 将控件状态设置为指定配置
   * @param {object} config - 配置对象（含 strategies 为可迭代集合）
   */
  setConfig(config) {
    this.refs.slider.value = Math.round(countToSlider(config.count));
    this.refs.input.value = config.count;
    this.updateCountDisplay(config.count);
    this.clearQuickActive();
    // 快捷按钮匹配高亮
    const match = this.refs.quickCounts.querySelector(
      `button[data-count="${config.count}"]`
    );
    if (match) match.classList.add('active');

    this.refs.dataFormat.value = config.format;
    this.refs.loadMode.value = config.loadMode;
    this.refs.chartType.value = config.chartType;
    this.refs.tooltipTrigger.value = config.tooltipTrigger;

    // 渲染器单选
    const radio = this.refs.rendererGroup.querySelector(`input[value="${config.renderer}"]`);
    if (radio) radio.checked = true;

    // 策略复选框
    const enabled = new Set(config.strategies);
    this.refs.strategyList.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = enabled.has(el.value);
    });
  }

  /** 渲染期间禁用面板交互 */
  setBusy(busy) {
    this.root.querySelector('.control-panel').classList.toggle('busy', busy);
    this.refs.btnApply.disabled = busy;
    this.refs.btnRegenerate.disabled = busy;
    this.refs.btnReset.disabled = busy;
    this.refs.btnExportCsv.disabled = busy;
    this.refs.btnExportJson.disabled = busy;
  }
}

/** 数据量格式化（1k / 10k / 1M / 10M） */
function formatCount(count) {
  if (count >= 1000000) return `${count / 1000000}M`;
  if (count >= 1000) return `${count / 1000}k`;
  return String(count);
}
