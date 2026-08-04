/**
 * 节流与防抖工具
 * 用于滑块拖动、窗口缩放等高频事件的性能优化
 */

/**
 * 节流：保证回调在指定时间窗口内最多执行一次
 * 适用场景：滑块拖动实时更新数值显示
 * @param {Function} fn - 目标函数
 * @param {number} delay - 时间窗口（毫秒）
 * @returns {Function} 包装后的节流函数
 */
export function throttle(fn, delay = 100) {
  let lastCall = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      // 窗口内最后一次调用延迟到窗口结束执行，保证尾部更新不丢失
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        fn.apply(this, args);
      }, delay - (now - lastCall));
    }
  };
}

/**
 * 防抖：回调在最后一次调用后延迟 delay 毫秒执行
 * 适用场景：输入框输入、窗口 resize 结束后执行一次
 * @param {Function} fn - 目标函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 包装后的防抖函数
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
}
