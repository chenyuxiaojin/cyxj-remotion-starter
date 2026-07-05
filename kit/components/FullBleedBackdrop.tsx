/**
 * <FullBleedBackdrop> —— 全屏镜头统一暖底纹理+ 缓慢漂移。
 *
 * 给「盖住人像的全屏镜头」(statshock / transition / herostat …)铺底,替代旧的纯黑/冷黑
 * `#0c0d10`(违反 §3.9「禁纯黑/冷黑」+ §3.3「深底=暖炭 #1A1714 + 暖渐变」)。
 *
 * 四层(从下到上):
 *   1) 暖炭底 #1A1714(静态,兜底)
 *   2) 暖向渐变 #241E19→#15110D(放大 + 慢速视差平移,做"光"的缓动)
 *   3) 透视网格 46px(theme.texture.gridDark,backgroundPosition 漂移=无缝滚动)
 *   4) 颗粒 grain(静态 SVG feTurbulence,backgroundPosition 略快漂移做视差)
 *   不含暗角 vignette —— 各镜头自带 glow + vignette,叠在本底之上。
 *
 * 漂移(设计要求:全屏背景朝一角缓慢挪动,增加生命感):
 *   用 useCurrentFrame() 逐帧算位移 → 写进 backgroundPosition / transform。
 *   ⚠️ 这是确定性帧驱动动画,预览和【最终渲染】都会动;禁用 CSS animation(渲染时失效)。
 *   平铺层(网格/颗粒)用 backgroundPosition 无缝滚动,永不露边;渐变层放大 124% 再平移,也不露边。
 *   漂移用【本地帧】(每个全屏镜头各自从 0 开始缓动),镜头间淡入淡出盖住衔接,不需全局连续。
 *
 * 硬规则:位移用 useCurrentFrame + 纯算术(线性、无 interpolate 外推问题);无随机/无时钟;
 *   颜色/格距/grain 从 theme.texture & theme.darkGlass 取,不内联硬编码。
 *
 * ── per-scene 视觉多样性旋钮(2026-06-29 重做加;研究结论:四连镜头一个底=PPT 感的病根)──
 *   不变 DNA = 暖底+网格+grain+漂移;每个全屏镜头只拧 3 个旋钮就各有面貌又整体协调:
 *     glows  —— 光斑(色调 tone 走 theme.colors,屏幕混合点亮本段;Linear 官网每段一束辉光的做法)
 *     tint   —— 全局色温(soft-light,极低不透明度;暖镜头偏橙/冷镜头偏蓝)
 *     vignette —— 暗角(warm,把视线钉回中心 + 加纵深)
 *   全部可选,缺省 = 旧行为(其它镜头 `<FullBleedBackdrop />` 不受影响)。色值只从 theme,hexToRgba 纯算术。
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

type Tone = 'orange' | 'blue';
/** 光斑:色调(theme.colors)+ 位置(%@1080 设计坐标)+ 强度 + 半径。 */
export type Glow = { tone: Tone; x: number; y: number; strength?: number; size?: number };
export type FullBleedBackdropProps = {
  /** 光斑层(屏幕混合点亮);可多个(双光斑场景)。缺省无。 */
  glows?: Glow[];
  /** 全局色温 tint(soft-light)。缺省无。 */
  tintTone?: Tone;
  tintStrength?: number;
  /** 暗角强度 0–1(warm,multiply)。缺省 0。 */
  vignette?: number;
  /**
   * 漂移帧偏移:让本底漂移从【前一镜头末尾】接着走,而非每镜从 0 重启。
   * 默认 0 = 旧行为(每镜本地从 0 漂,靠镜头间淡入淡出盖住衔接断点)。
   * 用于【一镜跨场景硬切】(后镜帧 0 复刻前镜末帧、关掉 FadeWrap):后镜传【前镜总帧数】,
   * 漂移连续不跳(否则硬切处渐变/网格位置突变 = 背景闪一下)。S6→S7a 踩过,2026-06-30。
   */
  driftFrameOffset?: number;
};

