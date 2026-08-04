/**
 * 应用入口：挂载根组件并初始化
 */
import { App } from './App.js';
import './styles/dark-theme.css';
import './styles/main.css';
import './styles/controls.css';

// 等待 DOM 就绪后启动应用，并暴露实例便于调试
window.addEventListener('DOMContentLoaded', () => {
  window.__perfLab = new App(document.getElementById('app'));
});
