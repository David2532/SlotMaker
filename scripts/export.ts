import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { simulate } from "@slotmaker/math-engine";
import { exportBundle, serializeBundle } from "@slotmaker/exporter";
import { ROOT, loadProjectArg } from "./lib.js";

// Usage: pnpm export [projectPath] [--force]
const args = process.argv.slice(2);
const force = args.includes("--force");
const projectArg = args.find((a) => !a.startsWith("--"));

const project = loadProjectArg(projectArg);
const sim = simulate(project, { spins: 50_000, seed: 1 });
const stats = { rtp: sim.rtp, hitFrequency: sim.hitFrequency, maxWin: sim.maxWin };

const result = exportBundle(project, { stats, force });

console.log(`\n  SLOT FACTORY — Export Center`);
console.log(`  Project: ${project.projectName}  (health ${result.bundle.manifest.health}/100)`);

if (!result.ok) {
  console.log(`\n  ❌ Export blocked by validator:`);
  for (const b of result.blockers) console.log(`     ✖ ${b}`);
  console.log(`\n  Re-run with --force to export anyway.\n`);
  process.exit(1);
}

const outDir = resolve(ROOT, "dist/exports");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `${project.id}.slot.json`);
writeFileSync(outPath, serializeBundle(result.bundle));

console.log(`\n  ✅ Exported${force ? " (forced)" : ""} → ${outPath}\n`);
