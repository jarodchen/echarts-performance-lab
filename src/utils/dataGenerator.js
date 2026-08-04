/**
 * 模拟数据生成器
 *
 * 生成带有明显趋势（正弦波 + 线性增长）和随机噪声的数据，
 * 支持普通二维数组与扁平 Float64Array 两种格式。
 *
 * 数据格式：
 * - array: [[x0, y0], [x1, y1], ...]
 * - typed: Float64Array([x0, y0, x1, y1, ...])，每 2 个数字为 1 组 [x, y]
 */

/**
 * 生成一条数据点的 y 值
 * @param {number} i - x 坐标
 * @param {number} seed - 随机种子，保证同一种子生成相同数据
 * @returns {number}
 */
function computeValue(i, seed) {
  // 趋势：正弦波（周期约 314 点）+ 线性增长
  const trend = Math.sin(i / 50) * 50 + i * 0.01;
  // 确定性伪随机噪声（mulberry32 算法，避免依赖全局 Math.random 顺序）
  const noise = (rand01(i, seed) - 0.5) * 20;
  return trend + noise;
}

/**
 * mulberry32 确定性随机数生成器
 * @param {number} i - 序列位置
 * @param {number} seed - 种子
 * @returns {number} 0~1 之间伪随机数
 */
function rand01(i, seed) {
  let t = (seed + i) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * 生成数据集
 * @param {number} count - 数据点数量
 * @param {boolean} useTypedArray - true 返回 Float64Array，false 返回普通二维数组
 * @param {number} seed - 随机种子（默认取时间戳，保证每次"生成数据"结果不同）
 * @returns {Array<Array<number>> | Float64Array}
 */
export function generateData(count, useTypedArray = false, seed = Date.now()) {
  if (useTypedArray) {
    // 扁平 Float64Array：直接写入连续内存，内存占用约为嵌套数组的 1/4
    const data = new Float64Array(count * 2);
    for (let i = 0; i < count; i++) {
      data[i * 2] = i; // x
      data[i * 2 + 1] = computeValue(i, seed); // y
    }
    return data;
  }

  const data = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = [i, computeValue(i, seed)];
  }
  return data;
}

/**
 * 数据点数量统计（兼容两种格式）
 * @param {Array<Array<number>> | Float64Array} data
 * @returns {number}
 */
export function countPoints(data) {
  return data instanceof Float64Array || data instanceof Float32Array ? data.length / 2 : data.length;
}

/**
 * 采样出数据中的某个片段（用于预览）
 * @param {Array<Array<number>> | Float64Array} data
 * @param {number} start - 起始索引
 * @param {number} count - 采样数量
 * @returns {Array<Array<number>>}
 */
export function sampleSlice(data, start, count) {
  if (data instanceof Float64Array || data instanceof Float32Array) {
    const out = [];
    const end = Math.min(start + count, data.length / 2);
    for (let i = start; i < end; i++) {
      out.push([data[i * 2], data[i * 2 + 1]]);
    }
    return out;
  }
  return data.slice(start, start + count);
}
