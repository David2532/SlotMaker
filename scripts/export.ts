import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMathReport, multiSeedSimulate } from "@slotmaker/math-engine";
import { exportBundle, serializeBundle } from "@slotmaker/exporter";
import { ROOT, loadProjectArg } from "./lib.js";

// Usage: pnpm export [projectPath] [--force]
const args = process.argv.slice(2);
const force = args.includes("--force");
const projectArg = args.find((a) => !a.startsWith("--"));

const project = loadProjectArg(projectArg);
// Build a real (multi-seed) math report and embed it in the bundle.
const mathReport = buildMathReport(project, multiSeedSimulate(project, { spins: 20_000, seeds: 3 }), { bonusBuyRounds: 10_000 });
const stats = { rtp: mathReport.rtp.observed, hitFrequency: mathReport.hitFrequency.mean, maxWin: mathReport.maxWin };

const result = exportBundle(project, { stats, mathReport, force });

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
