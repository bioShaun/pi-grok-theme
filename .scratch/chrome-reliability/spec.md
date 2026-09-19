# Chrome 可靠性与窄屏体验优化

Status: resolved

基线：当前 v0.5.0；创建日期：2026-09-19。

## Problem Statement

用户希望主题在长时间编码、终端分屏和不同字体环境下始终清晰、流畅，并能可靠记住偏好。当前版本已经具备主题原生配色、自适应 Footer、配置持久化、字形模式和 Pi/omp 主题生成，但有四组值得优先处理的问题：

1. Git 缓存过期后，Footer 渲染路径同步执行状态查询，查询超时设为 500ms。大仓库或网络盘存在阻塞界面的风险；失败时计数回落到零，还会混淆“未知”和“没有修改”。这是源码层面识别的风险，尚无实际终端性能测量。
2. Footer 最终对整行尾部截断，活动状态又位于末尾。即使状态段标为最高优先级，长模型名仍可能挤掉状态。分支缺少紧凑形态，窗口变窄时容易整段消失。已有宽度测试不能充分证明关键信息可读。
3. Footer 默认保存为显式 unicode，使默认路径绕过 Windows 自动降级；名为 ASCII 的字形集合仍包含非 ASCII 箭头，分隔符与字形策略独立，Header、工作指示器等也使用不同的解析入口。用户可能看到混合字形或缺字方框。
4. 配置直接覆写，保存失败被静默忽略。用户无法区分“本次已生效”和“重启后仍有效”。中文说明仍包含旧预设名称和会话级配置描述，与当前实现不一致。

## Solution

本次小版本集中改善上述四组体验：Git 在后台更新，Footer 读取已有快照；窄屏先确保活动状态和模型仍可辨识，再安排其他信息；字形自动检测、显式选择和 ASCII 降级遵循统一规则；偏好以原子方式保存，失败时保留会话内效果并提供一次清楚的提示。同步中英文使用文档和现有发布预览中受影响的部分。

完成后的用户可见结果：

- Git 查询未完成时，界面仍可渲染；查询完成后自动刷新，无需等待下一条模型输出。
- 状态读取失败不会伪装成干净工作区，不弹出反复打扰用户的 Git 错误通知。
- 在 20–160 列的验收范围内，有模型数据时保留可辨识的模型片段，并保留状态标记和活动类别；长名称不能把状态整个截掉。
- 新安装默认自动选择合适字形，已有显式偏好保留；需要时可以一条命令切换到一致的 ASCII chrome。
- 配置写入失败时，用户知道设置仅在本次会话有效，原有有效配置保持完整。

## User Stories

