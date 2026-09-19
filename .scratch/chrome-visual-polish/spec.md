# Chrome 视觉层级与长时使用体验

Status: resolved

创建日期：2026-09-19。代码基线：v0.5.0。配套规格：[Chrome 可靠性与窄屏体验优化](../chrome-reliability/spec.md)。

## Problem Statement

用户希望主题在长时间编码时显得克制、清晰、稳定。目前主题已经具备暗色、编码和日间变体，且 chrome 使用主题语义 token，但布局和视觉注意力仍可改善：

- Footer 将元数据和活动状态串成一行，状态位置随前方内容变化；用户需要重新寻找正在发生的活动。
- 分支使用强调色，模型和活动文字主要使用弱化色；未跟踪文件使用错误色，普通工作区信息容易获得过强的视觉权重。
- 可选 Header 采用三行完整边框，同时呈现品牌、路径、分支、模型和版本，开启后占用较多纵向空间。
- 默认图标混用 emoji、几何符号和 Braille，不同字体下可能出现不一致的大小与基线。
- 日间主题的浅灰 dim 适合装饰，但耗时等可读信息也使用该层级；仅检查色板或 Footer 快照不足以证明完整工作场景清晰。
- 当前提供工作动画和活动计时，但没有面向长时使用的安静模式。动画、数字更新和布局变化会持续吸引注意。

这些判断来自现有布局和配色实现，尚未完成真实终端视觉对照；本规格将可检查的设计意图转为验收条件，不宣称美观度或舒适度已被测量。

## Solution

以“克制、清晰、稳定”为统一方向，实施对话中提出的六项视觉优化。先完成 Footer 左右分区、语义颜色层级和轻量 Header，再统一图标、校准日间灰阶并加入安静模式。两阶段均属于本规格，第一阶段完成不代表整份规格完成。

宽屏 Footer 的左侧承载模型、分支和上下文等信息，右侧承载稳定的活动状态；小屏时沿用配套可靠性规格的核心信息保留规则。模型使用正文层级，分支和路径作为辅助信息，活动与真实风险获得强调。Header 保持默认关闭，提供一行 compact 与现有 boxed 风格。字形、背景和动画在三种主题下遵循一致的视觉规则。

所有新偏好即时生效并可靠保存；现有用户可保留 boxed Header、显式字形和正常动画。视觉效果通过真实渲染预览、行为测试和终端对照验收。

## User Stories

