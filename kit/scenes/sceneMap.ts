/**
 * SCENE_MAP —— 镜头类型字符串 → 内容组件。TalkingHead 据此把每个 scene 渲成图形。
 *
 * 本仓只带 5 个【通用引擎级】基础镜头(点题卡 / 口播标签 / 侧栏列表 / 双卡对比 / 两翼浮卡)。
 * 作者私有的品牌镜头库(几十个成片专用镜头)不在本仓——那是私有沉淀。
 * 你按同样机制沉淀自己的镜头:
 *   1) 在 content.tsx(或新建 scene 文件)写一个受 props 驱动的内容组件(复用 kit 组件,别从零造视觉)
 *   2) 在这里登记一行 type → 组件
 *   3) 如需新姿态,在 poses.ts 的 poseForScene 加一条 type → 姿态名
 *   出片层(props.json)就能用 type 选它,不必改任何渲染逻辑。
 */
import type React from 'react';
import { TitleScene, TalkScene, ListScene, CompareScene, FlankCardsScene } from './content';

export const SCENE_MAP: Record<string, React.FC<any>> = {
  title: TitleScene,           // 左侧竖排关键词卡逐张弹出(人像让到右侧)
  talk: TalkScene,             // 纯口播承接,可选左下角浮一行标签
  list: ListScene,             // 人像缩成一侧卡,对侧逐条蹦出要点列表
  compare: CompareScene,       // 人居中、两侧压暗,左右各一张迷你卡做短对决
  flankcards: FlankCardsScene, // 人居中,左右各竖排放大浮卡(compare 的 N 卡推广)
};
