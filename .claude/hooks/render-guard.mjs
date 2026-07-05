#!/usr/bin/env node
// PreToolUse(Bash)守卫:匹配渲染类命令时强制弹确认("渲染前必停"协议)。
// 不硬拦(deny),用 permissionDecision:"ask" 让用户过一遍 checklist 再放行。贵操作,别误渲。
import { readFileSync } from 'node:fs';

let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (data.tool_name !== 'Bash') process.exit(0);

const cmd = (data.tool_input && data.tool_input.command) || '';

// 只命中贵的成片渲染;放过 still(单帧自检,便宜,本来就是渲前该做的事)、
// studio/dev(预览)、bundle(只打包不渲染)
const isRender = /(remotion\s+render|npm\s+run\s+(-s\s+)?render|yarn\s+render|pnpm\s+render)/.test(cmd);
if (!isRender) process.exit(0);

const reason =
  "🎬 渲染前必停(贵操作,确认一遍再放行):\n" +
  "  1. 分辨率/帧率/时长 对不对?(看 composition 设置)\n" +
  "  2. 字幕走哪条路?A 路=Remotion 烧进画面 / B 路=后期(剪辑软件)做,别两头都做出双字幕\n" +
  "  3. 素材都在 public/ 且用 staticFile() 引用?(docs/HARD_RULES.md §6)\n" +
  "  4. 输出路径 out/ 不会覆盖要留的成片?\n" +
  "  5. 改完代码后 lint/tsc 过了吗?(Stop 钩子会兜底,但渲染前自查更稳)\n" +
  "  6. 静帧自检过了吗?先 still 抽帧、view 看过再渲——列出:查了哪些帧 / 修了什么 / 还接受什么问题(中文/CJK 必看,战疤5)\n" +
  `命令:${cmd}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
