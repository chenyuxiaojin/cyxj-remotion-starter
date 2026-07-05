/**
 * types.ts —— 镜头库的数据契约「类型 + 纯函数」,**零 zod 依赖**。
 *
 * 为什么单独拆出来(不放 videoSchema.ts):Remotion 枚举 composition 时会在 Node 侧
 *   求值入口代码,会顺着 import 链把 kit 文件也拉起来。kit 仓本身没有 node_modules,
 *   若 kit 里出现 `import 'zod'`,Node 从 kit 目录往上找 zod 找不到 → "Cannot find module 'zod'"。
 *   所以 kit 镜头库一律零运行时第三方依赖(只用 react/remotion);zod 留给【出片层】
 *   的 Root 用(出片工程把 zod 作为直接依赖装好)。videoSchema.ts(zod 版)从本文件取类型。
 */

/** 单个镜头:type 对应 scenes/sceneMap.ts 的键;props 是该镜头自己的数据。 */
export type SceneInput = {
  /** 镜头类型(title / talk / list / …) */
  type: string;
  /** 这个镜头持续多少秒 */
  durationInSeconds: number;
  /** 该镜头内容数据(随 type 而异) */
  props: Record<string, unknown>;
};

/** 口播底视频(可选):预览用代理、渲染用母片,SpeakerTrack 按环境自动切。 */
export type SpeakerInput = {
  proxySrc: string;
  masterSrc: string;
  objectPosition?: string;
  backdrop?: string;
};

/** 整条视频。 */
export type VideoInput = {
  fps?: number;
  width?: number;
  height?: number;
  background?: string;
  speaker?: SpeakerInput;
  scenes: SceneInput[];
};

/** 整片总帧数 = Σ每镜头秒数 × fps。 */
export function computeDurationInFrames(
  scenes: { durationInSeconds: number }[],
  fps: number,
): number {
  const totalSec = scenes.reduce((a, s) => a + s.durationInSeconds, 0);
  return Math.max(1, Math.round(totalSec * fps));
}

/** 把 scenes 累加成带绝对时间窗 [atSec, endSec) 的时间轴。 */
export function toTimeline(
  scenes: SceneInput[],
): (SceneInput & { atSec: number; endSec: number })[] {
  let t = 0;
  return scenes.map((s) => {
    const atSec = t;
    t += s.durationInSeconds;
    return { ...s, atSec, endSec: t };
  });
}
