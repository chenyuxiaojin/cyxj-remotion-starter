/**
 * <GlassCards> 套件 — 暗调玻璃卡片三件套(可复用版)。
 *
 * 来源:玻璃卡三件套 FloatingCard / Compare / SideList
 *       原型提炼。原型里写死的玻璃配色、品牌图标 union(IconName)全部去掉,
 *       颜色改走 ../theme.ts,图标改成开放的 React.ReactNode 槽位(组件不认任何具体图标)。
 *
 * 导出三个组件:
 *   - <FloatingCard>  单张关键词大卡(淡入 + 从一侧滑入)。
 *   - <Compare>       两张迷你卡左右贴边(人居中,一左一右,不放 VS)。
 *   - <SideList>      人像对侧逐条蹦出的列表(每行独立 appearAt,支持 line-through 静音项)。
 *
 * 手感配方(MOTION_NOTES §3,直接照搬,别改数):
 *   - 大卡入场 spring  {damping: 18, mass: 0.7}  —— 稳,几乎不弹。
 *   - 列表逐行 spring  {damping: 20, mass: 0.7}  —— 比大卡再稳一点,逐条蹦不显乱。
 *   - opacity 一律 interpolate(local, [0, 9], [0, 1], clamp),【不用】 spring(尾巴会拖泥带水)。
 *   - 错峰延迟靠 local = frame - appearAtFrames,喂给 spring / interpolate。
 *
 * 硬规则(HARD_RULES §1/§3/§4):
 *   - 所有 interpolate 带 { extrapolateLeft:'clamp', extrapolateRight:'clamp' }。
 *   - spring 返回 0..1,要像素位移再套一层 interpolate 重映射。
 *   - 禁 CSS transition/animation;动画只用 useCurrentFrame + interpolate/spring。
 *   - 颜色不内联硬编码,从 ../theme.ts 按 look 取。
 *
 * 与画幅无关,任意尺寸可用(原型为暗调口播片头 1920×1080 / 4K 设计,字号/间距可按需覆盖)。
 */
import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { theme } from '../theme';
import { EditableElement } from './EditableElement';
import type { Look } from './types';

/**
 * 单个卡片/行的数据(数据无关,与具体项目脱钩)。
 * icon 是开放的 React 节点槽位——调用方传任意图标元素(品牌 SVG / emoji / 自定义组件),
 * 本组件不认识任何具体图标 union。
 */
export type GlassItem = {
  /** 卡片/行主文案 */
  title: string;
  /** 可选图标节点(整段直接渲染到标题左侧/上方;不传则不占位) */
  icon?: React.ReactNode;
  /** 重点项:边框更亮、标题用 accent 强调色 */
  highlight?: boolean;
  /** 弱化项:标题变 muted 色 + line-through(用于"不适合…"这类反向项) */
  muted?: boolean;
};

/** 带出现时机的项(compare/list 用,appearAt 为整片绝对秒) */
export type GlassItemTimed = GlassItem & {
  /** 该项出现的绝对秒(整片时间轴) */
  appearAt: number;
};

/** 把 look 映射成一组玻璃卡用色,全部从 theme 取,不内联硬编码 */
const glassPalette = (look: Look) => {
  if (look === 'warmPaper') {
    const t = theme.warmPaper;
    return {
      // 暖纸:用不透明卡面色,弱玻璃感
      surface: t.card,
      gradient: t.card,
      blur: 0,
      strokeNormal: 'rgba(26,26,23,0.14)', // = ink @ 14%,弱描边
      strokeHot: t.accent,                  // 重点项描边用品牌橙
      strokeMuted: 'rgba(26,26,23,0.07)',   // 弱化项更淡
      titleNormal: t.ink,
      titleHot: t.accent,
      titleMuted: t.muted,
      iconNormal: t.muted,
      iconMuted: 'rgba(108,106,100,0.6)',   // muted @ 60%
      shadow: '0 14px 36px rgba(26,26,23,0.16)',
      muteLine: 'rgba(26,26,23,0.25)',
    };
  }
  const t = theme.darkGlass;
  return {
    surface: t.surface,
    // 暗玻璃斜向渐变 = 走 theme token(值在 theme.ts,换成你自己的品牌色)(见 theme.darkGlass.gradient)
    gradient: t.gradient,
    blur: 14,
    strokeNormal: t.strokeNormal,           // 工程2 实测 0.14(原 t.stroke=0.16 偏亮)
    strokeHot: 'rgba(255,255,255,0.34)',    // 重点项更亮(原型实测值)
    strokeMuted: t.strokeMuted,             // 工程2/1 实测 0.08(原 0.06 偏暗)
    titleNormal: t.titleNormal,             // 工程2 实测 #e8ecf2(原 onDark=#fff 偏亮)
    titleHot: '#ffffff',
    titleMuted: t.titleMuted,               // 工程2/1 实测 #7a818f(灰)
    iconNormal: t.muted,
    iconMuted: 'rgba(160,157,150,0.55)',    // muted @ 55%
    shadow: '0 18px 48px rgba(0,0,0,0.55)',
    muteLine: 'rgba(255,255,255,0.25)',
  };
};

