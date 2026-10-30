**中文** · [README.md](./README.md)

> [!WARNING]
> **⚠️ This tool has been merged into the [doctors](https://github.com/huanweide/doctors) monorepo and is no longer maintained here.**
>
> The source now lives at [`doctors/packages/idiot-index/`](https://github.com/huanweide/doctors/tree/main/packages/idiot-index). Inside doctors it runs as the `doctors idiot` subcommand (or `node packages/idiot-index/index.js`). This repository no longer accepts changes — please use <https://github.com/huanweide/doctors>.

<!-- badges -->
[![License](https://img.shields.io/github/license/huanweide/idiot-index)](LICENSE)
[![Stars](https://img.shields.io/github/stars/huanweide/idiot-index)](https://github.com/huanweide/idiot-index/stargazers)
[![zero-dep checkup CLI](https://img.shields.io/badge/zero--dep%20checkup%20CLI-18%20tools-22c55e)](https://github.com/huanweide/family-showcase)
<!-- /badges -->

**🔧 Part of the [huanweide zero-dependency CLI family](https://github.com/huanweide/family-showcase) (18 single-file tools). Use it standalone, as a subcommand inside the [doctors](https://github.com/huanweide/doctors) monorepo, or run everything together via [enghealth](https://github.com/huanweide/enghealth).**

# idiot-index · the Idiot Index CLI

> Idiot Index = product complexity ÷ theoretical minimum complexity. The higher the index, the more waste in how something was built.
> Quantify in one command how "bloated" your project is: dependencies replaceable by native APIs + an over-engineering score. **Zero dependencies, single file, local, deterministic, CI-ready.**

> **📦 Portability snapshot**
>
> - **Zero-dependency, single file** (`index.js`); copy it into any repo and `node index.js .` runs it, no `npm install`.
> - Local, deterministic, CI-ready (`--max` as a gate); requires Node >= 18.

## Who should use this

- Teams that want a single, shareable number for "how much unnecessary weight did we add".
- Anyone tired of running three separate tools (dead-dep finder, complexity linter, unused-dep checker) to judge bloat.
- Projects where dependency bloat and over-engineering are creeping in and you want a brake before they explode.

## Who should not use this

- If you want per-rule, detailed lint reports — this collapses everything into one provocative score on purpose.
- Note: this repo is deprecated — prefer `doctors idiot` for new setups.

## Why it's not just another lint wrapper

`knip` finds dead deps, `eslint` finds complexity, `depcheck` finds unused — three tools. We combine them into **one provocative single metric + native-replacement suggestions**, and:

- Deterministic: no AI, no network — the same project always gets the same score.
- CI-ready: one number is all you need for a gate (`--max`).
- Naturally viral: "what's your project's idiot index?" shares better than "feels messy".

## Install and run

Zero dependencies, copy-and-run (Node >= 18):

```bash
node index.js .                   # scan current directory
node index.js src/               # scan a specific directory
node index.js . --json           # output JSON for CI
node index.js . --max 40         # exit code 1 if index > 40 (CI gate)
node index.js . --require-usage  # only score redundant deps "unreferenced in source"
node index.js --help
```

> Note: there is **no** `idiot-index` package on npm (confirmed E404), so `npx idiot-index` fails. Use `node index.js` directly, or `npm install -g .` and then the global command.

## What it checks

1. **Redundant dependencies**: packages in `package.json` that hit the built-in replacement table (moment→Intl, lodash→native, axios→fetch, uuid→crypto.randomUUID…).
2. **Over-engineering**: recursively scans source, scores each file by "max nesting depth + type/interface declaration density", and lists the Top 10 fattest files.

The two combine into a 0–100 **idiot index**, graded A(<20) / B(<40) / C(<60) / D(<80) / F(>=80).

## How it distinguishes "delete" from "evaluate migration"

This is the most important honesty design in the tool.

**Reading only `package.json` gives harmful advice**: if your code is `require('lodash')`, and the tool says "delete lodash" just because `package.json` declares it — doing that is asking for trouble.

So the tool scans real references in source (`require()` / `import x from` / `import 'x'` / `lodash/fp` subpaths), and splits the conclusion into two:

| State | Conclusion | Copy |
|---|---|---|
| `usedInSource: false` | can really be deleted | `[unreferenced] delete moment → use Intl.DateTimeFormat / Temporal` |
| `usedInSource: true` | only migration can be evaluated | `[in use] axios is referenced in source, evaluate migration cost first → target node:fetch (needs Node 18+)` |

Replacements with version gates (`glob`→`node:fs.glob` needs Node 22+) carry `needs Node NN+` in the copy — no deception.

**The default scoring basis is unchanged** (still scores by declaration, backward compatible). For a stricter basis add `--require-usage`, which then only counts "unreferenced" redundant deps toward the penalty.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | scan complete, and index within threshold |
| 1 | index exceeds threshold (`--max`) |
| 2 | parameter error / target dir doesn't exist / target isn't a directory |
| 3 | **no source files scanned** — a 0 score doesn't mean healthy; the score isn't a valid conclusion |

## Why exit code 3 exists

Old versions handled a typo'd path or empty directory like this: scanned 0 files → score 0 → grade A → "dependencies restrained, nice" → **exit code 0**.

In other words, **you typo the directory name and CI gives you a green pass**. That's far worse than a false negative.

Now: a non-existent target exits 2 directly; a target that exists but scans no source files outputs `basisComplete: false` and exits 3. The `basisComplete` in JSON is the trust switch for CI.

## JSON output

```json
{
  "score": 18,
  "grade": "A",
  "redundantFound": [
    {
      "name": "lodash",
      "replacement": "native Array/Object/Map methods",
      "requiresNode": null,
      "dev": false,
      "declaredIn": ".",
      "usedInSource": true
    }
  ],
  "countedForPenalty": ["lodash"],
  "strictUsage": false,
  "scannedFiles": 128,
  "manifestsFound": 1,
  "basisComplete": true,
  "topFiles": [ ... ],
  "suggestions": [ ... ]
}
```

## CI integration

```yaml
- run: node idiot-index/index.js . --max 50
```

A score over the threshold turns red, forcing the team to brake before it balloons.

## monorepo

Recursively discovers all `package.json` (including workspaces sub-packages); redundant deps are tagged `declaredIn` so the source is clear at a glance. Capped at 200 manifests to avoid runaway scans on giant repos.

## Develop

```bash
node test.js                   # self-tests (24)
node scripts/smoke-cli.js      # end-to-end smoke (31 spawn-level assertions)
```

## More zero-dependency CLIs

huanweide also maintains a series of checkup CLIs with the same pattern (18 single-file tools in total). Visit [family-showcase](https://github.com/huanweide/family-showcase) for the overview, or use the aggregate runner [doctors](https://github.com/huanweide/doctors).

## License

MIT, see [LICENSE](LICENSE).

## Author

Maintained by **huanweide** · [GitHub](https://github.com/huanweide)