const TONE_HEX: Record<Tone, string> = { orange: theme.colors.orange, blue: theme.colors.blue };
// hex → rgba(纯算术,确定性;让色值仍单一来自 theme.colors)
const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// 静态颗粒噪声(feTurbulence 确定性,渲染逐帧一致),tile 成 grain overlay
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// 漂移方向(@1080 设计坐标,×2 到 4K)。朝右上角:x 向右(+)、y 向上(−)。
//   想改朝【左上角】,把 DRIFT_DIR_X 改成 -1 即可。
const DRIFT_DIR_X = 1;
const DRIFT_DIR_Y = -1;
const DRIFT_PX_PER_SEC = 9; // 漂移速度(@1080 px/秒;缓慢,4K 上视觉 ≈18px/s)

export const FullBleedBackdrop: React.FC<FullBleedBackdropProps> = ({
  glows = [],
  tintTone,
  tintStrength = 0.06,
  vignette = 0,
  driftFrameOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (frame + driftFrameOffset) / fps; // +offset:一镜跨场景续接漂移(默认 0=旧行为)
  // 基准位移(网格用)
  const dx = DRIFT_DIR_X * DRIFT_PX_PER_SEC * sec;
  const dy = DRIFT_DIR_Y * DRIFT_PX_PER_SEC * sec;

  return (
    <>
      {/* 1) 暖炭底(静态兜底) */}
      <AbsoluteFill style={{ backgroundColor: theme.darkGlass.bg }} />

      {/* 2) 暖向渐变:放大 124% + 慢速视差平移(0.4×),作为缓动的"光" */}
      <div
        style={{
          position: 'absolute',
          top: '-12%',
          left: '-12%',
          width: '124%',
          height: '124%',
          backgroundImage: theme.darkGlass.bgGrad,
          transform: `translate(${dx * 0.4}px, ${dy * 0.4}px)`,
        }}
      />

      {/* 3) 透视网格 46px:backgroundPosition 漂移(无缝滚动) */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.texture.gridDark} 1px, transparent 1px), linear-gradient(90deg, ${theme.texture.gridDark} 1px, transparent 1px)`,
          backgroundSize: `${theme.texture.gridSize}px ${theme.texture.gridSize}px`,
          backgroundPosition: `${dx}px ${dy}px`,
        }}
      />

      {/* 4) 颗粒 grain:略快漂移(1.5×)做视差层次 */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          backgroundSize: '180px 180px',
          backgroundPosition: `${dx * 1.5}px ${dy * 1.5}px`,
          opacity: theme.texture.grainOpacity,
          mixBlendMode: 'soft-light',
        }}
      />

      {/* 5) 色温 tint(soft-light,极低不透明度;暖镜头偏橙 / 冷镜头偏蓝) */}
      {tintTone ? (
        <AbsoluteFill
          style={{
            backgroundColor: hexToRgba(TONE_HEX[tintTone], tintStrength),
            mixBlendMode: 'soft-light',
          }}
        />
      ) : null}

      {/* 6) 光斑(屏幕混合点亮本段;色调走 theme.colors,位置/强度逐镜头拧) */}
      {glows.map((g, i) => (
        <AbsoluteFill
          key={i}
          style={{
            backgroundImage: `radial-gradient(circle at ${g.x}% ${g.y}%, ${hexToRgba(
              TONE_HEX[g.tone],
              g.strength ?? 0.32,
            )} 0%, transparent ${g.size ?? 58}%)`,
            mixBlendMode: 'screen',
          }}
        />
      ))}

      {/* 7) 暗角(warm multiply,把视线钉回中心 + 加纵深) */}
      {vignette > 0 ? (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(ellipse at center, transparent 52%, ${hexToRgba(
              theme.darkGlass.bg,
              vignette,
            )} 100%)`,
            mixBlendMode: 'multiply',
          }}
        />
      ) : null}
    </>
  );
};

export default FullBleedBackdrop;
