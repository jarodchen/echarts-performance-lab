/**
 * TypedArray 转换工具
 * 提供普通数组与 TypedArray 之间的相互转换，以及元信息读取
 */

/**
 * 将普通二维数组 [[x,y],...] 转换为扁平 Float64Array [x0,y0,x1,y1,...]
 * @param {Array<Array<number>>} points
 * @returns {Float64Array}
 */
export function toTypedArray(points) {
  const result = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    result[i * 2] = points[i][0];
    result[i * 2 + 1] = points[i][1];
  }
  return result;
}

/**
 * 将扁平 Float64Array 转换为普通二维数组
 * @param {Float64Array|Float32Array} typed
 * @returns {Array<Array<number>>}
 */
export function fromTypedArray(typed) {
  const count = typed.length / 2;
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = [typed[i * 2], typed[i * 2 + 1]];
  }
  return result;
}

/**
 * 提取扁平 TypedArray 中第 start 个点到第 end 个点的普通数组片段
 * @param {Float64Array|Float32Array} typed
 * @param {number} start - 起始点索引（含）
 * @param {number} end - 结束点索引（不含）
 * @returns {Array<Array<number>>}
 */
export function sliceTypedToPairs(typed, start, end) {
  const count = Math.min(end, typed.length / 2) - start;
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    const idx = (start + i) * 2;
    result[i] = [typed[idx], typed[idx + 1]];
  }
  return result;
}

/**
 * 判断数据是否为 TypedArray
 * @param {*} data
 * @returns {boolean}
 */
export function isTypedArray(data) {
  return data instanceof Float64Array || data instanceof Float32Array;
}
