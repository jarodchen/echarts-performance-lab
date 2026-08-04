/**
 * 操作文档弹窗组件
 *
 * 将 docs/user-guide.md（通过 Vite ?raw 导入为字符串）渲染为模态框，
 * 供用户在应用内随时查阅操作说明。
 *
 * 特性：
 * - 点击遮罩 / 关闭按钮 / Esc 键关闭
 * - 内容区独立滚动
 * - 支持目录锚点跳转（markdown 标题自动带 id）
 * - 代码块 / 表格 / 引用块样式适配深色主题
 */
import { marked } from 'marked';
import guideMd from '../../docs/user-guide.md?raw';

// 配置 marked：为标题生成锚点 id，支持目录跳转
marked.setOptions({
  gfm: true, // 启用 GitHub 风格（表格、任务列表等）
  breaks: false
});

// 自定义渲染器：给标题加 id 锚点，支持目录跳转
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  // 解析标题内联格式（加粗/代码等），并去除 HTML 标签生成锚点 id
  const text = this.parser.parseInline(tokens);
  const plain = text.replace(/<[^>]*>/g, '');
  const id = plain
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `<h${depth} id="${id}">${text}</h${depth}>`;
};
marked.use({ renderer });

export class HelpModal {
  /**
   * @param {HTMLElement} root - 挂载容器（body 末尾）
   * @param {string} [title] - 弹窗标题
   */
  constructor(root = document.body, title = '操作文档') {
    this.root = root;
    this.title = title;
    this.build();
    this.bindEvents();
  }

  /** 构建弹窗 DOM（默认隐藏） */
  build() {
    this.container = document.createElement('div');
    this.container.className = 'help-modal';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-hidden', 'true');
    this.container.innerHTML = `
      <div class="help-modal-backdrop"></div>
      <div class="help-modal-dialog">
        <div class="help-modal-header">
          <span class="help-modal-title">📖 ${this.title}</span>
          <button type="button" class="help-modal-close" title="关闭 (Esc)">✕</button>
        </div>
        <div class="help-modal-body">
          <div class="help-modal-content">${this.renderMarkdown()}</div>
        </div>
      </div>`;
    this.root.appendChild(this.container);

    this.backdrop = this.container.querySelector('.help-modal-backdrop');
    this.closeBtn = this.container.querySelector('.help-modal-close');
    this.body = this.container.querySelector('.help-modal-body');
  }

  /** 将 markdown 渲染为 HTML */
  renderMarkdown() {
    return marked.parse(guideMd);
  }

  /** 绑定关闭事件 */
  bindEvents() {
    this.backdrop.addEventListener('click', () => this.close());
    this.closeBtn.addEventListener('click', () => this.close());
    // Esc 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /** 打开弹窗 */
  open() {
    this.container.classList.add('open');
    this.container.setAttribute('aria-hidden', 'false');
    // 打开后回到顶部
    this.body.scrollTop = 0;
  }

  /** 关闭弹窗 */
  close() {
    this.container.classList.remove('open');
    this.container.setAttribute('aria-hidden', 'true');
  }

  /** 弹窗是否打开 */
  isOpen() {
    return this.container.classList.contains('open');
  }

  /** 切换开闭 */
  toggle() {
    this.isOpen() ? this.close() : this.open();
  }
}
