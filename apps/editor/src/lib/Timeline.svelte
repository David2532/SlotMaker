<script lang="ts">
  import type { Timeline, TimelineEvent } from "@slotmaker/animation-system";
  import type { SoundCue } from "@slotmaker/sound-system";

  interface Props {
    timeline: Timeline;
    cues: SoundCue[];
    playheadMs: number;
  }
  let { timeline, cues, playheadMs }: Props = $props();

  // Stable lane ordering for the rows (mockup screen 4).
  const LANE_ORDER = [
    "spin_start",
    "reel_drop_1", "reel_drop_2", "reel_drop_3", "reel_drop_4", "reel_drop_5", "reel_drop_6",
    "reel_stop", "symbol_land", "scatter_land",
    "win_detected", "cluster_highlight", "cluster_remove", "cascade_drop",
    "coin_collect", "bonus_trigger", "big_win_start",
  ];

  const lanes = $derived.by(() => {
    const present = new Set(timeline.events.map((e) => e.lane));
    const ordered = LANE_ORDER.filter((l) => present.has(l));
    for (const l of present) if (!ordered.includes(l)) ordered.push(l);
    return ordered;
  });

  const total = $derived(Math.max(timeline.totalMs, 1));
  const colorFor = (ev: string): string => {
    if (ev.startsWith("reel")) return "#2d9c6f";
    if (ev === "spin_start" || ev === "symbol_land") return "#5a8f7b";
    if (ev.startsWith("win") || ev.startsWith("cluster")) return "#f5c542";
    if (ev === "cascade_drop") return "#c98a2b";
    if (ev === "bonus_trigger" || ev.startsWith("big_win")) return "#e8b923";
    if (ev === "coin_collect") return "#ffbf00";
    if (ev === "scatter_land") return "#e63946";
    return "#888";
  };
  const eventsForLane = (lane: string): TimelineEvent[] =>
    timeline.events.filter((e) => e.lane === lane);
  const ms = (n: number) => `${Math.round(n)}`;
</script>

<div class="tl">
  <div class="ruler">
    <span>0ms</span>
    <span>{ms(total * 0.25)}</span>
    <span>{ms(total * 0.5)}</span>
    <span>{ms(total * 0.75)}</span>
    <span>{ms(total)}ms</span>
  </div>
  <div class="rows">
    {#each lanes as lane (lane)}
      <div class="lane">
        <div class="label">{lane}</div>
        <div class="track">
          {#each eventsForLane(lane) as e (e.id)}
            <div
              class="ev"
              style={`left:${(e.tStartMs / total) * 100}%; width:${Math.max((e.durationMs / total) * 100, 1.2)}%; --c:${colorFor(e.event)}`}
              title={`${e.event} @ ${ms(e.tStartMs)}ms · ${e.preset}`}
            >
              {#if e.label}<span class="lbl">{e.label}</span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
    <div class="playhead" style={`left:calc(120px + (100% - 120px) * ${Math.min(playheadMs / total, 1)})`}></div>
  </div>
  <div class="legend">
    {cues.length} sound cue(s) · {timeline.events.length} events · {ms(total)}ms total
  </div>
</div>

<style>
  .tl { font-size: 11px; }
  .ruler { display: flex; justify-content: space-between; padding-left: 120px; color: #6b746a; margin-bottom: 4px; }
  .rows { position: relative; }
  .lane { display: grid; grid-template-columns: 120px 1fr; align-items: center; height: 18px; }
  .label { color: #8a9388; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 6px; }
  .track { position: relative; height: 12px; background: #0c120a; border-radius: 3px; }
  .ev {
    position: absolute; top: 0; height: 12px; background: var(--c); border-radius: 3px; opacity: 0.9;
    display: flex; align-items: center; min-width: 4px;
  }
  .ev .lbl { font-size: 9px; color: #0b0f0a; font-weight: 700; padding: 0 3px; white-space: nowrap; }
  .playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #ff5a5a; pointer-events: none; }
  .legend { margin-top: 6px; color: #6b746a; }
</style>
