'use strict';

// 自测：在临时目录构造一个「胖」项目，验证 analyze 产出合理。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { analyze, gradeOf, REDUNDANT } = require('./index.js');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { console.error('  FAIL  ' + name + '  -> ' + e.message); process.exitCode = 1; }
}

// 1) REDUNDANT 表里确有 high-signal 条目
check('REDUNDANT 含 moment/lodash/axios', () => {
  assert.ok(REDUNDANT.moment, '缺 moment');
  assert.ok(REDUNDANT.lodash, '缺 lodash');
  assert.ok(REDUNDANT.axios, '缺 axios');
});

// 2) gradeOf 边界正确
check('gradeOf 边界', () => {
  assert.strictEqual(gradeOf(10), 'A');
  assert.strictEqual(gradeOf(30), 'B');
  assert.strictEqual(gradeOf(50), 'C');
  assert.strictEqual(gradeOf(70), 'D');
  assert.strictEqual(gradeOf(90), 'F');
});

// 3) 对一个确实冗余 + 过度嵌套的临时项目，能检出冗余依赖并给分数
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'idiot-'));
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
  dependencies: { moment: '^2.0.0', lodash: '^4.0.0', axios: '^1.0.0' },
  devDependencies: {},
}));
// 制造一个深度嵌套的文件
let deep = 'function a() {\n';
for (let i = 0; i < 10; i++) deep += '  '.repeat(i + 1) + 'function l' + i + '() {\n';
for (let i = 0; i < 10; i++) deep += '  '.repeat(10 - i) + '}\n';
deep += '}\n';
fs.writeFileSync(path.join(tmp, 'deep.ts'), deep);

const r = analyze(tmp);
check('检出 3 个冗余依赖', () => {
  const names = r.redundantFound.map(d => d.name).sort();
  assert.deepStrictEqual(names, ['axios', 'lodash', 'moment']);
});
check('score 在 0-100 且 >0', () => {
  assert.ok(r.score >= 0 && r.score <= 100, '越界: ' + r.score);
  assert.ok(r.score > 0, '应为正: ' + r.score);
});
check('topFiles 含 deep.ts', () => {
  assert.ok(r.topFiles.some(f => f.rel.endsWith('deep.ts')), '未命中 deep.ts');
});
check('grade 合法', () => {
  assert.ok(['A', 'B', 'C', 'D', 'F'].includes(r.grade));
});

// 4) 干净目录（无 package.json、无源码）不报错且分数为 0
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'idiot-empty-'));
const re = analyze(empty);
check('空目录 score=0 不崩', () => {
  assert.strictEqual(re.score, 0);
  assert.strictEqual(re.scannedFiles, 0);
});

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(empty, { recursive: true, force: true });

console.log(`\n自测完成：${passed} 项通过。`);
