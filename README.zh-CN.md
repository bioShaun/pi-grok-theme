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
~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · thinking:high · ● working (3.1s)
```

---

## 📦 三合一套件组成

| 组成部分 | 层级 | 核心功能 |
|---|---|---|
| **Phase 1: 原生主题** | 视觉层 | 提供 `grok-build-coding`（日常编码首选）、`grok-build`（极简黑白）与 `grok-build-day`（GrokDay 明亮白）三款原生 JSON 调色主题。 |
| **Phase 2: UI 扩展** | 交互层 | 自适应单行 Grok 风格 Footer 状态栏、工作区 Header Banner、OSC 12 琥珀金光标色同步（`#E0AF68`）、紧凑运行状态指示（`● working (2.4s)`）。 |
| **Phase 3: 工作流规范** | 行为层 | 标准化 4 阶段 **Plan（计划）→ Search（检索）→ Build（构建）→ Verify（验证）** 交互流，消除废话寒暄。 |

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

## 🖥️ UI 扩展与状态栏

Phase 2 提供的 UI 扩展实现完全还原 Grok Build 的紧凑单行状态栏。

### 响应式布局自适应

- **标准/宽屏模式（≥ 80 列宽度）：**
  ```text
  ~/my-project  main · claude-3.7-sonnet · 48k/200k (24%) · thinking:high · ● working (3.1s)
  ```

- **窄屏模式（< 80 列宽度）：**
  ```text
  main · sonnet-3.7 · 24% · ● working
  ```

### 智能折叠优先级
当终端窗口缩小时，状态栏元素按严格的优先级顺序隐藏，确保最关键信息始终可见：
1. `Working 状态指示器`（永远保留）
2. `激活模型名称`
3. `Git 分支`
4. `上下文使用量 / %`
5. `思考层级 Thinking Level`
6. `工作区路径 CWD`（首先隐藏）

### 扩展命令
- `/grok` 或 `/grok info`：查看当前工作区、活跃模型、光标颜色同步及主题状态信息。
- `/grok theme` / `/grok theme [coding|dark|day]`：查看全部可用主题及快速切换引导。
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
├── cursor.ts                  # OSC 12 终端光标颜色同步
├── footer.ts                  # 响应式单行 Footer 渲染器
├── header.ts                  # 工作区头部 Banner
├── status.ts                  # 运行状态控制器与消息过滤
│
├── docs/                      # 文档与规格
│   ├── guidelines.md
│   ├── pi-grok-build-theme.spec.md
│   └── development-notes.md
└── test/                      # 单元测试
    └── test.js
```

---

## 📄 开源协议

MIT © [earendil-works](https://github.com/earendil-works)
