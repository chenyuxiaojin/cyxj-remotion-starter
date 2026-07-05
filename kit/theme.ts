/* theme.ts — 视觉 token 的唯一来源。组件【只】从这里取色/字号/间距,不内联硬编码。
 *
 * ⚠️ 这是一套【通用占位色板】。下面每个 hex / 字族都要换成你自己的品牌值——
 *    改一处,全线组件跟着变。真正的项目里,建议把「值」再抽到一个生成器(如 tokens.mjs)
 *    做单一真源,这里只放产物;起步阶段直接改本文件即可。
 *
 * ⚠️ 字体提醒:本设计系统用 4 套字族(见 fonts)。【加载】由出片工程的 fonts.ts 负责
 *    (@remotion/fonts / 自托管 CJK)——只写名字不会自动加载。
 */

/* ───────────────────────── 颜色(占位,换成你自己的)─────────────────────────
 * 一个好用的约定:留两个强调色各司其职,别处一律中性。
 *   本占位板:accent = 命名/主体/当前对象;accent2 = 品牌锚点/数值高亮。
 */
export const colors = {
  // 浅色主题背景(浅中性;纯色也可直接用作 backgroundColor)
  bgCream: '#ece9e4',
  // 浅色渐变的浅端(比 bgCream 略亮)
  bgCreamTo: '#f2f0ec',
  // 浅底 backdrop 上缓慢游走的三团光斑颜色(几何/相位在组件里)
  creamClouds: ['#d9d5cd', '#e0dcd3', '#e6e2d8'],
  // 中性
  chrome: '#20242a',      // 顶部细黑条 / 视频 chrome
  ink: '#17191f',         // 浅色主题主文字(近黑)
  ink2: '#3a3c42',        // 次级文字 / 数值
  inkMuted: '#6b6b72',    // 注脚
  surface: '#e8e5df',     // 实色卡面
  backcard: '#dcd8d0',    // 叠层卡(卡后那张)
  white: '#ffffff',
  // 强调(仅用于标注;换成你自己的品牌色)
  blue: '#3d7de8',        // 命名 / 主体 / 当前对象
  blueStrong: '#2f6bd0',
  blueSoft: '#dde6f7',    // 行 / 格淡底
  orange: '#5b8f7d',      // 品牌锚点(占位用了个中性青绿,换成你的品牌色)
  orangeStrong: '#487261',
  peach: '#e6efe9',       // 列高亮淡底
} as const;

/* ───────────────────────── 字体(占位,换成你自己的)───────────────────────── */
export const fonts = {
  zh: 'Noto Sans SC',        // 中文 / 正文 / 口播标题(本模板已附带 Noto Sans SC woff2)
  display: 'Space Grotesk',  // 英文标题 / 大字 / 数值
  serif: 'Source Serif 4',   // 衬线点缀 / 表头 / 斜体强调
  mono: 'Space Mono',        // 注脚 / 指标名 / 序号 / 技术小字(本模板已附带 woff2)
  /** @deprecated 旧组件用的西文别名,等价 display */
  sans: 'Space Grotesk',
} as const;

/* ─────────────────────── 字号阶梯 @1080p ───────────────────────
 * 统一的字号阶梯。最小可读:任何文字 ≥ minReadable(24px)。
 */
export const fontSize = {
  listFull: 96,      // 全屏大字列表
  titleHero: 64,     // 大字标题页主标题
  stat: 60,          // 数值(对比卡)
  cardTitle: 44,     // 玻璃卡标题
  caption: 36,       // 口播标题 / 字幕级
  modelName: 34,     // 衬线名
  listItem: 30,      // 列表项卡
  bubble: 26,        // 气泡标签
  metaMono: 20,      // 指标注脚 / mono 标签
  minReadable: 24,   // 手机端可读下限
} as const;

/* ───────────────────── 间距(基准 4px)───────────────────── */
export const spacing = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, section: 96,
} as const; // px

/* ───────────────────── 圆角 ───────────────────── */
export const radius = {
  video: 28,         // 口播框
  card: 22,          // 实色 / 玻璃卡
  listPill: 13,      // 列表项卡
  ring: 11,          // 高亮框
  round: 999,        // 气泡
  // 兼容层(旧组件在用,勿删)
  sm: 6, md: 8, lg: 12, xl: 16, pill: 9999,
} as const; // px

/* ───────────────────── 阴影(占位;深玻璃卡用纯黑阴影)───────────────────── */
export const shadow = {
  video: '0 26px 56px -18px rgba(30,30,34,.42), 0 4px 12px rgba(30,30,34,.16)',
  card: '0 28px 60px -22px rgba(40,40,46,.38), 0 6px 18px -10px rgba(40,40,46,.20)',
  dark: '0 20px 50px -18px rgba(0,0,0,.50)',
  pill: '0 4px 12px rgba(20,20,25,.20)',
} as const;

/* ───────────────────── 卡片配方 ─────────────────────
 * 直接铺到 React style 上的样式对象。
 */
