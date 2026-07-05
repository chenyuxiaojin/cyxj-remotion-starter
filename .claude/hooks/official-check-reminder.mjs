// official-check-reminder.mjs — UserPromptSubmit
// 每轮把「出片强制官方核查」闸门顶到 Claude 眼前,抗会话漂移。
// 提醒型(退出码 0 + stdout 注入为上下文),不阻断 —— 符合本工作台
// "语义判断的不硬管"哲学:hook 没法知道是否真查了,真正闸门是
// Claude 动手前输出「📋 官方核查」清单(见 CLAUDE.md 硬规则)。

import { readFileSync } from 'node:fs';

const REMINDER = [
  '🎯 造画面前先定姿态:默认官方原生先搭(interpolate/spring/Sequence),不先翻库;',
  '   复用镜头库是「确实是重复内容 + 库里那个正好对」时的主动选择,不是反射——要造新就真造。',
  '   完整 5 步判断 + 边界:激活 overlay skill cyxj-remotion-overlay。',
  '',
  '⛔ 出片强制闸门 · 制作 / 修改任何 Remotion 视频代码前,先走官方三查并把结果摆出来:',
  '1. 官方 Skill —— 激活 remotion-best-practices,按它的最佳实践做',
  '2. 官方 API / 文档 —— 涉及的 Remotion API(interpolate / spring / Sequence / <Audio> / staticFile …)',
  '   先查官方 skill(remotion-best-practices 的规则文件)',
  '   或调 remotion-documentation MCP,禁止凭记忆',
  '3. 动手前先输出「📋 官方核查」清单(查了哪个 skill / 哪个 API / 哪份 docs + 官方原话);',
  '   写不出 = 没查 = 不许改代码',
  '(纯聊天 / 问答轮可忽略;一旦要写 .tsx、改 props.json、加镜头、出片,必须走完。详见 CLAUDE.md 硬规则)',
].join('\n');

try { readFileSync(0, 'utf8'); } catch {} // 排空 UserPromptSubmit 输入,内容这里用不到

process.stdout.write(REMINDER);
process.exit(0);