1. As a developer, I want the activity status to stay in a predictable place, so that I can find what the agent is doing at a glance.
2. As a developer, I want model and workspace information grouped separately from activity, so that I can distinguish persistent context from current progress.
3. As a developer using a wide terminal, I want deliberate space between metadata and activity, so that the footer is easy to scan.
4. As a developer using a narrow terminal, I want the layout to shrink while keeping the model and activity recognizable, so that visual polish does not reduce usability.
5. As a developer, I want timer updates to avoid moving unrelated fields, so that the footer stays visually stable during long operations.
6. As a developer using long model and branch names, I want predictable compact labels, so that unusually long names do not disrupt the layout.
7. As a developer using multiple extensions, I want optional status messages to respect the two footer regions, so that they cannot displace core activity information.
8. As a developer, I want the model name to use a readable primary text tone, so that model identity remains visible without adding another accent color.
9. As a developer, I want branch names, paths, and separators to be visually secondary, so that ordinary metadata does not compete with current activity.
10. As a developer, I want normal context usage to remain quiet and high usage to stand out, so that color helps me notice pressure.
11. As a developer with untracked files, I want their count to look informational rather than erroneous, so that the footer does not imply a failure.
12. As a developer, I want text and symbols to identify states independently of color, so that the theme remains understandable in limited-color environments.
13. As a developer, I want a one-line workspace header, so that I can retain orientation without giving up several rows of conversation space.
14. As a developer, I want the project name to be the focus of the compact header, so that the header helps me identify the workspace quickly.
15. As an existing user, I want the boxed header to remain available, so that I can keep the appearance I prefer.
16. As a developer, I want the header to remain optional, so that the update does not add persistent screen furniture without my choice.
17. As a developer, I want package version information available through the information command, so that it does not need to occupy the compact header.
18. As a developer, I want header style changes to apply immediately and survive restart, so that trying a layout does not require manual file editing.
19. As a user of a standard terminal font, I want a coherent set of simple monochrome symbols, so that decorative icons do not vary unexpectedly in size or baseline.
20. As a user of a Nerd Font, I want an intentional opt-in icon style, so that special glyphs are only used when I choose them.
21. As a user of a legacy terminal, I want the visual hierarchy to work with ASCII symbols, so that fallback mode still feels complete.
22. As a developer, I want labels to remain understandable without icons, so that font rendering never becomes the sole carrier of meaning.
23. As a developer using the day theme, I want readable auxiliary text on each relevant surface, so that timers and tool output do not fade into the background.
24. As a developer, I want muted decoration to remain distinct from readable secondary text, so that a quiet appearance does not make information difficult to read.
25. As a developer reviewing code and diffs, I want the day theme checked against real content, so that attractive chrome does not hide poor readability elsewhere.
26. As a developer switching themes, I want the same information hierarchy in dark and light modes, so that switching appearance does not change how I scan the interface.
27. As a developer using a third-party theme, I want chrome to use that theme's semantic colors, so that it does not impose hard-coded colors from the bundled palette.
28. As a developer working for several hours, I want a quiet motion mode, so that ongoing work does not require continual visual attention.
29. As a developer using quiet mode, I want activity transitions and completion to appear promptly, so that reduced motion never looks like a stalled agent.
30. As a developer, I want only one primary animated indicator, so that the footer and working message do not compete for attention.
31. As a developer, I want normal animation to remain available, so that I can choose a more active progress cue when useful.
32. As a developer, I want idle chrome to settle into a subdued state, so that finished work stops drawing my attention.
33. As a developer on an older host, I want unsupported animation customization to degrade honestly, so that the theme does not promise to stop an animation it cannot control.
34. As a maintainer, I want repeatable previews from the actual render path, so that a visual change can be reviewed without relying on hand-drawn examples.
35. As a maintainer, I want alignment, width, contrast, persistence, and lifecycle checks alongside visual comparisons, so that approving a screenshot does not hide functional regressions.
36. As a user reading either language's documentation, I want the new style and motion controls explained accurately, so that I can discover and restore my preferred appearance.

## Implementation Decisions

