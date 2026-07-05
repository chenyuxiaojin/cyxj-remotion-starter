#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit)守卫:在写入 .ts/.tsx 前拦截 Remotion HARD_RULES 机械红线。
// 真源:docs/HARD_RULES.md。只查"新增进去的内容",不查删除/旧代码。
// 命中 -> permissionDecision:"deny" 把违规原因喂回 Claude,让它改完再写。
import { readFileSync } from 'node:fs';

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

let data;
try { data = JSON.parse(readStdin()); } catch { process.exit(0); }

const tool = data.tool_name;
const input = data.tool_input || {};
const filePath = input.file_path || '';

// 只看 TS/TSX 源码;跳过配置 / 声明文件(它们不参与逐帧渲染)
if (!/\.(tsx|ts)$/.test(filePath)) process.exit(0);
if (/(\.config\.|eslint|\.d\.ts$|tailwind)/i.test(filePath)) process.exit(0);

// 取本次"要写进去"的内容
let content = '';
if (tool === 'Write') content = input.content || '';
else if (tool === 'Edit') content = input.new_string || '';
else if (tool === 'MultiEdit') content = (input.edits || []).map((e) => e.new_string || '').join('\n');
else process.exit(0);

if (!content.trim()) process.exit(0);

// 去掉注释,降低误伤(行注释 + 块注释)
const code = content
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

const violations = [];

// §2 禁非确定性随机 / 墙上时钟
if (/\bMath\.random\s*\(/.test(code))
  violations.push("Math.random() — 逐帧渲染会闪烁/不可复现。改用 Remotion 的 random(seed)。(§2)");
if (/\bDate\.now\s*\(/.test(code) || /\bnew\s+Date\s*\(\s*\)/.test(code) || /\bperformance\.now\s*\(/.test(code))
  violations.push("Date.now()/new Date()/performance.now() 驱动画面 — 渲染期读墙上时钟不可复现。改用 useCurrentFrame()。(§2)");

// §1 CSS 动画:裸写禁,「钉帧」写法放行(受控例外,非官方背书)。
// 官方 troubleshooting/css-animations 一律反对 CSS 动画;但 animationPlayState:'paused' 让动画
// 不吃浏览器墙上时钟,配从 frame 算的负 animationDelay 把它静态钉到某一时刻,渲染结果就成了
// 计算样式的纯函数 → 每帧快照确定一致。因此带 paused 标记的 @keyframes/animation: 放行。
// - transition: 本质是状态切换的过渡,没有钉帧写法可救 → 永远禁(避开 @remotion/transitions import:需紧跟冒号)。
// - @keyframes / animation: 仅当本次写入未出现 animationPlayState:'paused' 标记时才拦。
//   (静态正则只能看"本次写入是否含 paused";一处裸写、另一处恰好有 paused 的跨元素错配会漏判,
//    交给 remotion-rule-reviewer 语义审查。)
const framePinned = /animationPlayState\s*:\s*['"`]paused['"`]/.test(code);
if (!framePinned && /@keyframes/.test(code))
  violations.push("@keyframes 未钉帧 — CSS 动画按浏览器墙上时钟跑,渲染时丢帧。要么走 interpolate()/spring(),要么加 animationPlayState:'paused' + 负 animationDelay 钉到 frame。(§1)");
// animation: 键只拦「值像 CSS 动画」的写法(时长 1s/300ms、timing 关键词等)。
// SceneTag catalog.animation 这类数据字段的值是中文描述("依次弹出"),放行(数据字段白名单)。
// 非字面量值(变量/拼接)静态看不出是不是 CSS → 保守仍拦。
if (!framePinned) {
  const animKeyRe = /\banimation\s*:\s*([^,\n}]*)/g;
  let am;
  while ((am = animKeyRe.exec(code)) !== null) {
    const raw = (am[1] || '').trim();
    const lit = raw.match(/^['"`]([^'"`]*)['"`]$/);
    const cssish = (v) =>
      /(\d+(\.\d+)?m?s\b)|infinite|linear|ease|steps\s*\(|cubic-bezier|alternate|forwards|backwards|paused|running/i.test(v);
    if (lit ? cssish(lit[1]) : true) {
      violations.push("style 里裸 animation: 未钉帧 — 渲染时不生效/错位。要么走 interpolate()/spring(),要么加 animationPlayState:'paused' + 负 animationDelay 钉到 frame。(§1)");
      break;
    }
  }
}
if (/\btransition\s*:/.test(code))
  violations.push("style 里的 CSS transition: — transition 无法钉到 frame,渲染必错位,无同步写法可救。动效走 interpolate()/spring() 写进 inline style。(§1)");

// §1 禁 Tailwind 动画工具类(只在 className/class 属性值里找,避开普通变量名)
const classAttrRe = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{([^}]*)\})/g;
const badTw = new Set();
let m;
while ((m = classAttrRe.exec(code)) !== null) {
  const val = m[1] || m[2] || m[3] || m[4] || '';
  for (const tok of val.split(/\s+/)) {
    if (/^-?(animate-|transition$|transition-|duration-|ease-|delay-)/.test(tok)) badTw.add(tok);
  }
}
if (badTw.size)
  violations.push(`Tailwind 动画类 [${[...badTw].join(", ")}] — Tailwind 只准做静态(布局/间距/颜色/圆角/字体),动的走 interpolate()/spring()。(§1)`);

// §3 interpolate() 必须带 clamp
{
  const re = /\binterpolate\s*\(/g;
  let mm;
  while ((mm = re.exec(code)) !== null) {
    const win = code.slice(mm.index, mm.index + 500);
    const open = win.indexOf('(');
    let depth = 0, end = -1;
    for (let i = open; i < win.length; i++) {
      if (win[i] === '(') depth++;
      else if (win[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    const call = end >= 0 ? win.slice(0, end + 1) : win;
    if (!/clamp/.test(call)) {
      violations.push("interpolate() 没带 clamp — 输入超区间会线性外推,透明度/缩放算崩。必须写 extrapolateLeft/Right: 'clamp'。(§3)");
      break;
    }
  }
}

// §战疤6 OffthreadVideo 没有 loop 属性 — 抓字面 <OffthreadVideo ... loop>
// loop 对 Html5Video / @remotion/media 的 Video/Audio / <Loop> 都合法,所以只锁标签名 OffthreadVideo;
// 三元 <Footage ... loop>(动态标签名)静态抓不到,交给 remotion-rule-reviewer 语义审查。
{
  const tagRe = /<OffthreadVideo\b[^>]*>/g;
  let om;
  while ((om = tagRe.exec(code)) !== null) {
    if (/(?<![\w-])loop(?=[\s=/>])/.test(om[0])) {
      violations.push("<OffthreadVideo ... loop> — OffthreadVideo 没有 loop 属性(官方 props 表),渲染时被静默忽略 → 中段短素材导出会冻在最后一帧。删掉 loop,改用 <Sequence from> 归零本地时间 + <Loop durationInFrames={parseMedia 现读时长}> 包裹。(战疤6)");
      break;
    }
  }
}

if (violations.length === 0) process.exit(0);

const reason =
  "⛔ Remotion HARD_RULES 红线(先改这次编辑,再写入):\n" +
  violations.map((v, i) => `  ${i + 1}. ${v}`).join("\n") +
  "\n真源:docs/HARD_RULES.md";

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
