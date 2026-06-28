import type { AnimationEvent, SymbolState } from "@slotmaker/config";
import type { DevPack } from "./types.js";

/**
 * Golden Goal Rush dev pack. It can stand in for every symbol state, every
 * sound and the background using procedurally generated assets — drawn shapes
 * from the symbol's own colour/label and synthesized tones for sounds. This
 * makes the slot fully previewable/testable WITHOUT shipping any fake binaries.
 *
 * The `gen:` uris are descriptors the renderer / tone synth interpret at
 * runtime; nothing is written to disk and nothing pretends to be real art.
 */
export function createGoldenGoalRushDevPack(): DevPack {
  return {
    id: "ggr-dev",
    name: "Golden Goal Rush — Dev Placeholder Pack",
    canSymbol: () => true,
    symbolUri: (symbolId: string, state: SymbolState) => `gen:symbol/${symbolId}/${state}`,
    canSound: () => true,
    soundUri: (event: AnimationEvent) => `gen:tone/${event}`,
    canBackground: () => true,
    backgroundUri: () => `gen:background/stadium`,
  };
}
