/**
 * <TalkingHead> —— 口播视频装配器(数据驱动:出片层只给数据,渲染逻辑全在这)。
 *
 * 它做两件事,全部由 props(videoSchema)驱动,出片层不必写渲染逻辑:
 *   1) 一条【连续运镜】的口播人像轨(SpeakerTrack):由 scenes 推出 schedule,主体在姿态间
 *      滑过去不切镜 —— 这是「视频感、不像 PPT」的核心(刻意不用 <Series> 切镜)。
 *   2) 每个 scene 的内容图形:套 <Sequence from=镜头起点>(本地帧 → 镜头可移动/复用)+
 *      进出场淡入淡出,叠在人像让出的那侧。
 *
 * 加镜头类型 = 在 scenes/content.tsx 写组件 + scenes/sceneMap.ts 登记 + poses.ts 给姿态。
 */
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { SpeakerTrack } from '../speakers/SpeakerTrack';
import { CreamDriftBackdrop } from '../components/CreamDriftBackdrop';
import { theme } from '../theme';
import { POSES, poseForScene } from './poses';
import { SCENE_MAP } from './sceneMap';
import { toTimeline, type VideoInput, type SceneInput } from '../schema/types';

/**
 * props.enterEase 字符串 → Easing 函数(数据驱动:props.json 里只能写字符串,函数在这映射)。
 * 给个别镜头的【滑入】换缓动用 —— 如开头推近想"嗖"一下用 'out'(快起慢收)。
 */
const enterEasing = (name: unknown): ((t: number) => number) | undefined => {
  switch (name) {
    case 'out':     return Easing.out(Easing.cubic); // 快起慢收(whoosh/嗖,推荐配风声)
    case 'out-exp': return Easing.out(Easing.exp);   // 更猛的快起
    case 'in':      return Easing.in(Easing.cubic);  // 慢起快收
    case 'inout':   return Easing.inOut(Easing.cubic); // 对称(= 全局默认,一般不用显式写)
    default:        return undefined;                // 不指定 → 走 Stage 默认缓动
  }
};

/**
 * 段头 0.3s 淡入、段尾 0.4s 淡出 —— 与人像滑动交叠,顺滑不硬切。
 *
 * 可按边关闭(props.disableFadeIn / disableFadeOut):相邻两镜要做【一镜不断】(后镜帧 0 精确复刻前镜
 *   末帧)时,前镜关淡出 + 后镜关淡入 → 两镜首尾硬切但画面一致 = 无缝。否则 FadeWrap 相邻不交叠会
 *   各自淡出/淡入到透明 → 中间露出底层口播人物 = 断裂(S6→S7 踩过,2026-06-30)。
 *   两段独立 interpolate 取 Math.min(避免 [0,0]/[dur,dur] 递减崩,HARD_RULES 战疤7)。
 */
