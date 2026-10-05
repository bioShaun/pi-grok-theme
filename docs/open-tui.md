# pi-open-tui 配合模式

Grok 提供主题、光标颜色和终端标题；pi-open-tui 负责 Header、Footer、编辑器、工作状态与思考预览。Grok 默认在会话启动时检查已注册的 `open-tui` 扩展命令，并读取同一 agent 目录的 `open-tui.json`：扩展存在且未禁用时进入配合模式，不安装或清理对方的 UI，不拦截工作消息，不启动 Footer 时钟或读取 Git 计数。分支信息仍用于终端标题。

## 启用

安装/更新本包并 `/reload` 后执行：

```text
/grok theme open
/grok open-tui daily
/reload
```

日间主题使用 `/grok theme open-day`。两款主题在 Pi 的主题列表中分别叫 `grok-open` 和 `grok-open-day`。主题不会自动切换；请让终端本身的背景匹配主题（暗色 `#0A0A0A`，浅色 `#EEEEEE`），插件不会更改终端背景。

`/grok info` 显示当前配合状态。`/grok integration auto|standalone|companion` 保存下次 `/reload` 使用的界面分工：`auto` 为默认；`companion` 用于无法发现命令的宿主；`standalone` 用于已关闭其他界面扩展的场景。切换命令不会在运行中的任务里抢占界面。

## 信息密度

`/grok open-tui daily|diagnostic` 只合并以下配置，然后要求 `/reload`：

| 项目 | daily | diagnostic |
| --- | --- | --- |
| Footer | 放入输入框上下边框 | 独立显示 |
| 运行环境、Token、费用 | 隐藏 | 显示 |
| 单轮 TPS、TTFT、Token、费率 | 隐藏 | 显示 |
| 单轮耗时、异常停顿 | 显示 | 显示 |

语言、光标样式、图标、思考预览、扩展状态开关以及未知字段保持现有设置。不存在的配置从空对象合并，未指定字段由 pi-open-tui 使用其默认值。损坏或非对象的配置会报错并保留原文件；保存采用同目录临时文件和原子替换。

## 视觉取舍

专用主题为正文指定明确的颜色，让 pi-open-tui 使用的思考等级文字在画布和编辑器表面达到至少 4.5:1 的对比度。错误工具结果使用淡红色背景；思考正文使用柔和的辅助文字色。原有三个主题保留原来的外观。

pi-open-tui 0.3.10 同时使用 `thinking*` token 绘制等级文字和输入框边框，因此专用主题的边框也会更亮。分别控制文字和边框，以及将提供商名称改为中性色，仍需上游提供独立映射；此版本没有修改上游源码。

配合模式下 `/grok motion quiet` 仅保存 Grok 独立模式的偏好，不会关闭 pi-open-tui 的字幕或动画，命令会明确说明。图标也由 `/open-tui` 控制；已配置 Nerd Font 时可选 `nerd`，需要稳定文字字形时可选 `ascii`。

自动发现按会话启动时的配置判断。使用 `/open-tui` 开关扩展后，请 `/reload` 重新分配界面；旧宿主缺少命令发现 API 时，仍保留 Footer 被替换后让出的兼容机制。

## 联合预览与验证

- [暗色联合预览](previews/grok-open-open-tui.svg)
- [浅色联合预览](previews/grok-open-day-open-tui.svg)
- [实际渲染源码版本与摘要](previews/open-tui-source.json)

预览从指定的 pi-open-tui 安装目录读取未经修改的 TypeScript 源码，在项目的 `.scratch/test-tmp` 临时目录加载，使用真实 Header、编辑器、Footer 和思考预览渲染器。工具失败和 Diff 使用真实 Pi 内容渲染器。输入数据固定，覆盖 80、100、160 列和中文路径。SVG 展示静态结果，不能代替真实终端的字体、滚动与动画验收。

```bash
npm run previews:open-tui -- /path/to/pi-open-tui
npm run previews:open-tui -- /path/to/pi-open-tui --check
PI_OPEN_TUI_DIR=/path/to/pi-open-tui npm test
npm run typecheck
```

未设置 `PI_OPEN_TUI_DIR` 时，单元测试跳过可选的联合预览测试；主题、配合模式、预设保存测试仍运行。联合预览记录来源包版本、源码摘要与 Pi 版本；上游变化后应检查差异并重新生成。
