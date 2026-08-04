/**
 * 分片加载（流式追加）逻辑
 *
 * 使用 ECharts 的 appendData 接口分批追加数据：
 * 1. 首次 setOption 渲染空数据，建立图表结构
 * 2. 每批追加 APPEND_BATCH_SIZE 条数据（默认 5000）
 * 3. 通过 requestAnimationFrame 调度，让出主线程，界面保持可交互
 *
 * 注意事项：
 * - appendData 依赖 series.data（dataset 模式下不可用），因此分片模式不使用 dataset
 * - 柱状图不支持 appendData，回退为"分批 setOption"模拟流式加载
 */
import { APPEND_BATCH_SIZE } from '../config/optimizationPresets.js';
import { toPlainArray } from '../config/defaultOptions.js';
import { sliceTypedToPairs } from '../utils/typedArrayHelper.js';
import { formatNumber } from '../utils/performance.js';

/**
 * 将数据切成普通数组批次的迭代器
 * @param {Array<Array<number>> | Float64Array} fullData - 完整数据
 * @param {number} batchSize - 每批点数
 * @returns {Generator<Array<Array<number>>, void, void>}
 */
function* batchIterator(fullData, batchSize) {
  if (fullData instanceof Float64Array || fullData instanceof Float32Array) {
    // TypedArray：按点索引切片（每点 2 个数字）
    const total = fullData.length / 2;
    for (let start = 0; start < total; start += batchSize) {
      yield sliceTypedToPairs(fullData, start, Math.min(start + batchSize, total));
    }
  } else {
    for (let start = 0; start < fullData.length; start += batchSize) {
      yield fullData.slice(start, Math.min(start + batchSize, fullData.length));
    }
  }
}

/**
 * 以分片模式渲染图表
 * @param {object} chart - ECharts 实例（已初始化且未设置过数据）
 * @param {object} baseOption - 不含数据的基础 option
 * @param {Array<Array<number>> | Float64Array} fullData - 完整数据
 * @param {object} options
 * @param {boolean} options.isBar - 柱状图回退模式
 * @param {number} options.batchSize - 每批点数
 * @param {Function} options.onProgress - 进度回调 (percent, loadedCount, totalCount)
 * @returns {Promise<void>}
 */
export async function renderWithAppend(chart, baseOption, fullData, options = {}) {
  const { isBar = false, batchSize = APPEND_BATCH_SIZE, onProgress } = options;
  const totalPoints = fullData instanceof Float64Array || fullData instanceof Float32Array
    ? fullData.length / 2
    : fullData.length;

  if (totalPoints === 0) {
    chart.setOption(baseOption);
    return;
  }

  // 第一步：渲染空数据，建立坐标轴与系列结构
  chart.setOption({ ...baseOption, series: [{ ...baseOption.series[0], data: [] }] });

  if (isBar) {
    // ---- 柱状图回退方案：分批 setOption 累积数据（bar 不支持 appendData） ----
    // 为避免每次全量重建，使用增量合并模式逐批追加
    const plainData = toPlainArray(fullData);
    let appended = 0;
    for (let start = 0; start < totalPoints; start += batchSize) {
      const end = Math.min(start + batchSize, totalPoints);
      appended = end;
      chart.setOption({
        series: [{ data: plainData.slice(0, end) }]
      });
      onProgress?.((end / totalPoints) * 100, appended, totalPoints);
      // 让出主线程一帧，保证界面可交互
      await nextFrame();
    }
    return;
  }

  // ---- 折线图 / 散点图：使用原生 appendData ----
  const generator = batchIterator(fullData, batchSize);
  let appended = 0;
  for (const batch of generator) {
    chart.appendData({ seriesIndex: 0, data: batch });
    // 本地计数维护进度（getOption 在 appendData 模式下返回值不可靠）
    appended += batch.length;
    onProgress?.((appended / totalPoints) * 100, appended, totalPoints);
    await nextFrame();
  }
}

/**
 * 等待下一帧（使分片循环让出主线程）
 * @returns {Promise<void>}
 */
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * 格式化进度文本
 * @param {number} percent
 * @returns {string}
 */
export function formatProgress(percent) {
  return `${Math.min(100, Math.round(percent))}%`;
}

/**
 * 生成加载状态文本（用于指标卡"加载方式"）
 * @param {number} loaded - 已加载点数
 * @param {number} total - 总点数
 * @returns {string}
 */
export function buildAppendLabel(loaded, total) {
  return `分片加载 ${formatNumber(loaded)}/${formatNumber(total)}`;
}