/** 解析某项的三态颜色(normal / highlight / muted),muted 优先于 highlight */
const resolveItemColors = (
  item: Pick<GlassItem, 'highlight' | 'muted'>,
  p: ReturnType<typeof glassPalette>,
) => {
  if (item.muted) {
    return { stroke: p.strokeMuted, title: p.titleMuted, icon: p.iconMuted };
  }
  if (item.highlight) {
    return { stroke: p.strokeHot, title: p.titleHot, icon: p.iconNormal };
  }
  return { stroke: p.strokeNormal, title: p.titleNormal, icon: p.iconNormal };
};

// ─────────────────────────────────────────────────────────────
// 卡标题内荧光笔扫亮(借 QuoteScene.HighlightSpan 思路,内联)
// ─────────────────────────────────────────────────────────────

const SWEEP_SWEEP_SEC = 0.5; // 荧光笔扫过子串的时长(同 QuoteScene)
/** 荧光笔半透明底色(文字仍可读),与 QuoteScene 同值 */
const SWEEP_FILL: Record<'orange' | 'blue', string> = {
  orange: 'rgba(255,111,65,0.42)',
  blue: 'rgba(61,133,232,0.40)',
};

/**
 * 单个高亮 span:backgroundSize 宽度逐帧 0→100%(从左扫亮),全 interpolate 带 clamp,不用 CSS 动画。
 * startFrame = 卡入场帧 + sweep.appearAtSec 折算的延后。
 */
const SweepSpan: React.FC<{
  text: string;
  tone: 'orange' | 'blue';
  startFrame: number;
  titleColorHot: string;
}> = ({ text, tone, startFrame, titleColorHot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sweep = interpolate(
    frame,
    [startFrame, startFrame + Math.round(SWEEP_SWEEP_SEC * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const fill = SWEEP_FILL[tone];
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${fill}, ${fill})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0 0',
        backgroundSize: `${sweep * 100}% 100%`,
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
        borderRadius: theme.radius.ring,
        padding: '0.02em 0.08em',
        color: titleColorHot,
      }}
    >
      {text}
    </span>
  );
};

/**
 * 渲染卡标题:无 sweepHighlight(或子串未命中)→ 原样纯文本(行为不变);
 * 命中 → 切成 [前缀][高亮 span][后缀] 三段,高亮段从左扫亮。
 */
