#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit):零成本记录"本轮(上次 Stop 以来)动过出片代码没 / 动过规则文档没"。
// 和 record-edit.mjs 并排、各管各的 marker,互不干扰:
//   - record-edit.mjs        → .last-edited-project(给 typecheck 用)
//   - 本脚本                  → .session-edits.json(给 evolve-on-stop 用)
// 判定:.tsx/.ts/props.json = 出片代码(code);.md = 规则文档(doc)。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }

const fp = (data.tool_input && data.tool_input.file_path) || '';
if (!fp) process.exit(0);

const isCode = /(\.tsx?|props\.json)$/.test(fp);
const isDoc = /\.md$/.test(fp);
if (!isCode && !isDoc) process.exit(0);

const marker = fileURLToPath(new URL('./.session-edits.json', import.meta.url));
let s = { code: false, doc: false };
if (existsSync(marker)) {
  try { s = { ...s, ...JSON.parse(readFileSync(marker, 'utf8')) }; } catch { /* 坏了就重置 */ }
}

let changed = false;
if (isCode && !s.code) { s.code = true; changed = true; }
if (isDoc && !s.doc) { s.doc = true; changed = true; }

if (changed) {
  try { writeFileSync(marker, JSON.stringify(s)); } catch { /* 写不了就算了,不阻断 */ }
}
process.exit(0);
