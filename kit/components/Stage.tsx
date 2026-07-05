/**
 * <Stage> — 连续运镜引擎(把"命名姿态"运镜系统做成可复用引擎)。
 *
 * 核心思想(连续运镜:全片只有一个主体,在命名姿态间逐帧插值滑动,不切镜):
 *   全片只有【一个】主体(人像 / 卡片 / 任意 children)。它的姿态由一组纯数字(Pose)描述,
 *   段与段之间是【滑过去】不是【切过去】——这是"视频感、不像 PPT"的核心。
 *   任意两个 Pose 能逐字段线性插值,正因为 Pose 全是数字。
 *
 * 数据驱动:调用方传入
 *   - poses:命名姿态字典(如 { center: {...}, cardLeft: {...} })——【不写死】具体姿态。
 *   - schedule:时间轴(从第几秒起切到哪个命名姿态),subjectAt 据此连续插值。
 * 这样"改运镜"= 改 schedule / poses 数据,不碰渲染逻辑。
 *
 * ⚠️【战疤·必读】"抽搐":缩成小卡的主体【别加】breathing / 微漂移(scale 在 1.0 上下抖)。
 *   会把卡里的视频缩到 <1.0,露出忽大忽小的【边缝】= 用户看到的"抽搐"真凶。
 *   每段保持静止稳定,生命感来自真实实拍画面本身,不靠程序化漂移。
 *   (见 docs/HARD_RULES.md 框架红线:所有动效必须 frame 驱动)
 *
 * 缓动:段间过渡用 Easing.inOut(Easing.cubic)(无弹跳=不抖),默认时长 theme.motion.poseSlideSec。
 *
 * 数据无关、复制即用:本组件不关心主体是视频还是图片还是文字,只负责把 children
 *   放进当前插值出的姿态容器里。主体内容(<OffthreadVideo> / <Img> / 文字…)由调用方传。
 */
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { theme } from '../theme';

/**
 * 一个姿态 = 一组纯数字。任意两个 Pose 可逐字段线性插值。
 * 全是【可选字段 + 有默认值】:调用方只写关心的几项,其余走 DEFAULT_POSE。
 * 这样命名姿态字典写起来短(如 RIGHT 只需覆盖 scale/tx/gradL)。
 */
export type Pose = {
  /** 主体内部缩放(1 = 原大;越大主体越大)。默认 1。 */
  scale?: number;
  /** 主体内部左右平移(%),+ 右 / - 左(让出一侧给卡片用)。默认 0。 */
  tx?: number;
  /** 容器上边距(%)——>0 即"从铺满收成卡"。默认 0。 */
  insetT?: number;
  /** 容器右边距(%)。默认 0。 */
  insetR?: number;
  /** 容器下边距(%)。默认 0。 */
  insetB?: number;
  /** 容器左边距(%)。默认 0。 */
  insetL?: number;
  /** 容器圆角(px)。默认 0。 */
  radius?: number;
  /** 描边强度 0..1(0 无边,1 满边)。默认 0。 */
  border?: number;
  /** 投影强度 0..1。默认 0。 */
  shadow?: number;
  /** 缩成卡时身后露出的彩色底强度 0..1(也当"缩卡程度"用,驱动 backdrop)。默认 0。 */
  bg?: number;
  /** 左侧压暗 0..1(mode A 让左边给卡片可读性)。默认 0。 */
  gradL?: number;
  /** 右侧压暗 0..1。默认 0。 */
  gradR?: number;
};

/** 所有字段都解析出来的姿态(内部插值用,无 undefined)。 */
export type ResolvedPose = Required<Pose>;

/** 命名姿态字典:调用方定义有哪些姿态(键名自取)。 */
export type PoseMap = Record<string, Pose>;

/**
 * 时间轴的一段:从第 atSec 秒起,主体目标姿态切到 pose(必须是 poses 里的键名)。
 * schedule 是按 atSec 升序排列的数组,subjectAt 在相邻两段间用 poseSlideSec 平滑滑入。
 */
export type StageStep = {
  /** 这一段开始的绝对秒(整片时间轴)。 */
  atSec: number;
  /** 目标姿态名,必须是 poses 字典里的键。 */
  pose: string;
  /**
   * 【可选】这一段【滑入】用的过渡时长(秒),覆盖 Stage 的全局 transitionSec。
   * 不传走全局默认。用于个别镜头要更快/更慢的滑入(如开头推近要"嗖"一下 → 给个短值)。
   */
  transitionSec?: number;
  /**
   * 【可选】这一段【滑入】用的缓动函数,覆盖默认 Easing.inOut(Easing.cubic)。
   * 不传走默认对称缓动。用 Easing.out(...) 做"快起慢收"的快入(whoosh/嗖)。
   */
  easing?: (t: number) => number;
};

/** 一切字段缺省的兜底姿态(= CENTER 中性态:铺满、不缩卡、不压暗)。 */
const DEFAULT_POSE: ResolvedPose = {
  scale: 1,
  tx: 0,
  insetT: 0,
  insetR: 0,
  insetB: 0,
  insetL: 0,
  radius: 0,
  border: 0,
  shadow: 0,
  bg: 0,
  gradL: 0,
  gradR: 0,
};

