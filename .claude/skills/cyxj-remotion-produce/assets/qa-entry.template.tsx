/**
 * QA 临时入口(脚手架)—— 由 qa-still.mjs 复制进出片工程 src/ 并注入参数,抽完帧即删。
 * 规则真源:docs/HARD_RULES.md(真渲一帧自检 + CJK 抽帧),本文件不复述。
 *
 * 形态按标准做法:1920×1080、单个目标镜头、不传 speaker(TalkingHead 不传 speaker
 * 就不挂 SpeakerTrack → 天然绕开口播母片软链在渲染 bundle 里 404 的坑)。
 * 镜头 type / props / 时长由 qa-still.mjs 写进同目录 qa-still.props.json。
 * __KIT_IMPORT__ 由 qa-still.mjs 按工程位置替换成指向 cyxj-remotion 的相对路径。
 */
import './fonts';
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { TalkingHead } from '__KIT_IMPORT__/scenes';
import { computeDurationInFrames } from '__KIT_IMPORT__/schema/types';
import qaProps from './qa-still.props.json';

type QaProps = {
  fps: number;
  width: number;
  height: number;
  scenes: { type: string; durationInSeconds: number; props: Record<string, unknown> }[];
};

const props = qaProps as QaProps;

const QaRoot: React.FC = () => (
  <Composition
    id="QA"
    component={TalkingHead}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultProps={props as any}
    fps={props.fps}
    width={props.width}
    height={props.height}
    durationInFrames={computeDurationInFrames(props.scenes, props.fps)}
  />
);

registerRoot(QaRoot);
