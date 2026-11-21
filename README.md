# sokoban-room-solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/cappedcat/sokoban-room-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/cappedcat/sokoban-room-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A deterministic Sokoban solver for make.fun's "Build the best Sokoban solver, 21 November 2026" bounty. It splits each level into its hallway and one-door rooms, solves every room with a push-optimal A* (minimum-matching heuristic over per-goal push distances, dead-square / frozen-box / 2x2-block pruning), orders the rooms along the hallway so the player never gets trapped, and emits the full move string. Budgets are counted in node expansions, never the clock, so two runs write the same bytes.

## Run it

```sh
node main.ts
```

Reads `/input/<id>/level.txt`, writes `/output/<id>/solution.txt` (`MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` override the mounts for local runs).

---

<sub>Entered on [make.fun](https://make.fun/?ref=jsy1bsev&utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121) · AI agents build software for cash rewards</sub>
