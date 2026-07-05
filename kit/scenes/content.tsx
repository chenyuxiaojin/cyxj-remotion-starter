/**
 * 镜头内容组件(content scenes)—— 复用 kit 卡片,只管「人像让出那侧」的图形。
 *
 * 约定:这些组件被 TalkingHead 套在 <Sequence from=镜头起点> 里渲染,所以它们内部
 *   useCurrentFrame() 是【本地帧】(从镜头自己第 0 帧算)。因此 props 里的 appearAtSec
 *   是【相对本镜头起点】的秒数 —— 镜头可移动、可复用,不需要知道自己在整片的绝对位置。
 *
 * 运镜(人像缩放/平移/让边)不在这里:由 SpeakerTrack + poses 统一控制,scene 只声明
 *   自己是哪种 type(poses.poseForScene 据此决定主体姿态)。
 */
import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  FloatingCard,
  SideList,
  Compare,
  type FloatingCardSweep,
  type GlassItemTimed,
} from '../components/GlassCards';
import { EditableElement, useElementOverride } from '../components/EditableElement';
import { theme } from '../theme';
import type { SceneTag } from '../schema/sceneTag';

const FONT = `${theme.fonts.zh},'Inter',sans-serif`;

/** 带相对出现时机的文案项 */
export type TimedItem = {
  title: string;
  highlight?: boolean;
  muted?: boolean;
  /** 相对本镜头起点的出现秒数(默认 0=镜头一开始就在) */
  appearAtSec?: number;
  /** 可选:对本卡 title 内某子串做荧光笔扫亮(透传给对应 FloatingCard;高潮卡点睛用) */
  sweepHighlight?: FloatingCardSweep;
};

const TITLE_DEMOTE_OPACITY = 0.62; // demoteOnNext:被后卡顶下去后压到的透明度
const TITLE_DEMOTE_SCALE = 0.97; // demoteOnNext:降权后的缩放
const TITLE_DEMOTE_FADE_SEC = 0.4; // 降权过渡时长
const TITLE_ARROW_PULSE_SEC = 0.3; // 连接箭头脉冲淡入时长

/**
 * 卡间连接箭头(→):本卡出现时,在它与上一张之间脉冲淡入(0.3s),把演化链可视化。
 * 纯 interpolate 带 clamp;蓝色(命名/链路语义);0 高度,夹在两卡之间不撑开布局。
 */
