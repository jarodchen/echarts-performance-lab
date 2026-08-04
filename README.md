# ECharts 性能优化对比实验室

一个用于**直观对比 ECharts 图表性能**的交互式演示平台：左右并排两个图表，使用完全相同的原始数据，左侧保持未优化（红色系），右侧自由组合多种优化策略（绿色系），通过实时性能指标（首帧呈现时间 / FPS / 内存增量）量化优化收益。

![技术栈](https://img.shields.io/badge/Vite-7-646CFF) ![ECharts](https://img.shields.io/badge/ECharts-5.6-AA344D) ![JS](https://img.shields.io/badge/Vanilla%20JS-ESM-F7DF1E)

---

## ✨ 核心特性

- **并排对比**：左右图表同数据、同配置，仅右侧叠加优化策略，差异一目了然
- **实时性能指标**：首帧呈现时间、FPS、内存增量、数据点数量、加载方式、优化标记（悬停查看策略说明）
- **8 种优化策略自由组合**：`large` 大数据模式 / `progressive` 渐进渲染 / `lttb` 降采样 / `sampling` 内置采样 / `dataZoom` 数据缩放 / 关闭动画 / 精简视觉样式 / 增量更新
- **数据规模 1k ~ 10M**：分段式滑块 + 数值输入 + 快捷按钮（1k / 10k / 100k / 1M / 10M）
- **两种数据格式**：普通 `Array` / 扁平 `TypedArray`（内存更低、解析更快）
- **两种加载模式**：一次性加载 / 分片加载（`appendData` 每批 5,000 条，页面保持可交互）
- **Canvas / SVG 渲染器切换**，折线 / 散点 / 柱状三种图表，Tooltip `mousemove` / `click` 触发模式
- **对比高亮**：右侧指标优于左侧 30% 以上绿色 ▲、劣于 30% 红色 ▼
- **报告导出**：CSV（Excel 可直接打开）/ JSON 结构化报告 / 图表 PNG（2 倍分辨率）
- **应用内操作文档**：页面右上角"📖 操作文档"随时查阅

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18（推荐 20+）
- **Chrome / Edge**（内存指标依赖 Chrome 的 `performance.memory` API）

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器 → http://localhost:5173
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 本地预览构建产物
npm run preview

# 代码检查 / 格式化
npm run lint
npm run format
```

---

## 📊 性能指标说明

| 指标 | 含义 |
|------|------|
| **数据点** | 当前参与渲染的数据点总数（LTTB 降采样后右侧会远小于左侧） |
| **渲染耗时** | 首帧呈现时间（`setOption` → 第一次绘制完成）。progressive 分帧渲染下体现"快速首屏"优势 |
| **FPS** | 最近 500ms 窗口平均帧率（stats.js 面板 + 指标卡双展示） |
| **内存增量** | 本次渲染的内存增量（读数前强制 GC 刷新 V8 堆统计，保证公平） |
| **加载方式** | 一次性 / 分片加载（含进度） |
| **优化标记** | 右侧生效的策略列表 |

> **对比高亮规则**：右侧某项指标优于左侧 30% 以上 → 绿色 + ▲；劣于 30% → 红色 + ▼。悬停任意指标可查看说明。

---

## 🛠 优化策略一览

| 策略 | 作用 | 适用图表 |
|------|------|----------|
| `large` 大数据模式 | 数据量超阈值后切换轻量渲染管线 | 折线 / 散点 |
| `progressive` 渐进渲染 | 分帧渲染（每帧 500 点），避免单帧阻塞主线程 | 全部 |
| `lttb` 数据降采样 | LTTB 算法智能采样至 5,000 点，保留波形特征 | 全部 |
| `sampling` 内置采样 | 按像素宽度取平均，只画可见分辨率有效点 | 折线 |
| `dataZoom` 数据缩放 | 只渲染可视区域（初始前 20%） | 全部 |
| 关闭动画 | 跳过动画插值与重绘 | 全部 |
| 精简视觉样式 | 移除阴影 / 渐变，改用纯色 | 全部 |
| 增量更新 | 数据更新复用图表实例，避免销毁重建 | 全部 |

> 📖 每个策略的原理、适用场景与效果预估详见 [docs/optimization-guide.md](docs/optimization-guide.md)。

---

## 📁 项目结构

```
echarts-performance-lab/
├── index.html                  # 入口页面
├── vite.config.js              # Vite 配置
├── package.json
├── public/
│   └── favicon.ico
├── docs/                       # 文档
│   ├── user-guide.md           # 操作指南（应用内嵌）
│   ├── optimization-guide.md   # 优化策略原理指南
│   └── performance-report-template.md  # 性能报告模板
└── src/
    ├── main.js                 # 入口
    ├── App.js                  # 应用编排（数据流 / 渲染调度 / 导出报告）
    ├── config/                 # 配置
    │   ├── defaultOptions.js   # 基础 option 构建（坐标轴/文本/网格）
    │   └── optimizationPresets.js  # 8 个优化策略元数据
    ├── components/
    │   ├── ControlPanel.js     # 左侧控制面板
    │   ├── ChartContainer.js   # 图表生命周期 + 指标采集
    │   ├── PerformanceStats.js # 指标卡 + 对比高亮
    │   └── HelpModal.js        # 应用内操作文档弹窗
    ├── charts/                 # 图表 option 构建器
    │   ├── lineChart.js
    │   ├── scatterChart.js
    │   └── barChart.js
    ├── optimizations/          # 优化策略实现
    │   ├── applyOptimizations.js   # 策略合并到 option
    │   ├── sampling.js             # LTTB 降采样
    │   ├── appendData.js           # 分片加载（appendData）
    │   └── incrementalUpdate.js    # 增量更新判断
    ├── utils/
    │   ├── dataGenerator.js    # 确定性数据生成（正弦+噪声）
    │   ├── performance.js      # 首帧测量 / FPS / 内存 / 强制 GC
    │   ├── typedArrayHelper.js # TypedArray 工具
    │   ├── cache.js            # 数据缓存（FIFO 淘汰）
    │   └── throttle.js         # 节流
    └── styles/
        ├── dark-theme.css      # 深色主题变量
        ├── controls.css        # 控制面板样式
        └── main.css            # 布局 / 指标卡 / 弹窗
```

---

## 🔧 扩展开发指南

### 新增图表类型

1. 在 `src/charts/` 新建 `xxxChart.js`，导出 `buildXxxOption({ tooltipTrigger, isOptimized })`
2. 在 [App.js](src/App.js) 的 `buildBaseOption()` 中注册映射
3. 如需分片加载回退逻辑，参考 `appendData.js` 的 `isBar` 处理

### 新增优化策略

1. 在 `src/config/optimizationPresets.js` 注册策略元数据（`label` / `description` / `principle` / `applicable`）
2. 在 `src/optimizations/applyOptimizations.js` 实现 option 合并逻辑
3. 数据级优化（如 LTTB）在 `App.js` 的 `renderSide()` 中接入

### 新增性能指标

1. 在 `ChartContainer.js` 采集数据并回填
2. 在 `PerformanceStats.js` 的 `METRICS` 中登记（`label` / `better` 方向）
3. 在 `App.js` 的 `STAT_TIPS` 添加悬停说明

---

## 📚 相关文档

- [docs/user-guide.md](docs/user-guide.md) — 完整操作指南（也可在应用内"📖 操作文档"查看）
- [docs/optimization-guide.md](docs/optimization-guide.md) — 优化策略原理、适用场景与效果预估
- [docs/performance-report-template.md](docs/performance-report-template.md) — 性能对比报告模板

---

## 📦 技术栈

| 依赖 | 用途 |
|------|------|
| [Apache ECharts](https://echarts.apache.org/) 5.6 | 图表渲染（Canvas / SVG） |
| [downsample-lttb](https://www.npmjs.com/package/downsample-lttb) | LTTB 降采样算法 |
| [stats.js](https://github.com/mrdoob/stats.js) | FPS 面板 |
| [marked](https://marked.js.org/) | Markdown 渲染（应用内操作文档） |
| Vite 7 / ESLint 8 / Prettier 3 | 构建与代码质量 |

---

## ⚠️ 注意事项

- 内存指标依赖 Chrome 的 `performance.memory` API，其他浏览器显示 `--`
- 10M 数据量为极端压力测试场景，未优化侧卡顿属预期现象（这正是对比的意义）
- 性能数据受机器负载影响，严谨对比建议在安静环境下多次测量取平均值
