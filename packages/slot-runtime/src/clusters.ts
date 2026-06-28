import type { SlotProject } from "@slotmaker/config";
import type { Grid } from "./grid.js";

export interface ClusterWin {
  symbolId: string;
  /** Flat cell indices that make up the winning cluster (incl. wilds). */
  positions: number[];
  size: number;
  multiplier: number;
  /** Win for this cluster in bet multiples. */
  win: number;
}

interface SymbolLookup {
  kindById: Map<string, string>;
  paysById: Map<string, { minSize: number; multiplier: number }[]>;
  wildIds: Set<string>;
}

export function buildSymbolLookup(project: SlotProject): SymbolLookup {
  const kindById = new Map<string, string>();
  const paysById = new Map<string, { minSize: number; multiplier: number }[]>();
  const wildIds = new Set<string>();
  for (const s of project.symbols) {
    kindById.set(s.id, s.kind);
    if (s.kind === "wild") wildIds.add(s.id);
    // Sort tiers descending so the first match is the best-paying tier.
    const tiers = [...s.pays].sort((a, b) => b.minSize - a.minSize);
    paysById.set(s.id, tiers);
  }
  return { kindById, paysById, wildIds };
}

function payFor(
  lookup: SymbolLookup,
  symbolId: string,
  size: number,
): number {
  const tiers = lookup.paysById.get(symbolId);
  if (!tiers) return 0;
  for (const t of tiers) {
    if (size >= t.minSize) return t.multiplier;
  }
  return 0;
}

/**
 * Cluster-pays detection with wild substitution.
 *
 * For each paying (high/low) symbol type, flood-fill the orthogonally connected
 * region of cells that are either that symbol or a wild. A region pays when it
 * contains at least one real symbol cell and is at least `minClusterSize`.
 * Wilds may contribute to clusters of different symbol types (standard for
 * cluster-pays games like Reactoonz/Cluster slots).
 */
export function detectClusters(project: SlotProject, grid: Grid): ClusterWin[] {
  const lookup = buildSymbolLookup(project);
  const { columns, rows } = project.grid;
  const minSize = project.math.minClusterSize;
  const wins: ClusterWin[] = [];

  // Candidate paying symbol ids (those with at least one pay tier).
  const payingIds = project.symbols
    .filter((s) => (lookup.paysById.get(s.id)?.length ?? 0) > 0)
    .map((s) => s.id);

  const neighbors = (idx: number): number[] => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const out: number[] = [];
    if (col > 0) out.push(idx - 1);
    if (col < columns - 1) out.push(idx + 1);
    if (row > 0) out.push(idx - columns);
    if (row < rows - 1) out.push(idx + columns);
    return out;
  };

  for (const target of payingIds) {
    const visited = new Uint8Array(grid.length);
    const matches = (idx: number) =>
      grid[idx] === target || lookup.wildIds.has(grid[idx]!);

    for (let start = 0; start < grid.length; start++) {
      if (visited[start] || grid[start] !== target) continue;
      // BFS the connected target-or-wild region seeded from a real target cell.
      const stack = [start];
      const region: number[] = [];
      let realCount = 0;
      visited[start] = 1;
      while (stack.length) {
        const cur = stack.pop()!;
        region.push(cur);
        if (grid[cur] === target) realCount++;
        for (const n of neighbors(cur)) {
          if (!visited[n] && matches(n)) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }
      if (realCount > 0 && region.length >= minSize) {
        const multiplier = payFor(lookup, target, region.length);
        if (multiplier > 0) {
          wins.push({
            symbolId: target,
            positions: region.sort((a, b) => a - b),
            size: region.length,
            multiplier,
            win: multiplier,
          });
        }
      }
    }
  }

  return wins;
}

export function countKind(project: SlotProject, grid: Grid, kind: string): number {
  const ids = new Set(
    project.symbols.filter((s) => s.kind === kind).map((s) => s.id),
  );
  let n = 0;
  for (const cell of grid) if (ids.has(cell)) n++;
  return n;
}
