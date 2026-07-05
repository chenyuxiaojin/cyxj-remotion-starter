#!/usr/bin/env node
/**
 * qa-still.mjs —— QA 抽帧一键化:建临时 QA 入口 → 抽 3 帧(入场/中段 payoff/落点)→
 * 打印人工核对清单 → 删除脚手架。
 *
 * 规则真源(本脚本不复述规则):
 *   - docs/HARD_RULES.md(为什么 CJK 必须真渲抽帧肉眼看:字体没加载好会掉成豆腐块,只看预览看不出)
 *   - overlay skill 关键纪律:不在 kit / 仓库根跑 CLI —— 本脚本只允许在出片工程根目录运行
 *
 * 用法(在 出片工程根目录):
 *   npm run qa:still -- <type>                        # 从 ./props.json 找该 type 的第一段,用它的 props/时长
 *   npm run qa:still -- <type> --props=props.all-scenes.json   # 换一份装配文件找
 *   npm run qa:still -- <type> --index=1              # 同 type 多段时选第几段(0 起)
 *   npm run qa:still -- <type> --frames=24,120,220    # 覆盖默认三帧
 *   npm run qa:still -- <type> --duration=8 --scale=0.5
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const die = (msg) => { console.error(`❌ qa-still: ${msg}`); process.exit(1); };

// ---------- 0. 位置守卫:只允许在出片工程根目录运行 ----------
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
// assets 在 <repo>/.claude/skills/cyxj-remotion-produce/assets/ → 上溯 4 层到 <repo>;kit 在 <repo>/kit
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const KIT_ROOT = path.join(REPO_ROOT, 'kit');
const cwd = process.cwd();

if (cwd === KIT_ROOT || cwd.startsWith(KIT_ROOT + path.sep))
  die('当前在 kit/ 里。kit 零依赖、不运行,QA 抽帧只能在出片工程根目录跑(cd template/ 或你复制出的工程)。');
if (cwd === REPO_ROOT)
  die('当前在仓库根目录。这里没有 package.json,QA 抽帧只能在出片工程根目录跑(cd template/)。');

let pkg;
try { pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')); }
catch { die('当前目录没有可读的 package.json —— 不是 出片工程根目录。'); }
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (!deps.remotion && !deps['@remotion/cli'])
  die('当前工程的 package.json 里没有 remotion 依赖 —— 这不是 Remotion 出片工程。');
if (!existsSync(path.join(cwd, 'src'))) die('当前目录没有 src/ —— 不是 出片工程根目录。');

// ---------- 1. 参数 ----------
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of argv) {
  const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] ?? true;
  else positional.push(a);
}
const type = positional[0];
if (!type) die('缺镜头 type。用法:npm run qa:still -- <type> [--frames=a,b,c] [--props=<file>] [--index=n] [--duration=s] [--scale=x]');

// type 必须在镜头组注册表里(否则 TalkingHead 渲空帧,QA 白抽)
const sceneMapSrc = readFileSync(path.join(KIT_ROOT, 'scenes', 'sceneMap.ts'), 'utf8');
if (!new RegExp(`^\\s*'?${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?\\s*:`, 'm').test(sceneMapSrc))
  die(`type「${type}」不在镜头组注册表 kit/scenes/sceneMap.ts 里(清单以注册表为准)。`);

// ---------- 2. 取镜头 props / 时长(命令参数 / 装配 json 注入) ----------
let sceneProps = {};
let durationInSeconds = null;
let fps = 30;
const propsFile = typeof flags.props === 'string' ? flags.props : existsSync(path.join(cwd, 'props.json')) ? 'props.json' : null;
if (propsFile) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(path.join(cwd, propsFile), 'utf8')); }
  catch { die(`读不了 ${propsFile}(不存在或不是合法 JSON)。`); }
  if (Array.isArray(parsed.scenes)) {
    if (typeof parsed.fps === 'number') fps = parsed.fps;
    const matches = parsed.scenes.filter((s) => s.type === type);
    if (matches.length === 0) {
      console.log(`ℹ️  ${propsFile} 里没有 type=${type} 的镜头,用空 props 渲(画面可能是空的;可用 --props 指定别的装配文件)。`);
    } else {
      const idx = flags.index !== undefined ? Number(flags.index) : 0;
      if (!(idx >= 0 && idx < matches.length)) die(`--index=${flags.index} 越界:${propsFile} 里 type=${type} 共 ${matches.length} 段。`);
      if (matches.length > 1) console.log(`ℹ️  type=${type} 有 ${matches.length} 段,取第 ${idx} 段(--index 可换)。`);
      sceneProps = matches[idx].props ?? {};
      durationInSeconds = matches[idx].durationInSeconds ?? null;
    }
  } else {
    sceneProps = parsed; // 不带 scenes 的裸对象 → 直接当该镜头的 props 用
  }
}
if (flags.fps) fps = Number(flags.fps);
if (flags.duration) durationInSeconds = Number(flags.duration);
if (!durationInSeconds) durationInSeconds = 8;

// ---------- 3. 三帧:入场 / 中段(payoff)/ 落点(避开 FadeWrap 首尾淡入淡出) ----------
const durFrames = Math.max(1, Math.round(durationInSeconds * fps));
let frames;
if (typeof flags.frames === 'string') {
  frames = flags.frames.split(',').map((n) => Number(n.trim()));
  if (frames.some((n) => !Number.isInteger(n) || n < 0 || n >= durFrames))
    die(`--frames 有越界值(本镜头 0..${durFrames - 1})。`);
} else {
  frames = [...new Set([
    Math.min(24, Math.max(0, durFrames - 1)),
    Math.max(0, Math.round(durFrames / 2)),
    Math.max(0, durFrames - 18),
  ])].sort((a, b) => a - b);
}
const scale = flags.scale ? Number(flags.scale) : 1;

// ---------- 4. 落脚手架(用完即删,不入库) ----------
const entryPath = path.join(cwd, 'src', 'qa-entry.tsx');
const propsPath = path.join(cwd, 'src', 'qa-still.props.json');
const cleanup = () => { for (const p of [entryPath, propsPath]) { try { rmSync(p, { force: true }); } catch { /* 尽力而为 */ } } };
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

