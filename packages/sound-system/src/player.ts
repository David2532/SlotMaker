import type { AnimationEvent } from "@slotmaker/config";
import type { SoundCue } from "./cues.js";

export type SoundCategory = "ui" | "reel" | "win" | "feature";

export const SOUND_CATEGORIES: SoundCategory[] = ["ui", "reel", "win", "feature"];

/** Map an event to its mixer category (for per-category mute / stop). */
export function categoryOf(event: AnimationEvent | string): SoundCategory {
  switch (event) {
    case "reel_drop":
    case "reel_stop":
      return "reel";
    case "spin_start":
    case "symbol_land":
      return "ui";
    case "win_detected":
    case "cluster_highlight":
    case "cluster_remove":
    case "cascade_drop":
      return "win";
    default:
      return "feature";
  }
}

/** A playing sound the player can later stop. Sinks return one per `play`. */
export interface AudioHandle {
  stop(): void;
}

/** Pluggable audio backend. Returning null means "could not play" (safe). */
export interface AudioSink {
  play(file: string, volume: number): AudioHandle | null;
}

export interface PlayResult {
  played: boolean;
  volume: number;
  category: SoundCategory;
  /** Why a cue did not play. `missing-file` is the placeholder fallback. */
  reason?: "muted" | "category-muted" | "missing-file" | "no-sink";
}

export interface SoundPlayerOptions {
  /** Audio backend. Omit for a silent "simulate" player (no crashes, no audio). */
  sink?: AudioSink;
  /** Resolve a cue file to a real URL; return null if it's a placeholder/missing. */
  resolve?: (file: string) => string | null;
  masterVolume?: number;
}

export interface SoundPlayer {
  playCue(cue: SoundCue): PlayResult;
  stopCategory(category: SoundCategory): void;
  stopAll(): void;
  setMasterVolume(value: number): void;
  getMasterVolume(): number;
  setMuted(muted: boolean): void;
  muteCategory(category: SoundCategory, muted: boolean): void;
  isMuted(): boolean;
  isCategoryMuted(category: SoundCategory): boolean;
  /** Files seen that could not be resolved — surfaced as a placeholder badge. */
  getMissingFiles(): string[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Create a sound player. With no sink it "simulates" (reports what *would* play
 * without audio); with an HTML audio sink it plays for real. Missing or
 * placeholder files never throw — they fall back to a recorded warning.
 */
export function createSoundPlayer(opts: SoundPlayerOptions = {}): SoundPlayer {
  let master = clamp01(opts.masterVolume ?? 1);
  let muted = false;
  const mutedCats = new Set<SoundCategory>();
  const missing = new Set<string>();
  const active = new Map<SoundCategory, Set<AudioHandle>>();
  const resolve = opts.resolve ?? ((f: string) => f);
  const sink = opts.sink;

  const track = (cat: SoundCategory, h: AudioHandle) => {
    let set = active.get(cat);
    if (!set) active.set(cat, (set = new Set()));
    set.add(h);
  };

  return {
    playCue(cue: SoundCue): PlayResult {
      const category = categoryOf(cue.event);
      if (muted) return { played: false, volume: 0, category, reason: "muted" };
      if (mutedCats.has(category)) return { played: false, volume: 0, category, reason: "category-muted" };

      const url = resolve(cue.file);
      if (url == null) {
        missing.add(cue.file);
        return { played: false, volume: 0, category, reason: "missing-file" };
      }
      const volume = clamp01(cue.volume * master);
      if (!sink) return { played: false, volume, category, reason: "no-sink" };
      try {
        const handle = sink.play(url, volume);
        if (handle) track(category, handle);
        else {
          missing.add(cue.file);
          return { played: false, volume, category, reason: "missing-file" };
        }
      } catch {
        // Placeholder / unloadable file must never crash playback.
        missing.add(cue.file);
        return { played: false, volume, category, reason: "missing-file" };
      }
      return { played: true, volume, category };
    },
    stopCategory(category: SoundCategory) {
      for (const h of active.get(category) ?? []) {
        try {
          h.stop();
        } catch {
          /* ignore */
        }
      }
      active.delete(category);
    },
    stopAll() {
      for (const cat of active.keys()) this.stopCategory(cat);
    },
    setMasterVolume(value: number) {
      master = clamp01(value);
    },
    getMasterVolume: () => master,
    setMuted(value: boolean) {
      muted = value;
      if (value) this.stopAll();
    },
    muteCategory(category: SoundCategory, value: boolean) {
      if (value) {
        mutedCats.add(category);
        this.stopCategory(category);
      } else {
        mutedCats.delete(category);
      }
    },
    isMuted: () => muted,
    isCategoryMuted: (category: SoundCategory) => mutedCats.has(category),
    getMissingFiles: () => [...missing],
  };
}

/**
 * Browser audio backend built on HTMLAudioElement. Guarded so it is safe to call
 * in any environment; on the server (no `Audio`) it returns a no-op sink.
 */
export function createHtmlAudioSink(basePath = ""): AudioSink {
  const AudioCtor = (globalThis as { Audio?: typeof Audio }).Audio;
  if (typeof AudioCtor === "undefined") {
    return { play: () => null };
  }
  return {
    play(file: string, volume: number): AudioHandle | null {
      try {
        const el = new AudioCtor(basePath + file);
        el.volume = volume;
        // play() returns a promise that may reject for a missing file — swallow it.
        void el.play().catch(() => {});
        return { stop: () => el.pause() };
      } catch {
        return null;
      }
    },
  };
}
