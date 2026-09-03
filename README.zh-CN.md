# pi-grok-build ⚡

<p align="center">
  <b>专为 <a href="https://github.com/earendil-works/pi">Pi Coding Agent</a> 打造的终端原生工作区主题与 UI 交互扩展套件</b><br>
  深度对齐 <b>xAI Grok Build</b> (<code>xai-org/grok-build</code>) 的视觉语言与交互人体工学设计。
</p>

<p align="center">
  <a href="#-安装方法"><b>安装方法</b></a> •
  <a href="#-核心特性"><b>核心特性</b></a> •
  <a href="#-主题变体"><b>主题变体</b></a> •
  <a href="#-ui-扩展与状态栏"><b>UI 扩展</b></a> •
  <a href="#-phase-3-工作流交互规范"><b>工作流规范</b></a> •
  <a href="README.md"><b>English</b></a>
</p>

---

## 🎨 视觉美学与色彩层级

专为长时间多小时的编码负载设计，采用低饱和、高对比度的 **GrokNight** 中性炭黑基底，搭配优雅克制的 **TokyoNight** 语义点缀色系。

```text
#0A0A0A (终端底画布 Canvas)
  ↓
#141414 (主工作表面与工具卡片)
  ↓
#242424 (选中项与激活高亮)
  ↓
#414141 (装订线与分隔符)
  ↓
#E1E1E1 (主要文本高对比白)
  +
TokyoNight 语义点缀 (#7AA2F7 蓝, #7DCFFF 青, #E0AF68 琥珀金, #9ECE6A 绿, #BB9AF7 薰衣草紫, #F7768E 珊瑚红)
```

### 终端视觉效果预览

```text
╭─ GROK BUILD ─────────────────────────────────────────────────────────────╮
│ 📁 my-project  ⎇ main  ·  model: claude-3.7-sonnet  ·  v0.3.0            │
╰──────────────────────────────────────────────────────────────────────────╯

✓ read_file src/auth.ts (1.2s)
✓ bash npm test (842ms)

● thinking (1.4s)

────────────────────────────────────────────────────────────────────────────
~/my-project  main · claude-3.7-sonnet · ⇣48k/200k (24%) · ✻ high · ● working (3.1s)
```

