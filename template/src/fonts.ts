/**
 * fonts.ts — 中文主字体 Noto Sans SC 自托管(镜头库卡片用 700/800)。
 * index.ts 顶层 import 触发加载;delayRender 兜住,渲染前等字体到位(避免开头闪字体)。
 * woff2 文件放在 public/fonts/(已随模板附带)。需要更多字族时照此扩展(loadFont 一条一条加)。
 */
import { loadFont } from '@remotion/fonts';
import { staticFile, delayRender, continueRender } from 'remotion';

const handle = delayRender('Loading Noto Sans SC (700/800) + Space Mono (400/700)');
Promise.all([
  loadFont({ family: 'Noto Sans SC', url: staticFile('fonts/NotoSansSC-sc-700.woff2'), weight: '700' }),
  loadFont({ family: 'Noto Sans SC', url: staticFile('fonts/NotoSansSC-latin-700.woff2'), weight: '700' }),
  loadFont({ family: 'Noto Sans SC', url: staticFile('fonts/NotoSansSC-sc-800.woff2'), weight: '800' }),
  loadFont({ family: 'Noto Sans SC', url: staticFile('fonts/NotoSansSC-latin-800.woff2'), weight: '800' }),
  // Space Mono(等宽 Latin)—— theme.fonts.mono 指定;终端/计数器/时间轴标签的等宽质感。
  // 不加载会静默 fallback 到 Noto 非等宽(MOTION_NOTES §4 / ai-5 战疤);CJK 仍靠栈尾 Noto 兜底不豆腐。
  loadFont({ family: 'Space Mono', url: staticFile('fonts/SpaceMono-latin-400.woff2'), weight: '400' }),
  loadFont({ family: 'Space Mono', url: staticFile('fonts/SpaceMono-latin-700.woff2'), weight: '700' }),
])
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