1. As a developer, I want the footer to render while Git is still loading, so that repository status does not interrupt my interaction with the agent.
2. As a developer working in a large repository, I want slow Git queries to run outside rendering, so that typing and streamed output remain responsive.
3. As a developer using a network filesystem, I want repository discovery to happen outside rendering, so that filesystem latency does not block every footer refresh.
4. As a developer, I want the last successful Git snapshot to remain visible during refresh, so that the footer does not flicker between populated and empty states.
5. As a developer, I want failed Git queries to be distinguishable from a clean worktree, so that I do not mistake missing information for zero changes.
6. As a developer, I want Git results to appear when the background query completes, so that I do not need to trigger another conversation event.
7. As a developer switching branches or workspaces, I want results to belong to the current context, so that an older query cannot overwrite the current footer.
8. As a developer, I want repeated rendering to reuse Git data, so that the theme does not repeatedly scan my repository.
9. As a developer using the minimal preset, I want unnecessary Git status scans to be skipped, so that my compact setup also avoids unnecessary work.
10. As a developer using a Git worktree or detached HEAD, I want the footer to identify my checkout correctly, so that compact presentation does not remove existing Git support.
11. As a developer outside a Git repository, I want the theme to render normally without Git warnings, so that it remains useful in any directory.
12. As a developer closing a session, I want pending background work to stop affecting the UI, so that old sessions do not leak updates or resources.
13. As a developer using a split terminal, I want to see whether the agent is thinking, generating, or running a tool, so that narrow width does not hide progress.
14. As a developer using a model with a long name, I want its display label to shrink before the activity status disappears, so that both identity and activity remain recognizable.
15. As a developer using a long branch name, I want a compact branch label before it is removed, so that I retain useful repository context when space permits.
16. As a developer using several extensions, I want their status messages to yield space to core fields, so that optional information cannot hide the model or activity.
17. As a developer resizing my terminal, I want all presets to stay within the available columns, so that resizing does not cause overflow or a TUI failure.
18. As a developer using Chinese text, emoji, or linked paths, I want truncation to preserve terminal width and escape-sequence integrity, so that the line remains correctly rendered.
19. As a new user, I want glyph selection to default to automatic detection, so that I do not need to diagnose terminal font support before using the theme.
20. As an existing user, I want my explicit unicode, nerd, or ascii preference preserved, so that an update does not silently change my chosen appearance.
21. As a user of a legacy terminal, I want an ASCII mode whose generated symbols and separators are actually ASCII, so that the theme does not display unsupported glyphs.
22. As a user of a Nerd Font, I want Nerd glyphs to remain an explicit choice, so that automatic mode never assumes a special font is installed.
23. As a developer moving between terminals, I want requested and effective glyph settings to be distinguishable, so that automatic fallback is understandable.
24. As a developer changing glyph modes, I want all plugin-owned chrome to use the same effective mode immediately, so that the header, footer, and working indicator do not disagree.
25. As a developer, I want separator preferences to survive temporary ASCII fallback, so that returning to a capable terminal restores my chosen separator.
26. As a developer restarting the agent, I want footer and header preferences to persist, so that I do not repeat configuration commands each session.
27. As a developer, I want interrupted or failed saves to preserve the last valid settings file, so that a partial write does not erase my preferences.
28. As a developer with an unwritable settings location, I want my command to take effect for the current session and report that persistence failed, so that I understand what will happen after restart.
29. As a developer running multiple sessions, I want saved settings to remain valid JSON after overlapping writes, so that concurrent use cannot leave a partially written file.
30. As a user upgrading from an older release, I want the legacy footer auto alias to keep working, so that existing habits and configuration remain usable.
31. As a user reading either README, I want current commands, defaults, and persistence behavior to match the plugin, so that setup instructions are dependable.
32. As a maintainer, I want regression tests to assert visible behavior through existing extension boundaries, so that internal refactoring does not require rewriting implementation-shaped tests.

## Implementation Decisions

