<script lang="ts">
  import { onMount } from "svelte";
  import { loadProject, type SlotProject } from "@slotmaker/config";
  import { spin, type RoundResult } from "@slotmaker/slot-runtime";
  import { simulate, type SimResult } from "@slotmaker/math-engine";
  import { buildTimeline, type Timeline } from "@slotmaker/animation-system";
  import { autoSyncSounds, buildSoundCues, type SoundCue } from "@slotmaker/sound-system";
  import { autoFix, computeHealth } from "@slotmaker/validator";
  import { exportBundle, serializeBundle } from "@slotmaker/exporter";
  import golden from "@project";
  import SlotBoard from "$lib/SlotBoard.svelte";
  import TimelineView from "$lib/Timeline.svelte";

  let project = $state<SlotProject>(loadProject(golden));

  let round = $state<RoundResult | null>(null);
  let timeline = $state<Timeline | null>(null);
  let cues = $state<SoundCue[]>([]);
  let seed = $state(1);

  // Board playback is driven by a single clock (playheadMs) shared with the timeline.
  type Mut = { tMs: number; grid?: string[]; highlight?: number[] };
  let muts = $state<Mut[]>([]);
  let playheadMs = $state(0);
  let clock: ReturnType<typeof setInterval> | null = null;

  let sim = $state<SimResult | null>(null);
  let simBusy = $state(false);

  const health = $derived(
    computeHealth(project, sim ? { rtp: sim.rtp, hitFrequency: sim.hitFrequency, maxWin: sim.maxWin } : undefined),
  );

  const currentGrid = $derived.by(() => {
    let g = round?.steps[0]?.grid ?? [];
    for (const m of muts) if (m.tMs <= playheadMs && m.grid) g = m.grid;
    return g;
  });
  const highlight = $derived.by(() => {
    let h: number[] = [];
    for (const m of muts) if (m.tMs <= playheadMs && m.highlight) h = m.highlight;
    return new Set(h);
  });

  function buildMuts(r: RoundResult, tl: Timeline): Mut[] {
    const steps = r.steps;
    const winDetected = tl.events.filter((e) => e.event === "win_detected");
    const cascadeDrops = tl.events.filter((e) => e.event === "cascade_drop");
    const winIdx = steps.map((_, i) => i).filter((i) => steps[i]!.wins.length > 0);
    const m: Mut[] = [{ tMs: 0, grid: steps[0]?.grid.slice() ?? [], highlight: [] }];
    winIdx.forEach((si, k) => {
      const wd = winDetected[k];
      if (wd) m.push({ tMs: wd.tStartMs, highlight: steps[si]!.removed.slice() });
      const cd = cascadeDrops[k];
      if (cd && steps[si + 1]) m.push({ tMs: cd.tStartMs + cd.durationMs, grid: steps[si + 1]!.grid.slice(), highlight: [] });
    });
    return m.sort((a, b) => a.tMs - b.tMs);
  }

  function startClock() {
    if (clock) clearInterval(clock);
    playheadMs = 0;
    clock = setInterval(() => {
      const total = timeline?.totalMs ?? 0;
      playheadMs += 33;
      if (playheadMs >= total && clock) {
        playheadMs = total;
        clearInterval(clock);
        clock = null;
      }
    }, 33);
  }

  function doSpin() {
    seed += 1;
    const r = spin(project, seed * 2654435761);
    round = r;
    timeline = buildTimeline(project, r);
    cues = buildSoundCues(project, timeline);
    muts = buildMuts(r, timeline);
    startClock();
  }

  function replay() {
    if (timeline) startClock();
  }

  async function runSim(spins: number) {
    simBusy = true;
    await new Promise((res) => setTimeout(res, 10));
    sim = simulate(project, { spins, seed: 1 });
    simBusy = false;
  }

  function doAutoFix() {
    project = autoFix(project).project;
  }
  function doAutoSync() {
    project = { ...project, sounds: autoSyncSounds(project) };
    if (round && timeline) cues = buildSoundCues(project, timeline);
  }
  function doExport() {
    const stats = sim ? { rtp: sim.rtp, hitFrequency: sim.hitFrequency, maxWin: sim.maxWin } : undefined;
    const res = exportBundle(project, { stats, force: true });
    const blob = new Blob([serializeBundle(res.bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id}.slot.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    doSpin();
    return () => {
      if (clock) clearInterval(clock);
    };
  });

  const pct = (n: number) => `${n.toFixed(2)}%`;
</script>

<div class="app">
  <header>
    <h1><span class="gold">SLOT</span> FACTORY</h1>
    <span class="tag">Editor · Phase 2</span>
    <span class="spacer"></span>
    <span class="proj">{project.projectName}</span>
    <span class="muted">{project.template} · {project.theme}</span>
  </header>

  <main>
    <aside class="panel">
      <h2>Inspector</h2>
      <div class="row"><span>Grid</span><b>{project.grid.columns}×{project.grid.rows}</b></div>
      <div class="row"><span>Min cluster</span><b>{project.math.minClusterSize}</b></div>
      <div class="row"><span>Volatility</span><b>{project.math.volatility}</b></div>
      <div class="row"><span>Target RTP</span><b>{project.math.targetRtp}%</b></div>
      <div class="row"><span>Max win</span><b>{project.math.maxWin}×</b></div>

      <h3>Features</h3>
      {#each Object.entries(project.features) as [name, on] (name)}
        <div class="row"><span>{name}</span><b class={on ? "on" : "off"}>{on ? "on" : "off"}</b></div>
      {/each}

      <h3>Symbols ({project.symbols.length})</h3>
      <div class="symbols">
        {#each project.symbols as s (s.id)}
          <div class="chip" style={`--c:${s.color}`} title={`${s.name} · weight ${s.weight}`}>{s.label}</div>
        {/each}
      </div>
    </aside>

    <section class="stage">
      <SlotBoard {project} grid={currentGrid} {highlight} />
      <div class="hud">
        <button class="spin" onclick={doSpin}>SPIN</button>
        <div class="readout">
          <div class="big {round && round.totalWin > 0 ? 'win' : ''}">{round ? round.totalWin.toFixed(2) : "0.00"}× WIN</div>
          <div class="muted">
            t {Math.round(playheadMs)}/{timeline ? Math.round(timeline.totalMs) : 0}ms
            {#if round?.freeSpinsTriggered}· <b class="gold">FREE SPINS ×{round.freeSpinsCount}</b>{/if}
            {#if round?.capped}· <b class="gold">MAX WIN</b>{/if}
            <button class="mini" onclick={replay}>↻ replay</button>
          </div>
        </div>
      </div>
      {#if round}
        <div class="breakdown muted">base {round.baseWin.toFixed(2)}× · free spins {round.freeSpinsWin.toFixed(2)}× · coins {round.coinWin.toFixed(2)}×</div>
      {/if}
    </section>

    <aside class="panel">
      <h2>Math Lab</h2>
      <div class="simbtns">
        <button onclick={() => runSim(1000)} disabled={simBusy}>Run 1k</button>
        <button onclick={() => runSim(10000)} disabled={simBusy}>Run 10k</button>
        <button onclick={() => runSim(100000)} disabled={simBusy}>Run 100k</button>
      </div>
      {#if simBusy}
        <p class="muted">Simulating…</p>
      {:else if sim}
        <div class="row"><span>RTP</span><b class="gold">{pct(sim.rtp)}</b></div>
        <div class="row"><span>Hit freq</span><b>{pct(sim.hitFrequency)}</b></div>
        <div class="row"><span>Bonus freq</span><b>1 / {Number.isFinite(sim.bonusFrequency) ? sim.bonusFrequency.toFixed(0) : "—"}</b></div>
        <div class="row"><span>Max win</span><b>{sim.maxWin.toFixed(0)}×</b></div>
        <h3>Contribution</h3>
        <div class="row"><span>Base</span><b>{pct(sim.contribution.base)}</b></div>
        <div class="row"><span>Free spins</span><b>{pct(sim.contribution.freeSpins)}</b></div>
        <div class="row"><span>Coins</span><b>{pct(sim.contribution.coin)}</b></div>
      {:else}
        <p class="muted">Run a simulation to measure RTP. Never feel the math — simulate it.</p>
      {/if}

      <h2>Health <span class="score">{health.score}/100</span></h2>
      {#each health.categories as c (c.category)}
        <div class="hrow"><span>{c.category}</span><div class="bar"><div class="fill" style={`width:${c.score}%`}></div></div><b>{c.score}</b></div>
      {/each}
      <div class="actions">
        <button onclick={doAutoFix}>Auto-Fix</button>
        <button class="primary" onclick={doExport}>Export JSON</button>
      </div>
    </aside>
  </main>

  <section class="timelines">
    <div class="panel">
      <h2>Animation Timeline</h2>
      {#if timeline}
        <TimelineView {timeline} {cues} {playheadMs} />
      {/if}
    </div>
    <div class="panel">
      <h2>Sound Timeline <button class="mini" onclick={doAutoSync}>Auto-Sync</button></h2>
      <div class="sndhead"><span>Event</span><span>File</span><span>Delay</span><span>Vol</span></div>
      <div class="sndlist">
        {#each project.sounds as s (s.event)}
          {@const cue = cues.find((c) => c.event === s.event)}
          <div class="sndrow {cue && cue.tMs <= playheadMs ? 'played' : ''}">
            <span>{s.event}</span>
            <span class="file">{s.file}</span>
            <span>{s.delayMs}ms</span>
            <span>{Math.round(s.volume * 100)}%</span>
          </div>
        {/each}
      </div>
      <p class="muted small">{cues.length} cue(s) scheduled this spin · sounds pinned to events, not hand-timed</p>
    </div>
  </section>
</div>

<style>
  :global(body) { margin: 0; background: #0b0f0a; color: #e8e8e8; font-family: system-ui, Arial, sans-serif; }
  .gold { color: #f5c542; }
  .muted { color: #8a9388; }
  .small { font-size: 12px; }
  header { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #1c2b1a; background: #0e140c; }
  header h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  .tag { font-size: 11px; padding: 2px 8px; border: 1px solid #2d6a4f; border-radius: 10px; color: #2d9c6f; }
  .spacer { flex: 1; }
  .proj { font-weight: 700; }
  main { display: grid; grid-template-columns: 260px 1fr 300px; gap: 14px; padding: 14px; align-items: start; }
  .timelines { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 0 14px 18px; }
  .panel { background: #0e140c; border: 1px solid #1c2b1a; border-radius: 12px; padding: 14px; }
  .panel h2 { font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px; }
  .panel h2 .score { color: #f5c542; float: right; }
  .panel h3 { font-size: 12px; margin: 14px 0 6px; color: #8a9388; text-transform: uppercase; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; border-bottom: 1px dashed #16210f; }
  .row .on { color: #2d9c6f; }
  .row .off { color: #6b746a; }
  .symbols { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { width: 40px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; font-weight: 700; color: #0b0f0a; background: var(--c); }
  .stage { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .hud { display: flex; align-items: center; gap: 18px; }
  .spin { width: 78px; height: 78px; border-radius: 50%; border: none; cursor: pointer; background: radial-gradient(circle at 30% 30%, #2d9c6f, #1c5b40); color: white; font-weight: 800; font-size: 14px; }
  .spin:active { transform: scale(0.96); }
  .readout .big { font-size: 24px; font-weight: 800; }
  .readout .big.win { color: #f5c542; }
  .breakdown { font-size: 12px; }
  .simbtns, .actions { display: flex; gap: 8px; margin-bottom: 10px; }
  button { background: #16210f; color: #e8e8e8; border: 1px solid #2d6a4f; border-radius: 8px; padding: 7px 10px; cursor: pointer; font-size: 12px; }
  button:hover { border-color: #2d9c6f; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.primary { background: #2d6a4f; border-color: #2d9c6f; font-weight: 700; }
  button.mini { padding: 2px 7px; font-size: 11px; float: right; }
  .hrow { display: grid; grid-template-columns: 70px 1fr 24px; align-items: center; gap: 8px; font-size: 12px; padding: 2px 0; }
  .bar { height: 7px; background: #16210f; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, #2d6a4f, #f5c542); }
  .actions { margin-top: 12px; }
  .sndhead, .sndrow { display: grid; grid-template-columns: 1.3fr 1.6fr 0.6fr 0.5fr; gap: 8px; font-size: 12px; padding: 3px 0; }
  .sndhead { color: #6b746a; border-bottom: 1px solid #16210f; }
  .sndrow { border-bottom: 1px dashed #16210f; }
  .sndrow.played { color: #f5c542; }
  .sndrow .file { color: #8a9388; }
</style>
