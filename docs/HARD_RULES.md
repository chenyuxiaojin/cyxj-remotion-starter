# HARD_RULES.md — 硬规则唯一真源(框架红线裁剪版)

> 这是本仓所有 Remotion 视频工程的**硬规则唯一真源**。
> 违反这里 = 渲染坏 / 画面抖 / 不可复现。其它文档只**链向**本文件,不复制重述。
>
> **分工**:
> - **规则**的真源 = 本文件。
> - **品牌(色板/字体/间距/动效 token)**的真源 = [`../kit/theme.ts`](../kit/theme.ts)(占位色板,换成你自己的)。本文件**不写视觉规范**,只写"工程上不能这么干"。
> - **怎么用 API**(interpolate/spring/Sequence 的写法、字幕、转场、字体)= Remotion 官方 Agent Skill(`npx skills add remotion-dev/skills`)。本文件只写"红线",不重抄官方教程。
>
> ⚠️ 这是作者完整硬规则文档的**框架红线一节**(通用工程价值)。作者原文还含大量「战疤」(真实工程踩过的坑)与「生产线纪律」(镜头库装配架构),那些耦合私有工程,**本仓不含**——按同样机制沉淀你自己的战疤即可。

---

## ① 框架非协商(Remotion 官方红线)

> 这一层的依据是 Remotion 的工作原理:**视频是一帧一帧渲染的**,每一帧必须由 `frame` 这个数字**确定性**地算出来。任何"按真实时间流逝"或"随机"的东西都会和逐帧渲染打架——预览看着对,渲染出来就错/抖/不可复现。

### 1. 禁裸 CSS 动画;「钉帧」写法是受控例外

- ❌ **裸** CSS 动画一律禁:`transition:` / 裸 `animation:` / 裸 `@keyframes`。
- ❌ 不用 Tailwind 的 `animate-*`、`transition`、`duration-*`、`ease-*` 这类**动画工具类**。
- **为什么**:CSS 动画按浏览器的**墙上时钟**跑,不按 Remotion 的 `frame` 跑。预览里它在动,**渲染时每帧是独立快照,动画会丢失或错位**。
- **正解(默认走这条)**:所有动起来的值都用 `interpolate()` / `spring()` 从 `useCurrentFrame()` 算出来,写进 inline `style`。
- Tailwind **只准做静态的**:布局、间距、颜色、圆角、字体。**动的一律走 interpolate/spring**。

#### 受控例外:`animationPlayState:'paused'` + 负 `animationDelay` 钉帧

- ✅ **放行条件**:`@keyframes` / `animation:` 必须同时带 `animationPlayState: 'paused'`,并用从 `useCurrentFrame()` 算出的**负 `animationDelay`** 把动画静态钉到当前帧。
- **为什么能放行**:`paused` 让动画不再吃墙上时钟;负 `animationDelay` 把它**静态钉死**在某一时刻。渲染结果就成了计算样式的**纯函数**——同一帧永远渲成同一张,确定性成立。
- ⚠️ **这是主动开的受控例外,不是官方背书**。官方《Don't use CSS animations in Remotion》(https://www.remotion.dev/docs/troubleshooting/css-animations)**逐字反对**所有 CSS 动画。用它=主动承担"官方不保证"的风险;**拿不准就退回 `interpolate()`/`spring()` 这条官方正解**。
- ❌ `transition:` **无此例外**——它本质是状态切换的过渡,没有"钉到某一帧"的写法,**永远禁**。
- 静态守卫(`.claude/hooks/hard-rules-guard.mjs`)据此放行:本次写入含 `animationPlayState:'paused'` 标记 → 不拦 `@keyframes`/`animation:`;`transition:` 始终拦。跨元素错配(一处裸写、另一处恰好有 paused)静态查不到,交给 `remotion-rule-reviewer` 语义审。

### 2. 禁 JS 内置的随机与时间

- ❌ 不用 `Math.random()`。
- ❌ 不用 `Date.now()` / `new Date()` / `performance.now()` 来驱动画面。
- **为什么**:渲染是多帧、可能多进程并行算的。`Math.random()` 每次调用值都不同 → 同一帧渲两次结果不一样 → 闪烁、不可复现。时间函数同理。
- **正解**:需要随机就用 Remotion 的 `random(seed)`——同一个 seed 永远得到同一个值,逐帧稳定。
  - 官方文档:https://www.remotion.dev/docs/random
- 需要"当前时间点"就用 `useCurrentFrame()`(帧号),需要换算成秒就 `frame / fps`。

### 3. interpolate 永远带 clamp

