import './fonts';
import React from 'react';
import { Composition } from 'remotion';
import { z } from 'zod';
import { zColor } from '@remotion/zod-types';
import { TalkingHead } from '../../kit/scenes';
import { computeDurationInFrames } from '../../kit/schema/types';
import rawProps from '../props.json';

// 每个镜头的数据字段随 type 而异,这里用 catchall 兜住任意字段(通用起手足够)。
// 你的项目成熟后,可以给常用镜头写更严格的 zod schema,让 Studio 右侧控件更好用。
const scenePropsSchema = z
  .object({
    backgroundColor: zColor().optional(),
    accentColor: zColor().optional(),
    textColor: zColor().optional(),
  })
  .catchall(z.any());

// ⚠️ zod schema 定义在【出片层 Root】(本工程把 zod 装为直接依赖)。
//    别从 kit import zod schema:kit 仓没有 node_modules,Remotion 枚举 composition 时
//    会在 Node 侧从 kit 位置找 zod → 找不到。kit 只提供零依赖的类型/纯函数(schema/types.ts)。
export const videoSchema = z.object({
  fps: z.number().default(30),
  width: z.number().default(1920),
  height: z.number().default(1080),
  background: z.string().default('#22242a'),
  // 口播底视频(可选;不给则纯图形)。预览用 proxySrc(720p),渲染用 masterSrc(高清)。
  speaker: z
    .object({
      proxySrc: z.string(),
      masterSrc: z.string(),
      objectPosition: z.string().optional(),
      backdrop: z.string().optional(),
    })
    .optional(),
  // 镜头序列:type 选镜头(见 kit/scenes/sceneMap.ts),durationInSeconds 定时长,
  // props 是该镜头的数据(随 type 而异)。改片 = 改这里 / 改 props.json。
  scenes: z.array(
    z.object({
      type: z.string(),
      durationInSeconds: z.number().positive(),
      props: scenePropsSchema,
    }),
  ),
});

const demoProps = rawProps as z.infer<typeof videoSchema>;
const fps = demoProps.fps;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TalkingHead"
    component={TalkingHead}
    schema={videoSchema}
    defaultProps={demoProps}
    fps={fps}
    width={demoProps.width}
    height={demoProps.height}
    durationInFrames={computeDurationInFrames(demoProps.scenes, fps)}
    calculateMetadata={({ props }) => {
      const f = props.fps ?? 30;
      return {
        durationInFrames: computeDurationInFrames(props.scenes, f),
        fps: f,
        width: props.width ?? 1920,
        height: props.height ?? 1080,
      };
    }}
  />
);
