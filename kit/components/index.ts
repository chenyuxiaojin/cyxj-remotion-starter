/**
 * kit 组件库 barrel。
 * 组件样式一律从 ../theme.ts 取(占位色板,换成你自己的品牌色)。
 * 所有 interpolate 带 clamp,动画走 useCurrentFrame + interpolate/spring。
 */

// 中文逐字高亮字幕(吃 SRT)
export { SrtCaptions, type SrtCaptionsProps } from './SrtCaptions';

// 连续运镜引擎:一个主体在命名姿态间滑动(滑过去不切镜)
export {
  Stage,
  subjectAt,
  type Pose,
  type ResolvedPose,
  type PoseMap,
  type StageStep,
  type StageProps,
} from './Stage';

// 浅底漂浮 backdrop(口播缩卡身后露出的默认底:浅底 + 光斑缓慢飘,色走 theme)
export { CreamDriftBackdrop } from './CreamDriftBackdrop';

// 全屏暖底纹理 backdrop(全屏镜头铺底,避免纯平深底)
export { FullBleedBackdrop, type FullBleedBackdropProps, type Glow } from './FullBleedBackdrop';

// 玻璃卡套件(浮卡 / 对比 / 侧栏列表)
export {
  FloatingCard,
  Compare,
  SideList,
  type GlassItem,
  type GlassItemTimed,
  type FloatingCardProps,
  type CompareProps,
  type SideListProps,
} from './GlassCards';

// 元素级画布编辑机制(标记 + 覆盖应用层;做可视化编辑器时用得上)
export {
  EditableElement,
  ElementOverridesProvider,
  useElementOverride,
  normalizeElementOverrides,
  type ElementOverride,
  type ElementOverrides,
  type EditableElementProps,
} from './EditableElement';

// 入场动效小助手(封装 interpolate + spring,强制 clamp)
export {
  FadeIn,
  SlideIn,
  Pop,
  type FadeInProps,
  type SlideInProps,
  type PopProps,
  type SlideDirection,
} from './motion';

// 共享类型
export type { Look } from './types';
// Caption 直接从官方源再导出
export type { Caption } from '@remotion/captions';
