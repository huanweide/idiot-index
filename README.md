# idiot-index · 白痴指数 CLI

> 白痴指数 = 成品复杂度 ÷ 理论最小复杂度。指数越高，制造流程里的浪费越大。
> 一键量化你的项目有多「胖」：可被原生 API 替代的依赖 + 过度工程分数。**零依赖、单文件、本地、确定性、可进 CI。**

## 为什么不是又一个 lint wrapper

`knip` 查死依赖、`eslint` 查复杂度、`depcheck` 查未用——它们是三个工具。我们把它们**组合成一个挑衅性单一指标 + 原生替代建议**，并且：

- 确定性：不靠 AI、不连网，同一项目永远同一分数。
- 可进 CI：一个数字即可做门禁（`--max`）。
- 天生病毒传播：「你的项目白痴指数是多少？」比「感觉很乱」好分享。

## 安装 / 运行

零依赖，拷文件即跑（Node ≥ 18）：

```bash
node index.js <目录>          # 扫描指定目录（默认当前目录）
node index.js --json         # 输出 JSON，供 CI 读取
node index.js --max 40       # 指数 > 40 时退出码 1（CI 门禁）
node index.js --help
```

或本地全局体验：

```bash
npm install -g .            # 之后可用 idiot-index <目录>
```

## 输出示例

```
======================================================
  白痴指数 (Idiot Index): 47/100   等级 C
======================================================
  扫描目录 : /path/to/your-project
  源码文件 : 128 个

[1] 可被原生 API 替代的依赖 (3)
    - moment  →  Intl.DateTimeFormat / Temporal
    - lodash  →  原生 Array/Object/Map 方法
    - axios   →  node:fetch (Node 18+)

[2] 最「胖」的 10 个文件 (按深度+抽象)
    -  82  src/legacy/router.ts  (行540, 深11, 类型14)
    ...

[3] 建议
    * 删掉 moment → 用 Intl.DateTimeFormat / Temporal
    * 存在嵌套 ≥8 层的文件，拆函数/提前 return 降深度

  物理不允许就别做——先删，再优化。
======================================================
```

## 它查什么

1. **冗余依赖**：`package.json` 里命中内置替代表的包（moment→Intl、lodash→原生、axios→fetch、uuid→crypto.randomUUID…），直接给「删掉它」建议。
2. **过度工程**：递归扫描源码，按「最大嵌套深度 + 类型/接口声明密度」给每个文件打分，列出 Top10 最胖文件。

两者合成 0–100 的**白痴指数**，A(<20) / B(<40) / C(<60) / D(<80) / F(≥80)。

## CI 集成

```yaml
# .github/workflows/bloat.yml
- run: npx -y idiot-index . --max 50
```

分数超标即红，逼团队在膨胀前刹车。

## 四问摘要（GitHub Forge 上午选题结论）

- **① 真实痛点**：JS 生态平均 `npm install` 拉进 80+ 传递依赖，大量可被原生 API 替代；过度抽象 silently 积累，却没人有一把确定性尺子量化「这项目有多胖」。
- **② 为什么是我们现在能做且有差异化**：Ponytail 单月 8k★ 证明「极简情绪」当下最热；它必须接 AI、结果不确定、进不了 CI——我们用确定性、离线、单一数字做它的物理补丁，与 knip/eslint 不重叠。
- **③ MVP 落地**：单文件 `index.js`，零依赖，纯 `node:fs` + 正则扫描；`npx idiot-index <dir>` 15 秒内出分数 + Top10 罪魁；`--max` 进 CI 门禁。
- **④ 风险与不做理由**：若 MVP 无法在 ~250 行内给出「让人愿意转发」的尖锐结论就删。已验证可在 ~250 行内成立。护城河来自「组合成单一挑衅指标」而非堆功能。

## License

MIT

---

## 作者

由 **ReTr · 樊斯瑞** 维护 · [GitHub 主页](https://github.com/huanweide)

## CI 门禁用法

开箱即可接入 CI：在流水线中运行本工具，它会输出健康分与严重度；若存在不达标项会以非 0 退出码结束，从而拦下问题提交（具体参数见上方「快速开始」）。

## 赞助支持

如果这个项目帮到了你，欢迎 [点 Star](https://github.com/huanweide/idiot-index) 支持；也可微信扫码自愿赞助（收款码见 `sponsor/wechat-qr.png`，作者本人带 Tri 水印的码，纯静态图片、不含任何密钥）。

## 许可证

详见 [LICENSE](LICENSE)。
