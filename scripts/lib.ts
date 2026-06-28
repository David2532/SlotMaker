import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProject, type SlotProject } from "@slotmaker/config";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Resolve a project from a CLI arg, defaulting to the Golden Goal Rush reference. */
export function loadProjectArg(arg?: string): SlotProject {
  const path = arg
    ? resolve(process.cwd(), arg)
    : resolve(root, "projects/golden-goal-rush.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return loadProject(raw);
}

export function bar(value: number, max: number, width = 24): string {
  const filled = Math.round((Math.min(value, max) / max) * width);
  return "█".repeat(filled) + "·".repeat(Math.max(0, width - filled));
}

export const ROOT = root;
