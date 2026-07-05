#!/usr/bin/env node
// Stop 钩子:Claude 一轮收工前,在"本轮改过的那个子工程"里跑一次 tsc --noEmit。
// 没改过 .ts/.tsx -> 无 marker -> 立刻放行(纯聊天不受影响)。
// 有类型错 -> exit 2 阻止收工,把错误喂回 Claude 去修;stop_hook_active 兜底防死循环。
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

let data;
try { data = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }

// 如果这次收工本身就是被本钩子拦下来续跑的,放行,避免反复拦同一个错
if (data.stop_hook_active) process.exit(0);

const marker = fileURLToPath(new URL('./.last-edited-project', import.meta.url));
if (!existsSync(marker)) process.exit(0);

let projectDir = '';
try { projectDir = readFileSync(marker, 'utf8').trim(); } catch { process.exit(0); }
try { rmSync(marker); } catch { /* 用完即清 */ }

if (!projectDir || !existsSync(join(projectDir, 'tsconfig.json'))) process.exit(0);

// 只用子工程本地的 tsc,不存在就跳过(不联网 npx 下载)
const tscBin = join(projectDir, 'node_modules', '.bin', 'tsc');
if (!existsSync(tscBin)) process.exit(0);

const res = spawnSync(tscBin, ['--noEmit', '-p', join(projectDir, 'tsconfig.json')], {
  cwd: projectDir,
  encoding: 'utf8',
  timeout: 120000,
});

if (res.status === 0) {
  process.stdout.write(`✅ tsc 通过(${projectDir})`);
  process.exit(0);
}

const out = ((res.stdout || '') + (res.stderr || '')).trim().split('\n').slice(0, 40).join('\n');
process.stderr.write(`⚠️ tsc 类型检查没过(${projectDir})——修完再收工:\n${out}`);
process.exit(2);