/** 把可选字段的 Pose 补全成 ResolvedPose(缺省走 DEFAULT_POSE)。 */
const resolvePose = (p: Pose): ResolvedPose => ({ ...DEFAULT_POSE, ...p });

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 两个已解析姿态逐字段线性插值。 */
const lerpPose = (a: ResolvedPose, b: ResolvedPose, t: number): ResolvedPose => ({
  scale: lerp(a.scale, b.scale, t),
  tx: lerp(a.tx, b.tx, t),
  insetT: lerp(a.insetT, b.insetT, t),
  insetR: lerp(a.insetR, b.insetR, t),
  insetB: lerp(a.insetB, b.insetB, t),
  insetL: lerp(a.insetL, b.insetL, t),
  radius: lerp(a.radius, b.radius, t),
  border: lerp(a.border, b.border, t),
  shadow: lerp(a.shadow, b.shadow, t),
  bg: lerp(a.bg, b.bg, t),
  gradL: lerp(a.gradL, b.gradL, t),
  gradR: lerp(a.gradR, b.gradR, t),
});

/** 从 poses 字典取命名姿态并解析;键名不存在则兜底 DEFAULT_POSE。 */
const poseByName = (poses: PoseMap, name: string): ResolvedPose => {
  const found = poses[name];
  return found ? resolvePose(found) : DEFAULT_POSE;
};

/**
 * subjectAt — 连续运镜的核心。给定当前帧,按 schedule 在命名姿态间连续插值出"此刻的姿态"。
 *
 * 算法(出处 stage.ts 的 subjectAt):
 *   1. 找到当前时间命中的 schedule 段(最后一个 atSec <= 当前秒的段)。
 *   2. 当前段目标姿态 = curr,上一段目标姿态 = prev。
 *   3. 在 [段起点, 段起点 + transitionSec] 区间用 inOut(cubic) 把 prev 滑向 curr(0..1)。
 *   4. 段内(过渡结束后)保持 curr 静止——【不加任何 breathing / 漂移】(见顶部战疤)。
 *   收尾(超过最后一段起点)保持最后姿态,不回跳。
 *
 * @param frame         当前帧(来自 useCurrentFrame)
 * @param fps           帧率(来自 useVideoConfig)
 * @param schedule      时间轴(按 atSec 升序);空数组则全程 DEFAULT_POSE
 * @param poses         命名姿态字典
 * @param transitionSec 段间滑动时长(秒),默认 theme.motion.poseSlideSec
 * @returns             此刻插值出的 ResolvedPose
 */
export function subjectAt(
  frame: number,
  fps: number,
  schedule: StageStep[],
  poses: PoseMap,
  transitionSec: number = theme.motion.poseSlideSec,
): ResolvedPose {
  if (schedule.length === 0) return DEFAULT_POSE;

  const t = frame / fps;

  // 找命中段:最后一个 atSec <= t 的段(schedule 假定按 atSec 升序)。
  let idx = -1;
  for (let i = 0; i < schedule.length; i += 1) {
    if (schedule[i].atSec <= t) idx = i;
    else break;
  }

  // 还没到第一段:从 DEFAULT_POSE 滑向第一段(开场从中性态滑入)。
  //   单步可覆盖过渡时长 / 缓动(first.transitionSec / first.easing),不传走全局默认。
  if (idx === -1) {
    const first = schedule[0];
    const curr = poseByName(poses, first.pose);
    const dur = first.transitionSec ?? transitionSec;
    const p = interpolate(t, [first.atSec, first.atSec + dur], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: first.easing ?? Easing.inOut(Easing.cubic),
    });
    return lerpPose(DEFAULT_POSE, curr, p);
  }

  const step = schedule[idx];
  const curr = poseByName(poses, step.pose);
  const prev = idx > 0 ? poseByName(poses, schedule[idx - 1].pose) : DEFAULT_POSE;

  // 命中段的滑入:单步 transitionSec / easing 优先,缺省走全局 transitionSec + inOut(cubic)。
  const dur = step.transitionSec ?? transitionSec;
  const p = interpolate(t, [step.atSec, step.atSec + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: step.easing ?? Easing.inOut(Easing.cubic),
  });

  // 不加任何呼吸/漂移:每段保持静止稳定,生命感来自真实实拍画面本身。
  // (之前 breathing 会让缩卡里的视频缩到 <1.0,露出忽大忽小的边缝——就是"抽搐"真凶。)
  return lerpPose(prev, curr, p);
}

