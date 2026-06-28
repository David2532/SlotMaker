import { simulate, suggestBalance } from "@slotmaker/math-engine";
import { bar, loadProjectArg } from "./lib.js";

// Usage: pnpm sim [projectPath] [spins] [seed]
const [, , projectArg, spinsArg, seedArg] = process.argv;
const spins = Number(spinsArg ?? 100_000);
const seed = seedArg ? Number(seedArg) : undefined;

const project = loadProjectArg(projectArg);

console.log(`\n  SLOT FACTORY — Simulator`);
console.log(`  Project : ${project.projectName} (${project.template} / ${project.theme})`);
console.log(`  Grid    : ${project.grid.columns}x${project.grid.rows}, minCluster ${project.math.minClusterSize}`);
console.log(`  Spins   : ${spins.toLocaleString()}\n`);

const t0 = performance.now();
const r = simulate(project, { spins, seed });
const ms = performance.now() - t0;

const pct = (n: number) => `${n.toFixed(2)}%`;
console.log(`  RTP            ${pct(r.rtp)}   (target ${project.math.targetRtp}%)`);
console.log(`  Hit frequency  ${pct(r.hitFrequency)}   (target ${project.math.hitFrequencyTarget}%)`);
console.log(`  Dead spins     ${pct(r.deadSpinRate)}`);
console.log(`  Bonus freq     1 in ${Number.isFinite(r.bonusFrequency) ? r.bonusFrequency.toFixed(0) : "—"}   (target 1 in ${project.math.bonusFrequencyTarget})`);
console.log(`  Max win        ${r.maxWin.toFixed(0)}x   (cap ${project.math.maxWin}x, hit ${r.cappedRounds}x)`);
console.log(`  Avg win        ${r.avgWin.toFixed(3)}x\n`);

console.log(`  Feature contribution (RTP %):`);
console.log(`    Base game   ${pct(r.contribution.base)}`);
console.log(`    Free spins  ${pct(r.contribution.freeSpins)}`);
console.log(`    Coins       ${pct(r.contribution.coin)}\n`);

console.log(`  Win distribution:`);
const maxCount = Math.max(...r.distribution.map((b) => b.count), 1);
for (const b of r.distribution) {
  if (b.count === 0) continue;
  console.log(`    ${b.label.padEnd(10)} ${bar(b.count, maxCount)} ${b.count.toLocaleString()}`);
}

console.log(`\n  Balance suggestions:`);
for (const s of suggestBalance(project, r)) {
  console.log(`    ${s.severity === "warning" ? "⚠" : "ℹ"} ${s.action}`);
  console.log(`       → ${s.impact}`);
}

console.log(`\n  Simulated ${spins.toLocaleString()} spins in ${ms.toFixed(0)} ms (${(spins / (ms / 1000)).toFixed(0)} spins/s)\n`);
