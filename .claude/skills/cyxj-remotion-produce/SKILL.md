---
name: cyxj-remotion-produce
description: Remotion 出片流程编排器。从「要做一条视频」到「成片交付」的 8 阶段顺序:判型→起手→初始化三查→装配→字幕→QA 闸门→渲染交接→收工。用户说"做一条新视频 / 开一条新片 / 开新片 / 出片 / 渲染 / 渲全片"时使用。只管流程顺序与判断点,每步规则真源另有其主;叠加官方 Remotion skill 与 cyxj-remotion-overlay(管一段画面怎么做),不替代任何一个。
---

# cyxj-remotion-produce — 出片流程编排器

> **分工**:本 skill 管「一条片子从头到尾的顺序」;「某一段画面怎么做」→ `cyxj-remotion-overlay`;「做完把学到的回写规则」→ `cyxj-remotion-evolve`。三者构成 produce(流程)→ overlay(画面)→ sedimentation(沉淀)闭环,互相指认、不合并。
> **单一真源纪律**:本文件只放阶段顺序 + 判断点 + 指针,**不抄任何规则原文**(clamp 怎么写、禁什么动画……一律去指针指向的真源读)。真源变了,本文件不用跟着改。

## 8 阶段编排表

| 阶段 | 做什么 | 判断点 | 真源 |
|---|---|---|---|
| 0 判型 | 定这条片走哪条生产路 | 纯 Remotion 一把成片,还是 Remotion 出图形层 + 后期(剪辑软件)精剪叠层 | 你自己的后期 SOP(本仓不含) |
| 1 起手 | 定起点工程 | 像某个现成项目 → 抄它;否则复制 `template/` 开新工程 | `template/CLAUDE.md` |
| 2 初始化三查 | 新工程落地后逐项核对 | 依赖钉死不带 `^`?跨仓 alias `CROSS_REPO_PKGS` 配了(`template/remotion.config.ts`)?zod schema 内联在出片层 `src/Root.tsx`? | `docs/HARD_RULES.md` §7 / §10 / §9 |
| 3 装配 | 拼 `props.json` 时间轴 | 用注册表选镜头 type(清单以注册表为准,勿写死);每一段画面怎么做(原生造还是复用)→ 整体委托 overlay skill | `kit/scenes/sceneMap.ts` + `cyxj-remotion-overlay` |
| 4 字幕 | 按判型走字幕链路 | A 路:Whisper 转写 → 字幕修正 → parseSrt 进片(`<SrtCaptions>`);B 路:字幕归后期,Remotion 不烧字幕 | 你自己的字幕 SOP(本仓给了 `<SrtCaptions>` 组件) |
| 5 QA 闸门 | 渲全片前的自检 | ① 新/大改镜头逐个 `npm run qa:still -- <type>`(见下);② 验收清单逐项勾;③ 用 `remotion-rule-reviewer` 语义审放行 | `assets/qa-still.mjs` |
| 6 渲染交接 | 出成品并交接 | 4K 决策:图形主导 → 1080 合成 + `--scale=2`;实拍铺满 → 原生 4K 工程。R3F 场景渲染带 `--gl=angle` | `docs/HARD_RULES.md` §10 |
| 7 收工 | 沉淀与进化 | 工程内组件要不要晋升进 kit?本次学到的要不要回写规则?(收工进化闸 hook 会兜底提醒) | `kit/CLAUDE.md` 组件晋升节 + `cyxj-remotion-evolve` |

## QA 抽帧一键化(阶段 5 的工具)

在**出片工程根目录**跑(如 `template/`;工程 `package.json` 已接 `qa:still` 入口):

```bash
npm run qa:still -- <type>                 # 默认从 ./props.json 取该 type 的 props/时长,抽入场/中段/落点 3 帧
npm run qa:still -- <type> --frames=a,b,c  # 覆盖帧号;更多参数见 assets/qa-still.mjs 头注释
```

- 脚手架(qa-entry)自动建、自动删,产物落 `qa-frames/`(自动进 `.gitignore`)。
- 脚本只肯在出片工程根目录跑,在 kit / 仓库根会直接报错退出。
- 为什么必须真渲一帧看:tsc / compositions 全绿也抓不到运行时错;中文尤其要肉眼看(字体没加载好会掉成豆腐块,预览看不出)。

## 使用姿势

- 用户说「开一条新片」→ 从阶段 0 顺序走;说「渲染 / 出片」→ 从阶段 5 进入,前面阶段只补漏。
- 每进一个阶段,先把该阶段「真源」列里的文件读了再动手;本表只负责「别漏步骤、别乱顺序」。
- 改任何 `.tsx` / `props.json` 前,官方三查照走(hook 会提醒)。

> **私有沉淀说明**:作者的完整生产线还包含「上传口播一键成片」的前门、后期(剪辑软件)交接 SOP、字幕修正工具链、几十个品牌镜头——这些是私有资产,**本仓不含**。本 skill 给的是可复用的流程骨架,鼓励你按同样机制沉淀自己的那几层。