- **范围与基线。** 本规格只实现 Git 异步快照、Footer 信息保留、统一字形降级、可靠配置及文档同步。保留三种 Footer 预设、主题语义 token、上下文压力规则、Header 默认关闭、既有主题命令和第三方扩展状态支持。发布日期和版本号不在本规格中预先承诺。
- **Git 数据边界。** 将 Git 查询责任从 Footer 渲染模块移到独立的数据提供模块。该边界负责异步仓库发现、异步状态读取、缓存和查询状态；Footer 段构造及宽度拟合只消费快照。Header 和标题的分支读取也不得间接触发同步状态扫描。测试注入位于整个 Git 读取边界，不给每个文件系统调用增加独立替身。
- **快照语义。** 区分非仓库、首次加载、成功结果、刷新中和失败。刷新期间可继续展示上次成功结果；首次加载不编造零计数。失败后保留已知分支，隐藏不可信计数，并使用紧凑的 git? 标记表示状态未知；成功且零修改时不显示该标记。该标记属于 Git 可选段，随段一起参与拟合。
- **刷新策略。** 延续约 3 秒的缓存有效期，首次需要 Git 数据时异步加载。活动期间由现有生命周期时钟协调到期刷新；分支变化使缓存失效；工具结束等既有事件可以请求刷新，但必须合并重复请求。空闲时不增加持续轮询；外部文件修改在下一次既有活动或刷新事件时被发现。minimal 不为隐藏的计数启动查询；若 Header 或标题需要分支，只获取所需分支信息。
- **并发与资源所有权。** 同一上下文只允许一个有效查询在途，并合并后续失效请求。切换工作区或会话后，旧结果不得覆盖新快照。异步查询有有限超时，初始沿用 500ms 并在真实验证中评估；超时必须终止或回收对应子进程。会话生命周期拥有调度与清理，渲染器不创建时钟。只读状态查询禁用 Git 可选锁。关闭后不再请求渲染；反复初始化不能累积查询或订阅。
- **Git 兼容性。** 保留普通仓库、子目录、worktree、detached HEAD 和非仓库行为；错误、缺少 Git 命令和超时均安全降级。不为此引入远程请求、仓库全量文件监听或后台守护进程。
- **Footer 拟合契约。** 继续通过带优先级、必需属性和宽窄形态的段模型拟合。整体优先级保持活动状态、模型、分支、上下文、扩展状态、thinking、整轮耗时、路径的顺序。低优先级可选内容先让位，具备紧凑形态的段在被移除前先尝试紧凑形态。
- **状态空间保留。** 拟合时预留活动状态的可见宽度，不再依赖最终从右侧截掉整行来满足核心字段预算。紧凑状态保留标记与可区分的活动类别，时间和长工具说明可进一步缩短或移除。20–160 列内，有模型数据时同时保留至少一个可见的模型名称片段和可辨识状态；没有模型时不伪造模型段。低于 20 列时允许继续降级，但只要有一列就优先保留状态标记；零宽度返回空行。
- **长标签。** 分支增加宽度安全的紧凑形态，尽量保留末端辨识部分并明确标识截断。模型短名之外仍需有按可用列数截断的兜底，不能依赖穷举模型品牌实现宽度保证。所有名称保持展示用途，不修改实际模型或分支标识。
- **宽度与终端序列。** 继续使用宿主 TUI 的可见宽度和截断能力；任何宽度均不得输出超宽行。对缩短后保留的 ANSI 样式和 OSC 8 链接正确闭合，不破坏 Unicode 显示单元。
- **字形偏好。** 字形偏好新增 auto，支持 auto、unicode、nerd、ascii。新配置、缺失字段及非法值默认 auto；现有有效显式值原样保留，不猜测旧 unicode 是否由用户手动设置。升级用户可主动选择 auto。
- **字形优先顺序。** 旧版环境变量值 1 强制 ASCII，优先于所有设置；否则使用显式 unicode、nerd 或 ascii；auto 下，环境变量值 0 强制现代 Unicode，否则走已有终端检测。auto 不自动选择 nerd，也不新增字体探测或终端输入探测。文档清楚解释环境变量与显式偏好的关系。
- **统一解析与显示。** 扩展在生命周期和配置变更处解析有效字形策略，统一提供给 Footer、可选 Header、工作指示器、插件生成的工作消息和通知装饰。切换后即时刷新支持动态更新的 chrome，不重复包装工作消息方法。状态控制器继续负责活动语义，字形选择归展示层。
- **真正的 ASCII。** 有效 ASCII 模式下，插件自有装饰、箭头、边框、截断标记和工作动画使用可打印 ASCII。用户路径、模型名、分支名、工具名和第三方扩展内容不做破坏性的转写；因此不要求整个输出行只能包含 ASCII。
- **分隔符。** 保留现有四种分隔符偏好。有效 ASCII 模式下，dot 和 powerline-thin 临时降级为 ASCII 分隔符，slash 和 ascii 保持原样；仅改变有效输出，不覆写用户的原始偏好。退出 ASCII 后恢复所选样式。帮助和配置查询显示请求值与有效值，二者相同时可简写。
- **保存契约。** 配置保存由静默 void 结果改为可供命令层判断的成功或失败结果。通过目标文件同目录的唯一临时文件写入完整 JSON，再原子替换目标，避免留下半份有效配置。失败时清理本次临时文件并保留旧目标；不存在旧文件时不留下损坏目标。多个会话竞争写入时允许最后一次成功提交的完整快照生效，不承诺跨会话逐字段合并或实时同步。
- **错误反馈。** 用户主动修改偏好时，内存设置立即生效。若保存失败，同一命令只发送一次清楚提示，说明本次会话已生效但未保存；不得同时发出误导性的保存成功消息。无 UI 时安全返回失败结果。加载或自动迁移失败不导致启动崩溃，也不在每次渲染时重复通知。
- **兼容迁移。** 保留 Footer 预设 auto 到 default 的别名和迁移；新字形 auto 与旧预设 auto 是不同参数，不得混淆。自动迁移使用相同的原子保存机制。缺失或无效配置仍采用默认值，不因本次改动引入强制交互。
- **文档与资产。** 两种语言的使用文档同步当前预设、配置持久化、字形与分隔符命令、降级优先顺序、Git 未知状态和保存失败语义。更新变更记录及受行为变化影响的现有确定性预览；明确 omp 分发是主题文件支持，不暗示 Pi UI 扩展功能已移植到 omp。

