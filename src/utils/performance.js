/**
 * 性能测量工具
 * - measureFirstPaintTime: 测量首帧呈现耗时（setOption → 第一次 rendered）
 * - measureAppendTime: 分片加载总耗时（全部批次 → finished）
 * - FPSMonitor: 基于 requestAnimationFrame 的帧率监控器
 * - getMemoryUsage: 读取 JS 堆内存（仅 Chrome）
 */

/**
 * 测量首帧呈现耗时：从 setOption 调用到第一次 'rendered' 事件触发
 *
 * 为什么不用 'finished' 事件？
 * - 一次性渲染：rendered 与 finished 几乎同时触发，两者等价
 * - progressive 分帧渲染：finished 要等所有帧渲染完，总耗时更长，
 *   但分帧的目的是“快速首屏 + 不阻塞主线程”，首帧时间才能真正体现其优势
 * - 动画场景（<2000 点）：finished 要等动画播放完（数百 ms），首帧时间才是用户等待感
 *
 * @param {object} chart - ECharts 实例
 * @param {Function} renderFn - 实际执行渲染的函数（同步调用 setOption 等）
 * @returns {Promise<number>} 首帧呈现耗时（毫秒）
 */
export function measureFirstPaintTime(chart, renderFn) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let fallbackTimer = null;
    const finish = () => {
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      chart.off('rendered', onRendered);
      resolve(performance.now() - startTime);
    };
    const onRendered = () => finish();
    // 注册一次性监听（rendered 可能同步触发，必须先监听再调用）
    chart.on('rendered', onRendered);
    try {
      renderFn();
    } catch (err) {
      console.error('[measureFirstPaintTime] 渲染失败:', err);
      finish();
      return;
    }
    // 兜底：异常情况下 rendered 未触发则 2s 后强制结束，避免挂起
    fallbackTimer = setTimeout(finish, 2000);
  });
}

/**
 * 分片加载总耗时测量：
 * 等待所有批次追加完成，再等待最后一次渲染 finished 事件
 * @param {object} chart - ECharts 实例
 * @param {Function} appendAllFn - 异步函数，内部完成所有 appendData
 * @returns {Promise<number>} 总耗时（毫秒）
 */
export function measureAppendTime(chart, appendAllFn) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const onFinished = () => {
      const elapsed = performance.now() - startTime;
      chart.off('finished', onFinished);
      resolve(elapsed);
    };
    chart.on('finished', onFinished);
    appendAllFn()
      .catch(() => {
        chart.off('finished', onFinished);
        resolve(performance.now() - startTime);
      })
      .then(() => {
        // 所有批次已提交，等待最后一次渲染完成；部分浏览器 1s 内无 finished 则兜底
        setTimeout(() => {
          chart.off('finished', onFinished);
          resolve(performance.now() - startTime);
        }, 1000);
      });
  });
}

/**
 * FPS 监控器：基于 requestAnimationFrame 统计帧率
 * 每个图表区域独立实例，定时上报平均 FPS
 */
export class FPSMonitor {
  /**
   * @param {Function} onUpdate - 回调，接收最新 FPS 数值
   * @param {number} interval - 统计窗口（毫秒），默认 500ms
   */
  constructor(onUpdate, interval = 500) {
    this.onUpdate = onUpdate;
    this.interval = interval;
    this.running = false;
    this.frames = 0;
    this.lastTime = 0;
    this.rafId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.frames = 0;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  loop = () => {
    if (!this.running) return;
    this.frames += 1;
    const now = performance.now();
    const elapsed = now - this.lastTime;
    if (elapsed >= this.interval) {
      // FPS = 帧数 / 耗时（秒）
      const fps = Math.round((this.frames * 1000) / elapsed);
      this.onUpdate(fps);
      this.frames = 0;
      this.lastTime = now;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}

/**
 * 强制触发一次垃圾回收，刷新 performance.memory 堆统计
 *
 * V8 的 usedJSHeapSize 仅在 GC 结束时更新统计值；两次读数之间若没有
 * GC 发生，读数完全相同，渲染前后的差值恒为 0。
 *
 * 原理：通过分配约 64MB 临时对象填满新生代（semi-space，默认几十 MB），
 * 迫使 V8 执行 scavenger GC，从而刷新堆统计；临时对象随后即不可达，
 * 在 GC 中被回收，不会污染后续读数。
 *
 * 注意：浏览器 JS 没有强制 GC API，此方法无法保证 100% 触发 major GC，
 * 但可稳定触发 minor GC（scavenger），足以刷新统计值。
 */
export function triggerGc() {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
  const CHUNK_COUNT = 8; // 共 64MB
  // 持有引用并累计长度，防止 JIT 逃逸分析把分配优化掉
  const buffers = new Array(CHUNK_COUNT);
  let totalBytes = 0;
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const buf = new Uint8Array(CHUNK_SIZE);
    buffers[i] = buf;
    totalBytes += buf.length;
  }
  return totalBytes;
}

/**
 * 触发 GC 后读取内存（确保读数反映最新堆统计）
 * @returns {number|null} 内存 MB（Chrome/Edge 支持，其他浏览器返回 null）
 */
export function readMemoryAfterGc() {
  triggerGc();
  return getMemoryUsage();
}

/**
 * 读取当前 JS 堆内存占用
 * @returns {number|null} 内存 MB（Chrome/Edge 支持，其他浏览器返回 null）
 */
export function getMemoryUsage() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
}

/**
 * 格式化大数字（千分位分隔）
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  return Math.round(num).toLocaleString('en-US');
}

/**
 * 格式化为 MB 保留 1 位小数
 * @param {number|null} mb
 * @returns {string}
 */
export function formatMB(mb) {
  if (mb === null || mb === undefined) return '--';
  return `${mb.toFixed(1)} MB`;
}
