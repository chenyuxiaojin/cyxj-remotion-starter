# CLAUDE.md — 口播视频出片模板(L2)

## 这是什么

基于共享层 `../kit` 的口播视频**起手模板**。
出片 = 复制本目录 → 改 `props.json` → 渲。**画面来自 kit 的镜头,本工程只提供数据**——工作量从「设计」塌缩成「装配」。
人看的"怎么跑 / 镜头清单"见 `README.md`;本文件只记 Claude 要的**工作流 + 禁区**。

## 新视频怎么起

1. 复制 `template/` 到一个新目录(整包拷,模板**不带** node_modules)
2. `npm install`(从本机缓存装,十几秒)
3. 给新目录写一份简短 `CLAUDE.md`(这是干嘛的 / 视觉·流程禁区)
4. (可选)口播底视频放 `public/`,改 `props.json` 的 `speaker.proxySrc`(预览 720p)/`masterSrc`(渲染高清)
   > 不给 `speaker` 就是纯图形片(本模板默认 demo 就没有 speaker)。
5. 改 `props.json` 的 `scenes`(选 `type`、填文案、定 `durationInSeconds`)
6. 渲前静帧自检(见下)→ 渲全片

## 改片只动 props.json

- `scenes[].type` —— 镜头类型,**清单以 `../kit/scenes/sceneMap.ts` 注册表为准**(本仓 5 个:title / talk / list / compare / flankcards)
- `scenes[].durationInSeconds` —— 该镜头时长(累加成片长,自动算总帧)
- `scenes[].props` —— 该镜头的文案数据(随 type 而异)
- `speaker` —— 口播底视频(可省;不给则纯图形)

**加新镜头类型** → 去 `../kit/scenes/` 加(`content.tsx` + `sceneMap.ts` + `poses.ts`),全工程复用,**别在本工程平铺发明**。

## 硬规则:单一真源在 kit

所有硬规则以 **`../docs/HARD_RULES.md`** 为唯一真源(每条带原因 + 官方链接),本文件不复述。出片必踩的速记:

1. **动画 frame 驱动** —— `useCurrentFrame()` + `interpolate()`/`spring()`;禁 CSS animation/transition、Tailwind 动画类、GSAP(§1)
2. **镜头从库取,禁平铺发明已有镜头** —— L1 可创造,L2 只装配
3. **资源进 `public/`,用 `staticFile()` 引用**,禁裸相对路径(§6)
4. **zod schema 内联在 `src/Root.tsx`**,别从 kit import —— kit 没 node_modules,枚举 composition 时找不到 zod(§9)
5. **渲全片前必过静帧自检** —— 中文易"渲染时没加载好"掉成豆腐块,只看预览看不出

## 渲染自检回路(渲前必走)

渲前先出几张关键帧**低分辨率**静帧,自查(安全区出血 / 文字被平台 UI 遮 / 对齐 / 字体 / CJK 掉字),过了才渲:

```bash
npm run dev                                            # Studio 常驻,scrub 实时看
npx remotion still TalkingHead out/qa/f60.png  --frame=60  --scale=0.5
npx remotion still TalkingHead out/qa/f150.png --frame=150 --scale=0.5
npm run qa:still -- title                              # 或用一键抽帧工具逐镜头抽入场/中段/落点
npm run render                                         # 过了 → 渲全片 out/video.mp4
```

## 接共享层的机制(已配好,别删)

- `remotion.config.ts` 的 `resolve.modules` + `CROSS_REPO_PKGS` alias —— 让 kit 文件的裸依赖(含 `@remotion/*` / `three` / `animejs` 等 scoped 包)解析到本工程 node_modules(单一 React 实例;scoped 包 `resolve.modules` 兜不到,必须显式 alias)
- `tsconfig.json` 的 `paths` —— 让 `tsc` 给 kit 文件也能找到 react/remotion 类型
- import kit 组件**直取具体文件**(如 `../../kit/scenes`),barrel 没问题
