#!/usr/bin/env node
'use strict';

/*
 * idiot-index —— 白痴指数 CLI
 * 一键量化你的项目有多「胖」：可被原生 API 替代的依赖 + 过度工程分数。
 * 零依赖、单文件、本地、确定性、可进 CI 门禁。
 *
 * 白痴指数 = 成品复杂度 ÷ 理论最小复杂度。指数越高，制造流程里的浪费越大。
 */

const fs = require('node:fs');
const path = require('node:path');

// 冗余依赖 → 原生替代。命中即说明「这包装了不该装」。
const REDUNDANT = {
  'lodash': '原生 Array/Object/Map 方法',
  'underscore': '原生方法',
  'moment': 'Intl.DateTimeFormat / Temporal',
  'dayjs': 'Intl（已很轻，可评估是否必要）',
  'date-fns': 'Intl（部分可替代）',
  'chalk': 'node:util.styleText (Node 20+) / ANSI 转义',
  'colors': 'ANSI 转义',
  'picocolors': 'ANSI 转义',
  'ansi-colors': 'ANSI 转义',
  'is-odd': '% 2',
  'is-even': '% 2 === 0',
  'is-number': 'Number.isFinite / 正则',
  'left-pad': 'String.prototype.padStart',
  'mkdirp': 'fs.mkdir({recursive:true})',
  'fs-extra': 'node:fs/promises',
  'axios': 'node:fetch (Node 18+)',
  'node-fetch': 'node:fetch (Node 18+)',
  'uuid': 'node:crypto.randomUUID',
  'crypto-random-string': 'node:crypto.randomUUID',
  'slugify': 'encodeURIComponent / Intl 折叠',
  'pretty-bytes': 'Intl.NumberFormat',
  'deepmerge': 'structuredClone / 手写',
  'clone-deep': 'structuredClone',
  'rimraf': 'fs.rm({recursive:true, force:true})',
  'glob': 'node:fs.glob (Node 22+)',
  'minimatch': 'node:path 匹配',
  'dotenv': 'node:process.loadEnvFile (Node 20.6+) / --env-file',
  'querystring': 'node:querystring 已内置（无需安装）',
  'object-assign': 'Object.assign（已内置）',
  'foreach': 'Array.forEach（已内置）',
};

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.vuepress', 'vendor', 'bower_components',
  '.turbo', 'tmp', '.cache',
]);

const SRC_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue']);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// 跳过字符串/注释里的大括号，统计最大嵌套深度。
function maxNesting(src) {
  let depth = 0, max = 0;
  let state = 'normal'; // normal | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (state === 'normal') {
      if (c === '/' && n === '/') { state = 'line'; i++; continue; }
      if (c === '/' && n === '*') { state = 'block'; i++; continue; }
      if (c === "'") { state = 'sq'; continue; }
      if (c === '"') { state = 'dq'; continue; }
      if (c === '`') { state = 'tpl'; continue; }
      if (c === '{') { depth++; if (depth > max) max = depth; }
      else if (c === '}') { depth = Math.max(0, depth - 1); }
    } else if (state === 'line') {
      if (c === '\n') state = 'normal';
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'normal'; i++; }
    } else if (state === 'sq') {
      if (c === '\\') { i++; continue; }
      if (c === "'") state = 'normal';
    } else if (state === 'dq') {
      if (c === '\\') { i++; continue; }
      if (c === '"') state = 'normal';
    } else if (state === 'tpl') {
      if (c === '\\') { i++; continue; }
      if (c === '`') state = 'normal';
    }
  }
  return max;
}

function fileMetrics(absPath) {
  let src;
  try { src = fs.readFileSync(absPath, 'utf8'); }
  catch { return null; }
  const lines = src.split('\n').length;
  const depth = maxNesting(src);
  const typeCount = (src.match(/(?:interface|type)\s+[A-Za-z_]\w*/g) || []).length;
  const arrowCount = (src.match(/=>/g) || []).length;
  const fnCount = (src.match(/\bfunction\b/g) || []).length + arrowCount;
  const nestingScore = clamp(depth / 12, 0, 1) * 50;
  const abstractionScore = clamp(typeCount / 20, 0, 1) * 50;
  const fileScore = Math.round(nestingScore + abstractionScore);
  return { rel: path.relative(process.cwd(), absPath), lines, depth, typeCount, fnCount, fileScore };
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(abs, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (SRC_EXT.has(ext) && !e.name.endsWith('.min.js') && !e.name.endsWith('.d.ts')) {
        const m = fileMetrics(abs);
        if (m) out.push(m);
      }
    }
  }
}

