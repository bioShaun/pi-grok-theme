# Pi Grok Theme — 开发进度与踩坑总结

> **项目**: `pi-grok-theme`
> **参考源码**: `grok-build` (`~/pi/grok-build`, Rust, 官方开源)
> **日期**: 2026-08-20

---

## 📋 目标

将 Pi 的终端 UI（输入框、信息显示、底栏、配色）**全面对齐 Grok Build 官方风格**，打造一个忠于 GrokNight + TokyoNight 色系的深色主题扩展。

---

## ✅ 已完成工作

### 1. 主题配色文件建立

创建了两套主题 JSON，均以 Grok Build 源码 `groknight.rs` 为色值权威来源：

| 文件 | 用途 |
|------|------|
| `themes/grok-build.json` | 基础 Grok 极简主题 |
| `themes/grok-build-coding.json` | 编程增强版（紫色关键字、绿色字符串、橙色数字） |

**色值体系（vars）**：

```
terminalBg:   #0A0A0A   ← Grok 终端画布底色
surface1:     #141414   ← 主平面
surface2:     #1A1A1A   ← 用户消息底色
surface3:     #242424   ← 选中高亮底色
fg:           #E1E1E1   ← 主文本（高对比度白）
fgSecondary:  #C8C8C8   ← 次要文本
muted:        #88909F   ← 注释/次要信息
dim:          #686E78   ← 暗色分隔符
border:       #3E424A   ← Grok 标准边框
borderMuted:  #2B2E35   ← 极暗边框
```

**TokyoNight 强调色**：

```
blue:   #7AA2F7   ← 主强调色
cyan:   #7DCFFF   ← 链接/类型
amber:  #E0AF68   ← Bash 模式/警告
purple: #BB9AF7   ← 关键字/思考文本
green:  #9ECE6A   ← 成功/字符串
red:    #F7768E   ← 错误/删除
```

### 2. UI 扩展开发（extension/）

| 模块 | 说明 |
|------|------|
| `extension/index.ts` | 扩展入口，生命周期管理，`/grok` 斜杠命令 |
| `extension/footer.ts` | Grok 风格单行底栏（分支·模型·上下文·状态） |
| `extension/header.ts` | 工作区标题头（默认关闭） |
| `extension/status.ts` | 工作状态控制器（thinking / streaming / running tool） |

### 3. Header 默认关闭

用户反馈 **"header 没有作用啊"**，已将 `showHeader` 默认设为 `false`。保留 `/grok header` 切换命令。

### 4. 暗色文字对比度提升

用户反馈 **"暗色的字太暗看不清"**，校准了以下颜色：

| 颜色键 | 修改前 | 修改后 | 对比度变化 |
|--------|--------|--------|-----------|
| `dim` | `#414141` (1.6:1) | `#686E78` (>3.5:1) | ⬆ 可读 |
| `muted` | `#6C6C6C` (2.8:1) | `#88909F` (>4.5:1) | ⬆ 清晰 |

### 5. 输入框边框颜色修复

用户反馈 **"输入框的边框还是蓝色"**，定位到根因并完成修复（见下方踩坑 #1）。

---

## 🕳️ 踩坑记录

### 坑 1：输入框边框蓝色 — `thinkingLevel` 动态着色机制

> ⚠️ **这是最隐蔽的坑**。在主题 JSON 中设置 `border` 和 `borderAccent` 并不能控制输入框边框颜色。

**现象**：主题中 `border` 已设为 `#3E424A`（炭灰），但输入框上下两条横线仍然是亮蓝色。

**根因**：Pi 的编辑器边框颜色是**动态的**，取决于当前「思考等级 (Thinking Level)」。核心逻辑在 `interactive-mode.js` 中：

```javascript
updateEditorBorderColor() {
    if (this.isBashMode) {
        this.editor.borderColor = theme.getBashModeBorderColor();
    } else {
        const level = this.session.thinkingLevel || "off";
        this.editor.borderColor = theme.getThinkingBorderColor(level);
    }
}
```

**坑的本质**：

