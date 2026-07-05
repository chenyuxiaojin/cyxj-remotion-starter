#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit):零成本记录"最近改过的子工程目录"。
// 不在每次编辑时跑 tsc(太慢),只往 marker 文件写一下,真正的 typecheck 留给 Stop 钩子一次性做。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }

const filePath = (data.tool_input && data.tool_input.file_path) || '';
if (!/\.(tsx|ts)$/.test(filePath)) process.exit(0);

// 向上找最近一层带 tsconfig.json 的目录 = 这个改动所属的 Remotion 子工程
let dir = dirname(filePath);
let projectDir = '';
for (let i = 0; i < 12 && dir && dir !== '/'; i++) {
  if (existsSync(join(dir, 'tsconfig.json'))) { projectDir = dir; break; }
  dir = dirname(dir);
}
if (!projectDir) process.exit(0);

const marker = fileURLToPath(new URL('./.last-edited-project', import.meta.url));
try { writeFileSync(marker, projectDir); } catch { /* 写不了就算了,不阻断 */ }
process.exit(0);
