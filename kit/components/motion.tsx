/**
 * motion.tsx — 入场动效小助手。
 *
 * 把最常用的 `interpolate` + `spring` 套路封装成开箱即用的包裹组件,
 * 让"给某块内容加个入场"= 套一层 <FadeIn>/<SlideIn>/<Pop>,
 * 而不是每次手搓 useCurrentFrame + interpolate + clamp。
 *
 * 设计取舍(对齐 HARD_RULES / MOTION_NOTES):
 *   - 所有 interpolate 一律带 { extrapolateLeft:'clamp', extrapolateRight:'clamp' }
 *     (HARD_RULES §3 / MOTION_NOTES §1)——封装在这里,调用方不可能漏 clamp。
 *   - spring() 只产 0..1 进度,要变像素/缩放再套一层 interpolate 重映射
 *     (HARD_RULES §4 / MOTION_NOTES §3)。
 *   - 位移/缩放用 spring(要弹性),opacity 用 interpolate(要利落,不拖尾巴)
 *     —— MOTION_NOTES §3 的分工:opacity 别用 spring。
 *   - delay 单位是【帧】;每个组件内部 local = useCurrentFrame() - delay,
 *     把"这一项自己的本地帧"喂给 spring/interpolate,多块用不同 delay 即可错峰蹦出。
 *   - 默认时长取 theme.motion(entranceFrames),不内联硬编码。
 *
 * 用法:
 *   <FadeIn delay={0}><Title /></FadeIn>
 *   <SlideIn delay={6} from="bottom" distance={48}><Card /></SlideIn>
 *   <Pop delay={12}><Badge /></Pop>
 *
 * 注意:这些组件渲一个 <div> 包裹层(套 transform/opacity)。布局影响:
 *   它是 block div,不改变文档流定位;需要绝对定位/flex 子项时,
 *   把定位样式放在【外层】,让动效 div 只管 transform/opacity。
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** clamp 选项:所有 interpolate 必带(HARD_RULES §3)。抽出来避免到处重复。 */
const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** SlideIn 的入场方向 */
export type SlideDirection = 'top' | 'bottom' | 'left' | 'right';

// ─────────────────────────────────────────────────────────────────────────────
// FadeIn — 纯透明度淡入
// ─────────────────────────────────────────────────────────────────────────────

export type FadeInProps = {
  /** 要淡入的内容 */
  children: React.ReactNode;
  /** 起始延迟(帧)。本项的本地帧 = 当前帧 - delay。默认 0。 */
  delay?: number;
  /** 淡入时长(帧)。默认 theme.motion.entranceFrames(≈0.4s)。 */
  duration?: number;
};

/**
 * <FadeIn> — opacity 0→1 线性淡入。
 *
 * opacity 用 interpolate 不用 spring(MOTION_NOTES §3):透明度要"线性、干脆地"
 * 在 ~0.4s 内淡完,spring 的尾巴会让淡入拖泥带水。
 */
export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = theme.motion.entranceFrames,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const opacity = interpolate(local, [0, duration], [0, 1], CLAMP);
  return <div style={{ opacity }}>{children}</div>;
};

// ─────────────────────────────────────────────────────────────────────────────
// SlideIn — 方向位移滑入 + 淡入
// ─────────────────────────────────────────────────────────────────────────────

export type SlideInProps = {
  /** 要滑入的内容 */
  children: React.ReactNode;
  /** 起始延迟(帧)。本项的本地帧 = 当前帧 - delay。默认 0。 */
  delay?: number;
  /** 从哪个方向滑入。默认 'bottom'(从下往上浮入)。 */
  from?: SlideDirection;
  /** 起始位移距离(像素,正数)。默认 48。 */
  distance?: number;
  /** opacity 淡入时长(帧)。默认 theme.motion.entranceFrames。 */
  fadeDuration?: number;
};

/**
 * <SlideIn> — spring 驱动的方向位移滑入,配 interpolate 淡入。
 *
 * spring({damping:18, mass:0.7}) 产 0..1 进度(MOTION_NOTES §3 的入场配方:
 * 稳、几乎不弹,适合商务调性),再用 interpolate 把 0..1 重映射成像素位移
 * (HARD_RULES §4:spring 不直接当像素用)。
 * 位移用 spring(要弹性),opacity 用 interpolate(要利落)—— 两者分工。
 */
export const SlideIn: React.FC<SlideInProps> = ({
  children,
  delay = 0,
  from = 'bottom',
  distance = 48,
  fadeDuration = theme.motion.entranceFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  // 0..1 入场进度。damping/mass 见 MOTION_NOTES §3「关键词大卡入场」配方。
  const enter = spring({ frame: local, fps, config: { damping: 18, mass: 0.7 } });

  // 起始偏移:水平方向(left/right)给 X,垂直方向(top/bottom)给 Y。
  // left/top 从负向滑入,right/bottom 从正向滑入。
  const axisStart =
    from === 'left' || from === 'top' ? -distance : distance;
  // 0..1 → 像素:进度 0 时在起点偏移,进度 1 时归位 0。
  const offset = interpolate(enter, [0, 1], [axisStart, 0], CLAMP);

  const isHorizontal = from === 'left' || from === 'right';
  const translate = isHorizontal
    ? `translateX(${offset}px)`
    : `translateY(${offset}px)`;

  // opacity 单独用 interpolate(local 帧),利落淡入,不蹭 spring 的尾巴。
  const opacity = interpolate(local, [0, fadeDuration], [0, 1], CLAMP);

  return <div style={{ transform: translate, opacity }}>{children}</div>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pop — 缩放弹入
// ─────────────────────────────────────────────────────────────────────────────

export type PopProps = {
  /** 要弹入的内容 */
  children: React.ReactNode;
  /** 起始延迟(帧)。本项的本地帧 = 当前帧 - delay。默认 0。 */
  delay?: number;
  /** 起始缩放(终值固定 1)。默认 0.8。 */
  fromScale?: number;
  /**
   * 是否允许轻微过冲(弹一下再落定)。默认 false。
   * - false:damping 18,稳,几乎不弹(商务调性)。
   * - true:damping 12,带轻微 overshoot(活泼)。见 MOTION_NOTES §3。
   */
  overshoot?: boolean;
  /** opacity 淡入时长(帧)。默认 theme.motion.entranceFrames。 */
  fadeDuration?: number;
};

/**
 * <Pop> — scale fromScale→1 的弹入,配淡入。
 *
 * spring 产 0..1 进度,interpolate 重映射成缩放(HARD_RULES §4)。
 * overshoot=true 时调小 damping 让它"弹一下"——注意:此时 spring 进度会
 * 短暂超过 1,但 interpolate 已 clamp,缩放不会失控(HARD_RULES §3)。
 * 过冲的视觉感来自缩放路径本身,不来自越界外推。
 */
export const Pop: React.FC<PopProps> = ({
  children,
  delay = 0,
  fromScale = 0.8,
  overshoot = false,
  fadeDuration = theme.motion.entranceFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  // overshoot 时调小 damping 制造回弹;否则用稳态配方。mass 0.7 同 §3。
  const enter = spring({
    frame: local,
    fps,
    config: { damping: overshoot ? 12 : 18, mass: 0.7 },
  });

  // 0..1 → 缩放。clamp 保证即便 spring 过冲、scale 也锁在 [fromScale, 1] 端点内。
  const scale = interpolate(enter, [0, 1], [fromScale, 1], CLAMP);
  const opacity = interpolate(local, [0, fadeDuration], [0, 1], CLAMP);

  return <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>;
};

export default { FadeIn, SlideIn, Pop };