function gradeOf(score) {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'F';
}

function analyze(targetDir) {
  const root = path.resolve(targetDir || '.');
  const pkgPath = path.join(root, 'package.json');
  let deps = {};
  let devDeps = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    deps = pkg.dependencies || {};
    devDeps = pkg.devDependencies || {};
  } catch { /* 无 package.json 也能扫源码 */ }

  const redundantFound = [];
  for (const name of Object.keys(REDUNDANT)) {
    if (deps[name]) redundantFound.push({ name, replacement: REDUNDANT[name], dev: false });
    else if (devDeps[name]) redundantFound.push({ name, replacement: REDUNDANT[name], dev: true });
  }

  const files = [];
  walk(root, files);
  const topFiles = files
    .slice()
    .sort((a, b) => b.fileScore - a.fileScore)
    .slice(0, 10);

  const avgTop = topFiles.length
    ? topFiles.reduce((s, f) => s + f.fileScore, 0) / topFiles.length
    : 0;

  const redundantPenalty = clamp(redundantFound.length * 8, 0, 50);
  const overPenalty = clamp(avgTop * 0.5, 0, 50);
  const score = Math.round(redundantPenalty + overPenalty);
  const grade = gradeOf(score);

  const suggestions = [];
  for (const r of redundantFound) {
    suggestions.push(`删掉 ${r.name}${r.dev ? '(dev)' : ''} → 用 ${r.replacement}`);
  }
  if (topFiles.some(f => f.depth >= 8)) {
    suggestions.push('存在嵌套 ≥8 层的文件，拆函数/提前 return 降深度');
  }
  if (topFiles.some(f => f.typeCount >= 10)) {
    suggestions.push('类型声明偏多，确认是否过度抽象（类型≠实现）');
  }
  if (suggestions.length === 0) {
    suggestions.push('未检出明显冗余，保持克制。');
  }

  return {
    target: root,
    score, grade,
    redundantFound,
    scannedFiles: files.length,
    topFiles,
    suggestions,
  };
}

function printReport(r) {
  const bar = '='.repeat(54);
  console.log(bar);
  console.log(`  白痴指数 (Idiot Index): ${r.score}/100   等级 ${r.grade}`);
  console.log(bar);
  console.log(`  扫描目录 : ${r.target}`);
  console.log(`  源码文件 : ${r.scannedFiles} 个`);
  console.log('');

  console.log(`[1] 可被原生 API 替代的依赖 (${r.redundantFound.length})`);
  if (r.redundantFound.length === 0) {
    console.log('    - 无。依赖克制，赞。');
  } else {
    for (const d of r.redundantFound) {
      console.log(`    - ${d.name}${d.dev ? ' (dev)' : ''}  →  ${d.replacement}`);
    }
  }
  console.log('');

  console.log(`[2] 最「胖」的 10 个文件 (按深度+抽象)`);
  for (const f of r.topFiles) {
    console.log(`    - ${f.fileScore.toString().padStart(3)}  ${f.rel}  (行${f.lines}, 深${f.depth}, 类型${f.typeCount})`);
  }
  console.log('');

  console.log('[3] 建议');
  for (const s of r.suggestions) console.log(`    * ${s}`);
  console.log('');
  console.log('  物理不允许就别做——先删，再优化。');
  console.log(bar);
}

function main() {
  const args = process.argv.slice(2);
  let target = '.';
  let asJson = false;
  let max = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') asJson = true;
    else if (a === '--max') max = parseInt(args[++i], 10);
    else if (a === '-h' || a === '--help') {
      console.log('用法: node index.js [目录] [--json] [--max N]');
      console.log('  --json   输出 JSON（CI 集成）');
      console.log('  --max N  指数超过 N 时退出码 1（CI 门禁）');
      process.exit(0);
    } else if (!a.startsWith('-')) target = a;
  }

  const r = analyze(target);
  if (asJson) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    printReport(r);
  }

  if (max !== null && r.score > max) {
    console.error(`\n[CI] 白痴指数 ${r.score} > 阈值 ${max}，构建门禁失败。`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { analyze, gradeOf, REDUNDANT, maxNesting };
