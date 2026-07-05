/**
 * 组件库共享类型。
 * 真源:样式 token 在 ../theme.ts(占位色板,换成你自己的品牌色)。
 */
// 注:Caption 类型不在此再导出（它来自 @remotion/captions）。
// 只用 Look 的轻量消费者（如 GlassCards）import 本文件时，不应被动拖入 @remotion/captions 依赖。
// Caption 的 barrel 再导出改到 index.ts 直接从官方源取（见 index.ts）。

/** 两套品牌 look(对应 theme.warmPaper / theme.darkGlass) */
export type Look = 'warmPaper' | 'darkGlass';
