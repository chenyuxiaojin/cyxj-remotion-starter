/**
 * <SpeakerTrack> — 全程常驻、连续运镜的口播人像轨(复用 kit 的 <Stage> 运镜引擎)。
 *
 * 为什么不用 @remotion/media 的 <Video>(战疤3):它是 canvas/WebCodecs,不支持
 *   objectPosition,会毁掉缩卡时的人脸居中。这里按环境切原生组件:
 *     预览(Studio) → <Html5Video>(真实 <video>,播放流畅)
 *     渲染          → <OffthreadVideo>(逐帧精确)
 *   源也按环境切:预览用 720p 代理(快),渲染用高清母片(清晰)。
 *
 * 运镜:把 poses(命名姿态字典)+ schedule(由 scenes 推出的时间轴)交给 <Stage>,
 *   Stage 逐帧插值,段间是【滑过去】不是【切过去】。主体内部 scale/tx 由 render-prop
 *   拿到当前 pose 自己消化(容器只管 inset/圆角/描边/投影)。
 */
import React from 'react';
import {
  OffthreadVideo,
  Html5Video,
  useRemotionEnvironment,
  staticFile,
} from 'remotion';
import { Stage, type PoseMap, type StageStep } from '../components/Stage';

export type SpeakerTrackProps = {
  /** 预览用 720p 代理(public/ 下相对路径) */
  proxySrc: string;
  /** 渲染用高清母片(public/ 下相对路径) */
  masterSrc: string;
  /** 命名姿态字典(见 scenes/poses.ts) */
  poses: PoseMap;
  /** 运镜时间轴(从第几秒切到哪个姿态;由 scenes 推出) */
  schedule: StageStep[];
  /** 缩成竖卡时把人脸拉回正中(源里人偏右时调,如 '50% 42%')。默认居中。 */
  objectPosition?: string;
  /** 缩成卡时身后露出的彩色底(CSS background) */
  backdrop?: string;
  /** 帧驱动 backdrop 节点(优先于 backdrop 字符串;让露出的底逐帧动,如奶油云飘) */
  backdropNode?: React.ReactNode;
  /** 段间滑动时长(秒);默认走 theme.motion.poseSlideSec */
  transitionSec?: number;
};

export const SpeakerTrack: React.FC<SpeakerTrackProps> = ({
  proxySrc,
  masterSrc,
  poses,
  schedule,
  objectPosition = '50% 50%',
  backdrop,
  backdropNode,
  transitionSec,
}) => {
  const env = useRemotionEnvironment();
  const Footage = env.isRendering ? OffthreadVideo : Html5Video;
  const src = staticFile(env.isRendering ? masterSrc : proxySrc);
  return (
    <Stage poses={poses} schedule={schedule} backdrop={backdrop} backdropNode={backdropNode} transitionSec={transitionSec}>
      {(pose) => (
        <Footage
          src={src}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
            transform: `scale(${pose.scale}) translateX(${pose.tx}%)`,
            transformOrigin: 'center center',
          }}
        />
      )}
    </Stage>
  );
};

export default SpeakerTrack;