let template = readFileSync(path.join(SCRIPT_DIR, 'qa-entry.template.tsx'), 'utf8');
let kitImport = path.relative(path.join(cwd, 'src'), KIT_ROOT).split(path.sep).join('/');
if (!kitImport.startsWith('.')) kitImport = './' + kitImport;
template = template.replaceAll('__KIT_IMPORT__', kitImport);
if (!existsSync(path.join(cwd, 'src', 'fonts.ts')))
  template = template.replace("import './fonts';\n", ''); // 没有字体注册文件的工程照样能抽(CJK 结论要打折,清单里会提示)
const hasFonts = existsSync(path.join(cwd, 'src', 'fonts.ts'));

const outDir = path.join(cwd, 'qa-frames');
mkdirSync(outDir, { recursive: true });
// 红线:qa-frames/ 不入库
const gi = path.join(cwd, '.gitignore');
if (!existsSync(gi) || !readFileSync(gi, 'utf8').includes('qa-frames')) {
  appendFileSync(gi, 'qa-frames/\n');
  console.log('ℹ️  已把 qa-frames/ 加进 .gitignore(QA 产物不入库)。');
}

let failedFrame = null;
try {
  writeFileSync(propsPath, JSON.stringify({
    fps, width: 1920, height: 1080,
    scenes: [{ type, durationInSeconds, props: sceneProps }],
  }, null, 2));
  writeFileSync(entryPath, template);

  console.log(`🎬 qa:still → type=${type} · ${durationInSeconds}s@${fps}fps · 抽帧 [${frames.join(', ')}] · scale=${scale}`);
  for (const f of frames) {
    const out = path.join('qa-frames', `${type}-f${f}.png`);
    const r = spawnSync('npx', ['remotion', 'still', 'src/qa-entry.tsx', 'QA', out, `--frame=${f}`, `--scale=${scale}`], { stdio: 'inherit' });
    if (r.status !== 0) { failedFrame = f; break; }
  }
} finally {
  cleanup();
}

if (failedFrame !== null) {
  console.error(`\n❌ frame ${failedFrame} 渲染失败 —— 这正是真渲一帧要暴露的运行时错误(tsc/compositions 全绿也抓不到)。`);
  console.error('   先按上面的报错修镜头,再重跑 qa:still。脚手架已清理。');
  process.exit(1);
}

console.log(`\n✅ 抽帧完成 → qa-frames/(${frames.length} 张)。人工核对:`);
console.log('   [ ] 0 throw(上方渲染日志无报错)');
console.log(hasFonts
  ? '   [ ] CJK 无豆腐块 / 掉字'
  : '   [ ] CJK 无豆腐块 / 掉字 ⚠️ 本工程没有 src/fonts.ts,字体未注册,CJK 结论不作数');
console.log('   [ ] 内容都在 y<950 字幕安全区上方');
console.log('🧹 QA 脚手架(src/qa-entry.tsx + qa-still.props.json)已删除 —— 用完即删,不入库。');
