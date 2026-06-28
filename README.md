# SLOT FACTORY

> Not "build a slot." **Automate slot production.**
> Idea → playable slot → simulated math → export, in minutes.

SLOT FACTORY is a modular slot **production platform**, not a one-off editor. A slot
is never hidden in code — it is a single, validated **config** that the runtime,
math engine, validator and exporter all read. That separation is what lets one
mechanic become twenty slots (reskin), and what keeps the math honest (you never
*feel* RTP — you simulate it).

The reference project is **Golden Goal Rush**: a 6×5 cluster slot with cascades,
scatter free spins, a coin collector and bonus buy, in a black-&-gold football
stadium skin.

---

## Phase 1 — what's built

This branch delivers the **core production loop** end to end:

| Step | Delivered |
| --- | --- |
| 1. Config schema (source of truth) | `@slotmaker/config` (Zod-validated `SlotProject`) |
| 2. Cluster 6×5 runtime | `@slotmaker/slot-runtime` (seeded RNG, cluster detection w/ wilds, cascades) |
| 3. Renderer + live preview | `apps/editor` (SvelteKit + PixiJS) |
| 4. Golden Goal Rush template/theme/project | `templates/`, `themes/`, `projects/golden-goal-rush.json` |
| 5. Win detection | flood-fill clusters → step sequence (drives preview **and** animation) |
| 6. Math simulation | `@slotmaker/math-engine` (RTP, hit/bonus freq, distribution, contribution) |
| 7. Validator + health score + auto-fix | `@slotmaker/validator` |
| 8. Export (JSON bundle, gated) | `@slotmaker/exporter` |

Everything runs **headless from the CLI** and **live in the browser editor**.

---

## Architecture

Editor and runtime are strictly separated. The config is the only shared state.

```
slotmaker/
  packages/
    config/            # SlotProject schema + validation (the source of truth)
    slot-runtime/      # RNG, grid, cluster detection, cascades, spin orchestration
    math-engine/       # seeded Monte-Carlo simulation + balance suggestions
    animation-system/  # preset registry + buildTimeline() (Phase 2)
    sound-system/      # sound packs + buildSoundCues() / autoSyncSounds() (Phase 2)
    validator/         # checks, health score, safe auto-fix
    exporter/          # validated, self-describing JSON bundle
  apps/
    editor/         # SvelteKit + PixiJS — builder, math lab, validator, export
  templates/cluster-6x5/      # skin-agnostic mechanic descriptor
  themes/golden-goal-rush/    # the football black-&-gold skin
  projects/golden-goal-rush.json   # the reference slot (calibrated to ~96% RTP)
  scripts/          # sim / validate / export CLIs
```

Data flow (one direction): **Config → Runtime → Win detection → Math → Validator → Export.**

---

## Quick start

```bash
pnpm install

pnpm test          # unit tests for runtime, math, validator, exporter
pnpm typecheck     # tsc -b across all packages

pnpm sim           # simulate Golden Goal Rush (100k spins) and print the math report
pnpm validate      # project health score + issue list
pnpm validate --fix   # apply safe auto-fixes and show before/after health
pnpm export        # write a validated bundle to dist/exports/

pnpm editor        # run the live editor (PixiJS preview) at localhost:5173
pnpm editor:build  # production build of the editor
```

`pnpm sim` accepts args: `pnpm sim <projectPath> <spins> <seed>`.

### Example: `pnpm sim`

```
  RTP            95.15%   (target 96%)
  Hit frequency  26.21%   (target 24%)
  Bonus freq     1 in 302 (target 1 in 180)
  Feature contribution:  Base 88.50%  Free spins 5.82%  Coins 0.83%
```

The RTP wobbles ~1% by seed — that's Monte-Carlo variance, and exactly why the
balance assistant flags drift instead of trusting a single run.

---

## Key design decisions

- **Seeded everything.** `Rng` is deterministic; the same seed reproduces the
  same spins and the same simulation, so results are reproducible and debuggable.
- **Cluster pays with wild substitution.** A connected (orthogonal) region of a
  symbol + wilds pays when it is ≥ `minClusterSize` and contains ≥ 1 real symbol.
- **Steps drive both preview and animation.** A spin returns the full cascade
  step list (`grid`, `wins`, `removed`), so the renderer and the (Phase-2)
  animation timeline read the same data.
- **The validator is the export gate.** A project with errors will not export
  unless explicitly forced ("Export anyway"). No broken builds.
- **Auto-fix is safe-only.** It binds default sounds/animations, fills placeholder
  labels and fits the board to mobile — but never touches weights or pays, because
  those change RTP and must go through the simulator.

---

## Phase 2 — in progress (this branch)

Event-based **animation** and **sound** systems, both fed by the exact same spin
step sequence as the live preview — so visuals, timeline and audio can never drift:

- `@slotmaker/animation-system` — `buildTimeline(project, round)` turns a played
  round into ordered, timed events (`spin_start`, staggered `reel_drop` per
  column, `symbol_land`, `win_detected` / `cluster_remove` / `cascade_drop` per
  cascade, `scatter_land`, `bonus_trigger`, `coin_collect`, `big_win_start`),
  plus a swappable preset registry.
- `@slotmaker/sound-system` — `buildSoundCues(project, timeline)` schedules sounds
  against the timeline (event start + binding delay); `autoSyncSounds()` is the
  one-click "Auto Sync" that fills unbound events from a sound pack.
- **Editor** — the board now plays back off a single timeline clock; new
  **Animation Timeline** (lanes + live playhead) and **Sound Timeline** panels
  visualize the last spin.

## Roadmap (next phases)

- **Phase 2 (remaining)** — symbol states, asset pipeline, responsive HUD editor,
  move simulation into a Web Worker, real audio playback.
- **Phase 3** — 1M/10M parallel simulation, volatility graphs, bonus-buy & ante
  calculators, auto-balance that edits weights and re-simulates.
- **Phase 4** — AI agents (theme/asset/animation/sound/QA), one-click reskin,
  preset marketplace.
- **Phase 5** — Factory mode: batch-generate, simulate and export many slots from
  one mechanic.
