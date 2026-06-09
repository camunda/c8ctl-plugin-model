# AGENTS.md

This file describes how to efficiently implement and iterate on this c8ctl plugin as an autonomous coding agent.

## Goal

Build and maintain a plugin that exposes a `model` command for building BPMN process models incrementally from the CLI. The BPMN file is always the source of truth; `.c8ctl-model.json` tracks only the cursor position and active file path.

## Plugin Contract

- Plugin entry point: `c8ctl-plugin.js` (root re-export to `dist/c8ctl-plugin.js`)
- Source file: `src/c8ctl-plugin.ts`
- Build output: `dist/c8ctl-plugin.js`
- Required export: `commands` object mapping command name → async handler
- Optional export: `metadata` object for help descriptions

## Key Architecture

- `src/bpmn.ts` — all BPMN read/write/mutation logic via `bpmn-moddle`
- `src/state.ts` — reads/writes `.c8ctl-model.json` (cursor + file path only)
- `src/layout.ts` — recomputes all BPMNShape/BPMNEdge positions after each mutation
- `src/args.ts` — minimal flag parser (`--source`, `--id`, etc.)
- `src/commands/` — one file per subcommand

## Development Loop

1. `npm install`
2. `npm run build`
3. `c8ctl load plugin --from file://${PWD}`
4. `c8ctl model init my-process`
5. `c8ctl model append userTask 'Review Application'`
6. `c8ctl model status`

## Quality Checks

1. Build succeeds: `npm run build`
2. Plugin loads: `c8ctl load plugin --from file://${PWD}`
3. `c8ctl help` shows the `model` command
4. `c8ctl model init my-process` creates `my-process.bpmn` in CWD
5. Resulting `.bpmn` file opens correctly in Camunda Modeler

## Minimal Change Policy

- Make the smallest change required for each task.
- Do not add unrelated commands or refactors.
- Keep `metadata.commands` descriptions concise and user-facing.

## Structural Invariants

- **"Always green" CI policy**: every PR must pass all checks before merging.  Broken builds block all other work.
- **Warnings are fatal**: do not suppress or ignore a warning to make a build pass.  Fix the root cause instead.
- **No silent failures**: do not treat any failure as pre-existing or unrelated without explicit confirmation from the engineer.
- **On every change**: verify that all tests pass (`npm test`) and the build succeeds (`npm run build`) with zero errors and zero warnings.