## Testing Decisions

- **主要验收边界。** 优先复用扩展注册、命令调用和会话事件，经已有 fake Pi 上下文取得 Footer 渲染结果及通知。测试从用户操作和外部事件出发，观察可见内容、保存后的文件和关闭后的行为；不锁定私有字段、辅助函数顺序或具体类拆分。
- **必要的补充边界。** 保留现有纯 Footer 拟合、字形解析和配置文件往返测试。新增边界仅限可控制完成、失败和延迟的异步 Git 读取器；已有可注入时钟和配置位置继续复用。避免为每个内部步骤创建新的 mock seam。
- **Git 行为验证。** 用未完成的 Git Promise 证明扩展仍可输出 Footer、处理后续事件，随后完成 Promise 并验证刷新后的计数；不靠不稳定的毫秒阈值推断“未阻塞”。覆盖首次加载、旧快照刷新、成功零修改、失败未知标记、超时后恢复、同上下文请求合并、minimal 不扫描计数、旧工作区结果隔离和关闭后迟到结果不刷新。
- **真实 Git 小型集成。** 复用现有 Git fixture 思路，创建小型仓库验证 staged、dirty、untracked、分支切换、子目录、worktree、detached HEAD 和非仓库。不用真实大型仓库承担确定性测试，也不触碰开发者仓库的索引或配置。
- **Footer 可读性验证。** 扩展现有 20–160 列矩阵，覆盖三种预设、各活动状态、暗色/日间/第三方主题、字形模式和分隔符。除可见宽度外，必须断言核心状态与模型片段保留；以未知超长模型名、长工具名、长分支、多个扩展状态、中文和 emoji 作为对抗输入。额外覆盖 0、1 和不足 20 列的降级边界。
- **转义序列。** 复用 OSC 8 和 ANSI 回归案例，确认截断后没有链接或样式泄漏。ASCII 验收只约束插件生成的内容，不错误地禁止用户名称中的 Unicode。
- **字形策略验证。** 覆盖新安装、缺失和非法设置、保留旧显式偏好、auto 在现代与旧终端上的选择、环境变量 1/0、显式 nerd 和 ascii，以及四种分隔符的有效结果。通过扩展命令检查配置报告、Footer、Header 和工作指示器更新，而不仅测试字形表常量。
- **配置可靠性验证。** 沿用临时配置位置和新会话注册模式验证持久化、预设别名迁移、字形 auto 往返。覆盖写临时文件失败、替换失败后旧文件仍可加载、临时文件清理、主动命令仅一次失败提示和会话内设置继续生效。并发保存后文件必须是某次完整成功提交的配置，不要求固定赢家。
- **既有测试先例。** 参考现有 Footer 预设、回归矩阵、字形基础、Git 状态、设置持久化、OSC 8、工作指示器、RenderClock、主题切换及发布资产测试。只对实际变化扩展行为断言，不大范围重写测试体系。
- **发布检查。** 实现完成后运行现有测试和类型检查，确保主题生成一致性、schema、对比度和确定性预览门禁继续通过。只更新由本规格行为变化引起的预期结果，不能靠删除断言掩盖回归。
- **真实终端补充验收。** 在现代终端和 tmux 分屏检查约 20、40、80、120 列，覆盖日间/暗色、长标签和实际 Git 变化；用强制 ASCII 检查降级。真实旧 Windows 环境不可用时明确记录未验证范围，不能把模拟等同于真实终端证据。大型或网络盘仓库的性能测量作为补充证据，记录环境，不预先宣称收益。
- **执行环境约束。** 临时仓库、配置、缓存、日志和测试产物放在已确认父目录的项目内可清理目录；运行既有测试前把临时目录环境指向该位置，避免其 os.tmpdir 默认写入系统临时内存盘。项目外仅使用被授权的项目临时位置。预计超过一分钟、超过 2G 内存或大量访问网络盘的任务，先记录 slot audit 和 slot status，再通过对应 slot 池执行；不得终止其他 agent 的进程或调大槽位插队。

