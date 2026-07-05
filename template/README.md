# 口播视频起手模板

复用 `../kit` 的镜头与组件,**改 `props.json` 即出片**。

## 怎么跑

```bash
npm install
npm run dev        # 打开 Remotion Studio 预览
```

Studio 里能看到一条 demo 片(title / talk / list 三镜)。

## 怎么改片

只动 `props.json`:

- `fps` / `width` / `height` / `background` —— 整片参数
- `speaker` —— 口播底视频(可省;不给就是纯图形片)
- `scenes[]` —— 镜头序列,每段:
  - `type` —— 镜头类型(本模板可用:`title` / `talk` / `list` / `compare` / `flankcards`;完整清单看 `../kit/scenes/sceneMap.ts`)
  - `durationInSeconds` —— 这段多长
  - `props` —— 这段的文案数据(随 type 而异,看 `../kit/scenes/content.tsx` 里各镜头的 props)

## 命令

```bash
npm run dev                 # Studio 预览
npm run still               # 抽一帧到 out/qa/f.png(自检)
npm run qa:still -- <type>  # 逐镜头一键抽 3 帧(入场/中段/落点)
npm run render              # 渲全片 → out/video.mp4
npm run render3d            # 含 R3F 3D 场景时用(带 --gl=angle)
npm run typecheck           # tsc --noEmit
```

## 关键文件

- `src/Root.tsx` —— Composition 定义 + zod schema(schema 内联在这,别从 kit import)
- `src/fonts.ts` —— 字体加载(已附带 Noto Sans SC + Space Mono 的 woff2)
- `remotion.config.ts` —— 接共享层的 webpack alias(`CROSS_REPO_PKGS`,别删)
- `props.json` —— 你要改的就是这个
