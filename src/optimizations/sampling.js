/**
 * LTTB 降采样封装
 *
 * Largest-Triangle-Three-Buckets（最大三角形三桶）算法：
 * 将数据均匀分桶，每桶保留一个离相邻桶中点连线最远的点，
 * 从而在压缩数据量的同时最大程度保留波形趋势特征。
 *
 * 使用 npm 包 `downsample-lttb`（Sveinn Steinarsson 算法的 Node 移植版），
 * 输入输出均为 [[x, y], ...] 普通数组。
 * 注意：LTTB 为同步算法，1000 万点降采样耗时约几百毫秒，
 * 扩展方向：可移入 Web Worker 避免阻塞主线程。
 */
import { processData as lttb } from 'downsample-lttb';
import { fromTypedArray, isTypedArray } from '../utils/typedArrayHelper.js';

/**
 * LTTB 降采样
 * @param {Array<Array<number>> | Float64Array} data - 原始数据
 * @param {number} threshold - 目标点数
 * @returns {Array<Array<number>>} 降采样后的普通二维数组
 */
export function lttbSample(data, threshold) {
  // TypedArray 需先转为普通二维数组（lttb 库仅支持数组格式）
  const points = isTypedArray(data) ? fromTypedArray(data) : data;
  if (points.length <= threshold) {
    // 数据量未超过阈值，无需降采样
    return points;
  }
  return lttb(points, threshold);
}

/**
 * 降采样统计信息
 * @param {Array<Array<number>> | Float64Array} data
 * @param {Array<Array<number>>} sampled
 * @returns {{ original: number, sampled: number, reduction: string }}
 */
export function lttbStats(data, sampled) {
  const original = isTypedArray(data) ? data.length / 2 : data.length;
  const sampledCount = sampled.length;
  const reduction = original > 0 ? (1 - sampledCount / original) * 100 : 0;
  return {
    original,
    sampled: sampledCount,
    reduction: reduction.toFixed(1) + '%'
  };
}
