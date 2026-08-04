/**
 * 数据缓存工具（Map 实现）
 * 相同参数的数据只生成一次，避免重复生成大数据集（最高 1000 万点）导致的卡顿
 */

/** 缓存容量上限：最多缓存 8 组数据集，超出后按插入顺序淘汰（FIFO） */
const MAX_CACHE_SIZE = 8;

class DataCache {
  constructor() {
    /** @type {Map<string, any>} */
    this.cache = new Map();
  }

  /**
   * 生成缓存键
   * @param {object} params - { count, format, seed }
   * @returns {string}
   */
  static buildKey(params) {
    return `${params.count}|${params.format}|${params.seed ?? ''}`;
  }

  /**
   * 获取缓存数据；未命中返回 undefined
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    if (!this.cache.has(key)) return undefined;
    // 命中时刷新顺序（LRU 语义）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 写入缓存，超出容量时淘汰最早插入的项
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    while (this.cache.size > MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 清空缓存（"生成数据"按钮会强制重新生成，需清除对应键）
   */
  clear() {
    this.cache.clear();
  }
}

/** 全局数据缓存单例 */
export const dataCache = new DataCache();

/**
 * 生成缓存键（供外部直接调用）
 * @param {object} params - { count, format, seed }
 * @returns {string}
 */
export function buildCacheKey(params) {
  return `${params.count}|${params.format}|${params.seed ?? ''}`;
}
