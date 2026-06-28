import type { SlotProject, SymbolDef } from "@slotmaker/config";
import type { Rng } from "./rng.js";

/**
 * A grid is a flat, row-major array of symbol ids of length `columns * rows`.
 * Cell index = row * columns + col. Flat arrays keep the cluster flood-fill and
 * the renderer cheap and allocation-light during 10M-spin simulations.
 */
export type Grid = string[];

export interface WeightedTable {
  symbols: SymbolDef[];
  cumulative: number[];
  total: number;
}

/** Precompute a cumulative weight table once per simulation, not per cell. */
export function buildWeightTable(project: SlotProject): WeightedTable {
  const symbols = project.symbols.filter((s) => s.weight > 0);
  const cumulative: number[] = [];
  let total = 0;
  for (const s of symbols) {
    total += s.weight;
    cumulative.push(total);
  }
  return { symbols, cumulative, total };
}

export function drawSymbol(table: WeightedTable, rng: Rng): string {
  const r = rng.next() * table.total;
  // Linear scan is fine for the ~12 symbol counts slots use.
  for (let i = 0; i < table.cumulative.length; i++) {
    if (r < table.cumulative[i]!) return table.symbols[i]!.id;
  }
  return table.symbols[table.symbols.length - 1]!.id;
}

export function fillGrid(project: SlotProject, table: WeightedTable, rng: Rng): Grid {
  const size = project.grid.columns * project.grid.rows;
  const grid: Grid = new Array(size);
  for (let i = 0; i < size; i++) grid[i] = drawSymbol(table, rng);
  return grid;
}

export function indexOf(project: SlotProject, col: number, row: number): number {
  return row * project.grid.columns + col;
}