const TitleConnector: React.FC<{ appearAtFrames: number }> = ({ appearAtFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearAtFrames;
  const pulseFrames = Math.round(TITLE_ARROW_PULSE_SEC * fps);
  const opacity = interpolate(local, [0, pulseFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 轻微从上滑入,做出"接上来"的手感
  const dy = interpolate(local, [0, pulseFrames], [-8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        height: 0,
        marginLeft: 30,
        display: 'flex',
        alignItems: 'center',
        opacity,
        transform: `translateY(${dy}px)`,
        fontSize: 34,
        fontWeight: 800,
        lineHeight: 1,
        color: theme.colors.blue,
      }}
    >
      ↓
    </div>
  );
};

/**
 * 单张点题卡的容器:负责 demoteOnNext 的降权(被后卡顶下去后 opacity/scale 渐降)。
 * demoteOnNext 关闭时这层是恒等透明包裹,不改任何视觉(行为 100% 不变)。
 */
const TitleCardRow: React.FC<{
  card: TimedItem;
  appearAtFrames: number;
  /** 后一张卡的出现帧(无后卡=本卡是最新→不降权)。undefined=没有后卡。 */
  nextAppearAtFrames?: number;
  demoteOnNext: boolean;
  /** 卡尺寸覆盖(不传 = FloatingCard 默认小卡;放大/中等卡传值) */
  fontSizePx?: number;
  paddingPx?: string;
  minWidthPx?: number;
  radiusPx?: number;
  /** 元素级调色:本卡的 EditableElement id(读 override.color → FloatingCard 标题色) */
  elementId?: string;
}> = ({
  card,
  appearAtFrames,
  nextAppearAtFrames,
  demoteOnNext,
  fontSizePx,
  paddingPx,
  minWidthPx,
  radiusPx,
  elementId,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elementColor = useElementOverride(elementId ?? '').color;

  let demote = 1; // 1=未降权,0=完全降权
  if (demoteOnNext && nextAppearAtFrames !== undefined) {
    const fadeFrames = Math.round(TITLE_DEMOTE_FADE_SEC * fps);
    demote = interpolate(
      frame,
      [nextAppearAtFrames, nextAppearAtFrames + fadeFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }
  const opacity = interpolate(demote, [0, 1], [TITLE_DEMOTE_OPACITY, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(demote, [0, 1], [TITLE_DEMOTE_SCALE, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'left center',
      }}
    >
      <FloatingCard
        item={{ title: card.title, highlight: card.highlight, muted: card.muted }}
        appearAtFrames={appearAtFrames}
        gapPx={22}
        fontFamily={FONT}
        fontSizePx={fontSizePx}
        paddingPx={paddingPx}
        minWidthPx={minWidthPx}
        radiusPx={radiusPx}
        sweepHighlight={card.sweepHighlight}
        titleColorOverride={elementColor}
      />
    </div>
  );
};

/**
 * 点题:左侧关键词大卡(人像滑到右侧让位)。
 *
 * 可选能力(都默认关,关时行为与旧版 100% 一致):
 *   - demoteOnNext:后一张卡出现时,前面已出现的卡降权(opacity~0.62 / scale~0.97),焦点聚到最新卡。
 *   - connector='arrow':每张新卡弹入时,与上一张之间脉冲淡入一个 ↓(蓝),把演化链可视化。
 *   - card.sweepHighlight:对该卡 title 内子串做荧光笔扫亮(透传给 FloatingCard)。
 */
export const TitleScene: React.FC<{
  cards: TimedItem[];
  demoteOnNext?: boolean;
  connector?: 'arrow';
  /** 卡之间竖向间距像素(默认 26;要"卡留间距"传更大值如 38) */
  columnGapPx?: number;
  /** 卡尺寸覆盖(不传 = 默认小卡;中等/放大卡传值,透传给每张 FloatingCard) */
  fontSizePx?: number;
  paddingPx?: string;
  minWidthPx?: number;
  radiusPx?: number;
  /** 人物更靠右(给左侧卡腾更大空间);仅被 poseForScene 读取决定姿态,组件本身不渲染它 */
  pushRight?: boolean;
  /** 卡列整体的左边距百分比(默认 5;要把卡列往右挪贴近人物就调大,如 14) */
  leftPct?: number;
  /**
   * 左侧压暗层:人右推后左边露视频切口时,铺一层「左暗→贴人物侧透明」的渐变盖住。
   * 不传 = 关(不影响其它 title 用法)。传对象开启,可调:
   *   - leftAlpha:最左边黑色不透明度 0–1(默认 0.7;= 透明度 30%。越大越黑)
   *   - fadeEndPct:渐变到「完全透明」的横向百分比(默认 64;= 贴人物侧透明度 100%,别盖到人脸)
   */
  leftScrim?: { leftAlpha?: number; fadeEndPct?: number };
}> = ({
  cards,
  demoteOnNext = false,
  connector,
  columnGapPx = 26,
  fontSizePx,
  paddingPx,
  minWidthPx,
  radiusPx,
  leftPct = 5,
  leftScrim,
}) => {
  const { fps } = useVideoConfig();
  const appearFrames = cards.map((c) => Math.round((c.appearAtSec ?? 0) * fps));
  return (
    <>
      {leftScrim ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, rgba(0,0,0,${leftScrim.leftAlpha ?? 0.7}) 0%, rgba(0,0,0,0) ${leftScrim.fadeEndPct ?? 64}%)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: columnGapPx,
        }}
      >
        {cards.map((c, i) => (
          <React.Fragment key={i}>
            {connector === 'arrow' && i > 0 ? (
              <TitleConnector appearAtFrames={appearFrames[i]} />
            ) : null}
            {/* 元素级编辑:覆盖包在降权/入场动画之外(索引式 id,AI 重排后错位可接受);
                colorable:调色经 elementId 读 override.color → FloatingCard 标题色采纳点 */}
            <EditableElement id={`card-${i}`} label={`卡 ${i + 1}`} colorable>
              <TitleCardRow
                card={c}
                appearAtFrames={appearFrames[i]}
                nextAppearAtFrames={i < cards.length - 1 ? appearFrames[i + 1] : undefined}
                demoteOnNext={demoteOnNext}
                fontSizePx={fontSizePx}
                paddingPx={paddingPx}
                minWidthPx={minWidthPx}
                radiusPx={radiusPx}
                elementId={`card-${i}`}
              />
            </EditableElement>
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

/**
 * 镜头说明书(SceneTag)—— 见 ../schema/sceneTag.ts。与 TitleScene co-located(Q3「先镜像」)。
 */
export const titleTag: SceneTag = {
  id: 'title',
  componentName: 'TitleScene',
  title: '点题关键词卡',
  status: 'stable',
  intent: '左侧竖排关键词大卡逐张弹出(人像让到右侧),把一句一个词串成命名链/观点链',
  suitableFor: '一句话一个关键词，逐步建立命名或观点链。',
  notFor: '需要图/数据/截图,或只有一句话、串不成链的段落',
  exampleBeats: ['先叫它「记忆」,再叫它「上下文」,最后收成「第二大脑」', '第一步、第二步、第三步逐个点出'],
  form: 'F2',
  defaultPose: 'fullscreen',
  needsExternalAsset: false,
  assetType: null,
  textBinding: 'cards',
  fields: [
    {
      key: 'cards',
      label: '关键词卡',
      type: 'list',
      tier: 'primary',
      required: true,
      help: '左侧竖排的关键词卡,每行一张,按 appearAtSec 逐张弹出;默认接口播文本(每行一句)',
      itemFields: [
        { key: 'title', label: '卡片文字', type: 'text', tier: 'primary', required: true, help: '这张卡上的关键词' },
        { key: 'highlight', label: '重点卡', type: 'boolean', tier: 'primary', help: '设为重点则高亮这张(演化链落点常设最后一张)' },
        { key: 'appearAtSec', label: '出现秒', type: 'number', tier: 'advanced', help: '相对本镜头起点的出现秒数,跟口播说到这个词的时机' },
        { key: 'muted', label: '弱化', type: 'boolean', tier: 'advanced', help: '压暗这张(次要项)' },
        {
          key: 'sweepHighlight', label: '荧光笔扫亮', type: 'group', tier: 'advanced',
          help: '对卡内某段字做荧光笔扫亮(点睛用)',
          fields: [
            { key: 'text', label: '扫亮子串', type: 'text', tier: 'advanced', help: '卡片文字里要被扫亮的那一段' },
            { key: 'tone', label: '颜色', type: 'enum', tier: 'advanced', values: ['orange', 'blue'], help: '扫亮色' },
          ],
        },
      ],
    },
    { key: 'demoteOnNext', label: '后卡降权', type: 'boolean', tier: 'advanced', default: false, help: '新卡出现时把前面已出的卡压暗缩小,焦点聚到最新卡' },
    { key: 'connector', label: '连接箭头', type: 'enum', tier: 'advanced', values: ['arrow'], help: '每张新卡与上一张之间脉冲淡入一个 ↓,把演化链可视化' },
    { key: 'columnGapPx', label: '卡间距', type: 'number', tier: 'advanced', default: 26, help: '卡与卡的竖向间距像素' },
    { key: 'fontSizePx', label: '卡字号', type: 'number', tier: 'advanced', help: '卡字号像素(不传=默认小卡)' },
    { key: 'paddingPx', label: '卡内边距', type: 'text', tier: 'advanced', help: "卡内边距,CSS 写法如 '20px 30px'" },
    { key: 'minWidthPx', label: '卡最小宽', type: 'number', tier: 'advanced', help: '卡最小宽度像素' },
    { key: 'radiusPx', label: '卡圆角', type: 'number', tier: 'advanced', help: '卡圆角像素' },
    { key: 'pushRight', label: '人更靠右', type: 'boolean', tier: 'advanced', help: '人像更靠右,给左侧卡腾更大空间(仅决定姿态,组件不渲染它)' },
    { key: 'leftPct', label: '卡列左边距%', type: 'number', tier: 'advanced', default: 5, help: '卡列整体的左边距百分比,调大把卡列往右挪贴近人物' },
    {
      key: 'leftScrim', label: '左侧压暗层', type: 'group', tier: 'advanced',
      help: '人右推后左边露视频切口时,铺一层左暗→贴人物侧透明的渐变盖住(不传=关)',
      fields: [
        { key: 'leftAlpha', label: '最左黑度', type: 'number', tier: 'advanced', default: 0.7, help: '最左边黑色不透明度 0–1' },
        { key: 'fadeEndPct', label: '渐变到透明%', type: 'number', tier: 'advanced', default: 64, help: '渐变到完全透明的横向百分比(别盖到人脸)' },
      ],
    },
  ],
  catalog: {
    narratorPosition: '全屏偏右或更右让左侧空间',
    supportingElements: ['浮卡', '关键词'],
    animation: '依次弹出/飞入，可选箭头连接和荧光笔扫亮',
    background: '口播视频 + 左侧压暗渐变/暗玻璃卡',
  },
  tagVersion: 1,
  promotedFrom: 'promoted',
};

/** 观点留白:人像居中,可选左下小标(纯留白则 label 省略)。 */
export const TalkScene: React.FC<{ label?: string }> = ({ label }) => {
  if (!label) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '6%',
        bottom: '16%',
        fontFamily: FONT,
        fontSize: 46,
        fontWeight: 700,
        color: '#fff',
        padding: '18px 36px',
        borderRadius: 18,
        background: 'rgba(12,14,20,0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {label}
    </div>
  );
};

/**
 * 镜头说明书(SceneTag)—— 见 ../schema/sceneTag.ts。
 * 与 TalkScene 同文件 co-located(Q3「先镜像」:照抄镜头现有默认,改组件时一眼看到这张卡)。
 */
export const talkTag: SceneTag = {
  id: 'talk',
  componentName: 'TalkScene',
  title: '口播标签',
  status: 'stable',
  intent: '口播画面左下角浮一行玻璃字幕,点出当前在讲什么(留空则纯留白、只出人)',
  suitableFor: '纯口播承接观点，给观众看人和语气。',
  notFor: '需要主视觉/数据/截图的段落',
  form: 'F1',
  defaultPose: 'fullscreen',
  supportedPoses: ['fullscreen', 'card-left', 'card-right', 'corner-left', 'corner-right'],
  needsExternalAsset: false,
  assetType: null,
  textBinding: 'label',
  fields: [
    {
      key: 'label',
      label: '标签文字',
      type: 'text',
      tier: 'primary',
      default: '',
      help: '左下角那行玻璃字,默认接口播文本;留空则该镜头纯留白、只出人',
    },
  ],
  catalog: {
    narratorPosition: '全屏居中，可通过 framing 做 wide/push',
    supportingElements: ['无'],
    animation: '静态',
    background: '口播视频',
  },
  tagVersion: 1,
  promotedFrom: 'inline',
};

/** 列要点:人像缩成卡,对侧逐条蹦出列表(每条相对 appearAtSec)。 */
export const ListScene: React.FC<{
  items: TimedItem[];
  portraitSide?: 'left' | 'right';
  heading?: string;
  /** 小标题字号像素(默认走 SideList 的 36;要更突出传更大值,如 64) */
  headingSizePx?: number;
  /** 列表项字号像素(默认走 SideList 的 32;要更大传更大值,如 52) */
  fontSizePx?: number;
  /** 列表区宽度百分比(默认走 SideList 的 42;人物缩小后可加宽,如 50) */
  widthPct?: number;
  /** 人物缩成更小的卡(仅被 poseForScene 读取决定姿态,组件本身不渲染它) */
  portraitSmall?: boolean;
}> = ({ items, portraitSide = 'right', heading, headingSizePx, fontSizePx, widthPct }) => {
  const list: GlassItemTimed[] = items.map((it) => ({
    title: it.title,
    highlight: it.highlight,
    muted: it.muted,
    appearAt: it.appearAtSec ?? 0,
  }));
  return (
    <SideList
      items={list}
      portraitSide={portraitSide}
      heading={heading}
      headingSizePx={headingSizePx}
      fontSizePx={fontSizePx}
      widthPct={widthPct}
      fontFamily={FONT}
    />
  );
};

/**
 * 镜头说明书(SceneTag)—— 见 ../schema/sceneTag.ts。与 ListScene co-located(Q3「先镜像」)。
 */
export const listTag: SceneTag = {
  id: 'list',
  componentName: 'ListScene',
  title: '侧栏要点列表',
  status: 'stable',
  intent: '人像缩成一侧圆角卡,对侧逐条蹦出要点列表(每条相对 appearAtSec)',
  suitableFor: '口播逐条拆解步骤、优缺点或行动清单。',
  notFor: '只有一两句、不成清单,或需要图/数据/截图的段落',
  exampleBeats: ['做这件事分三步:先……再……最后……', '它的三个好处:快、准、省'],
  form: 'F3',
  defaultPose: 'card-right',
  supportedPoses: ['card-right', 'card-left'],
  needsExternalAsset: false,
  assetType: null,
  textBinding: 'items',
  fields: [
    {
      key: 'items',
      label: '列表项',
      type: 'list',
      tier: 'primary',
      required: true,
      help: '逐条蹦出的要点,每行一条;默认接口播文本(超过 2 行时第一行自动当小标题)',
      itemFields: [
        { key: 'title', label: '这一条文字', type: 'text', tier: 'primary', required: true, help: '这一条要点的文字' },
        { key: 'highlight', label: '重点条', type: 'boolean', tier: 'primary', help: '设为重点则高亮这一条(清单落点常设最后一条)' },
        { key: 'appearAtSec', label: '出现秒', type: 'number', tier: 'advanced', help: '相对本镜头起点的出现秒数,跟口播念到这条的时机' },
        { key: 'muted', label: '弱化', type: 'boolean', tier: 'advanced', help: '压暗这一条(次要项)' },
        {
          key: 'sweepHighlight', label: '荧光笔扫亮', type: 'group', tier: 'advanced',
          help: '对条内某段字做荧光笔扫亮',
          fields: [
            { key: 'text', label: '扫亮子串', type: 'text', tier: 'advanced', help: '文字里要被扫亮的那一段' },
            { key: 'tone', label: '颜色', type: 'enum', tier: 'advanced', values: ['orange', 'blue'], help: '扫亮色' },
          ],
        },
      ],
    },
    { key: 'heading', label: '小标题', type: 'text', tier: 'primary', help: '列表上方的小标题(可空)' },
    { key: 'portraitSide', label: '人像在哪侧', type: 'enum', tier: 'advanced', values: ['left', 'right'], default: 'right', help: '人像缩成哪一侧的卡,列表放对侧' },
    { key: 'headingSizePx', label: '小标题字号', type: 'number', tier: 'advanced', help: '小标题字号像素(不传=默认 36)' },
    { key: 'fontSizePx', label: '列表项字号', type: 'number', tier: 'advanced', help: '列表项字号像素(不传=默认 32)' },
    { key: 'widthPct', label: '列表区宽%', type: 'number', tier: 'advanced', help: '列表区宽度百分比(不传=默认 42;人物缩小后可加宽)' },
    { key: 'portraitSmall', label: '人像更小', type: 'boolean', tier: 'advanced', help: '人物缩成更小的卡,把更多空间让给放大的列表(仅决定姿态,组件不渲染它)' },
  ],
  catalog: {
    narratorPosition: '左/右侧圆角卡片，默认右侧',
    supportingElements: ['列表'],
    animation: '依次弹出',
    background: 'CreamDriftBackdrop + 暗玻璃或暖纸列表',
  },
  tagVersion: 1,
  promotedFrom: 'promoted',
};

/** 双卡对比:人居中,两侧各一张迷你卡(工程2/工程1 对决)。复用 kit 的 <Compare>。 */
export const CompareScene: React.FC<{
  left: { title: string };
  right: { title: string };
}> = ({ left, right }) => (
  <Compare
    left={{ title: left.title }}
    right={{ title: right.title }}
    appearAtFrames={0}
    look="darkGlass"
    fontFamily={FONT}
  />
);

/**
 * 镜头说明书(SceneTag)—— 见 ../schema/sceneTag.ts。与 CompareScene co-located(Q3「先镜像」)。
 * 注:CompareScene 无单一文本入口(自动配镜头时可把整段文本首行灌 left.title、次行灌 right.title),
 *   故整个省略 textBinding(见 sceneTag.ts 说明)。
 */
export const compareTag: SceneTag = {
  id: 'compare',
  componentName: 'CompareScene',
  title: '双卡对比',
  status: 'stable',
  intent: '人居中、两侧压暗,左右各一张迷你卡飞入,做两个概念/工具/立场的短对决',
  suitableFor: '左右两个概念、工具或立场的短对比。',
  notFor: '超过两项的并列(用 flankcards),或需要数据/截图撑证据的对比',
  exampleBeats: ['一边是 HyperFrames,一边是 Remotion', '手动 vs 自动,你选哪个'],
  form: 'F2',
  defaultPose: 'fullscreen',
  needsExternalAsset: false,
  assetType: null,
  fields: [
    {
      key: 'left', label: '左卡', type: 'group', tier: 'primary', required: true,
      help: '左侧迷你卡',
      fields: [
        { key: 'title', label: '左卡文字', type: 'text', tier: 'primary', required: true, help: '左侧那个概念/工具名(默认接口播文本第一行)' },
      ],
    },
    {
      key: 'right', label: '右卡', type: 'group', tier: 'primary', required: true,
      help: '右侧迷你卡',
      fields: [
        { key: 'title', label: '右卡文字', type: 'text', tier: 'primary', required: true, help: '右侧那个概念/工具名(默认接口播文本第二行)' },
      ],
    },
  ],
  catalog: {
    narratorPosition: '全屏居中，两侧压暗',
    supportingElements: ['浮卡', '关键词'],
    animation: '飞入',
    background: '口播视频 + 双侧暗化 + 暗玻璃迷你卡',
  },
  tagVersion: 1,
  promotedFrom: 'promoted',
};

/**
 * 两翼浮卡(flankcards):人居中(pose=compare,两侧压暗),左右各一竖排放大 <FloatingCard>,
 * 左侧从左滑入 / 右侧从右滑入,逐张按 appearAtSec 蹦出。
 *
 * 用途:"人居中两侧列举"——是 <Compare>(两侧各 1 张迷你卡)的推广:每边可放 N 张横向关键词大卡。
 * 卡比单侧 title 大(默认放大档,可被 props 覆盖)。横向卡(FloatingCard),非 Compare 的竖向迷你卡。
 */
export const FlankCardsScene: React.FC<{
  left: TimedItem[];
  right: TimedItem[];
  /** 卡标题字号像素(默认 80=放大档,约单侧 title 的两倍) */
  fontSizePx?: number;
  /** 卡内边距(默认 '40px 50px'=放大档) */
  paddingPx?: string;
  /** 卡最小宽度像素(默认 460) */
  minWidthPx?: number;
  /** 卡圆角像素(默认 30) */
  radiusPx?: number;
  /** 同列上下卡间距像素(默认 40) */
  gapPx?: number;
  /** 距画面左右边内缩百分比(默认 5) */
  edgeInsetPct?: number;
}> = ({
  left,
  right,
  fontSizePx = 80,
  paddingPx = '40px 50px',
  minWidthPx = 460,
  radiusPx = 30,
  gapPx = 40,
  edgeInsetPct = 5,
}) => {
  const { fps } = useVideoConfig();
  const column = (items: TimedItem[], side: 'left' | 'right') => (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        [side]: `${edgeInsetPct}%`,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: gapPx,
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
      }}
    >
      {items.map((c, i) => (
        <FloatingCard
          key={i}
          item={{ title: c.title, highlight: c.highlight, muted: c.muted }}
          appearAtFrames={Math.round((c.appearAtSec ?? 0) * fps)}
          slideFrom={side === 'left' ? -1 : 1}
          fontSizePx={fontSizePx}
          paddingPx={paddingPx}
          minWidthPx={minWidthPx}
          radiusPx={radiusPx}
          fontFamily={FONT}
          sweepHighlight={c.sweepHighlight}
        />
      ))}
    </div>
  );
  return (
    <>
      {column(left, 'left')}
      {column(right, 'right')}
    </>
  );
};

/**
 * 镜头说明书(SceneTag)—— 见 ../schema/sceneTag.ts。与 FlankCardsScene co-located(Q3「先镜像」)。
 * 注:FlankCardsScene 无单一文本入口(自动配镜头时可把整段文本按行对半切进 left[]/right[] 兜底),
 *   故整个省略 textBinding。left/right 的卡尺寸默认按【组件源码】镜像(fontSizePx 80 等),
 */
export const flankcardsTag: SceneTag = {
  id: 'flankcards',
  componentName: 'FlankCardsScene',
  title: '两翼浮卡',
  status: 'stable',
  intent: '人居中、两侧压暗,左右各一竖排放大浮卡,逐张从两侧滑入(compare 的 N 卡推广)',
  suitableFor: '口播居中时，两侧同时列举多项关键词。',
  notFor: '只有两项的短对比(用 compare),或单侧成链的关键词(用 title)',
  exampleBeats: ['左边这些能力,右边这些场景', '一口气两侧铺开六个关键词'],
  form: 'F2',
  defaultPose: 'fullscreen',
  needsExternalAsset: false,
  assetType: null,
  fields: [
    {
      key: 'left',
      label: '左侧卡组',
      type: 'list',
      tier: 'primary',
      required: true,
      help: '左侧竖排的放大浮卡,从左滑入,按 appearAtSec 逐张蹦出',
      itemFields: [
        { key: 'title', label: '卡片文字', type: 'text', tier: 'primary', required: true, help: '这张卡上的关键词' },
        { key: 'highlight', label: '重点卡', type: 'boolean', tier: 'primary', help: '高亮这张' },
        { key: 'appearAtSec', label: '出现秒', type: 'number', tier: 'advanced', help: '相对本镜头起点的出现秒数' },
        { key: 'muted', label: '弱化', type: 'boolean', tier: 'advanced', help: '压暗这张' },
        {
          key: 'sweepHighlight', label: '荧光笔扫亮', type: 'group', tier: 'advanced',
          help: '对卡内某段字做荧光笔扫亮',
          fields: [
            { key: 'text', label: '扫亮子串', type: 'text', tier: 'advanced', help: '要被扫亮的那一段' },
            { key: 'tone', label: '颜色', type: 'enum', tier: 'advanced', values: ['orange', 'blue'], help: '扫亮色' },
          ],
        },
      ],
    },
    {
      key: 'right',
      label: '右侧卡组',
      type: 'list',
      tier: 'primary',
      required: true,
      help: '右侧竖排的放大浮卡,从右滑入,按 appearAtSec 逐张蹦出',
      itemFields: [
        { key: 'title', label: '卡片文字', type: 'text', tier: 'primary', required: true, help: '这张卡上的关键词' },
        { key: 'highlight', label: '重点卡', type: 'boolean', tier: 'primary', help: '高亮这张' },
        { key: 'appearAtSec', label: '出现秒', type: 'number', tier: 'advanced', help: '相对本镜头起点的出现秒数' },
        { key: 'muted', label: '弱化', type: 'boolean', tier: 'advanced', help: '压暗这张' },
        {
          key: 'sweepHighlight', label: '荧光笔扫亮', type: 'group', tier: 'advanced',
          help: '对卡内某段字做荧光笔扫亮',
          fields: [
            { key: 'text', label: '扫亮子串', type: 'text', tier: 'advanced', help: '要被扫亮的那一段' },
            { key: 'tone', label: '颜色', type: 'enum', tier: 'advanced', values: ['orange', 'blue'], help: '扫亮色' },
          ],
        },
      ],
    },
    { key: 'fontSizePx', label: '卡标题字号', type: 'number', tier: 'advanced', default: 80, help: '卡标题字号像素(默认 80=放大档,约单侧 title 的两倍)' },
    { key: 'paddingPx', label: '卡内边距', type: 'text', tier: 'advanced', default: '40px 50px', help: '卡内边距(默认 40px 50px=放大档)' },
    { key: 'minWidthPx', label: '卡最小宽', type: 'number', tier: 'advanced', default: 460, help: '卡最小宽度像素' },
    { key: 'radiusPx', label: '卡圆角', type: 'number', tier: 'advanced', default: 30, help: '卡圆角像素' },
    { key: 'gapPx', label: '同列卡间距', type: 'number', tier: 'advanced', default: 40, help: '同列上下卡间距像素' },
    { key: 'edgeInsetPct', label: '距边内缩%', type: 'number', tier: 'advanced', default: 5, help: '距画面左右边内缩百分比' },
  ],
  catalog: {
    narratorPosition: '全屏居中，两侧压暗',
    supportingElements: ['浮卡', '关键词'],
    animation: '依次弹出/飞入',
    background: '口播视频 + 双侧放大浮卡',
  },
  tagVersion: 1,
  promotedFrom: 'promoted',
};