export type StageProps = {
  /** 命名姿态字典(键名自取,如 { center, right, cardLeft })。 */
  poses: PoseMap;
  /** 时间轴:从第几秒切到哪个命名姿态(按 atSec 升序)。 */
  schedule: StageStep[];
  /** 段间滑动时长(秒),默认 theme.motion.poseSlideSec(0.8s)。 */
  transitionSec?: number;
  /**
   * 主体内容(放进姿态容器里)。数据无关:可以是 <OffthreadVideo> / <Img> / 文字 / 任意 JSX。
   * 容器靠 inset 从铺满收成卡;主体内部缩放/平移由 children 自行用 pose 处理,
   * 或用 render-prop 形式 children(pose) 拿到当前姿态自己消化(见下)。
   */
  children?: React.ReactNode | ((pose: ResolvedPose) => React.ReactNode);
  /**
   * 缩成卡时身后露出的彩色底(opacity 由 pose.bg 驱动)。
   * 传 CSS background 字符串;不传则不画 backdrop 层。
   */
  backdrop?: string;
  /**
   * 帧驱动 backdrop 节点(优先于 backdrop 字符串)。传了就用它当缩卡露出的底,opacity 仍由
   * pose.bg 驱动 —— 用于让 backdrop 自己逐帧动(如奶油云飘)。不传则回退 backdrop 字符串。
   */
  backdropNode?: React.ReactNode;
  /** 左侧压暗的 CSS background(opacity 由 pose.gradL 驱动)。不传走默认暗向渐变。 */
  gradLeft?: string;
  /** 右侧压暗的 CSS background(opacity 由 pose.gradR 驱动)。不传走默认暗向渐变。 */
  gradRight?: string;
  /** 容器额外样式(覆盖/补充,如 background、自定义 border)。 */
  containerStyle?: React.CSSProperties;
};

/** 默认压暗渐变(中性暗向,任意 look 都能压底给一侧卡片可读性)。 */
const DEFAULT_GRAD_LEFT =
  'linear-gradient(90deg, rgba(8,9,12,0.8) 0%, rgba(8,9,12,0.4) 30%, transparent 52%)';
const DEFAULT_GRAD_RIGHT =
  'linear-gradient(270deg, rgba(8,9,12,0.8) 0%, rgba(8,9,12,0.4) 30%, transparent 52%)';

/**
 * <Stage> — 把 children 放进当前插值出的姿态容器。
 *
 * 用法 A(children 不关心姿态,只靠容器 inset 收成卡):
 *   <Stage poses={POSES} schedule={SCHEDULE} backdrop={BG}>
 *     <OffthreadVideo src={...} style={{width:'100%',height:'100%',objectFit:'cover'}} />
 *   </Stage>
 *
 * 用法 B(children 是 render-prop,拿当前姿态自己做内部缩放/平移):
 *   <Stage poses={POSES} schedule={SCHEDULE}>
 *     {(pose) => (
 *       <OffthreadVideo src={...} style={{
 *         width:'100%',height:'100%',objectFit:'cover',
 *         transform:`scale(${pose.scale}) translateX(${pose.tx}%)`,
 *       }} />
 *     )}
 *   </Stage>
 *
 * 注:容器只负责 inset / 圆角 / 描边 / 投影(姿态的"外形");主体内部的 scale/tx
 * 由 children 自己消化(用法 B 拿 pose),因为内部缩放属于主体内容、不属于容器框。
 */
export const Stage: React.FC<StageProps> = ({
  poses,
  schedule,
  transitionSec = theme.motion.poseSlideSec,
  children,
  backdrop,
  backdropNode,
  gradLeft = DEFAULT_GRAD_LEFT,
  gradRight = DEFAULT_GRAD_RIGHT,
  containerStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = subjectAt(frame, fps, schedule, poses, transitionSec);

  const body =
    typeof children === 'function'
      ? (children as (pose: ResolvedPose) => React.ReactNode)(p)
      : children;

  return (
    <>
      {/* 缩成卡时身后露出的彩色底(可选):优先帧驱动节点,其次 CSS 字符串 */}
      {backdropNode ? (
        <AbsoluteFill style={{ opacity: p.bg }}>{backdropNode}</AbsoluteFill>
      ) : backdrop ? (
        <AbsoluteFill style={{ background: backdrop, opacity: p.bg }} />
      ) : null}

      {/* 主体容器:inset>0 即从铺满收成圆角卡 */}
      <div
        style={{
          position: 'absolute',
          top: `${p.insetT}%`,
          right: `${p.insetR}%`,
          bottom: `${p.insetB}%`,
          left: `${p.insetL}%`,
          borderRadius: p.radius,
          overflow: 'hidden',
          border: `1.5px solid rgba(255,255,255,${0.16 * p.border})`,
          boxShadow: `0 24px 60px rgba(0,0,0,${0.6 * p.shadow})`,
          ...containerStyle,
        }}
      >
        {body}
      </div>

      {/* mode A 让边时的压暗(给那侧卡片可读性),缩卡时随 gradL/gradR 自动归零 */}
      <AbsoluteFill
        style={{ background: gradLeft, opacity: p.gradL, pointerEvents: 'none' }}
      />
      <AbsoluteFill
        style={{ background: gradRight, opacity: p.gradR, pointerEvents: 'none' }}
      />
    </>
  );
};

export default Stage;
