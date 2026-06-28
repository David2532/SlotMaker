import type { SlotProject, SoundBinding } from "@slotmaker/config";
import type { Timeline } from "@slotmaker/animation-system";
import { STADIUM_PACK, type SoundPack } from "./pack.js";

/** A concrete, scheduled sound to play at a point in the round. */
export interface SoundCue {
  event: string;
  file: string;
  /** Absolute time from spin start, in ms (animation start + binding delay). */
  tMs: number;
  volume: number;
  lane: string;
}

/**
 * Schedule sounds against an animation timeline. Each timeline event that has a
 * matching sound binding produces a cue at (event start + binding delay). This
 * is the "Auto Sync Sounds" engine — sound is pinned to events, never hand-timed
 * somewhere in code.
 */
export function buildSoundCues(project: SlotProject, timeline: Timeline): SoundCue[] {
  const byEvent = new Map<string, SoundBinding>();
  for (const b of project.sounds) byEvent.set(b.event, b);

  const cues: SoundCue[] = [];
  for (const ev of timeline.events) {
    const binding = byEvent.get(ev.event);
    if (!binding) continue;
    cues.push({
      event: ev.event,
      file: binding.file,
      tMs: ev.tStartMs + binding.delayMs,
      volume: binding.volume,
      lane: ev.lane,
    });
  }
  cues.sort((a, b) => a.tMs - b.tMs);
  return cues;
}

/**
 * Produce a complete set of sound bindings from a pack, preserving any the user
 * already set. Returns new bindings — does not mutate the project.
 */
export function autoSyncSounds(project: SlotProject, pack: SoundPack = STADIUM_PACK): SoundBinding[] {
  const existing = new Map(project.sounds.map((s) => [s.event, s]));
  const result: SoundBinding[] = [...project.sounds];
  for (const [event, file] of Object.entries(pack.files)) {
    if (!file || existing.has(event as SoundBinding["event"])) continue;
    result.push({
      event: event as SoundBinding["event"],
      file,
      delayMs: 0,
      volume: pack.volume?.[event as SoundBinding["event"]] ?? 0.8,
    });
  }
  return result;
}