## Out of Scope

- 安静模式、动画开关、降低计时刷新频率和新的视觉层级方案。
- 新增代码、Markdown、Diff、搜索态等完整工作场景预览；本次仅维护已有预览的正确性。
- 新主题配色、自动日夜切换、系统外观轮询、终端背景查询或字体自动探测。
- 新增成本、吞吐量、PR、待办、权限或多 agent 状态段。
- 修改编辑器、替换提示符、改变宿主工作流或扩展 Pi 主题 schema。
- Pi UI 扩展向 omp 的移植。
- 用户配置实时跨会话同步、跨会话冲突合并、全局偏好管理框架。
- 清理本规格之外的整个代码库、重构全部命令或修复无关问题。
- 自动发布软件包、提交合并或创建远程 issue。

## Further Notes

- 本规格来自当前对话中的六项优化建议，采用其中建议优先进入下一小版本的第 1、2、3、6 项作为执行范围；其余两项明确延后。技术细节是为使任务可执行而作的设计选择，不代表用户已逐项审阅。
- 已将主要测试边界向用户发出可选核对；未收到调整时按本规格的现有高层边界继续，不把未回复写成已确认。
- 本规格发布时尚未修改产品实现，也没有运行性能测量或宣称测试通过。
- 本规格有意调整旧版本对 legacy 箭头、默认 unicode 和整行截断的描述；相应旧测试和文档应按新的行为契约更新，同时保留主题原生、生命周期清理与宽度安全原则。
- 本次仅发布一份完整规格。后续若拆分实施工单，遵循本地 tracker 的独立编号工单约定，不把多个实施票合并进一个工单文件。


## Answer

2026-09-19：按本规格完成实现，状态标记为 resolved。实现清单、操作命令及证据见[实施记录](../implementation/report.md)。

- 最终标准测试 16 个文件通过，详细测试 143 项通过，类型检查与差异空白检查通过；六份真实渲染预览的确定性检查通过。
- 实际 Pi 0.84.2 PTY 验证了宽窄布局、主题/字形/Header 切换，以及 normal/quiet 下 thinking → generating → idle。
- 首轮审查发现的通知 Unicode 改写与过期标题文档已修复；思考流标签也已修正。修正轮独立审查 PASS，冻结文件哈希一致。
- tmux、实体 Windows/Nerd Font 与大仓库/NFS 环境尚未验证；具体环境限制和一次未定位原因的测试失败及通过重跑均保留于实施记录，不据此宣称这些场景已经通过。
- 未提交或发布；变更记录位于 Unreleased。