- 调 `interpolate()` **必须**显式写 `extrapolateLeft: 'clamp'` 和 `extrapolateRight: 'clamp'`。
- **为什么**:不写的话,输入超出区间时 `interpolate` 会**继续线性外推**——透明度算出 1.4、缩放算出负数,画面瞬间崩。`clamp` 把值锁在区间端点内。
- **`inputRange` 还必须严格递增**:`[0, 5]` ✅,`[5, 0]` ❌ —— 递减会运行时崩 `inputRange must be strictly monotonically increasing`。想做"值越大越暗"这类**反向映射**,反转的是 **`outputRange`** 不是 input:写 `interpolate(remaining, [0, n], [0.32, 1])`(input 递增、output 反着给),**绝不**写 `interpolate(remaining, [n, 0], [1, 0.32])`。⚠️ **`clamp` 只防外推,拦不到 inputRange 递减**——`tsc`/`compositions` 全绿、预览拖到那一帧才崩。
- 官方文档:https://www.remotion.dev/docs/interpolate

### 4. spring 返回 0..1,要 interpolate 重映射

- `spring()` 默认返回一个 **0 到 1**(可能微微过冲)的进度值,**不是**你最终要的像素/缩放/角度。
- **正解**:拿 spring 的返回值再喂给 `interpolate()`,映射到你真正要的范围。例:`const p = spring(...)` → `interpolate(p, [0, 1], [0, 200], {extrapolateRight: 'clamp'})`。
- 官方文档:https://www.remotion.dev/docs/spring

### 5. 确定性渲染:渲染期不能有异步 / 随机

- 同一个 `frame` 渲染多少次,结果必须**完全一样**。
- ❌ 渲染路径里不放:`fetch` / 网络请求、读时钟、`Math.random()`、依赖外部状态的副作用。
- 数据要在渲染前就备齐(写进 props / 常量 / 本地文件),不要渲染时才去拿。

### 6. 资源放 public/,用 staticFile() 引用

- 图片 / 音频 / 视频 / 字体 / SVG 一律放工程的 `public/` 目录。
- 代码里用 `staticFile('xxx.mp4')` 引用,**不要**写相对路径 `./xxx` 或 `import` 二进制资源。
- 官方文档:https://www.remotion.dev/docs/staticfile

### 7. 依赖钉精确版本(不带 `^`)

- 核心 Remotion 包在 `package.json` 里写**精确版本**,不带 `^` / `~`。
- **为什么**:`@remotion/*` 各包版本必须**整组一致**;带 `^` 会让某个包偷偷升小版本、和其它包错配,渲染出诡异 bug。
- **现行版本基线以起手模板 `template/package.json` 为准**(单一真源,模板升级即基线变)。
- 升级用 `npx remotion upgrade`(整组一起升),不要手改单个包号。

### 8. Tailwind 的边界

- Tailwind 在 Remotion 里要装官方适配:`@remotion/tailwind-v4`(Tailwind v4)。本模板默认不带 Tailwind,用 inline style + theme token;要加自己装官方适配。
- **能用**:静态布局(flex/grid/定位)、间距、颜色、圆角、字体、阴影这种**不随帧变**的样式。
- **不能用**:任何动画类(见 §1)。动 = interpolate/spring + inline style。

### 9. Zod schema 内联在出片层 `Root.tsx`,别从 kit import

- 出片工程的 Zod schema **写在该工程自己的 `src/Root.tsx`**(配 defaultProps)。**别把 schema 从 `kit` import**。
- **为什么**:kit **没装 node_modules**,Remotion 枚举 composition 时 Node 会从 kit 位置找 `zod` → 找不到 → 报错。kit 只提供**零依赖的纯 TS 类型**(`kit/schema/types.ts`),zod 留给出片层。
- 出处:`template/CLAUDE.md` + `kit/schema/types.ts`。

### 10. 动画引擎扩展(R3F / anime.js / 跨仓 alias)

Remotion 当**帧驱动网页动画引擎**用(本模板已装 R3F + anime.js + 原生武器 noise/paths/shapes)。除核心 `interpolate`/`spring`,扩展三条路的**红线(违反就崩/闪/不可复现)**:

- **R3F(`@remotion/three`)**:3D 动画**必须 `useCurrentFrame()` 驱动,禁 `useFrame()`**(@react-three/fiber 的,按墙上时钟跑→渲染闪);`<ThreeCanvas>` 必传 `width`/`height` 且打灯;**渲染必加 `--gl=angle`**(headless Chrome 无 WebGL,不加报 `Error creating WebGL context`)。
- **anime.js**:**必须 `autoplay:false` + 每帧 `seek((frame/fps)*1000)`**;裸 autoplay = 墙上时钟,禁。
- **CSS 同步式**:见上面 §1「受控例外」(`transition:` 永禁;`animation:`/`@keyframes` 仅 `paused`+负 `animationDelay` 合法)。
- **跨仓 alias(最易踩)**:kit 镜头(`kit/`,无 node_modules)跨仓 `import '@remotion/three'`/`'three'`/`'animejs'`… 时,出片工程 `remotion.config.ts` **必须**把这些包显式 alias 到本工程入口文件(`require.resolve(pkg,{paths:[__dirname]})`)——`resolve.modules` 对 scoped 包**兜不到**(报 `Can't resolve`)。`template/remotion.config.ts` 已内置 `CROSS_REPO_PKGS` 表,新片自动带;存量工程抄过去。**只装包不配 alias = bundle 报 can't resolve。**
