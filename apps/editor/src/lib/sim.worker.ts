/// <reference lib="webworker" />
import type { SlotProject } from "@slotmaker/config";
import { buildMathReport, multiSeedSimulate, type MathReport, type MultiSeedResult } from "@slotmaker/math-engine";

export interface SimRequest {
  project: SlotProject;
  spins: number;
  seeds: number;
}

export type SimResponse =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; multi: MultiSeedResult; report: MathReport };

// Heavy simulation runs here, off the main thread, so the editor never freezes
// even at 1M+ spins.
self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { project, spins, seeds } = e.data;
  const multi = multiSeedSimulate(project, {
    spins,
    seeds,
    onProgress: (done, total) => (self as DedicatedWorkerGlobalScope).postMessage({ type: "progress", done, total } satisfies SimResponse),
  });
  const report = buildMathReport(project, multi);
  (self as DedicatedWorkerGlobalScope).postMessage({ type: "done", multi, report } satisfies SimResponse);
};