- 编辑器对象有一个 `borderColor` 属性（函数类型），在**每次渲染**时被调用来着色 `─` 横线
- 这个属性**不读取** `colors.border` 或 `colors.borderAccent`
- 而是读取 `colors.thinkingOff / thinkingMinimal / ... / thinkingMax`
- 原先 `thinkingHigh` 被设为 `"blue"` (#7AA2F7)，默认思考等级为 high → 蓝色边框

**另外**，在 `getEditorTheme()` 中，**初始**边框色是 `borderMuted`，但一旦会话开始、模型被赋予了 thinkingLevel，`updateEditorBorderColor()` 就会覆盖它。

**修复方案**：将所有 thinking 等级的边框色映射到 Grok 的炭灰色阶：

```json
"thinkingOff": "borderMuted",      // #2B2E35
"thinkingMinimal": "borderMuted",  // #2B2E35
"thinkingLow": "border",           // #3E424A
"thinkingMedium": "border",        // #3E424A
"thinkingHigh": "border",          // #3E424A ← 修复关键！
"thinkingXhigh": "dim",            // #686E78
"thinkingMax": "amber"             // #E0AF68 (仅极限思考用琥珀金)
```

---

### 坑 2：双文件同步 — 本地仓库 vs 全局安装目录

> ⚠️ 修改本地仓库不会自动同步到 Pi 实际加载的全局安装目录。

Pi 加载扩展的路径是：

```
~/.pi/agent/git/github.com/bioShaun/pi-grok-theme/
```

而开发仓库在：

```
~/pi/pi-grok-theme/
```

**每次修改都必须同步到两处**，否则重启 Pi 后看到的仍然是旧版。

---

### 坑 3：插件冲突 — pi-zentui

用户曾安装 `pi-zentui` 扩展，它也会修改编辑器边框和 UI 布局，导致：

- 输入框上下出现**双重**水平分隔线
- 用户消息区域出现额外的 `╭ user ──────╮` 边框

**解决**：卸载 `pi-zentui`，由 `pi-grok-theme` 独占 UI 定制权。

---

### 坑 4：对比度陷阱 — 深色背景上的深色文字

> 📝 在 `#0A0A0A` 的终端画布上，任何低于 `#60xxxx` 亮度的文字几乎不可见。

Grok Build 官方源码中的 `COMMENT` 色 (`#565F89`) 在其 `#1A1B26` 底色上对比度约 3.2:1，但在 Pi 的 `#0A0A0A` 底色上对比度骤降至 ~2.0:1。

**教训**：不能直接照搬 groknight.rs 的色值，需要根据 Pi 实际的终端背景色重新计算对比度，确保 ≥ 3.5:1。

---

### 坑 5：ANSI_COLORS 常量与主题 JSON 不一致

`extension/status.ts` 中的 `ANSI_COLORS` 使用硬编码的 RGB ANSI 转义序列。如果只修改了 JSON 主题文件而忘记同步更新 `status.ts` 中的 RGB 值，底栏中的颜色会与消息区域产生视觉差异。

**当前已对齐**：两处使用完全相同的 RGB 值。

---

### 坑 6：光标颜色误区 — OSC 12 运行时转义 vs 静态主题 JSON

> 💡 **关键突破**：此前认为 Pi 的编辑器光标使用反色渲染无法控制，但对齐 Grok Build 源码（`grok-build/theme/mod.rs` 中的 `apply_cursor_color()`）后发现：Grok Build 的光标颜色也不是通过主题配置的，而是直接向终端 stdout 发送 `OSC 12` 运行时转义序列（`\x1b]12;rgb:RR/GG/BB\x07`）。
> 
> 在 `cursor.ts` 中实现此机制后，Pi 终端光标在 `session_start` 时自动变为 Grok 标志性的琥珀金 (`#E0AF68`)，`session_shutdown` 时通过 `OSC 112` 干净恢复终端默认光标。

---

### 坑 7：扩展显示名称异常 — `[Extensions]` 列表显示为 `extension` 而非包名

> ⚠️ Pi 的扩展名称解析机制基于入口路径的层级关系。

**现象**：安装插件后，Pi 启动时的 `[Extensions]` 列表显示为 `extension`，而其他插件（如 `pi-velocity`、`pi-rtk-optimizer`）显示为正常的包名。

**根因**：
- 在 Pi 核心 `interactive-mode.js`（`getCompactExtensionLabels`）中，当扩展入口位于子目录（如 `./extension/index.ts`）时，Pi 剔除文件名后会取最后一级父目录名（`extension`）作为显示标识。
- 只有当 `index.ts` 位于根目录，声明为 `"pi": { "extensions": ["./index.ts"] }` 时，Pi 才会直接将其映射为完整的包名（`pi-grok-theme`）。

**解决**：
- 将扩展入口及相关模块扁平化到项目根目录（`index.ts`、`cursor.ts`、`footer.ts`、`header.ts`、`status.ts`）。
- 更新 `package.json` 中的 `main`、`exports` 与 `pi.extensions` 为 `"./index.ts"`。
- 同步更新单测与全局安装目录。

---

## 🚀 v0.3.0 优化成果（2026-08-21）

| 优先级 | 特征 | 实施细节 | 状态 |
|---|---|---|---|
| **P1** | **OSC 12 光标色同步** | 新增 `extension/cursor.ts`，会话启动设为琥珀金 `#E0AF68`，退出时 `OSC 112` 恢复 | ✅ 完成 |
| **P2** | **GrokDay 亮色主题** | 新增 `themes/grok-build-day.json`，基于官方 `grokday.rs`，`#EEEEEE` 浅灰中性底 + 加深 TokyoNight | ✅ 完成 |
| **P3** | **Markdown 标题色阶** | `mdHeading` 统一调优为 `cyan` (`#7DCFFF` / `#0E7490`)，高保真还原 Grok h1 风格 | ✅ 完成 |
| **P4** | **`/grok theme` 切换引导** | `/grok theme [coding\|dark\|day]` 提供直观的主题列表与切换说明 | ✅ 完成 |
| **P5** | **版本号与全量套件同步** | 升级 v0.3.0，更新 `package.json` × 2、`SPEC.md`、`README`、`install.sh` / `uninstall.sh`、全量单测 | ✅ 完成 |

---

## 📐 Pi 主题架构要点（供后续参考）

### 主题 JSON 加载链

```
themes/grok-build.json
    → registerThemes()
    → loadThemeFromPath()
    → resolveThemeColors()
    → vars 变量解析
    → Theme 实例化
    → theme.fg() / theme.bg()
```

### 编辑器边框色的决策链

```
Session Start
    → isBashMode?
        Yes → bashMode 色 (#E0AF68)
        No  → getThinkingBorderColor(level)
             → thinkingOff / Min / Low / Med / High / Xhigh / Max
             → editor.borderColor = (str) => theme.fg(colorKey, str)
             → render() → horizontal = this.borderColor('─')
```

### 关键文件关系

| 文件 | 职责 |
|------|------|
| `themes/*.json` | 色值定义（vars + colors） |
| `extension/index.ts` | 扩展入口，生命周期钩子 |
| `extension/footer.ts` | 底栏渲染（单行响应式） |
| `extension/header.ts` | 头部横幅（默认关闭） |
| `extension/status.ts` | 状态指示器 + ANSI 常量 |
| Pi 核心 `theme.js` | 主题解析引擎（`getEditorTheme()` / `getThinkingBorderColor()` 等） |
| Pi 核心 `interactive-mode.js` | `updateEditorBorderColor()` — 动态覆盖编辑器边框色 |

---

## 🔜 后续可优化方向

1. **自定义 Prompt Arrow** — Grok Build 使用 `❯ ` 作为输入提示符（定义在 `glyphs.rs`），Pi 目前无法通过主题 JSON 定义提示符样式，可能需要通过 `setEditorComponent()` 实现自定义编辑器组件
2. **光标颜色** — Grok Build 使用 `#E0AF68` 琥珀金光标，但 Pi 的编辑器光标使用 `\x1b[7m` 反色渲染，无法通过主题控制
3. **活动边框色** — `borderAccent` (`#7AA2F7`) 仅在特定场景生效（如搜索框焦点），主编辑器的聚焦态边框由 thinking level 控制
4. **自动主题切换** — 支持 `auto:grok-build/light` 格式的自动亮暗切换配置
