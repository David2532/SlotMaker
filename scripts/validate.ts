import { simulate } from "@slotmaker/math-engine";
import { autoFix, computeHealth } from "@slotmaker/validator";
import { bar, loadProjectArg } from "./lib.js";

// Usage: pnpm validate [projectPath] [--fix]
const args = process.argv.slice(2);
const fix = args.includes("--fix");
const projectArg = args.find((a) => !a.startsWith("--"));

let project = loadProjectArg(projectArg);
const sim = simulate(project, { spins: 50_000, seed: 1 });
const stats = { rtp: sim.rtp, hitFrequency: sim.hitFrequency, maxWin: sim.maxWin };

function print(label: string) {
  const h = computeHealth(project, stats);
  console.log(`\n  ${label}: Health ${h.score}/100   ${h.exportReady ? "✅ Export Ready" : "❌ Has blockers"}`);
  for (const c of h.categories) {
    console.log(`    ${c.category.padEnd(10)} ${bar(c.score, 100)} ${c.score}/100`);
  }
  if (h.issues.length) {
    console.log(`\n  Issues:`);
    for (const i of h.issues) {
      const mark = i.severity === "error" ? "✖" : i.severity === "warning" ? "⚠" : "ℹ";
      console.log(`    ${mark} [${i.category}] ${i.message}${i.autoFixable ? "  (auto-fixable)" : ""}`);
    }
  }
  return h;
}

console.log(`\n  SLOT FACTORY — Validator`);
console.log(`  Project: ${project.projectName}`);
print("BEFORE");

if (fix) {
  const { project: fixed, applied } = autoFix(project);
  project = fixed;
  console.log(`\n  Auto-Fix applied ${applied.length} safe change(s):`);
  for (const a of applied) console.log(`    • ${a}`);
  print("AFTER");
}
console.log();