const renderTitle = (
  title: string,
  titleColorHot: string,
  appearAtFrames: number,
  fps: number,
  sweep?: FloatingCardSweep,
): React.ReactNode => {
  if (!sweep || !sweep.text) return title;
  const idx = title.indexOf(sweep.text);
  if (idx < 0) return title; // 未命中:原样显示,不改行为
  const before = title.slice(0, idx);
  const after = title.slice(idx + sweep.text.length);
  const startFrame = appearAtFrames + Math.round((sweep.appearAtSec ?? 0) * fps);
  return (
    <>
      {before}
      <SweepSpan
        text={sweep.text}
        tone={sweep.tone}
        startFrame={startFrame}
        titleColorHot={titleColorHot}
      />
      {after}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// <FloatingCard> — 单张关键词大卡
// ─────────────────────────────────────────────────────────────

/**
 * 卡标题内荧光笔扫亮配置(可选)。给高潮卡的关键词点睛——
 * 在 title 内对 text 子串(首次出现)做从左扫亮,逻辑借 QuoteScene.HighlightSpan(内联实现,带 clamp)。
 */
export type FloatingCardSweep = {
  /** title 里要刷亮的子串(精确匹配,首次出现;不命中则不渲染高亮、title 原样显示) */
  text: string;
  /** 高亮色:blue=命名 / orange=高潮(语义铁律,见 theme) */
  tone: 'blue' | 'orange';
  /** 荧光笔开始扫的本地秒数(相对本卡 appearAtFrames 再延后这么多;默认 0) */
  appearAtSec?: number;
};

export type FloatingCardProps = {
  /** 卡片数据 */
  item: GlassItem;
  /** 该卡出现的本地起始帧(错峰多张卡用不同值) */
  appearAtFrames: number;
  /** 品牌 look,决定配色(默认 darkGlass) */
  look?: Look;
  /** 从哪个方向滑入:-1 从左,1 从右(默认 -1) */
  slideFrom?: -1 | 1;
  /** 滑入像素距离(默认 48) */
  slideDistancePx?: number;
  /** 卡片内 图标↔标题 间距像素(默认 theme.spacing.lg=24;工程2 样板实测 22) */
  gapPx?: number;
  /** 标题字号像素(默认 44) */
  fontSizePx?: number;
  /** 图标尺寸像素(默认 44),传给 icon 节点用——本组件只决定占位框,实际渲染由调用方的 icon 控制大小 */
  iconSizePx?: number;
  /** 字体族(默认 theme.fonts.zh;字体加载由宿主 fonts.ts 负责) */
  fontFamily?: string;
  /** 卡片内边距 CSS(默认 '26px 34px';放大卡传更大值,如 '38px 50px') */
  paddingPx?: string;
  /** 卡片最小宽度像素(默认 540;放大/窄列时覆盖) */
  minWidthPx?: number;
  /** 卡片圆角像素(默认 theme.radius.xl + 8 ≈ 24;放大卡可加大) */
  radiusPx?: number;
  /**
   * 可选:对 title 内某子串做荧光笔从左扫亮(高潮卡关键词点睛)。
   * 不传 = 现状(title 整段纯文字渲染,行为 100% 不变)。
   */
  sweepHighlight?: FloatingCardSweep;
  /**
   * 可选:标题颜色覆盖(#rrggbb)。元素级调色的采纳点——调用方从
   * useElementOverride(id).color 取值传入;不传 = look 默认色,行为不变。
   */
  titleColorOverride?: string;
};

/**
 * 单张关键词大卡:淡入 + 从一侧滑入。
 * 位移用 spring(要弹性),透明度用 interpolate(要利落),分工见 MOTION_NOTES §3。
 */
export const FloatingCard: React.FC<FloatingCardProps> = ({
  item,
  appearAtFrames,
  look = 'darkGlass',
  slideFrom = -1,
  slideDistancePx = 48,
  gapPx = theme.spacing.lg,
  fontSizePx = 44,
  iconSizePx = 44,
  fontFamily,
  paddingPx = '26px 34px',
  minWidthPx = 540,
  radiusPx = theme.radius.xl + 8,
  sweepHighlight,
  titleColorOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearAtFrames;

  const enter = spring({ frame: local, fps, config: { damping: 18, mass: 0.7 } });
  const translateX = interpolate(enter, [0, 1], [slideDistancePx * slideFrom, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(local, [0, 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const p = glassPalette(look);
  const c = resolveItemColors(item, p);

  return (
    <div
      style={{
        transform: `translateX(${translateX}px)`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: gapPx,
        background: p.gradient,
        backdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        WebkitBackdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        border: `1.5px solid ${c.stroke}`,
        borderRadius: radiusPx, // 默认 ≈24(贴合原型大卡圆角);放大卡可加大
        padding: paddingPx,
        boxShadow: p.shadow,
        minWidth: minWidthPx,
        maxWidth: 820,
        fontFamily: fontFamily ?? theme.fonts.zh,
      }}
    >
      {item.icon ? (
        <span
          style={{
            width: iconSizePx,
            height: iconSizePx,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
          }}
        >
          {item.icon}
        </span>
      ) : null}
      <div
        style={{
          fontSize: fontSizePx,
          fontWeight: 800,
          lineHeight: 1.15,
          color: titleColorOverride ?? c.title,
          letterSpacing: 0.5,
        }}
      >
        {renderTitle(item.title, p.titleHot, appearAtFrames, fps, sweepHighlight)}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// <Compare> — 两张迷你卡左右贴边
// ─────────────────────────────────────────────────────────────

/** Compare 内部用的迷你卡(竖向布局:图标在上,标题在下) */
const MiniCard: React.FC<{
  item: GlassItem;
  appearAtFrames: number;
  /** 滑入方向:-1 从左,1 从右 */
  dir: -1 | 1;
  look: Look;
  fontSizePx: number;
  iconSizePx: number;
  widthPx: number;
  fontFamily: string;
}> = ({ item, appearAtFrames, dir, look, fontSizePx, iconSizePx, widthPx, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearAtFrames;

  const enter = spring({ frame: local, fps, config: { damping: 18, mass: 0.7 } });
  const x = interpolate(enter, [0, 1], [40 * dir, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(local, [0, 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const p = glassPalette(look);
  const c = resolveItemColors(item, p);

  return (
    <div
      style={{
        transform: `translateX(${x}px)`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing.lg,
        background: p.gradient,
        backdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        WebkitBackdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        border: `1.5px solid ${c.stroke}`,
        borderRadius: theme.radius.xl + 10, // ≈26,贴合原型迷你卡圆角
        padding: '42px 48px',
        width: widthPx,
        boxShadow: p.shadow,
        fontFamily,
      }}
    >
      {item.icon ? (
        <span
          style={{
            width: iconSizePx,
            height: iconSizePx,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
          }}
        >
          {item.icon}
        </span>
      ) : null}
      <div
        style={{
          fontSize: fontSizePx,
          fontWeight: 700,
          color: c.title,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {item.title}
      </div>
    </div>
  );
};

export type CompareProps = {
  /** 左卡数据 */
  left: GlassItem;
  /** 右卡数据 */
  right: GlassItem;
  /** 两卡入场的基准本地帧(右卡自动比左卡晚 6 帧,做出错峰) */
  appearAtFrames: number;
  /** 品牌 look(默认 darkGlass) */
  look?: Look;
  /** 标题字号像素(默认 46) */
  fontSizePx?: number;
  /** 图标尺寸像素(默认 84) */
  iconSizePx?: number;
  /** 单卡宽度像素(默认 460) */
  cardWidthPx?: number;
  /** 距画面左右边的内缩百分比(默认 5,即 left:5% / right:5%) */
  edgeInsetPct?: number;
  /** 字体族(默认 theme.fonts.zh) */
  fontFamily?: string;
};

/**
 * 对比:两张迷你卡贴左右两边(人居中,一左一右,不放 VS)。
 * 右卡比左卡晚 6 帧入场,做出轻微错峰。绝对定位,需放在一个铺满画面的容器内。
 */
export const Compare: React.FC<CompareProps> = ({
  left,
  right,
  appearAtFrames,
  look = 'darkGlass',
  fontSizePx = 46,
  iconSizePx = 84,
  cardWidthPx = 460,
  edgeInsetPct = 5,
  fontFamily,
}) => {
  const ff = fontFamily ?? theme.fonts.zh;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: `${edgeInsetPct}%`,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <MiniCard
          item={left}
          appearAtFrames={appearAtFrames}
          dir={-1}
          look={look}
          fontSizePx={fontSizePx}
          iconSizePx={iconSizePx}
          widthPx={cardWidthPx}
          fontFamily={ff}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          right: `${edgeInsetPct}%`,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <MiniCard
          item={right}
          appearAtFrames={appearAtFrames + 6}
          dir={1}
          look={look}
          fontSizePx={fontSizePx}
          iconSizePx={iconSizePx}
          widthPx={cardWidthPx}
          fontFamily={ff}
        />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// <SideList> — 人像对侧逐条蹦出列表
// ─────────────────────────────────────────────────────────────

/** SideList 单行:按自己的 appearAt 蹦出,支持 highlight / muted(line-through) */
const ListRow: React.FC<{
  row: GlassItem;
  appearAtFrames: number;
  look: Look;
  fontSizePx: number;
  iconSizePx: number;
  fontFamily: string;
}> = ({ row, appearAtFrames, look, fontSizePx, iconSizePx, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearAtFrames;

  // 列表逐行配方比大卡再稳一点(damping 20)
  const t = spring({ frame: local, fps, config: { damping: 20, mass: 0.7 } });
  const x = interpolate(t, [0, 1], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(local, [0, 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const p = glassPalette(look);
  const c = resolveItemColors(row, p);

  return (
    <div
      style={{
        transform: `translateX(${x}px)`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md + 2, // ≈18
        background: p.gradient,
        backdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        WebkitBackdropFilter: p.blur ? `blur(${p.blur}px)` : undefined,
        border: `1.5px solid ${c.stroke}`,
        borderRadius: theme.radius.xl + 2, // ≈18
        padding: '20px 26px',
        marginBottom: theme.spacing.md + 2,
        fontFamily,
      }}
    >
      {row.icon ? (
        <span
          style={{
            width: iconSizePx,
            height: iconSizePx,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
          }}
        >
          {row.icon}
        </span>
      ) : null}
      <div
        style={{
          fontSize: fontSizePx,
          fontWeight: 700,
          color: c.title,
          lineHeight: 1.2,
          textDecoration: row.muted ? 'line-through' : 'none',
          textDecorationColor: p.muteLine,
        }}
      >
        {row.title}
      </div>
    </div>
  );
};

export type SideListProps = {
  /** 列表行数据,每行带绝对秒 appearAt(逐条蹦出) */
  items: GlassItemTimed[];
  /** 人像在哪一侧,列表自动贴对侧(默认 left → 列表贴右) */
  portraitSide?: 'left' | 'right';
  /** 品牌 look(默认 darkGlass) */
  look?: Look;
  /** 行标题字号像素(默认 32) */
  fontSizePx?: number;
  /** 行图标尺寸像素(默认 34) */
  iconSizePx?: number;
  /** 列表区宽度百分比(默认 42) */
  widthPct?: number;
  /** 距对侧边的内缩百分比(默认 6) */
  edgeInsetPct?: number;
  /** 列表上方可选小标题(如 'HyperFrames';不传则不渲染) */
  heading?: string;
  /** 小标题颜色(默认 theme.colors.blue) */
  headingColor?: string;
  /** 小标题字号像素(默认 theme.fontSize.caption=36;要更突出传更大值如 64) */
  headingSizePx?: number;
  /** 字体族(默认 theme.fonts.zh) */
  fontFamily?: string;
  /**
   * 可选:元素级编辑 id 前缀。传了就把 heading 和每行包进 <EditableElement>
   * (id = `${prefix}-heading` / `${prefix}-${i}`),画布上可单独拖位置/缩放。
   * 不传 = 渲染树不变(阶段 B,2026-07-02)。
   */
  elementIdPrefix?: string;
};

/**
 * 人像对侧的逐条列表。每行按自己的 appearAt(绝对秒)蹦出。
 * 绝对定位贴在人像对侧;需放在一个铺满画面的容器内。
 */
export const SideList: React.FC<SideListProps> = ({
  items,
  portraitSide = 'left',
  look = 'darkGlass',
  fontSizePx = 32,
  iconSizePx = 34,
  widthPct = 42,
  edgeInsetPct = 6,
  heading,
  headingColor = theme.colors.blue,
  headingSizePx = theme.fontSize.caption,
  fontFamily,
  elementIdPrefix,
}) => {
  const { fps } = useVideoConfig();
  const ff = fontFamily ?? theme.fonts.zh;
  // 元素级编辑包裹(仅 elementIdPrefix 给了才包;定位仍在外层容器,包裹层只管 transform)
  const wrapEl = (node: React.ReactNode, id: string, label: string) =>
    elementIdPrefix ? (
      <EditableElement id={id} label={label}>
        {node}
      </EditableElement>
    ) : (
      node
    );
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: `${widthPct}%`,
        // 人像在左 → 列表贴右;人像在右 → 列表贴左
        left: portraitSide === 'left' ? undefined : `${edgeInsetPct}%`,
        right: portraitSide === 'left' ? `${edgeInsetPct}%` : undefined,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {heading
        ? wrapEl(
            <div
              style={{
                fontSize: headingSizePx,
                fontWeight: 700,
                color: headingColor,
                marginBottom: 22,
                fontFamily: ff,
              }}
            >
              {heading}
            </div>,
            `${elementIdPrefix}-heading`,
            '列表标题',
          )
        : null}
      {items.map((row, i) => (
        <React.Fragment key={i}>
          {wrapEl(
            <ListRow
              row={row}
              appearAtFrames={Math.round(row.appearAt * fps)}
              look={look}
              fontSizePx={fontSizePx}
              iconSizePx={iconSizePx}
              fontFamily={ff}
            />,
            `${elementIdPrefix}-${i}`,
            `第 ${i + 1} 行`,
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default { FloatingCard, Compare, SideList };
