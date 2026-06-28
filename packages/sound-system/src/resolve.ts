import type { AnimationEvent, SlotProject } from "@slotmaker/config";
import { resolveSound, type ResolveContext, type ResolvedAsset } from "@slotmaker/asset-pipeline";
import { toneForEvent, type ToneSpec } from "./tone.js";

/** A resolved sound, with a tone spec attached when it resolves to a dev tone. */
export interface ResolvedSoundCue extends ResolvedAsset {
  tone?: ToneSpec;
}

/**
 * Sound asset resolver (sound-system view): real file → generated tone (demo) →
 * placeholder → missing. Adds the synthesized tone spec for generated cues so
 * the player can produce audible placeholder sound without any real files.
 */
export function resolveSoundCue(
  project: SlotProject,
  event: AnimationEvent,
  ctx: ResolveContext = {},
): ResolvedSoundCue {
  const r = resolveSound(project, event, ctx);
  return r.status === "generated" ? { ...r, tone: toneForEvent(event) } : r;
}
