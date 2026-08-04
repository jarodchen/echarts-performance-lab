/**
 * 增量更新逻辑
 *
 * ECharts setOption 的两种更新模式：
 * - 默认 merge 模式：增量合并，只更新变化的配置项，性能最好
 * - notMerge 模式（第二参数 true）：全量替换配置，但复用实例状态
 *
 * "增量更新"策略的演示方式：
 * - 开启时：复用已有图表实例，setOption(option, true) 全量替换（避免销毁重建）
 * - 关闭时：dispose 销毁实例后重新 init + setOption（模拟"每次重建"的最差情况）
 *
 * 实测对比：数据量越大，复用实例 vs 销毁重建的耗时差异越明显。
 */

/**
 * 判断是否需要重建实例
 * 当图表类型、渲染器等"结构性配置"发生变化时，增量更新也无法复用，必须重建
 * @param {object} prevConfig - 上次配置
 * @param {object} nextConfig - 本次配置
 * @returns {boolean}
 */
export function needsRecreate(prevConfig, nextConfig) {
  if (!prevConfig) return true;
  return (
    prevConfig.chartType !== nextConfig.chartType ||
    prevConfig.renderer !== nextConfig.renderer ||
    prevConfig.dataFormat !== nextConfig.dataFormat
  );
}

/**
 * 应用增量更新（复用实例）
 * @param {object} chart - 已有 ECharts 实例
 * @param {object} option - 新配置
 * @returns {number} 更新耗时（毫秒）
 */
export function applyIncremental(chart, option) {
  const start = performance.now();
  // 第二参数 true = notMerge：全量替换但复用实例（比 dispose + init 快）
  chart.setOption(option, true);
  return performance.now() - start;
}
