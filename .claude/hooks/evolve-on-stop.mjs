#!/usr/bin/env node
// Stop 钩子(闸二 · 文档进化闸):本轮动过出片代码、却没动任何规则文档 → exit 2 拦一次,
// 提示跑 /进化 把"学到的"路由回写。和 typecheck-on-stop 并排,各用各的 marker。
//   - 改了代码 + 改了文档(doc=true)→ 视为已进化,放行。
//   - 只改了文档 / 啥都没改 → 放行。
//   - stop_hook_active 兜底:只拦一次,续跑放行(防死循环;也是"确无规则变化"的逃生口)。
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }

// 被本钩子拦下来续跑的这次收工,放行
if (data.stop_hook_active) process.exit(0);

const marker = fileURLToPath(new URL('./.session-edits.json', import.meta.url));
if (!existsSync(marker)) process.exit(0); // 本轮没动过任何文件 → 放行(纯聊天不受影响)

let s = {};
try { s = JSON.parse(readFileSync(marker, 'utf8')); } catch { process.exit(0); }
try { rmSync(marker); } catch { /* 用完即清 */ }

if (s.code && !s.doc) {
  process.stderr.write(
    '🧬 文档进化闸:本轮动了出片 / 镜头代码,但规则文档一字没改。\n' +
    '→ 若这次产生了该沉淀的东西(纠正 / 新决策 / 新手法 / 旧规则被推翻 / 文档过时),' +
    '跑 /进化(激活 cyxj-remotion-evolve)把它路由回写进对应真源文件。\n' +
    '→ 若确认本轮确无规则级变化,直接再次收工即可放行(本闸只拦一次)。'
  );
  process.exit(2);
}
process.exit(0);
