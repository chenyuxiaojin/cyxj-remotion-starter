# Claude × Remotion 视频工作台脚手架

用 **Claude Code 指挥 Remotion** 出口播视频的方法论骨架。不是一个视频工程,是一套让 AI 稳定产出视频的**工作台**:三层架构 + hooks 守规矩 + skills 编排流程。

作者:**陈与小金**。

---

## 这是什么

做 Remotion 视频最大的坑不是不会写代码,是 AI 容易:用 CSS 动画(渲染时错位)、用 `Math.random`(逐帧闪烁)、凭记忆瞎写 API、每次从头设计画面。这个脚手架把这些坑变成**结构**:

- **三层架构** —— L0 官方工具链 / L1 共享层 `kit`(引擎级组件 + 基础镜头 + 设计 token)/ L2 出片层 `template`(只装配、改 `props.json`)。画面来自 kit,出片工程只提供数据。
- **hooks 守规矩** —— 7 个钩子在 `.claude/settings.json` 里接好:写 `.tsx` 前拦机械红线(CSS 动画 / `Math.random` / `interpolate` 缺 clamp…),渲染前弹确认,收工前跑 `tsc` 并提醒把学到的沉淀回文档。
- **skills 编排流程** —— 3 个流程 skill:`produce`(一条片的 8 阶段顺序)、`overlay`(一段画面怎么做:原生先行 vs 复用)、`evolve`(把学到的回写规则,让文档越用越准)。

## 5 分钟跑起来

前置:Node 18+、能跑 Remotion(macOS/Linux/Windows 均可)。

```bash
cd template
npm install
npx remotion studio        # 打开 Studio,scrub 预览 demo(title / talk / list 三镜)
```

改 `template/props.json` 就能改片:选镜头 `type`、填文案、定 `durationInSeconds`。渲一张静帧自检 / 渲全片:

```bash
npx remotion still TalkingHead out/qa/f60.png --frame=60 --scale=0.5   # 抽一帧看
npm run render                                                          # 渲全片 → out/video.mp4
```

## 目录结构

```
CLAUDE.md              根路由(给 Claude Code 看:进哪里、不能做什么、规则去哪读)
docs/HARD_RULES.md     硬规则唯一真源(框架红线:frame 驱动 / clamp / 确定性 / public…)
.claude/
  settings.json        接好 7 个 hooks
  hooks/               守规矩钩子(机械红线拦截 / 官方核查提醒 / 渲染前确认 / 收工 typecheck + 进化闸)
  agents/              remotion-rule-reviewer(渲染前语义审)
  skills/              produce / overlay / evolve 三个流程 skill
kit/                   L1 共享层:引擎级组件 + 5 个基础镜头 + 设计 token(占位)+ schema
template/              L2 起手模板(复制它开新片,import 指向 ../kit)
```

## 包含什么 / 不包含什么

**包含**(方法论骨架 + 引擎积木):
- 7 个 hooks、3 个流程 skill、渲染前审查 agent
- 起手模板工程(装好依赖即可跑)
- 引擎级组件:口播运镜轨 `SpeakerTrack`、玻璃卡 `GlassCards`、逐字字幕 `SrtCaptions`、入场动效 `motion`、全屏底 `FullBleedBackdrop` 等
- 5 个通用镜头:`title` / `talk` / `list` / `compare` / `flankcards`
- 硬规则的**框架红线**一节(通用工程价值)

**不包含**(作者私有资产,鼓励你沉淀自己的):
- 几十个品牌成片专用镜头
- 真实设计系统色值 —— `kit/theme.ts` 里全是**通用占位色**,每个都标了「换成你自己的」
- 上传口播一键成片的前门、后期交接 SOP、字幕修正工具链

镜头库与设计系统是作者的私有沉淀;本仓给的是**方法论骨架**,鼓励你在同样的结构上长出自己的镜头库和品牌视觉。

## 关于 Remotion

Remotion 是用 React 写视频的框架(逐帧渲染成 MP4)。官方文档:https://www.remotion.dev 。本脚手架的所有动效都遵守 Remotion 的确定性渲染约束(见 `docs/HARD_RULES.md`)。

## License

MIT — 见 [LICENSE](./LICENSE)。