> 可信的预览资产由真实渲染代码确定性生成（非手工绘制），位于
> [`docs/previews/`](docs/previews/)，见[可视化预览](#%EF%B8%8F-可视化预览)。

---

## 📦 三合一套件组成

| 组成部分 | 层级 | 核心功能 |
|---|---|---|
| **Phase 1: 原生主题** | 视觉层 | 提供 `grok-build-coding`（日常编码首选）、`grok-build`（极简黑白）与 `grok-build-day`（GrokDay 明亮白）三款原生 JSON 调色主题。 |
| **Phase 2: UI 扩展** | 交互层 | 自适应单行 Grok 风格 Footer 状态栏、工作区 Header Banner、OSC 12 琥珀金光标色同步（`#E0AF68`）、紧凑运行状态指示（`● working (2.4s)`）。 |
| **Phase 3: 工作流规范** | 行为层 | 标准化 4 阶段 **Plan（计划）→ Search（检索）→ Build（构建）→ Verify（验证）** 交互流，消除废话寒暄。 |

---

## 🆕 v0.4 新特性 —— 自适应主题化 Chrome

v0.4 将展示层升级为**主题原生的自适应 chrome**：

- **主题原生渲染。** Footer、Header、状态徽章与 `/grok` 通知的所有前景色均取自当前 Pi 主题的语义 token——彻底移除硬编码的 GrokNight ANSI。深色、日间与第三方主题都能原生渲染，切换主题即时重着色。OSC 12 光标遵循命名主题策略：捆绑深色主题使用 Grok 琥珀 `#E0AF68`，`grok-build-day` 使用更深的琥珀 `#B45309`，未知主题保留终端默认。
- **Grok 工作动画。** 流式输出期间，以主题 accent 着色的单列 Braille spinner（`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧`，120ms 节奏）持续动画。传统终端回退为 ASCII `| / - \`。会话关闭时恢复 Pi 默认指示器，footer 永远不会出现第二个动画 spinner。
- **上下文压力指标。** Footer 采用 Grok 紧凑 token 记法 `⇣48k/200k (24%)`（紧凑形态：`24%`），并在 65%（accent）、80%（warning）、90%（error）阈值逐级变色。缺少用量数据时绝不伪造 `0%` 段。
- **双计时 + 合并渲染。** 状态标签显示**相位**耗时（思考/流式/工具状态切换时重置）；`full` 预设额外显示整轮耗时。渲染通过 250ms 时钟合并——token 突发不再强制逐 token 重绘。
- **Footer 预设。** `/grok footer auto|minimal|full` 即时切换展示形态：`auto`（默认响应式层级）、`minimal`（model · context · status）、`full`（全部段 + 整轮耗时）。
- **直接主题切换。** `/grok theme` 列出已安装主题（标记当前主题）；`/grok theme <名称|coding|minimal|day>` 直接切换，支持参数补全；失败时上报主机错误且不改变当前主题。
- **传统字形回退。** `PI_GROK_LEGACY_GLYPHS=1` 强制 ASCII chrome 字形；在非现代终端的 Windows 上自动启用；`PI_GROK_LEGACY_GLYPHS=0` 可覆盖自动检测。
- **兼容性。** 在旧版 Pi 上所有新 UI API 均经特性检测：扩展保持 v0.3 行为而不会启动失败。Footer 预设为会话级配置。

---

## 🚀 安装方法

`pi-grok-theme` 已完整打包为标准 **Pi 插件包（Pi Package / Extension）**。

### 通过 Pi CLI 安装（推荐）

在终端中直接运行：

```bash
pi install https://github.com/bioShaun/pi-grok-theme
```

如果是本地克隆或开发模式：

```bash
git clone https://github.com/bioShaun/pi-grok-theme.git
cd pi-grok-theme
pi install . -l
```

### 或在 `~/.pi/agent/settings.json` 中配置
直接在配置文件中的 `packages` 数组添加仓库地址：

```json
{
  "theme": "grok-build-coding",
  "packages": [
    "https://github.com/bioShaun/pi-grok-theme"
  ]
}
```

---

## 🎯 激活与使用

### 1. 在 Pi 交互会话中激活
启动 Pi 后输入 `/settings`，选择 **Theme**，然后选中 `grok-build-coding`。

### 2. 在全局配置文件中设置 (`~/.pi/agent/settings.json`)
```json
{
  "theme": "grok-build-coding"
}
```

### 3. 通过 CLI 参数指定
```bash
pi --use-theme grok-build-coding
```

---

## 🌓 主题变体对比

| 主题 | 适用场景 | 视觉特色 |
|---|---|---|
| **`grok-build-coding`** *(推荐)* | 日常高强度编码 | 丰富语法层级（关键字 `#BB9AF7`、函数 `#7AA2F7`、类型 `#7DCFFF`）、1秒快速辨识的高对比 Diff（`#9ECE6A` / `#F7768E`）、青色 Markdown 标题、温暖的琥珀金激活边框。 |
| **`grok-build`** | 极致单色极简主义 | 单色灰白代码语法、青色标题、轻微青蓝修饰、扁平化 `#141414` 工具背景块。 |
| **`grok-build-day`** | 白天与明亮环境 | 极简灰白底画布 `#EEEEEE`、清晰 `#1A1A1A` 深色文字与加深版 TokyoNight 语义色，专为日间高可读性打造。 |

---

## 🖼️ 可视化预览

全部预览由 `npm run previews` 从真实渲染路径生成（捆绑主题 JSON → 真实 Pi
`Theme` 实例 → `renderHeader` / `renderGrokFooter` → ANSI→SVG），同时展示
窄幅与宽幅 footer 布局：

| 主题 | 预览 |
|---|---|
| `grok-build-coding` | [docs/previews/grok-build-coding.svg](docs/previews/grok-build-coding.svg) |
| `grok-build` | [docs/previews/grok-build.svg](docs/previews/grok-build.svg) |
| `grok-build-day` | [docs/previews/grok-build-day.svg](docs/previews/grok-build-day.svg) |

发布测试会逐字节比对已提交的 SVG 与全新渲染结果，预览永远不会过期或被手工篡改。

---

## 🖥️ UI 扩展与状态栏

Phase 2 提供的 UI 扩展实现完全还原 Grok Build 的紧凑单行状态栏。

### 响应式布局自适应

- **标准/宽屏模式（≥ 80 列宽度）：**
  ```text
  ~/my-project  main · claude-3.7-sonnet · ⇣48k/200k (24%) · ✻ high · ● working (3.1s)
  ```

- **窄屏模式（< 80 列宽度）：**
  ```text
  main · sonnet-3.7 · 24% · ● working
  ```

### Footer 预设
- `/grok footer`：报告当前预设与可用取值。
- `/grok footer auto`：响应式层级，包含全部可用段（默认）。
- `/grok footer minimal`：model · context · status。
- `/grok footer full`：cwd · branch · model · context · thinking · 整轮耗时 · 扩展状态 · status。

预设即时生效且为会话级。整轮耗时仅在 `full` 预设且轮次进行中显示。

### 智能折叠优先级
当终端窗口缩小时，状态栏段按元数据驱动的优先级收缩（status 与 model 永不丢弃；
宽幅 context 先收缩为百分比再丢弃；第三方扩展状态逐个丢弃，绝不会把核心字段
挤出屏幕）：
1. `Working 状态指示器`（永不丢弃）
2. `激活模型名称`（收缩为短名）
3. `Git 分支`
4. `上下文使用量 / %`（先收缩为 `24%`）
5. `第三方扩展状态`（逐个丢弃）
6. `思考层级 Thinking Level`
7. `整轮耗时`（仅 full 预设）
8. `工作区路径 CWD`（首先隐藏）

### 扩展命令
- `/grok` 或 `/grok info`：查看当前工作区、活跃模型、光标颜色同步及主题状态信息。
- `/grok theme`：列出已安装主题（标记当前主题），支持参数补全。
- `/grok theme <名称|coding|minimal|day>`：直接切换主题——同步刷新光标、工作指示器、Header 与 Footer；失败时保持当前主题不变。
- `/grok footer [auto|minimal|full]`：即时切换 Footer 预设。
- `/grok toggle`：在自适应模式与强制紧凑模式之间快速切换。
- `/grok header`：开启/关闭工作区 Header 横幅（默认关闭，按需启用）。

---

## 📋 Phase 3 工作流交互规范

为使 Pi Coding Agent 的回复风格具备 Grok Build 般的高信息密度与结构化交付：

```text
1. 计划 (PLAN)     2. 检索 (SEARCH)       3. 构建 (BUILD)      4. 验证 (VERIFY)
意图任务清单  ───>  精准检索与定位  ───>  手术式代码修改  ───>  测试报告与改动总结
```

### 快速启用
```bash
# 全局应用到 Pi Agent
cp guidelines.md ~/.pi/agent/AGENTS.md

# 或仅应用到当前项目
cp guidelines.md .pi/rules.md
```

完整交互规则详见 [guidelines.md](guidelines.md)。

---

## 🛠️ 项目文件结构

```text
pi-grok-theme
├── package.json               # 根目录 Pi 插件包清单
├── LICENSE                    # MIT 开源协议
├── README.md                  # 英文说明文档
├── README.zh-CN.md            # 中文说明文档 (简体中文)
├── SPEC.md                    # 详细技术规范书
├── guidelines.md              # Phase 3 工作流交互规范
│
├── themes/                    # Phase 1: 原生主题
│   ├── grok-build-coding.json # GrokNight 编码主题
│   ├── grok-build.json        # 极简单色暗色主题
│   └── grok-build-day.json    # GrokDay 明亮主题
│
├── index.ts                   # Phase 2: UI 扩展入口与事件生命周期
├── chrome-theme.ts            # 唯一样式适配器（语义 Pi theme token）
├── glyphs.ts                  # 能力感知字形词汇表（现代/传统）
├── cursor.ts                  # OSC 12 命名主题光标策略
├── footer.ts                  # 元数据驱动 Footer 段、预设与拟合
├── header.ts                  # 工作区头部 Banner
├── status.ts                  # 语义活动状态控制器与消息过滤
├── render-clock.ts            # 250ms 合并渲染时钟（轮次作用域）
├── working-indicator.ts       # Grok Braille 工作动画（特性检测）
├── version.ts                 # 展示版本号（与 package.json 同步）
│
├── docs/                      # 文档与规格
│   ├── previews/              # 确定性 chrome 预览资产（SVG）
│   ├── guidelines.md
│   ├── pi-grok-build-theme.spec.md
│   └── development-notes.md
├── scripts/render-previews.js # 确定性预览渲染器（npm run previews）
└── test/                      # 单元测试与发布门禁
    ├── test.js
    ├── theme-quality.js
    └── fixtures/theme-schema.json
```

---

## 📄 开源协议

MIT © [earendil-works](https://github.com/earendil-works)
