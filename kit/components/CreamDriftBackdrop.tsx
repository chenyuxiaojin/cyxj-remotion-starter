/**
 * <CreamDriftBackdrop> —— 亮场缩卡露出的「奶油亮底 + 云朵缓慢漂浮」【全局默认 backdrop】。
 *
 * 角色:作为 <Stage>/<SpeakerTrack>/<TalkingHead> 的 backdropNode —— 人物缩成卡时身后渐显的底
 *   (opacity 由 pose.bg 驱动)。后来抽成共享组件:从某口播工程的本片专属组件提升为
 *   口播缩卡的【全局默认】,颜色一律走 theme(奶油亮底替换旧 bgCream,色值真源见 ../theme.ts)。
 *
 * 颜色全部从 theme.colors 取(组件不内联硬编码 hex):
 *   - 基底渐变 = bgCream → bgCreamTo(奶油亮端,静态兜底,云在它之上飘)
 *   - 三团云的色 = creamClouds[0..2](漂浮奶油桃光斑)
 *   云的几何(圆心 cx/cy、椭圆半径 rx/ry、漂移正弦项 xs/ys)是【动效几何】不是品牌色,留在组件里。
 *
 * 「云在飘」怎么实现(确定性帧驱动,出处同 FullBleedBackdrop 的漂移):
 *   每团云 = 一层 AbsoluteFill,背景是一个辐向光斑(radial-gradient,transparent 软边)。
 *   光斑圆心 (cx,cy) 用 useCurrentFrame() 逐帧按【多个非整数倍周期的正弦项之和】沿很慢的椭圆游走 →
 *   三团不同周期/相位 = 互相错开、永不重复的"云在飘"。
 *   ⚠️ 帧驱动 + 纯算术(确定性),预览和【最终渲染】都会动;禁用 CSS animation(渲染时失效)。
 *      无 Math.random / 无 Date.now。
 *   ⚠️ 只平移圆心、【不缩放/不改透明度抖动】——避免任何"抽搐"。生命感来自缓慢漂移本身。
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** 奶油基底(亮端线性渐变,静态兜底,云在它之上飘)。色从 theme 取。 */
const BASE = `linear-gradient(135deg, ${theme.colors.bgCream}, ${theme.colors.bgCreamTo})`;

/**
 * 每团云:cx/cy = 静止圆心(画面%);rx/ry = 椭圆半径(% 元素,越小光晕越小);
 * xs/ys = 该轴位移 = 【多个不同周期的正弦项之和】—— 这就是"不规则流动"的函数:
 *   单个正弦 = 规则画圈;两个【非整数倍】周期的正弦相加 = 合成轨迹永不重复,像云在乱飘。
 *   每项 {a 幅度%, p 周期s, ph 相位}:主项给慢飘(周期≈认可的速度),次项小幅快一点打碎规则感。
 *   全确定性(Math.sin),无 Math.random / 无 Date.now。
 * 颜色用 theme.colors.creamClouds[i](漂浮奶油桃光斑),不内联硬编码。
 */
type Term = { a: number; p: number; ph: number };
type Cloud = { color: string; cx: number; cy: number; rx: number; ry: number; xs: Term[]; ys: Term[] };

const CLOUDS: Cloud[] = [
  {
    color: theme.colors.creamClouds[0], cx: 28, cy: 34, rx: 26, ry: 30,
    xs: [{ a: 11, p: 12, ph: 0.0 }, { a: 5, p: 7.3, ph: 1.3 }],
    ys: [{ a: 8, p: 15, ph: 0.6 }, { a: 4, p: 8.7, ph: 2.2 }],
  },
  {
    color: theme.colors.creamClouds[1], cx: 76, cy: 68, rx: 25, ry: 29,
    xs: [{ a: 10, p: 14, ph: 1.6 }, { a: 5, p: 8.9, ph: 0.4 }],
    ys: [{ a: 9, p: 11, ph: 2.1 }, { a: 4, p: 6.7, ph: 3.0 }],
  },
  {
    color: theme.colors.creamClouds[2], cx: 52, cy: 20, rx: 27, ry: 30,
    xs: [{ a: 12, p: 17, ph: 3.2 }, { a: 5, p: 9.5, ph: 1.9 }],
    ys: [{ a: 7, p: 13, ph: 0.9 }, { a: 4, p: 7.9, ph: 2.6 }],
  },
];

/** 多正弦叠加 = 不规则位移(确定性)。 */
const wobble = (terms: Term[], t: number): number =>
  terms.reduce((sum, k) => sum + k.a * Math.sin((2 * Math.PI * t) / k.p + k.ph), 0);

export const CreamDriftBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // 秒

  return (
    <AbsoluteFill style={{ background: BASE }}>
      {CLOUDS.map((c, i) => {
        const cx = c.cx + wobble(c.xs, t);
        const cy = c.cy + wobble(c.ys, t);
        return (
          <AbsoluteFill
            key={i}
            style={{
              background: `radial-gradient(ellipse ${c.rx}% ${c.ry}% at ${cx}% ${cy}%, ${c.color}, transparent)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export default CreamDriftBackdrop;
