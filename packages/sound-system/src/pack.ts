import type { AnimationEvent } from "@slotmaker/config";

/**
 * A sound pack maps canonical events to audio files. Packs are swappable skins:
 * the football pack roars, a candy pack pops. Auto Sync uses the active pack to
 * fill any unbound event in one click.
 */
export interface SoundPack {
  id: string;
  name: string;
  files: Partial<Record<AnimationEvent, string>>;
  /** Default per-event playback volume (0..1). */
  volume?: Partial<Record<AnimationEvent, number>>;
}

export const STADIUM_PACK: SoundPack = {
  id: "stadium",
  name: "Stadium (Golden Goal Rush)",
  files: {
    spin_start: "spin_whoosh.wav",
    reel_drop: "reel_drop.wav",
    reel_stop: "reel_tick.wav",
    symbol_land: "soft_hit.wav",
    win_detected: "small_win.wav",
    cluster_highlight: "highlight.wav",
    cluster_remove: "pop_explosion.wav",
    cascade_drop: "drop.wav",
    scatter_land: "whistle_hit.wav",
    bonus_trigger: "stadium_roar.wav",
    coin_collect: "gold_coin.wav",
    big_win_start: "crowd_big_win.wav",
  },
  volume: {
    reel_stop: 0.65,
    scatter_land: 0.9,
    bonus_trigger: 1,
    big_win_start: 0.95,
  },
};

export const PACKS: Record<string, SoundPack> = {
  stadium: STADIUM_PACK,
};