- **与可靠性规格衔接。** 本规格的生产实现以配套可靠性规格的快照式 Git、核心字段保留、统一字形解析和原子配置保存为基础。可以提前准备颜色设计与预览，但合并相关实现前须具备这些契约。复用已有提供器、布局模型、生命周期和保存结果，不建立第二套缓存、降级或写入系统。ready-for-agent 表示规格可执行，不代表这些依赖已经实现。
- **布局与优先级分离。** Footer 段保留优先级和宽窄形态，增加或复用左右区域的展示信息。区域位置不改变重要性：活动状态、模型、分支、上下文优先，扩展状态、thinking、整轮耗时和路径按既有规则让位。三种预设继续存在，full 仅表示信息更全，不取消宽度约束。
- **宽屏左右分区。** 从现有 80 列紧凑边界起启用宽屏分区。右侧给活动状态预留 24 列，区域右边缘固定在行尾；左侧与右侧至少留两列空格。状态短语放在右区左侧，阶段耗时靠右，状态变化或计时位数变化不推动左区。右区内容超出预算时先缩短工具说明，再使用活动类别，必要时省略计时，不能超宽。
- **左区顺序。** default 的左区按模型、分支、上下文、第三方扩展状态、thinking、路径排列；full 在路径后显示可用的整轮耗时；minimal 左区只保留模型和上下文。低优先级字段是否显示仍由可用宽度决定，不能为保留路径挤掉模型。右区始终承载活动状态；没有数据的字段不显示占位零值。
- **窄屏行为。** 少于 80 列时收敛为紧凑布局，取消固定 24 列预留，按实际内容分配空间并保留必要间隔。沿用可靠性规格的 20–160 列核心字段保证和更小宽度下的状态标记兜底。宽窄切换由当前可用列数决定，不引入依赖历史帧的隐藏布局状态。
- **静态与活动层级。** 模型、项目名使用 text；分支、路径、正常上下文、计时和一般辅助文字使用 muted；分隔符、纯装饰边框使用 dim。活动文字保持可读，活动标记可用 accent 或对应语义 tone。空闲标记和 idle 文案均回到次级层级。全局 chrome 继续由主题适配器着色，不把固定 RGB 写进渲染器。
- **Git 颜色语义。** 普通分支不再长期占用强调色。staged 保留 success，dirty 可用 warning，untracked 改为 muted；继续保留不同的字符前缀，使计数可在无色环境中辨识。Git 未知标记使用 warning，不能伪装成错误或成功。红色仍可用于真实错误、上下文严重压力和 Diff 删除等既有语义，不全局重定义 error token。
- **上下文压力。** 沿用 65%、80%、90% 阈值以及缺少数据时不伪造百分比的契约；正常时弱化，达到阈值时按既有 accent、warning、error 语义突出。不叠加闪烁、背景警报或额外动画。
- **Header 样式。** 新增 compact 和 boxed 两种样式。compact 只占一行，以项目名或紧凑工作区名为主体、分支为辅助，不重复模型、品牌大标题和版本号；空间不足先缩短分支，再缩短项目名。boxed 保留既有三行框架和元数据选项，但跟随统一字形与颜色策略。两种样式都必须宽度安全。
- **Header 命令与迁移。** 新安装仍默认关闭 Header，首次开启默认 compact。保留无参数 header 命令的切换行为，增加 header compact、header boxed、header on、header off；指定样式同时开启，off 保留上次样式。旧配置已启用 Header 且没有样式字段时迁移为 boxed，避免升级后静默改变已开启的布局；缺失或非法样式其余情况采用 compact。信息命令显示开关与样式，版本号继续可查。
- **图标家族。** 默认 Unicode chrome 使用可预测的单色符号，替换装饰性的文件夹与闪电 emoji，不依赖 emoji 的彩色呈现。保留适合活动指示的单列 Braille；它与静态符号同属一套尺寸约束。Nerd 模式只替换已有语义标记，不增加图标密度；ASCII 模式按可靠性规格完整降级。所有图标选择进入中央字形词汇表，不在各个渲染器散落常量。
- **可读标签。** 图标与说明之间采用一致的一列间距，同组字段使用统一分隔符，左右区域靠空白区分。保留文字活动类别与计数前缀，不仅依赖颜色或字体来表达信息。用户内容和第三方状态不被重绘成指定图标风格。
- **日间灰阶。** 区分正文、可读辅助信息、装饰与背景层次；耗时、分支、工具输出等可读内容不能仅因想要更安静而降到装饰色。优先调整语义使用位置，再按真实内容校准日间 palette 与 overlay；不预先给出未经验证的新色值。日间与两种暗色主题保持相同的信息角色，但不要求 RGB 数值镜像。
- **对比度与宿主背景。** 延续现有对比度门禁，并对本次新增或调整的可读文字角色在实际相关背景上检查至少 4.5:1；装饰线不作为正文要求。活动类别可保留 text/muted，颜色标记承载强调。颜色检查不能只把主题中的参考背景当成真实终端背景；预览应注明匹配背景条件，实际终端分别验证暗色和日间。第三方主题沿用其语义 token，不自动修改其 palette，也不承诺第三方对比度。
- **主题源与双份生成。** 所有调色改动在共享 palette 和 overlay 完成，再生成 Pi/omp 主题文件；不手工修改生成结果。Pi 主题保持原 schema，omp 专用 token 保持隔离。只有共享颜色变化传播到 omp，不把 Footer 分区或 Header 样式宣传为 omp 插件功能。
- **动效偏好。** 增加 normal 和 quiet 两档 motion 偏好，默认 normal 以保留当前活跃反馈。提供 motion 查询及 motion normal、motion quiet 命令，补全、信息展示和持久化沿用既有命令体系。quiet 是视觉偏好，不改变活动状态机、工具执行或数据刷新频率。
- **单一动画焦点。** normal 继续由宿主支持的工作指示器承担主要动画；Footer 状态标记保持静态，工作消息不重复插入第二个 spinner 或装饰性活动点。保留 Footer 上有用的活动摘要和计时，不把重复动画减少误解为删除状态信息。
- **安静模式。** 宿主 API 支持时用单个静态帧替换自定义动画；Footer 和插件生成的工作消息计时显示整数秒，纯计时导致的可见更新最多每秒一次。状态类别改变、工具开始或结束、主题与配置变化、Git 查询完成仍可立即更新，不受一秒节流延迟。normal 保留既有短阶段计时精度；无需变化的已显示内容不因相同秒数反复请求渲染。
- **调度兼容。** 安静模式控制展示精度和由纯计时引起的渲染请求，不把共享生命周期时钟整体降频，从而拖慢 Git 快照刷新或其他必要事件。复用已存在的时钟注入点与清理路径，不在 Footer 或工作指示器中新增轮询器。
- **旧宿主降级。** 实施前以已安装宿主的实际 API 检查静态帧配置可用性；只使用公开支持的工作指示器契约。无该能力时 quiet 仍降低插件计时变化，保留宿主默认指示器；命令结果或信息查询说明动效受宿主限制。不能通过访问私有字段或接管终端输入承诺消除所有宿主动画。
- **配置完整性。** Header 样式和 motion 字段加入现有设置负载，使用可靠性规格的原子保存和失败结果；调整其中一个字段不得丢失其他已有偏好。切换即时生效，失败时说明仅本次会话有效，反复启停或切换不能留下旧计时器、重复包装或旧动画。关闭会话恢复宿主默认指示器。
- **视觉验收资产。** 更新现有三种主题的确定性 Header/Footer 预览，增加 compact/boxed、宽窄布局、长名称、空闲/活动、上下文阈值、Git 不同状态以及 normal/quiet 的代表性场景。静态图片只能说明布局与颜色，动画与位置稳定性须另用可控多帧序列或终端录制验证。
- **日间内容对照。** 为本次灰阶评估补充代码块、Markdown、工具输出、工具错误、Diff 和搜索选中态的小型固定场景，优先使用宿主实际渲染组件；不支持确定性离线渲染的部分通过真实会话留证。不创建假组件来冒充宿主渲染，也不将这项验收扩展成新的预览网站。
- **文档与兼容描述。** 同步中英文文档、命令帮助、变更记录与已发布资产说明，说明布局分区、新 Header 样式、motion、旧配置迁移和宿主限制。现有主题命令、Footer 预设和可靠性规格中的降级规则继续有效。

