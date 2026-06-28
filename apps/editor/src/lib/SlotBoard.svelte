<script lang="ts">
  import { onMount } from "svelte";
  import type { SlotProject } from "@slotmaker/config";
  import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

  interface Props {
    project: SlotProject;
    grid: string[];
    highlight: Set<number>;
    /** Current global render state (static/spin/land/win) from the timeline. */
    renderState?: string;
    /** Status of the resolved symbol assets ("generated" in demo). */
    assetStatus?: string;
  }
  let { project, grid, highlight, renderState = "static", assetStatus = "generated" }: Props = $props();

  const STATUS_DOT: Record<string, number> = {
    real: 0x2d9c6f,
    generated: 0xc98a2b,
    placeholder: 0xe8b923,
    missing: 0xe63946,
  };

  const PAD = 8;
  const cell = $derived(Math.min(project.grid.cellSize, 92));
  const cols = $derived(project.grid.columns);
  const rows = $derived(project.grid.rows);
  const dropDistance = $derived(PAD + rows * cell + cell); // start above the canvas top
  const DROP_MS = 360;
  const STAGGER_MS = 55;
  const LAND_MS = 180;

  let host: HTMLDivElement;
  let app: Application | null = null;

  // Live snapshot the ticker reads (kept out of Svelte reactivity for 60fps).
  const live = { grid: [] as string[], highlight: new Set<number>(), renderState: "static" };

  interface Cell {
    container: Container;
    bg: Graphics;
    glow: Graphics;
    label: Text;
    symbolId: string;
    offsetY: number;
    dropStart: number; // performance.now() ms when this cell starts dropping
    landStart: number; // when the land squash began (0 = none)
    glowAlpha: number;
  }
  let cells: Cell[] = [];

  const symOf = (id: string) => project.symbols.find((s) => s.id === id);
  const colorFor = (id: string) => parseInt((symOf(id)?.color ?? "#888888").replace("#", ""), 16);
  const labelFor = (id: string) => symOf(id)?.label ?? id;
  const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  function paintSymbol(c: Cell, id: string) {
    const half = cell / 2;
    c.bg.clear();
    c.bg.roundRect(-half + 4, -half + 4, cell - 8, cell - 8, 12);
    c.bg.fill({ color: colorFor(id) });
    c.bg.stroke({ width: 2, color: 0x000000, alpha: 0.35 });
    // Premium symbols get an inner ring for a touch of depth.
    if (symOf(id)?.kind === "high" || symOf(id)?.kind === "wild") {
      c.bg.circle(0, 0, half - 16);
      c.bg.stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    }
    c.label.text = labelFor(id);
  }

  function makeCell(i: number): Cell {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const container = new Container();
    container.position.set(PAD + col * cell + cell / 2, PAD + row * cell + cell / 2);

    const glow = new Graphics();
    const half = cell / 2;
    glow.roundRect(-half + 2, -half + 2, cell - 4, cell - 4, 14);
    glow.stroke({ width: 4, color: 0xffd700, alpha: 1 });
    glow.alpha = 0;
    container.addChild(glow);

    const bg = new Graphics();
    container.addChild(bg);

    const label = new Text({
      text: "",
      style: new TextStyle({ fill: 0x0b0f0a, fontFamily: "Arial", fontSize: 20, fontWeight: "bold" }),
    });
    label.anchor.set(0.5);
    container.addChild(label);

    const dot = new Graphics();
    dot.circle(cell / 2 - 12, -cell / 2 + 12, 4);
    dot.fill({ color: STATUS_DOT[assetStatus] ?? 0x888888 });
    container.addChild(dot);

    return { container, bg, glow, label, symbolId: "", offsetY: 0, dropStart: 0, landStart: 0, glowAlpha: 0 };
  }

  function frame(now: number) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const id = live.grid[i];
      if (id == null) continue;
      if (id !== c.symbolId) {
        // New symbol → drop it in from above, staggered by column.
        c.symbolId = id;
        paintSymbol(c, id);
        c.offsetY = -dropDistance;
        c.dropStart = now + (i % cols) * STAGGER_MS;
        c.landStart = 0;
      }

      // Drop animation.
      if (c.offsetY < 0) {
        if (now >= c.dropStart) {
          const p = clamp01((now - c.dropStart) / DROP_MS);
          c.offsetY = -dropDistance * (1 - easeOutCubic(p));
          if (p >= 1) {
            c.offsetY = 0;
            c.landStart = now;
          }
        }
      }

      // Landing squash.
      let sx = 1;
      let sy = 1;
      if (c.landStart && now - c.landStart < LAND_MS) {
        const p = (now - c.landStart) / LAND_MS;
        const squash = Math.sin(p * Math.PI) * 0.16;
        sy = 1 - squash;
        sx = 1 + squash;
      } else {
        c.landStart = 0;
      }

      // Win pulse + glow.
      const won = live.highlight.has(i);
      const targetGlow = won ? 0.45 + 0.3 * Math.sin(now / 140) : 0;
      c.glowAlpha += (targetGlow - c.glowAlpha) * 0.2;
      c.glow.alpha = Math.max(0, c.glowAlpha);
      const pulse = won ? 1 + 0.05 * (0.5 + 0.5 * Math.sin(now / 130)) : 1;

      c.container.position.y = PAD + Math.floor(i / cols) * cell + cell / 2 + c.offsetY;
      c.container.scale.set(sx * pulse, sy * pulse);
    }
  }

  onMount(() => {
    let disposed = false;
    const width = PAD * 2 + cols * cell;
    const height = PAD * 2 + rows * cell;
    const application = new Application();
    application.init({ width, height, background: 0x0b0f0a, antialias: true }).then(() => {
      if (disposed) {
        application.destroy(true);
        return;
      }
      app = application;
      const board = new Container();
      app.stage.addChild(board);
      for (let i = 0; i < cols * rows; i++) {
        const c = makeCell(i);
        cells.push(c);
        board.addChild(c.container);
      }
      host.appendChild(app.canvas);
      app.ticker.add(() => frame(performance.now()));
    });
    return () => {
      disposed = true;
      app?.destroy(true);
      app = null;
      cells = [];
    };
  });

  // Mirror reactive props into the snapshot the ticker reads.
  $effect(() => {
    live.grid = grid;
    live.highlight = highlight;
    live.renderState = renderState;
  });
</script>

<div class="board" bind:this={host}></div>

<style>
  .board {
    display: inline-block;
    max-width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 0 0 2px #1c2b1a, 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  .board :global(canvas) {
    display: block;
    max-width: 100%;
    height: auto !important;
  }
</style>
