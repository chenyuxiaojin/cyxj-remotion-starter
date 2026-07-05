/**
 * <SrtCaptions> — 旗舰中文字幕组件(逐字高亮)。
 *
 * 吃修好的 SRT(建议先过一遍字幕修正工具),渲逐字高亮。
 * 接口约定(SOP A4):
 *   - 给 src(public/ 里的 .srt 路径)→ 组件内部 parseSrt;或直接给 captions(已 parse)。
 *   - 样式从 ../theme.ts 取(不内联硬编码)。
 *   - 字体先加载好再渲(中文自托管:由宿主模板的 fonts.ts 负责加载;本组件只用 fontFamily)。
 *   - 与画幅无关,任意尺寸可用(含 4:3 等非 16:9 画幅)。
 *
 * 高亮公式(SOP A4 / MOTION_NOTES §2):
 *   absoluteTimeMs = page.startMs + (frameInSequence / fps) * 1000
 *   isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs
 *
 * ⚠️ 待验证(装好 remotion-dev/skills / @remotion/mcp 后核一遍):
 *   - delayRender/continueRender 为加载 SRT 的标准异步模式;若官方推荐 useDelayRender hook,可替换。
 *   - fitText 自动缩放为可选增强(底部 TODO);首版用 maxWidth + 固定字号,够稳。
 */
import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createTikTokStyleCaptions,
  parseSrt,
  type Caption,
} from '@remotion/captions';
import { theme } from '../theme';
import type { Look } from './types';

export type SrtCaptionsProps = {
  /** public/ 里的 .srt 路径,如 'captions/news.srt'。与 captions 二选一。 */
  src?: string;
  /** 已 parse 好的 Caption[]。与 src 二选一(给了它就不再 fetch)。 */
  captions?: Caption[];
  /** createTikTokStyleCaptions 的合并阈值。中文建议调大(默认 1000ms,按词组成块)。 */
  combineMs?: number;
  /** 品牌 look,决定颜色(默认 darkGlass) */
  look?: Look;
  /** 距底部像素(默认 90) */
  bottomPx?: number;
  /** 字号像素(默认 56);宿主可按画幅覆盖 */
  fontSizePx?: number;
  /** 字体族(默认走 theme.fonts.zh)。字体加载由宿主 fonts.ts 负责。 */
  fontFamily?: string;
  /** 字幕条最大宽度百分比(默认 86,留边) */
  maxWidthPct?: number;
};

/** 把 look 映射到颜色:未读词 / 当前词 / 描边 */
const looksColors = (look: Look) => {
  if (look === 'warmPaper') {
    return {
      idle: theme.warmPaper.ink,
      active: theme.warmPaper.accent,
      stroke: 'rgba(247,242,234,0.9)', // 暖底上用浅描边
    };
  }
  return {
    idle: theme.darkGlass.onDark,
    active: theme.darkGlass.accent,
    stroke: 'rgba(0,0,0,0.55)', // 暗底/压画面上用深描边
  };
};

export const SrtCaptions: React.FC<SrtCaptionsProps> = ({
  src,
  captions: captionsProp,
  combineMs = 1000,
  look = 'darkGlass',
  bottomPx = 90,
  fontSizePx = 56,
  fontFamily,
  maxWidthPct = 86,
}) => {
  const { fps } = useVideoConfig();
  const [captions, setCaptions] = useState<Caption[] | null>(
    captionsProp ?? null,
  );
  // 只有走 src 异步加载时才挡渲染
  const [handle] = useState<number | null>(() =>
    captionsProp || !src ? null : delayRender('加载 SRT 字幕'),
  );

  useEffect(() => {
    if (captionsProp || !src || handle === null) return;
    let cancelled = false;
    fetch(staticFile(src))
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const { captions: parsed } = parseSrt({ input: text });
        setCaptions(parsed);
        continueRender(handle);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('SrtCaptions: 读取/解析 SRT 失败', src, err);
        cancelRender(err); // 抛错并中断渲染(返回 never,故放最后)
      });
    return () => {
      cancelled = true;
    };
  }, [src, captionsProp, handle]);

  if (!captions) return null;

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: combineMs,
  });

  return (
    <AbsoluteFill>
      {pages.map((page, i) => (
        <Sequence
          key={i}
          from={Math.round((page.startMs / 1000) * fps)}
          durationInFrames={Math.max(
            1,
            Math.ceil((page.durationMs / 1000) * fps),
          )}
          layout="none"
        >
          <CaptionPage
            page={page}
            look={look}
            bottomPx={bottomPx}
            fontSizePx={fontSizePx}
            fontFamily={fontFamily ?? theme.fonts.zh}
            maxWidthPct={maxWidthPct}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** 单页字幕。Sequence 内 useCurrentFrame() 从 0 起 → 还原绝对毫秒判断高亮。 */
const CaptionPage: React.FC<{
  page: ReturnType<typeof createTikTokStyleCaptions>['pages'][number];
  look: Look;
  bottomPx: number;
  fontSizePx: number;
  fontFamily: string;
  maxWidthPct: number;
}> = ({ page, look, bottomPx, fontSizePx, fontFamily, maxWidthPct }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = looksColors(look);
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: bottomPx,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: `${maxWidthPct}%`,
          textAlign: 'center',
          fontFamily,
          fontSize: fontSizePx,
          fontWeight: 700,
          lineHeight: 1.25,
          whiteSpace: 'pre', // 必须:保住词的前导空格,词不粘连(SOP A2)
          WebkitTextStroke: `6px ${colors.stroke}`,
          paintOrder: 'stroke', // 先描边再画字,字不被吃掉
        }}
      >
        {page.tokens.map((token, ti) => {
          const isActive =
            token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span
              key={ti}
              style={{ color: isActive ? colors.active : colors.idle }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default SrtCaptions;

/*
 * TODO(增强,装好官方 skill 后做):
 * fitText/measureText(@remotion/layout-utils)按容器宽自动缩放变长中文行,替代固定 fontSizePx。
 * 注意:测量参数必须 = 渲染参数,且字体加载完再测(SOP A5)。
 */
