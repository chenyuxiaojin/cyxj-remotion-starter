/**
 * EditableElement.tsx — 元素级画布编辑的 L1 机制核心。
 *
 * 出片工程(L2)的工作台要做「点画布上的元素 → 拖位置 / 缩放 / 改色」,
 * 覆盖值由宿主(渲染器)以 props 传入(如 shotParams.elements.<elementId>)。本文件提供三件东西:
 *
 *   - <ElementOverridesProvider value={shotParams.elements}> —— 宿主渲染器在每段
 *     内容外提供(值经 normalizeElementOverrides 宽进严出钳制);
 *   - <EditableElement id label colorable> —— 镜头作者把"用户可能想单独调的元素"
 *     包一层、起个名。挂 data-* 属性供画布 DOM 发现,
 *     并应用几何覆盖(translate/scale/opacity);
 *   - useElementOverride(id) —— 颜色采纳点用:`color: ov.color ?? theme 默认 token`。
 *     颜色不能靠 CSS 继承(镜头文字几乎都显式设色),所以几何由包裹层管、
 *     颜色由组件在采纳点显式采纳,token 仍是默认值(HARD_RULES ③-3 色纪律不破)。
 *
 * 包装纪律(同 motion.tsx):EditableElement 渲一个 block div,只管 transform/opacity;
 *   **定位样式(absolute/flex 子项)放外层**,绝对定位元素在定位 div 内侧包。
 *
 * 叠加次序契约(外→内):
 *   段级静态 transform → 段级关键帧 → scene 布局定位 → 【本组件:元素覆盖
 *   translate(dx,dy) scale(s),transformOrigin center】 → 元素自身入场动画 → 内容。
 *   dx/dy 是 1920×1080 合成坐标 px(段级 scale 会等比放大它,定义如此)。
 *
 * 确定性:覆盖值完全源自 props(shotParams),不读 DOM / 时钟 / 随机,渲染确定。
 * 全默认值时不加 style(恒等短路)——"没编辑过 = 渲染树零变化",QA 基线不动。
 */
import React, { createContext, useContext } from 'react';

/** 单个元素的覆盖值。全部可选;缺省 = 不覆盖。 */
export type ElementOverride = {
  /** 水平位移,px,基于 1920×1080 合成坐标。钳制 [-1920, 1920]。 */
  dx?: number;
  /** 垂直位移,px。钳制 [-1080, 1080]。 */
  dy?: number;
  /** 等比缩放。钳制 [0.2, 5]。 */
  scale?: number;
  /** 透明度。钳制 [0, 1]。 */
  opacity?: number;
  /** 颜色覆盖(#rrggbb)。包裹层不应用;由声明 colorable 的组件在采纳点显式采纳。 */
  color?: string;
};

export type ElementOverrides = Record<string, ElementOverride>;

const clampNum = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : undefined;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * 宽进严出:`shotParams.elements` 是 loose record(外部 JSON),逐键钳制。
 * 非对象 / 非法类型 / 越界一律回落"无覆盖",坏数据不脏渲染。
 * 钳制规则:宽进严出,把越界的覆盖值钳回合法范围。
 */
export const normalizeElementOverrides = (raw: unknown): ElementOverrides => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: ElementOverrides = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const ov: ElementOverride = {};
    const dx = clampNum(o.dx, -1920, 1920);
    const dy = clampNum(o.dy, -1080, 1080);
    const scale = clampNum(o.scale, 0.2, 5);
    const opacity = clampNum(o.opacity, 0, 1);
    if (dx !== undefined) ov.dx = dx;
    if (dy !== undefined) ov.dy = dy;
    if (scale !== undefined) ov.scale = scale;
    if (opacity !== undefined) ov.opacity = opacity;
    if (typeof o.color === 'string' && HEX_COLOR.test(o.color)) ov.color = o.color;
    if (Object.keys(ov).length > 0) out[id] = ov;
  }
  return out;
};

const Ctx = createContext<ElementOverrides>({});

/** 宿主渲染器在每段内容外提供;value 直接喂 shotParams.elements(内部钳制)。 */
export const ElementOverridesProvider: React.FC<{
  value: unknown;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <Ctx.Provider value={normalizeElementOverrides(value)}>{children}</Ctx.Provider>
);

/** 颜色采纳点用:`const ov = useElementOverride('label'); color: ov.color ?? 默认 token`。 */
export const useElementOverride = (id: string): ElementOverride =>
  useContext(Ctx)[id] ?? {};

export type EditableElementProps = {
  /** 元素稳定 id:静态元素用语义名(kicker/label/title),数组渲染用索引式(card-0)。只用 [a-z0-9-]。 */
  id: string;
  /** 画布 hover / 选框显示的中文名(如「卡 1」「口播标签」)。 */
  label?: string;
  /** 该元素支持 color 覆盖(组件已接采纳点);画布取色器据此显示。 */
  colorable?: boolean;
  children: React.ReactNode;
};

/**
 * <EditableElement> — 包元素起名。只管几何(translate/scale/opacity);
 * 定位样式放外层(文件头纪律)。覆盖全默认时恒等短路,不加 style。
 */
export const EditableElement: React.FC<EditableElementProps> = ({
  id,
  label,
  colorable,
  children,
}) => {
  const ov = useElementOverride(id);
  const dx = ov.dx ?? 0;
  const dy = ov.dy ?? 0;
  const s = ov.scale ?? 1;
  const op = ov.opacity ?? 1;
  const identity = dx === 0 && dy === 0 && s === 1 && op === 1;
  return (
    <div
      data-vibe-el={id}
      data-vibe-label={label}
      data-vibe-colorable={colorable ? '1' : undefined}
      style={
        identity
          ? undefined
          : {
              transform: `translate(${dx}px, ${dy}px) scale(${s})`,
              transformOrigin: 'center center',
              opacity: op,
            }
      }
    >
      {children}
    </div>
  );
};