## Testing Decisions

- **主要验收边界。** 复用扩展注册、命令与会话事件，通过 fake Pi 上下文取得真实 Header/Footer 渲染结果、工作指示器配置及通知；观察用户操作产生的外部行为。静态视觉验收通过同一真实渲染路径的确定性资产完成。无需为本规格新增生产测试接口。
- **良好测试的标准。** 断言可见位置、保留的信息、语义角色、配置重启效果和清理结果，不断言私有函数调用顺序或完整内部段数组。宽度正确与视觉层级正确分别验收；快照更新本身不能证明视觉效果合格。
- **布局矩阵。** 沿用 20–160 列、各预设、活动状态、主题和字形组合的现有矩阵，覆盖 79/80/81 列切换、0/1 列、未知长模型、长分支、长工具、中文、emoji、OSC 8 和第三方长状态。验收无溢出、无转义泄漏、模型与活动可辨识，以及宽屏左右区至少两列间隔。
- **位置稳定。** 在同宽度、同阶段、同元数据下推进可控时间，跨越 9.9 秒、10 秒、59 秒和分钟边界，比较可见列位置。宽屏状态区起止位置和左侧字段不应随计时移动；允许在元数据变化或窗口跨断点时重新拟合。超长工具说明应在右区内缩短。
- **颜色语义。** 复用主题替身记录 semantic token 的方式，检查模型和项目名用正文层级、普通分支与 untracked 不使用错误色、装饰使用 dim、关键计时不降到装饰色。检查上下文阈值与未知 Git 状态仍准确；保留无色文本可理解的证据。
- **Header 命令。** 经真实命令入口覆盖 compact、boxed、on、off、无参数 toggle、非法参数及补全。断言 compact 输出一行且只呈现必要工作区信息，boxed 保留三行，新安装默认关闭、旧已开启设置保留 boxed，重启恢复选定样式。
- **字形测试。** 复用中央字形宽度、ASCII 和 Nerd 模式测试，验证默认标记不要求 emoji 或 Nerd 字体、单列标记与间距一致。以实际终端检查字体基线与方框问题，不能单凭 wcwidth 类测量断言所有终端视觉相同。
- **日间与内容可读性。** 在实际使用的背景上验证正文和辅助文字对比度，记录 dim 仅用于装饰的位置；检查代码、Markdown、Diff、选中态和工具输出的小型场景。对比度数学通过与真实终端视觉通过分别记录，不将前者代替后者。暗色主题仍执行现有质量门禁。
- **动效与事件时效。** 复用可控时钟与工作指示器替身，经命令验证 normal/quiet 切换：静态帧、整秒显示、相同秒内的纯计时更新合并；状态变化、Git 完成和设置变化不被 quiet 延迟。API 不存在或拒绝配置时不崩溃，查询能说明限制，关闭恢复默认。
- **生命周期与持久化。** 复用设置重启测试与会话启停矩阵，覆盖新字段缺失/非法、旧设置迁移、保存失败、连续切换样式及动效、不丢失其他偏好、无重复包装或残留计时器。已有 Git 异步行为与可靠性测试必须继续通过。
- **确定性资产。** 固定主题、字体假设、宽度、工作区、Git 快照和时刻；从真实渲染结果生成预览并逐字节检查可重现性。沿用既有 palette 生成、theme schema、类型检查和发布文件完整性门禁。若版本号从 compact Header 消失，版本一致性检查仍覆盖实际展示版本的入口。
- **真实终端验收。** 在至少一个现代终端及 tmux 分屏检查暗色/日间、普通 Unicode/强制 ASCII、宽窄布局与运动切换；Nerd 模式使用真实安装了相应字体的环境。用操作前后截图和短时序记录验证注意力焦点与位置稳定性。环境不可用时如实列出未验证项，不用模拟结果声称真实验收通过。
- **资源与产物。** 测试临时配置、Git 仓库、缓存、预览中间文件和日志置于确认存在父目录的项目内可清理位置，运行既有测试前设置项目内临时目录环境，禁止写入系统临时内存盘。预计超过一分钟、超过 2G 内存或大量访问网络盘的验证，先把 slot audit 与 slot status 写入项目日志，再经对应 slot 池运行；不得终止其他任务或调大槽位。

