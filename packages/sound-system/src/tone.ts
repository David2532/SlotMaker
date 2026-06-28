import type { AnimationEvent } from "@slotmaker/config";
import { categoryOf, type AudioSink, type SoundCategory } from "./player.js";

/** A synthesized placeholder tone used for generated (dev) sound cues. */
export interface ToneSpec {
  freq: number;
  durationMs: number;
  type: OscillatorType;
}

const CATEGORY_TONE: Record<SoundCategory, ToneSpec> = {
  ui: { freq: 520, durationMs: 90, type: "triangle" },
  reel: { freq: 300, durationMs: 70, type: "square" },
  win: { freq: 760, durationMs: 160, type: "sine" },
  feature: { freq: 440, durationMs: 320, type: "sawtooth" },
};

export function toneForEvent(event: AnimationEvent | string): ToneSpec {
  return CATEGORY_TONE[categoryOf(event)];
}

/**
 * WebAudio sink that plays a short synthesized tone for `gen:tone/<event>` uris.
 * It only handles generated tone uris (returns null otherwise) and is fully
 * guarded — safe to construct on the server, and never throws on playback.
 */
export function createToneSink(): AudioSink {
  const Ctx =
    (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (typeof Ctx === "undefined") return { play: () => null };

  let ac: AudioContext | null = null;
  return {
    play(file: string, volume: number) {
      const m = /^gen:tone\/(.+)$/.exec(file);
      if (!m) return null;
      try {
        ac ??= new Ctx();
        const spec = toneForEvent(m[1]!);
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = spec.type;
        osc.frequency.value = spec.freq;
        gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.2; // keep tones gentle
        osc.connect(gain).connect(ac.destination);
        const t0 = ac.currentTime;
        osc.start(t0);
        osc.stop(t0 + spec.durationMs / 1000);
        return {
          stop: () => {
            try {
              osc.stop();
            } catch {
              /* already stopped */
            }
          },
        };
      } catch {
        return null;
      }
    },
  };
}
