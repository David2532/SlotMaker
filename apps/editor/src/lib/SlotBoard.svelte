<script lang="ts">
  import { onMount } from "svelte";
  import type { SlotProject } from "@slotmaker/config";
  import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

  interface Props {
    project: SlotProject;
    grid: string[];
    highlight: Set<number>;
  }
  let { project, grid, highlight }: Props = $props();

  let host: HTMLDivElement;
  let app: Application | null = null;
  let board: Container | null = null;
  let ready = $state(false);

  const PAD = 8;
  const cell = 92; // on-screen cell size (independent of config cellSize)

  const colorFor = (id: string): number => {
    const sym = project.symbols.find((s) => s.id === id);
    return sym ? parseInt(sym.color.replace("#", ""), 16) : 0x333333;
  };
  const labelFor = (id: string): string =>
    project.symbols.find((s) => s.id === id)?.label ?? id;

  function draw() {
    if (!app || !board) return;
    board.removeChildren();
    const { columns, rows } = project.grid;
    for (let i = 0; i < grid.length; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = PAD + col * cell;
      const y = PAD + row * cell;
      const won = highlight.has(i);

      const g = new Graphics();
      g.roundRect(x + 3, y + 3, cell - 6, cell - 6, 10);
      g.fill({ color: colorFor(grid[i]!), alpha: won ? 1 : 0.85 });
      g.stroke({ width: won ? 4 : 2, color: won ? 0xffd700 : 0x000000, alpha: won ? 1 : 0.4 });
      board.addChild(g);

      const style = new TextStyle({
        fill: 0x0b0f0a,
        fontFamily: "Arial",
        fontSize: 20,
        fontWeight: "bold",
      });
      const t = new Text({ text: labelFor(grid[i]!), style });
      t.anchor.set(0.5);
      t.position.set(x + cell / 2, y + cell / 2);
      board.addChild(t);
    }
  }

  onMount(() => {
    let disposed = false;
    const { columns, rows } = project.grid;
    const width = PAD * 2 + columns * cell;
    const height = PAD * 2 + rows * cell;
    const application = new Application();
    application
      .init({ width, height, background: 0x0b0f0a, antialias: true })
      .then(() => {
        if (disposed) {
          application.destroy(true);
          return;
        }
        app = application;
        board = new Container();
        app.stage.addChild(board);
        host.appendChild(app.canvas);
        ready = true;
        draw();
      });
    return () => {
      disposed = true;
      app?.destroy(true);
      app = null;
      board = null;
    };
  });

  // Redraw whenever the grid or highlight changes.
  $effect(() => {
    void grid;
    void highlight;
    if (ready) draw();
  });
</script>

<div class="board" bind:this={host}></div>

<style>
  .board {
    display: inline-block;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 0 0 2px #1c2b1a, 0 12px 40px rgba(0, 0, 0, 0.5);
  }
</style>