export const cards = {
  /** 深玻璃卡(浮于素材) */
  glassDark: {
    background: 'rgba(22,24,28,.66)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: radius.card,
    boxShadow: shadow.dark,
    color: '#fff',
  },
  /** 浅玻璃卡(浅底场景) */
  glassLight: {
    background: 'rgba(255,255,255,.74)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,.80)',
    borderRadius: radius.card,
    boxShadow: '0 20px 50px -18px rgba(40,40,46,.28)',
  },
  /** 实色卡(承载数据表) */
  cardSolid: {
    background: colors.surface,
    borderRadius: radius.card,
    boxShadow: shadow.card,
  },
  /** 列表项卡(浅底上的深色 pill) */
  listPill: {
    background: 'rgba(58,55,62,.82)',
    backdropFilter: 'blur(8px)',
    borderRadius: radius.listPill,
    color: '#fff',
  },
} as const;

/* ───────────────────── 动效 token(视频特有,帧数 @30fps)───────────────────── */
export const motion = {
  fps: 30,
  beatMinSec: 4,             // 任何静止画面 ≥4s 必须有变化
  entranceFrames: 12,        // 卡片入场典型时长 ≈0.4s
  transitionFrames: 24,      // 场景转场典型时长 ≈0.8s
  poseSlideSec: 0.8,         // 连续运镜在布局间滑动时长
  leadInFrames: 8,           // 卡片在被讲到前 ~6–10 帧入场
  beatHoldMinSec: 1.5,       // 一个信息单元至少停 1.5s 再切
  cardSpringDamping: 18,     // 卡片入场 spring({damping:18})
  cardStaggerMs: 70,         // 多卡错峰 60–80ms 逐张
  bubbleSpringDamping: 12,   // 气泡稍带回弹 spring({damping:12})
  exitFasterRatio: 0.5,      // 退场比入场快 ~1/2
  easingDefault: 'Easing.inOut(Easing.cubic)',
} as const;

/* ───────────────────── 兼容层:两套 look(占位)─────────────────────
 * GlassCards / SrtCaptions / types.ts 用 theme.warmPaper / theme.darkGlass。
 * 键名保持不变,值换成你自己的品牌真值。
 */
export const warmPaper = {
  canvas: '#ece9e4',         // 浅底主色
  accent: colors.orange,     // 浅底上的强调色
  ink: colors.ink,           // 近黑主文字
  muted: colors.inkMuted,    // 注脚
  card: colors.surface,      // 实色卡面
} as const;

export const darkGlass = {
  bg: '#22242a',             // 深底回退色(真实场景背景常是口播视频本身)
  bgGrad: 'linear-gradient(160deg,#2a2d34,#181a1f)',     // 全屏暖向渐变——全屏镜头底色用它,禁纯黑
  surface: 'rgba(22,24,28,.66)', // 深玻璃卡面
  stroke: 'rgba(255,255,255,.16)', // 玻璃卡描边
  onDark: '#f2f1ee',         // 深主题文字(暖白)
  accent: colors.blue,       // 深底上的强调(命名/主体)
  muted: 'rgba(242,241,238,.62)', // 深底上的弱化文字
  gradient:
    'linear-gradient(135deg, rgba(22,24,30,0.72), rgba(12,14,20,0.58))', // 暗玻璃卡斜向渐变
  strokeNormal: 'rgba(255,255,255,0.14)', // 普通项描边
  titleNormal: '#e8ecf2',                  // 普通项标题色
  strokeMuted: 'rgba(255,255,255,0.08)',  // 弱化项描边
  titleMuted: '#7a818f',                   // 弱化项标题色
} as const;

/* ───────────────────── 全屏纹理(占位)─────────────────────
 * 全屏镜头(盖人像的过场/数据卡)用这套纹理铺底,避免纯平深底。
 */
export const texture = {
  gridLight: 'rgba(40,38,34,.05)',     // 浅底透视网格线
  gridDark: 'rgba(240,238,234,.05)',   // 深底透视网格线
  gridSize: 46,         // 网格格距(px)
  grainOpacity: 0.08,   // 颗粒 overlay 不透明度
} as const;

/* focus 框三色(截图/画面同时标注多区域用)。 */
export const focusTones = {
  orange: { border: 'rgba(230,140,80,0.95)', fill: 'rgba(230,140,80,0.14)', label: '#e68c50' },
  green: { border: 'rgba(61,200,132,0.95)', fill: 'rgba(61,200,132,0.15)', label: '#26b96b' },
  blue: { border: 'rgba(74,144,255,0.95)', fill: 'rgba(74,144,255,0.14)', label: '#367fe8' },
} as const;

/* 品牌色半透明调(镜头辉光 / 荧光笔扫亮底)。 */
export const tints = {
  blueGlow: 'rgba(61,125,232,0.16)',
  blueSweep: 'rgba(61,125,232,0.40)',
  whiteSweep: 'rgba(255,255,255,0.28)',
  orangeGlow: 'rgba(91,143,125,0.13)',
  orangeSweep: 'rgba(91,143,125,0.42)',
} as const;

export const theme = {
  colors, fonts, fontSize, spacing, radius, shadow, cards, motion, warmPaper, darkGlass, texture, focusTones, tints,
} as const;
export type Theme = typeof theme;
