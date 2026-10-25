# OPTIMIZER_LOG — idiot-index

## Round 1 · 2026-10-15

### 一、存活评估

**同类替代**：

| 工具 | 覆盖 | 短板 |
|---|---|---|
| `knip` | 死依赖 / 未用导出 / 文件冗余 | 需 npm install，依赖树构建，报告长 |
| `depcheck` | 只查未用依赖 | 只覆盖「依赖」这一半 |
| `eslint` + `complexity` | 复杂度 | 需配置文件，规则可关，输出是列表不是数字 |
| `lizard` | 圈复杂度 | 只做复杂度，且需 pip |

**结论：保留。** 没有任何一个能用「零依赖 + 单文件 + 离线 + 确定性 + 单一数字」这五条同时满足。
这是它的差异化所在，不是「又做了一个 knip」。

另外它是家族里 `licguard` 的「依赖体检双子」另一只（README 互相引用），删掉会留断链。

### 二、方向选择

**单点深度特化。**

指标设计不动——0-100、确定性、单数字传播，这些是对的，也是这个工具的全部价值。

要动的是它的**可信度层**。现在的状况是：它给出的是「听起来很确定的错误结论」。

- 路径拼错 → 0 分 / 等级 A / 「依赖克制，赞」/ **退出码 0**
- 代码里正在 `require('lodash')` → 照样建议「**删掉** lodash」

第二条尤其严重。一个「可进 CI 的建议工具」给出**有害**建议，比不给建议更糟，因为它听起来很权威，用户会照做。

评分公式一个字不改，改的是**喂给公式的事实**。

### 三、找到的缺陷与修复

#### P0-1 路径拼错 → 满分通过

实测：`node index.js ./src/nonexistent-feature --max 20` → score 0、grade A、
「依赖克制，赞」、exit 0。空目录同样。

CI 里目录改名、路径拼错、workspace 路径写错，门禁静默失效**并给绿色信号**。

**修复**：入口前置校验 + 独立退出码 3 + `basisComplete` 字段。

#### P0-2 在用的依赖被建议删掉

fixture：`package.json` 声明 lodash/axios，`src/app.js` 里真的 require 了。旧实现照删不误。

**修复**：`collectImports()` 扫源码真实引用——`require()` / `import x from` / `import 'x'`
/ `lodash/fp` 子路径，输出 `usedInSource` 字段。建议分两类：

- `[未引用] 删掉 moment → 用 Intl...`（真的可以删）
- `[在用] axios 被源码引用，先评估迁移成本 → 目标 node:fetch（需 Node 18+）`

**默认计分口径保持不变**（向后兼容），新增 `--require-usage` 提供更严口径。

#### P1 monorepo 全漏

只读根 `package.json`，workspaces 子包声明的依赖一个都看不到。
修复：`collectManifests()` 递归发现（上限 200 防跑飞），每条命中标 `declaredIn`。

#### P1 rel 路径退化

`rel` 相对 `process.cwd()` 而非扫描根。扫临时目录时输出
`..\..\..\AppData\Local\Temp\...\src\app.js`——从任意目录调CLI 都不可读。
修复：改相对 `rootDir`，统一 `/` 分隔符。

#### P1 参数静默

`--max abc` / `--max` 缺值 / `--bogus` 全部 exit 0。**门禁参数写错 = 门禁不存在。**
修复：全部退 2。

#### P2 版本门槛 / npx 死包

`REDUNDANT` 改为 `{repl, requires}` 结构，有版本门槛的建议直接写进文案。
`npm view idiot-index` 实测 E404，README 里的 `npx -y idiot-index` 是死命令——已删并写明。

### 四、门禁可信度

自测 7 → 24 项（原有 7 项一字未改）；新增 `scripts/smoke-cli.js` 31 项 spawn 级断言。

变异 4 组全部拦下：

| 变异 | 单测 | 冒烟 |
|---|---|---|
| 目标存在性校验失效 | fail 1 | fail 1 |
| 不做源码引用检测 | fail 8 | fail 4 |
| strictUsage 过滤失效（合法写法） | fail 1 | fail 2 |
| rel 改回相对 cwd | fail 8 | fail 5 |

**关键验证**：`process.exit()` 会截断 stdout，导致 `--json` 输出成残缺 JSON。
冒烟脚本的「空目录 basisComplete=false」当场变红，是这个 bug 的唯一检出点。
已改 `process.exitCode`，让 Node 自然退出刷新缓冲。

### 五、我自己的错误

1. **变异脚本缩进不匹配**。用 4 空格去匹配源码里的 2 空格 `if`，`assert` 直接报 `NOT APPLIED`。
   如果没盯输出，会把「变异没注入」当成「门禁失效」，得出完全相反的结论。

2. **批量变异共享备份导致串扰**。第一轮变异 4 的输出里混进了变异 2 的失败项。
   `diff` 备份确认文件干净后单独重跑才拿到可信数据。**变异必须逐个独立还原+复验。**

3. **冒烟把 stderr 拼进 JSON 解析**。`run()` 最初返回 `stdout + stderr`，
   导致「空目录 basisComplete」假失败。CLI 本身没错，是断言方法错了。
   已改为分开返回 `out` / `err`，需要看全部时用 `both()`。

4. **Windows runner 的 shell**。CI 最后一步用了 `test $? -eq 2`——bash 语法，
   而 windows-latest 默认 pwsh。已显式 `shell: bash`。

### 六、变更清单

| 文件 | 改动 |
|---|---|
| `index.js` | 新增 `bareName` / `collectImports` / `collectManifests`；入口前置校验；退出码 2/3；`--require-usage`；`basisComplete` / `usedInSource` / `declaredIn` / `countedForPenalty` 字段；`REDUNDANT` 改结构；`rel` 修正；`process.exit` → `process.exitCode` |
| `test.js` | 7 → 24 项 |
| `scripts/smoke-cli.js` | 新增，31 项断言 |
| `.github/workflows/verify.yml` | 新增，双平台 + 路径打错必退 2 |
| `README.md` | 全文重写，删吹牛段与npx 死命令 |
| `LICENSE` | 新增 MIT |
| `GH_OPTIMIZER_STATE.json` | 新增 |
| `OPTIMIZER_LOG.md` | 本文件 |
- 2026-10-25 引擎自动修复 S1/S2/L11
