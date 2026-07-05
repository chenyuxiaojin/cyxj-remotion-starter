/**
 * sceneTag.ts —— 镜头「自描述说明书(SceneTag)」的共享类型,**零依赖纯类型**(同 schema/types.ts)。
 *
 * 一处声明、可多处消费:每个镜头在自己的文件里 co-located 写 `export const xxxTag: SceneTag = {...}`,
 * 一个构建脚本可以把全库 tag 汇总成机器可读目录(给 AI 选镜头 / 给可视化编辑台摆控件 / 给官方 Studio 控件)。
 *   这是「让镜头自我描述」的通用机制;本仓不含配套的编辑台/构建脚本(作者私有沉淀),
 *   你可以按同样机制沉淀自己的目录派生链。
 *
 * 零依赖红线:本文件只能有纯类型 + 纯数据,不引任何运行时库(kit 无 node_modules)。
 * tag 的值必须是【字面量】(Q3「先镜像」:照抄镜头现有默认,别引用外部常量)——
 *   构建脚本靠「读源码文本 + 取对象字面量求值」抽取,引用外部常量会导致抽取失败。
 */

/** 字段控件类型 —— 同时对得上可视化编辑台的控件类型和 Remotion zod 控件 */
export type FieldType =
  | 'text'     // 文本     → 编辑台 'text'    / zod zTextarea
  | 'number'   // 数值     → 编辑台 'number'  / z.number
  | 'boolean'  // 开关     → 编辑台 'boolean' / z.boolean
  | 'enum'     // 固定选项 → 编辑台 'enum'    / z.enum   (必带 values)
  | 'color'    // 颜色     → 编辑台 'text'    / zColor
  | 'asset'    // public 下文件 → 编辑台 'asset' / staticFile (必带 assetRoot)
  | 'list'     // 重复项数组 → 编辑台 'array'  / z.array  (必带 itemFields)
  | 'group';   // 嵌套对象 → 编辑台 'object'  / z.object (必带 fields)

/** 字段暴露层级(Q4 已定:分两级) */
export type FieldTier =
  | 'primary'   // 每条视频都要填的(文字/图/选项)→ 网页台摆明面
  | 'advanced'; // 偶尔才调的(颜色/动效快慢)→ 收起,但仍可调,一个不扔

export interface SceneField {
  key: string;            // 镜头组件的 prop 名(如 'label' / 'provider')
  label: string;          // 人看的中文名
  type: FieldType;
  tier: FieldTier;        // Q4:每条字段必须分级(primary 摆明面 / advanced 收起仍可调)
  required?: boolean;     // 不填镜头就不成立(默认 false)
  default?: unknown;      // 镜头自带的合理默认 —— 填这里=自描述,下游不再硬编码默认
  help?: string;          // 一句话给 AI 看:这字段干嘛、怎么填
  values?: string[];      // type:'enum' 必填
  assetRoot?: string;     // type:'asset' 必填,如 'screenshots/'
  itemFields?: SceneField[]; // type:'list' 必填:每个数组项的字段
  fields?: SceneField[];     // type:'group' 必填:嵌套对象的字段
  keyframeable?: boolean; // 这个值能否在时间轴上打关键帧(默认 false)
  example?: unknown;      // 一个示例值,给 AI 照着填
}

/**
 * 口播位 —— 统一的 6 值口播布局枚举。
 *
 * ⚠️ 注意:poses.ts 的 `center` 姿态是【两用】的——`fullscreen` 和 `audio-only`
 *   都可以映射到 `center` 这一个 pose。所以从 poses 反推 6 值时,按「人出不出镜」区分:
 *     · 人出镜、居中说话铺满屏(如 talk / title)                         → 'fullscreen'
 *     · 全屏图形 / B-roll 盖住人、人不出镜(如 contextsiphon/professionpan/quote) → 'audio-only'
 *   talk 的 TalkScene 只在口播视频上叠一行标签、人全程出镜 → 'fullscreen'。
 */
export type Pose =
  | 'fullscreen'   // 人占满屏、居中说话(poses.center,人出镜)
  | 'card-left' | 'card-right'      // 人缩成左/右圆角卡(poses.cardLeft/cardRight)
  | 'corner-left' | 'corner-right'  // 人缩成角落小卡
  | 'audio-only';  // 只有声音、不出人(全屏盖人大图/母题 多用,poses.center 的另一用法)

/**
 * 目录展示用的自然语言描述(给人/AI 读;这些是镜头自身的编辑性描述,无其它结构化来源)。
 * 对应现手写 shots.json 里的同名字段,让 shots.json 能从说明书 100% 派生、不丢信息。
 */
export interface SceneCatalog {
  narratorPosition?: string;     // 构图位的自然语言版(可比 defaultPose 更细,如带 framing 说明)
  supportingElements?: string[]; // 画面里还有什么(浮卡/列表/数据/截图…;无则 ['无'])
  animation?: string;            // 主要动效一句话(如 '静态' / '依次弹出')
  background?: string;           // 背景一句话(如 '口播视频')
}

export interface SceneTag {
  /* —— 身份 —— */
  id: string;             // 必须 === sceneMap 注册键(闸会校验)
  componentName: string;  // 导出的组件名
  title: string;          // 人看的中文名
  status: 'stable' | 'experimental';

  /* —— 给 AI 选镜头(意图)—— */
  intent: string;         // 一句话:这镜头让观众 get 什么 / 什么视觉动作
  suitableFor: string;    // 什么意图/内容点该用它
  notFor?: string;        // 什么时候别用(防 AI 滥用)
  exampleBeats?: string[];// 1-2 个真实口播节拍示例

  /* —— 构图位 —— */
  form: string;                 // 视觉形态(沿用 shots.json 的 F0/F1/F2…)
  defaultPose: Pose;            // 默认口播姿态(对齐 poses.ts)
  supportedPoses?: Pose[];      // 能配合的口播位(默认 [defaultPose])
  fullscreenOnly?: boolean;     // true=只能全屏盖人(如 context 母题)
  needsExternalAsset: boolean;  // 要不要用户素材(截图/logo)
  assetType?: 'screenshot' | 'logo' | 'image' | 'video' | null;
  assetRoot?: string;           // 素材在 public/ 下哪个目录

  /* —— 文本绑定 —— */
  textBinding?: string;   // 哪个字段默认接口播文本(如 talk → 'label')

  /* —— 可编辑契约(自描述核心)—— */
  fields: SceneField[];

  /* —— 目录展示描述(让 shots.json 全派生,不丢现手写信息)—— */
  catalog?: SceneCatalog;

  /* —— 元 —— */
  tagVersion: 1;
  promotedFrom?: 'promoted' | 'inline';
}