## Out of Scope

- 重新设计主题品牌、增加第四种主题或大规模改动两种暗色主题的语法调色。
- 新增图形设置面板、预览网站、可交互主题编辑器或字体安装向导。
- 替换编辑器、改变提示符、重排宿主消息区域、修改宿主的 Markdown 或 Diff 渲染实现。
- 自动日夜切换、操作系统外观检测、终端背景或字体探测。
- 新增速度、费用、任务、PR、权限或多 agent 状态字段。
- 自建动画引擎、接管宿主私有状态、保证关闭所有宿主自身动效。
- 重新实现配套可靠性规格已经定义的异步 Git、ASCII 降级和原子配置机制。
- 将 Pi UI 扩展移植到 omp；仅共享主题源的生成结果可同步到 omp。
- 自动发布包、合并提交或发布到远程 issue tracker。

## Further Notes

- 本规格对应当前对话的六项 UI 建议；与配套可靠性规格分别管理。前者明确延后的安静模式及完整内容对照，在本规格中成为实施与验收范围，不改变前者已经定义的交付边界。
- 优先级顺序为：Footer 分区、语义颜色、compact Header；随后完成图标统一、日间校准和 motion。全部六项及对应证据齐备才可视为本规格完成。
- 命令命名、24 列宽屏状态区、旧 Header 迁移和 quiet 精度是将讨论具体化的设计选择，不表示这些细节经过用户逐项确认。验收时若发现真实终端证据要求调整，应先更新本规格相应契约，再同步实现和测试。
- 用户已确认测试边界：复用真实 Header/Footer 渲染与扩展命令测试，结合确定性预览和真实终端对照验收，不新增底层测试接口。
- 规格发布仅代表完成设计与本地 tracker 登记。规格发布时尚未实施；本次实现与验收结果见下方 Answer。
- 后续拆票时使用独立编号实施工单，标明依赖关系；不要把多项实施票合并成单个工单文件。


## Answer

2026-09-19：按本规格完成实现，状态标记为 resolved。实现清单、操作命令及证据见[实施记录](../implementation/report.md)。

- 最终标准测试 16 个文件通过，详细测试 143 项通过，类型检查与差异空白检查通过；六份真实渲染预览的确定性检查通过。
- 实际 Pi 0.84.2 PTY 验证了宽窄布局、主题/字形/Header 切换，以及 normal/quiet 下 thinking → generating → idle。
- 首轮审查发现的通知 Unicode 改写与过期标题文档已修复；思考流标签也已修正。修正轮独立审查 PASS，冻结文件哈希一致。
- tmux、实体 Windows/Nerd Font 与大仓库/NFS 环境尚未验证；具体环境限制和一次未定位原因的测试失败及通过重跑均保留于实施记录，不据此宣称这些场景已经通过。
- 未提交或发布；变更记录位于 Unreleased。
