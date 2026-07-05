/**
 * poses — 镜头库共用的「命名姿态字典」+「镜头类型 → 姿态」映射。
 *
 * 全片只有一个主体(口播人像),它在这些命名姿态间【连续滑动】(不切镜),这是
 * 「视频感、不像 PPT」的核心。<SpeakerTrack> 把这个字典 + 由 scenes 推出的 schedule
 * 喂给 kit 的 <Stage>,Stage 负责逐帧插值。改运镜 = 改这里 / 改 scenes,不碰组件。
 *
 * 这里只留 5 个基础镜头用到的姿态。加新镜头时在 POSES 补姿态、在 poseForScene 补一条分支。
 */
import type { PoseMap } from '../components/Stage';

/** 命名姿态字典。键名被 poseForScene 引用。 */
export const POSES: PoseMap = {
  // 居中说话:接近铺满 + 极轻推近
  center: { scale: 1.04 },
  // 开头「说话→放大」:talkWide(略拉远)→ talkPush(推近)连续滑动出 push-in
  talkWide: { scale: 1.0 },
  talkPush: { scale: 1.12 },
  // 滑到右、铺满,左侧让给关键词卡(title)
  right: { scale: 1.11, tx: 4, gradL: 1 },
  // title 的「人更靠右」变体:人右推到很右、缩放接近自然,给左侧腾大空间
  rightWide: { scale: 1.1, tx: 20, gradL: 1 },
  // 滑到左、铺满,右侧让给卡片
  left: { scale: 1.11, tx: -4, gradR: 1 },
  // 对比:人居中,两侧都压暗
  compare: { scale: 1.04, gradL: 1, gradR: 1 },
  // 缩成左侧圆角小卡,右侧让给列表
  cardLeft: {
    scale: 1, insetT: 11, insetR: 54, insetB: 11, insetL: 4,
    radius: 22, border: 1, shadow: 1, bg: 1,
  },
  // 缩成右侧圆角小卡,左侧让给列表
  cardRight: {
    scale: 1, insetT: 11, insetR: 4, insetB: 11, insetL: 54,
    radius: 22, border: 1, shadow: 1, bg: 1,
  },
  // list 的「人更小」变体(props.portraitSmall 触发):卡更窄更矮,让更多空间给放大的列表
  cardRightSmall: {
    scale: 1, insetT: 14, insetR: 4, insetB: 14, insetL: 60,
    radius: 22, border: 1, shadow: 1, bg: 1,
  },
  cardLeftSmall: {
    scale: 1, insetT: 14, insetR: 60, insetB: 14, insetL: 4,
    radius: 22, border: 1, shadow: 1, bg: 1,
  },
};

/** 每种镜头类型 → 主体目标姿态名(必须是 POSES 的键)。 */
export function poseForScene(type: string, props: Record<string, unknown> = {}): string {
  switch (type) {
    case 'title':
      // 默认人右;props.pushRight=true 时人更靠右(rightWide),给左侧腾更大空间
      return props.pushRight ? 'rightWide' : 'right';
    case 'list': {
      const onRight = (props.portraitSide ?? 'right') === 'right';
      // props.portraitSmall=true → 人物缩成更小的卡,把空间让给放大的列表
      if (props.portraitSmall) return onRight ? 'cardRightSmall' : 'cardLeftSmall';
      return onRight ? 'cardRight' : 'cardLeft';
    }
    case 'compare':
    case 'flankcards':
      // 人居中、两侧压暗,左右各一竖排放大浮卡(flankcards = compare 的 N 卡推广)
      return 'compare';
    case 'talk':
      // 开头样板:props.framing='wide'(略拉远)/'push'(推近),两镜连续滑动出 push-in;默认 center
      if (props.framing === 'wide') return 'talkWide';
      if (props.framing === 'push') return 'talkPush';
      return 'center';
    default:
      return 'center';
  }
}
