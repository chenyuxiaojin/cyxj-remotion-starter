# CLAUDE.md — kit(L1 共享层)

> 这是本工作台的 **L1 共享中间层**:所有视频共用的引擎级组件、基础镜头、设计 token、schema 类型都在这里。
> 三层定位:**L0** 官方工具链(`remotion-best-practices` skill + `remotion-documentation` MCP)→ **L1 本层(kit)**(造镜头/组件)→ **L2** `../template/`(出片,只装配)。
> 上层路由见 `../CLAUDE.md`。

## 这一层是干嘛的

`kit/` 是一个**零依赖的源码层**:不装 node_modules、无 `package.json`,**不单独构建/运行**——总是被出片工程跨仓 import(零依赖是为了让 Remotion 枚举 composition 时不撞上缺 `zod`,见 `../docs/HARD_RULES.md` §9)。⚠️ 因此在 kit 里单独打开 `.tsx`,编辑器会因解析不到 `remotion`/`react` 满屏标红——**那是常态,不是代码坏**(要验代码就在出片工程里跑)。

| 要找什么 | 在哪 |
|---|---|
| **镜头组**(数据驱动的镜头组件;数量以 `sceneMap.ts` 注册表为准) | `scenes/`(`sceneMap.ts` 是注册表,本仓带 5 个通用镜头) |
| 口播轨 / 说话人运镜 | `speakers/SpeakerTrack.tsx` |
| 通用组件(玻璃卡/字幕/运镜/入场动效/全屏底/元素编辑) | `components/`(`index.ts` 是 barrel) |
| schema 纯类型(零 zod 依赖) | `schema/types.ts` |
| 镜头自描述说明书(SceneTag,可派生目录/控件) | `schema/sceneTag.ts` |
| 设计 token 来源(代码 import;**占位色板,换成你自己的**) | `theme.ts` |
| 硬规则唯一真源 | `../docs/HARD_RULES.md` |
| 起手模板 | `../template/`(复制改 `props.json` 即出片) |

## 本仓带了哪些镜头 / 组件

- **镜头(`scenes/`)**:装配器 `TalkingHead` + 5 个通用镜头 `title`(点题关键词卡)/ `talk`(口播标签)/ `list`(侧栏列表)/ `compare`(双卡对比)/ `flankcards`(两翼浮卡)。
- **组件(`components/`)**:`SrtCaptions`(逐字字幕)/ `Stage` + `SpeakerTrack`(连续运镜口播轨)/ `GlassCards`(玻璃卡三件套)/ `motion`(FadeIn/SlideIn/Pop 入场)/ `FullBleedBackdrop` + `CreamDriftBackdrop`(全屏/浅底铺底)/ `EditableElement`(元素级编辑机制)。

> 作者私有的品牌镜头库(几十个成片专用镜头)、真实设计系统色值**不在本仓**——那是私有沉淀。本仓给的是可复用的引擎积木,鼓励你按同样机制沉淀自己的镜头库和设计系统。

## L1 可创造,L2 只装配(核心纪律)

- **这里(L1)允许改镜头、发明镜头**——这是创造画面的正确入口。
- **出片项目(L2)只装配**:用 `scenes/` 的镜头拼时间轴 + 改 `props.json`,不在那边平铺复刻镜头。
- **新建镜头三步**:① 在 `scenes/content.tsx`(或新文件)写受 props 驱动的组件(复用 kit 组件,别从零造视觉)② 在 `scenes/sceneMap.ts` 登记一行 type → 组件 ③ 需要新姿态就在 `scenes/poses.ts` 的 `poseForScene` 加一条。

## 视觉 token:theme.ts 是唯一来源

组件一律从 `theme.ts` 取 token、**不内联色值**。`theme.ts` 现在是一套**通用占位色板**——每个 hex / 字族都要换成你自己的品牌值,改一处全线组件跟着变。项目成熟后建议把「值」再抽到一个生成器做单一真源,`theme.ts` 只放产物;起步阶段直接改它即可。

## 组件晋升(作品私有 → 本层)

> 单一真源在此(根 `../CLAUDE.md` 路由指过来)。

做完一条视频后,判断工程里的组件要不要提升进本层 `components/`:

1. **被 ≥2 个作品复制或引用** → 晋升候选
2. **体现品牌 DNA**(theme token 用法 / 字幕样式 / 运镜 / 玻璃卡等视觉语言)→ 晋升候选
3. **仅单作品使用、耦合具体文案或素材** → 留在作品 `src/` 内,不晋升
4. 拿不准 → 问用户,不擅自晋升

晋升硬要求:组件只从 `theme.ts` 取 token、不内联品牌色值;props 化作品相关内容;遵守 `../docs/HARD_RULES.md`。