const FadeWrap: React.FC<{ dur: number; fadeIn?: boolean; fadeOut?: boolean; children: React.ReactNode }> = ({
  dur,
  fadeIn = true,
  fadeOut = true,
  children,
}) => {
  const f = useCurrentFrame();
  const inO = fadeIn ? interpolate(f, [0, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  const outO = fadeOut ? interpolate(f, [dur - 12, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>;
};

const SceneFrame: React.FC<{
  scene: SceneInput & { atSec: number; endSec: number };
  fps: number;
}> = ({ scene, fps }) => {
  const Content = SCENE_MAP[scene.type];
  if (!Content) return null;
  const from = Math.round(scene.atSec * fps);
  const dur = Math.max(1, Math.round((scene.endSec - scene.atSec) * fps));
  const content = <Content {...scene.props} sceneDurationFrames={dur} />;
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      {scene.props?.disableSceneFade ? (
        content
      ) : (
        <FadeWrap dur={dur} fadeIn={scene.props?.disableFadeIn !== true} fadeOut={scene.props?.disableFadeOut !== true}>
          {content}
        </FadeWrap>
      )}
    </Sequence>
  );
};

/**
 * uiScale —— 原生 4K 工程的「图形层放大」开关(默认 1,旧工程不受影响)。
 *
 * 背景(2026-06-20,有官方文档证据):Remotion 的 `--scale` 渲染旗标【不提升视频分辨率】
 *   (https://www.remotion.dev/docs/scaling:scale 只放大文字/SVG/图片,Videos 不放大)。
 *   所以「1080 工程 + --scale=2」会把 4K 实拍糟蹋成 1080 软放大。要保真 4K,工程必须【原生 4K】。
 *   但镜头库的字号/间距 token 是 @1080p 设计的,直接放进 4K 工程会只占半屏。
 *
 * 解法(实拍层与图形层分离):
 *   - 实拍层(SpeakerTrack)放在 wrapper 【外面】,AbsoluteFill 100% = 原生 4K,OffthreadVideo
 *     拿 4K 母片逐帧 1:1 → 真 4K,不经任何 CSS scale,绝不变软。
 *   - 图形层(scenes)放进一个 1920×1080 的盒子里整体 `transform: scale(uiScale)` → 在 4K 画布上
 *     按 @1080p 设计渲染再放大,文字是矢量/DOM,在 4K 设备分辨率下重新栅格化 → 清晰。
 *   两层都用百分比定位,缩卡时实拍卡与内容卡按比例对齐(不受 uiScale 影响)。
 *   注:实拍卡的描边/圆角/投影来自 Stage 的 px token(@1080),4K 下偏小是已知小瑕疵
 *       (全屏镜头无 chrome 不受影响),需要时再给 Stage 加 chromeScale,本次先不动。
 */
export const TalkingHead: React.FC<
  VideoInput & { uiScale?: number; backdropNode?: React.ReactNode }
> = ({
  // 深底回退色【全局默认 espresso】:从 theme 取(原硬编码冷黑 #0c0d10 违反"禁纯黑/冷黑"已退役)。
  background = theme.darkGlass.bg,
  speaker,
  scenes,
  uiScale = 1,
  // 缩卡身后露出的 backdrop【全局默认 = 奶油云飘】(2026-06-21):不传则自动走奶油亮场。
  //   想关掉(某片要纯深底缩卡)显式传 backdropNode={null} 即可绕过默认。opacity 仍由 pose.bg 驱动。
  backdropNode = <CreamDriftBackdrop />,
}) => {
  const { fps, width, height } = useVideoConfig();
  const timeline = toTimeline(scenes);
  // 每个镜头在它的起点切到对应姿态;SpeakerTrack/Stage 在段间连续插值。
  // 单步滑入覆盖:scene.props.enterSec(秒)/ enterEase(字符串)只影响该段滑入,不动其它过渡。
  //   用于开头推近要"嗖"一下(短过渡 + Easing.out 快起慢收 → 好配风声),其余镜头照走全局 0.8s。
  const schedule = timeline.map((s) => {
    const enterSec = typeof s.props?.enterSec === 'number' ? s.props.enterSec : undefined;
    const easing = enterEasing(s.props?.enterEase);
    return {
      atSec: s.atSec,
      pose: poseForScene(s.type, s.props),
      ...(enterSec !== undefined ? { transitionSec: enterSec } : {}),
      ...(easing ? { easing } : {}),
    };
  });
  // 全分辨率全屏镜头:内部用 useVideoConfig() 的【真分辨率】算布局(图序列锚点变焦、SVG 鱼眼滤镜),
  // 不能套进 uiScale 的 1920×1080 盒子——盒子里 translate 会按 3840 算却落在 1920 容器上 = 2× 错位。
  // 这些直接在原生分辨率渲(全屏盖人像,不需要 @1080p 图形层的重栅格)。
  // rankdays:内部用 useVideoConfig() 真分辨率算 scale-to-fit + 相机/光标几何,必须在原生分辨率渲,
  //   否则套进 uiScale 盒子会再被 ×uiScale = 2× 错位(卡片巨大化)。同 fixedfocusriser。
  const FULL_RES_SCENE_TYPES = new Set(['fixedfocusriser', 'rankdays']);
  const fullResEls = timeline.map((s, i) =>
    FULL_RES_SCENE_TYPES.has(s.type) ? <SceneFrame key={i} scene={s} fps={fps} /> : null,
  );
  const scaledEls = timeline.map((s, i) =>
    FULL_RES_SCENE_TYPES.has(s.type) ? null : <SceneFrame key={i} scene={s} fps={fps} />,
  );
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {speaker ? (
        <SpeakerTrack
          proxySrc={speaker.proxySrc}
          masterSrc={speaker.masterSrc}
          objectPosition={speaker.objectPosition}
          backdrop={speaker.backdrop}
          backdropNode={backdropNode}
          poses={POSES}
          schedule={schedule}
        />
      ) : null}
      {/* 全分辨率全屏镜头:盒子外、原生分辨率直接渲(全屏盖人像,时间上与其它镜头不重叠) */}
      {fullResEls}
      {uiScale === 1 ? (
        scaledEls
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: width / uiScale,
            height: height / uiScale,
            transform: `scale(${uiScale})`,
            transformOrigin: 'top left',
          }}
        >
          {scaledEls}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default TalkingHead;
