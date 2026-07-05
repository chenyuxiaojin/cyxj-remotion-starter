# CLAUDE.md

本文件给 Claude Code 用,是这个 Remotion 工作台脚手架的**根路由**。

这是一个「用 Claude Code 指挥 Remotion 出口播视频」的方法论骨架:**三层架构** + **hooks 守规矩** + **skills 编排流程**。它本身不是单个 Remotion 工程——仓库根没有 `package.json`,也不是渲染入口。实际出片在 `template/`(或你从它复制出的工程)里。

**这份文件只回答四件事**:站在仓库根时——该进哪里、不能做什么、规则去哪读、这套骨架怎么用。具体规则不写在这,在下面索引指向的真源里。

## 硬规则

1. **新片从 `template/` 起手**:复制 `template/` 到一个新目录 → `npm install` → 改 `props.json` → 渲。别把 `.tsx` / `package.json` / 素材散落到仓库根。
2. **续作/迭代进已有工程目录里改**,不另开目录。
3. **仓库根禁跑 `npm` / `npx remotion`**——没 `package.json`,命令一律先 `cd` 进 `template/` 或你复制出的工程。
4. **进任一出片工程前先读它自己的 `CLAUDE.md` / `README.md`**——视觉禁区、流程禁区、组件约定在那,本文件不重复。
5. **改 `.tsx` / `props.json` / 镜头前必走官方核查**——三查提醒由 `official-check-reminder` hook 每轮注入,写不出核查内容 = 没查 = 不许改。纯聊天/问答轮不强制。
6. **用 React + Remotion 帧驱动体系**(`interpolate`/`spring`/`Sequence`/`<Audio>` 为主)——**所有动效必须 `useCurrentFrame()` 驱动**;**不用 GSAP / CSS 动画**(红线见 `docs/HARD_RULES.md`)。
7. **造画面默认原生先行;复用是判断后的主动选择,不是开工反射。** 用户说要「新镜头 / 新效果」时,默认就是真造——不许先翻库、拿「有个差不多的」把人劝退。完整 5 步判断在 overlay skill `cyxj-remotion-overlay`。

## 三层真源索引(规则/资产都在这些里,本文件不复制)

- **L0 官方层** —— 官方写法 / API / CLI 一律走这,别凭记忆:
  skill `remotion-best-practices`(`npx skills add remotion-dev/skills`)、MCP `remotion-documentation`(`npx @remotion/mcp@latest`)
- **L1 共享层(kit)** —— 引擎级组件、5 个基础镜头、设计 token、schema、硬规则:
  `kit/CLAUDE.md`(它自带"要找什么 / 在哪"的索引)
- **L2 出片层** —— 怎么开新片、怎么出片:
  起手模板 `template/CLAUDE.md` + 每个工程自己的 `CLAUDE.md` / `README.md`

## 目录路由

| 在哪 | 是什么 |
|---|---|
| `kit/` | L1 共享真源:引擎级组件 / 基础镜头 / 设计 token(占位)/ schema |
| `template/` | 起手模板(复制它开新片) |
| `docs/HARD_RULES.md` | 硬规则唯一真源(框架红线) |
| `.claude/hooks/` | 7 个守规矩钩子(硬规则拦截 / 渲染前确认 / 收工 typecheck+进化闸) |
| `.claude/agents/` | `remotion-rule-reviewer`(渲染前语义审) |
| `.claude/skills/` | 3 个流程 skill(produce 编排 / overlay 画面 / evolve 沉淀) |

## 这套骨架怎么用(hooks + skills)

- **hooks**(`.claude/settings.json` 已接好,7 个):写 `.tsx` 前拦机械红线(`hard-rules-guard`);每轮把官方核查顶到眼前(`official-check-reminder`);跑渲染命令前弹确认(`render-guard`);收工前在改过的工程里跑 `tsc`(`typecheck-on-stop`)、并在动了代码没动文档时提醒沉淀(`evolve-on-stop` + 两个 `record-*` 记账)。
- **skills**(`.claude/skills/`):`cyxj-remotion-produce` 管一条片的 8 阶段顺序;`cyxj-remotion-overlay` 管一段画面怎么做(原生先行 vs 复用);`cyxj-remotion-evolve` 管把学到的回写规则。

## 包含什么 / 不包含什么

本仓给的是**方法论骨架 + 引擎级积木**:hooks、流程 skills、三层架构、起手模板、基础组件与 5 个通用镜头、占位设计系统。

**不含**作者的私有资产:几十个品牌成片镜头、真实设计系统色值、上传口播一键成片的前门、后期交接 SOP、字幕修正工具链。这些是私有沉淀——`kit/theme.ts` 的色值全是**占位色,换成你自己的**;镜头库和设计系统鼓励你按同样机制沉淀自己的。

> 作者:陈与小金。
