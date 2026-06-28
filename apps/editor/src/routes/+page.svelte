<script lang="ts">
  import { onMount } from "svelte";
  import { loadProject, type SlotProject } from "@slotmaker/config";
  import { spin, type RoundResult } from "@slotmaker/slot-runtime";
  import type { MathReport, MultiSeedResult } from "@slotmaker/math-engine";
  import SimWorker from "$lib/sim.worker?worker";
  import { buildTimeline, eventToSymbolState, type Timeline } from "@slotmaker/animation-system";
  import {
    autoSyncSounds,
    buildSoundCues,
    createSoundPlayer,
    createToneSink,
    resolveSoundCue,
    type SoundCue,
    type SoundPlayer,
  } from "@slotmaker/sound-system";
  import {
    buildAssetRegistry,
    createGoldenGoalRushDevPack,
    type AssetRegistry,
  } from "@slotmaker/asset-pipeline";
  import type { AnimationEvent, ExportProfile } from "@slotmaker/config";
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

  // Single playback clock shared by board, timeline and sound cues.
  type Mut = { tMs: number; grid?: string[]; highlight?: number[] };
  let muts = $state<Mut[]>([]);
  let playheadMs = $state(0);
  let isPlaying = $state(false);
  let clock: ReturnType<typeof setInterval> | null = null;

  // Audio runtime (placeholder-safe). "simulate" = visual only; "audio" = play.
  let audioMode = $state<"simulate" | "audio">("simulate");
  let masterVol = $state(0.8);
  let muteAll = $state(false);
  let player: SoundPlayer | null = null;

  // Heavy Math Lab — runs in a Web Worker so the editor never freezes.
  let math = $state<MathReport | null>(null);
  let multi = $state<MultiSeedResult | null>(null);
  let mathBusy = $state(false);
  let mathProgress = $state(0);
  let seedCount = $state(5);
  let worker: Worker | null = null;

  // Phase 2B: asset system. Demo resolution uses the dev pack (generated assets).
  const devPack = createGoldenGoalRushDevPack();
  let exportProfile = $state<ExportProfile>("demo");
  const assetRegistry: AssetRegistry = $derived(buildAssetRegistry(project, { devPack }));

  const health = $derived(
    computeHealth(
      project,
      math ? { rtp: math.rtp.observed, hitFrequency: math.hitFrequency.mean, maxWin: math.maxWin } : undefined,
      { profile: exportProfile, devPack },
      math ?? undefined,
    ),
  );

  const isPlaceholder = (f: string) => !f.includes("/") && !/^https?:/.test(f);
  const hasPlaceholderAudio = $derived(project.sounds.some((s) => isPlaceholder(s.file)));

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
  const activeEvent = $derived.by(() => {
    if (!timeline) return null;
    let cur: string | null = null;
    for (const e of timeline.events) {
      if (e.tStartMs <= playheadMs && playheadMs < e.tStartMs + e.durationMs) cur = e.event;
    }
    return cur;
  });
  // Resolved render state driving the board (winning cells override to "win").
  const boardState = $derived(eventToSymbolState((activeEvent ?? "static") as AnimationEvent));
  const symbolAssetStatus = $derived(assetRegistry.completeness.symbolStates > 0 ? "real" : "generated");
  const pctI = (n: number) => `${Math.round(n * 100)}%`;

  // Feel polish: near-miss tension + big-win count-up.
  const scatterIds = new Set(project.symbols.filter((s) => s.kind === "scatter").map((s) => s.id));
  const baseScatters = $derived(round ? (round.steps[0]?.grid.filter((c) => scatterIds.has(c)).length ?? 0) : 0);
  const nearMiss = $derived(!!round && !round.freeSpinsTriggered && baseScatters === project.math.freeSpins.triggerScatters - 1);
  const bigWin = $derived(!!round && round.totalWin >= 10);
  let displayWin = $state(0);
  let countTimer: ReturnType<typeof setInterval> | null = null;

  function startCountup(total: number) {
    if (countTimer) clearInterval(countTimer);
    if (total < 10) {
      displayWin = total;
      return;
    }
    displayWin = 0;
    const t0 = performance.now();
    const dur = 1100;
    countTimer = setInterval(() => {
      const p = Math.min((performance.now() - t0) / dur, 1);
      displayWin = total * (1 - Math.pow(1 - p, 3));
      if (p >= 1 && countTimer) {
        displayWin = total;
        clearInterval(countTimer);
        countTimer = null;
      }
    }, 33);
  }

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

  function stopClock() {
    if (clock) clearInterval(clock);
    clock = null;
    isPlaying = false;
  }

  function tick() {
    const total = timeline?.totalMs ?? 0;
    const prev = playheadMs;
    playheadMs = Math.min(playheadMs + 33, total);
    // Fire any cue we just crossed.
    for (const c of cues) {
      if (c.tMs > prev && c.tMs <= playheadMs && player) player.playCue(c);
    }
    if (playheadMs >= total) stopClock();
  }

  function play() {
    if (!timeline) return;
    if (playheadMs >= timeline.totalMs) playheadMs = 0;
    stopClock();
    isPlaying = true;
    clock = setInterval(tick, 33);
  }
  function pause() {
    stopClock();
  }
  function reset() {
    stopClock();
    playheadMs = 0;
  }

  function doSpin() {
    seed += 1;
    const r = spin(project, seed * 2654435761);
    round = r;
    timeline = buildTimeline(project, r);
    cues = buildSoundCues(project, timeline);
    muts = buildMuts(r, timeline);
    playheadMs = 0;
    startCountup(r.totalWin);
    play();
  }

  function runMath(spins: number) {
    if (!worker || mathBusy) return;
    mathBusy = true;
    mathProgress = 0;
    // Snapshot the project (plain object) so it can cross the worker boundary.
    worker.postMessage({ project: JSON.parse(JSON.stringify(project)), spins, seeds: seedCount });
  }

  function syncPlayer() {
    player?.setMasterVolume(masterVol);
    player?.setMuted(muteAll || audioMode === "simulate");
  }

  function doAutoFix() {
    project = autoFix(project).project;
  }
  function doAutoSync() {
    project = { ...project, sounds: autoSyncSounds(project) };
    if (round && timeline) cues = buildSoundCues(project, timeline);
  }
  function doExport() {
    const stats = math ? { rtp: math.rtp.observed, hitFrequency: math.hitFrequency.mean, maxWin: math.maxWin } : undefined;
    const res = exportBundle(project, { profile: exportProfile, stats, devPack, mathReport: math ?? undefined, force: true });
    const blob = new Blob([serializeBundle(res.bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id}.slot.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    // Resolver returns null for placeholder (bare) filenames → safe silent fallback.
    // Demo audio uses synthesized tones for the generated (placeholder) cues.
    player = createSoundPlayer({
      sink: createToneSink(),
      resolve: (cue) => resolveSoundCue(project, cue.event as AnimationEvent, { devPack }).uri ?? null,
      masterVolume: masterVol,
    });
    worker = new SimWorker();
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress") mathProgress = msg.done / msg.total;
      else if (msg.type === "done") {
        multi = msg.multi;
        math = msg.report;
        mathBusy = false;
        mathProgress = 1;
      }
    };
    syncPlayer();
    doSpin();
    return () => {
      stopClock();
      if (countTimer) clearInterval(countTimer);
      worker?.terminate();
    };
  });

  // Keep the audio runtime in sync with the mixer controls.
  $effect(() => {
    void masterVol;
    void muteAll;
    void audioMode;
    syncPlayer();
  });

  const pct = (n: number) => `${n.toFixed(2)}%`;
</script>

<div class="app">
  <header>
    <h1><span class="gold">SLOT</span> FACTORY</h1>
    <span class="tag">Editor · Phase 3</span>
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
      <SlotBoard {project} grid={currentGrid} {highlight} renderState={boardState} assetStatus={symbolAssetStatus} />
      <div class="hud">
        <button class="spin" onclick={doSpin}>SPIN</button>
        <div class="readout">
          <div class="big {round && round.totalWin > 0 ? 'win' : ''} {bigWin ? 'bigwin' : ''}">{displayWin.toFixed(2)}× WIN</div>
          <div class="muted">
            {#if bigWin}<b class="gold">BIG WIN</b> · {/if}
            {#if round?.freeSpinsTriggered}<b class="gold">FREE SPINS ×{round.freeSpinsCount}</b> · {/if}
            {#if round?.capped}<b class="gold">MAX WIN</b> · {/if}
            {#if nearMiss}<b class="nearmiss">SO CLOSE · {baseScatters}/{project.math.freeSpins.triggerScatters} scatter</b> · {/if}
            active: <b>{activeEvent ?? "—"}</b>
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
        <button onclick={() => runMath(1000)} disabled={mathBusy}>1k</button>
        <button onclick={() => runMath(10000)} disabled={mathBusy}>10k</button>
        <button onclick={() => runMath(100000)} disabled={mathBusy}>100k</button>
        <button onclick={() => runMath(1000000)} disabled={mathBusy}>1M</button>
      </div>
      <label class="vol">seeds <input type="range" min="1" max="20" step="1" bind:value={seedCount} disabled={mathBusy} /> {seedCount}</label>
      {#if mathBusy}
        <div class="bar" style="margin-top:8px"><div class="fill" style={`width:${mathProgress * 100}%`}></div></div>
        <p class="muted small">Simulating {seedCount} seed(s) in a worker… {Math.round(mathProgress * 100)}%</p>
      {:else if math}
        <div class="row"><span>RTP (observed)</span><b class="gold">{pct(math.rtp.observed)}</b></div>
        <div class="row"><span>Target</span><b>{math.rtp.target}%</b></div>
        <div class="row"><span>95% band</span><b>{pct(math.rtp.confidenceLow)}–{pct(math.rtp.confidenceHigh)}</b></div>
        <div class="row"><span>Spread</span><b>{pct(math.rtp.min)} … {pct(math.rtp.max)}</b></div>
        <div class="row"><span>Sample</span><b class={math.lowSample ? "off" : "on"}>{math.sampleSize.toLocaleString()} · {math.seedCount} seeds</b></div>
        {#if math.lowSample}<p class="muted small">⚠ sample too low — run 100k+ for a trustworthy RTP</p>{/if}
      {:else}
        <p class="muted">Run a worker simulation to measure RTP. Never feel the math — simulate it.</p>
      {/if}

      <h2>Health <span class="score">{health.score}/100</span></h2>
      {#each health.categories as c (c.category)}
        <div class="hrow"><span>{c.category}</span><div class="bar"><div class="fill" style={`width:${c.score}%`}></div></div><b>{c.score}</b></div>
      {/each}

      <h2>Assets <span class="score">{pctI(assetRegistry.completeness.overall)} real</span></h2>
      <div class="badges">
        <span class="b real">real {assetRegistry.counts.real}</span>
        <span class="b gen">generated {assetRegistry.counts.generated}</span>
        <span class="b ph">placeholder {assetRegistry.counts.placeholder}</span>
        <span class="b miss">missing {assetRegistry.counts.missing}</span>
      </div>
      <div class="hrow"><span>symbols</span><div class="bar"><div class="fill" style={`width:${assetRegistry.completeness.symbolStates * 100}%`}></div></div><b>{pctI(assetRegistry.completeness.symbolStates)}</b></div>
      <div class="hrow"><span>sounds</span><div class="bar"><div class="fill" style={`width:${assetRegistry.completeness.sounds * 100}%`}></div></div><b>{pctI(assetRegistry.completeness.sounds)}</b></div>
      <div class="row"><span>Production</span><b class={assetRegistry.production.ready ? "on" : "off"}>{assetRegistry.production.ready ? "ready" : `blocked · ${assetRegistry.production.blockers.length} need real`}</b></div>

      <div class="actions">
        <button onclick={doAutoFix}>Auto-Fix</button>
        <span class="seg">
          <button class="mini {exportProfile === 'demo' ? 'on' : ''}" onclick={() => (exportProfile = "demo")}>Demo</button>
          <button class="mini {exportProfile === 'production' ? 'on' : ''}" onclick={() => (exportProfile = "production")}>Prod</button>
        </span>
        <button class="primary" onclick={doExport}>Export</button>
      </div>
      <p class="muted small">{exportProfile} export · {assetRegistry.production.ready ? "production-ready" : "demo only (placeholders present)"}</p>
    </aside>
  </main>

  <section class="timelines">
    <div class="panel">
      <h2>Animation Timeline
        <span class="transport">
          <button class="mini" onclick={play} disabled={isPlaying}>▶ Play</button>
          <button class="mini" onclick={pause} disabled={!isPlaying}>⏸ Pause</button>
          <button class="mini" onclick={reset}>⟲ Reset</button>
        </span>
      </h2>
      <div class="muted small">
        total {timeline ? Math.round(timeline.totalMs) : 0}ms · playhead {Math.round(playheadMs)}ms · active <b class="gold">{activeEvent ?? "—"}</b>
      </div>
      {#if timeline}
        <TimelineView {timeline} {cues} {playheadMs} />
      {/if}
    </div>
    <div class="panel">
      <h2>Sound Timeline
        <span class="transport">
          <button class="mini" onclick={doAutoSync}>Auto-Sync</button>
        </span>
      </h2>
      <div class="sndctl">
        <label class="seg">
          <button class="mini {audioMode === 'simulate' ? 'on' : ''}" onclick={() => (audioMode = "simulate")}>Simulate</button>
          <button class="mini {audioMode === 'audio' ? 'on' : ''}" onclick={() => (audioMode = "audio")}>Play Audio</button>
        </label>
        <label class="chk"><input type="checkbox" bind:checked={muteAll} /> Mute All</label>
        <label class="vol">Master <input type="range" min="0" max="1" step="0.05" bind:value={masterVol} /> {Math.round(masterVol * 100)}%</label>
        {#if hasPlaceholderAudio}<span class="badge">⚠ placeholder audio (silent)</span>{/if}
      </div>
      <div class="sndhead"><span>Event</span><span>File</span><span>Delay</span><span>Vol</span></div>
      <div class="sndlist">
        {#each project.sounds as s (s.event)}
          {@const cue = cues.find((c) => c.event === s.event)}
          <div class="sndrow {cue && cue.tMs <= playheadMs ? 'played' : ''}">
            <span>{s.event}</span>
            <span class="file">{s.file}{#if isPlaceholder(s.file)}<span class="ph">•</span>{/if}</span>
            <span>{s.delayMs}ms</span>
            <span>{Math.round(s.volume * 100)}%</span>
          </div>
        {/each}
      </div>
      <p class="muted small">{cues.length} cue(s) this spin · mode: {audioMode}{muteAll ? " · muted" : ""}</p>
    </div>
  </section>

  {#if math}
    <section class="mathlab">
      <div class="panel">
        <h2>Win Distribution</h2>
        {#each math.distribution as b (b.label)}
          {@const maxc = Math.max(...math.distribution.map((x) => x.count), 1)}
          <div class="hrow"><span>{b.label}</span><div class="bar"><div class="fill" style={`width:${(b.count / maxc) * 100}%`}></div></div><b>{b.count.toLocaleString()}</b></div>
        {/each}
        <h3>Rates</h3>
        <div class="row"><span>Dead</span><b>{pct(math.rates.dead)}</b></div>
        <div class="row"><span>Small (≤5×)</span><b>{pct(math.rates.small)}</b></div>
        <div class="row"><span>Medium (5–20×)</span><b>{pct(math.rates.medium)}</b></div>
        <div class="row"><span>Big (&gt;20×)</span><b>{pct(math.rates.big)}</b></div>
        <div class="row"><span>Max win</span><b>{math.maxWin.toFixed(0)}×</b></div>
      </div>

      <div class="panel">
        <h2>Feature Contribution</h2>
        <div class="row"><span>Base game</span><b>{pct(math.contribution.base)}</b></div>
        <div class="row"><span>Free spins</span><b>{pct(math.contribution.freeSpins)}</b></div>
        <div class="row"><span>Coin feature</span><b>{pct(math.contribution.coin)}</b></div>
        <h3>Volatility <span class="score">{math.volatility.label}</span></h3>
        <div class="row"><span>Std dev / spin</span><b>{math.volatility.stdDev.toFixed(2)}×</b></div>
        <div class="row"><span>Skew</span><b>{math.volatility.skew.toFixed(1)}</b></div>
        <div class="row"><span>Big-win dependency</span><b>{pctI(math.volatility.bigWinDependency)}</b></div>
        <div class="row"><span>Feature dependency</span><b>{pctI(math.volatility.featureDependency)}</b></div>
        <div class="row"><span>vs config ({math.volatility.configured})</span><b class={math.volatility.matchesConfig ? "on" : "off"}>{math.volatility.matchesConfig ? "match" : "conflict"}</b></div>
      </div>

      <div class="panel">
        <h2>Bonus Buy</h2>
        <div class="row"><span>Expected value</span><b>{math.bonusBuy.expectedValue.toFixed(1)}×</b></div>
        <div class="row"><span>Fair price</span><b>{math.bonusBuy.fairPrice.toFixed(1)}×</b></div>
        <div class="row"><span>Configured price</span><b>{math.bonusBuy.configuredPrice}×</b></div>
        <div class="row"><span>Buy RTP</span><b class="gold">{Number.isFinite(math.bonusBuy.buyRtp) ? pct(math.bonusBuy.buyRtp) : "—"}</b></div>
        <div class="row"><span>House edge</span><b>{pctI(math.bonusBuy.houseEdge)}</b></div>
        {#each math.bonusBuy.warnings as w (w)}<p class="muted small">⚠ {w}</p>{/each}
      </div>

      <div class="panel">
        <h2>Balance Suggestions</h2>
        {#if math.suggestions.length === 0}<p class="muted">Nothing to suggest — math is on target.</p>{/if}
        {#each math.suggestions as s (s.action)}
          <div class="suggest {s.severity}">
            <div class="act">{s.severity === "warning" ? "⚠" : "ℹ"} {s.action}</div>
            <div class="muted small">{s.impact}</div>
          </div>
        {/each}
        <p class="muted small">Suggestions only — re-simulate after any change.</p>
      </div>
    </section>
  {/if}
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
  .mathlab { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 0 14px 18px; align-items: start; }
  .mathlab h2 .score { float: right; color: #f5c542; text-transform: none; }
  .suggest { padding: 6px 0; border-bottom: 1px dashed #16210f; }
  .suggest .act { font-size: 12px; }
  .suggest.warning .act { color: #f5c542; }
  @media (max-width: 1100px) { .mathlab { grid-template-columns: 1fr 1fr; } }
  .panel { background: #0e140c; border: 1px solid #1c2b1a; border-radius: 12px; padding: 14px; }
  .panel h2 { font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px; }
  .panel h2 .score { color: #f5c542; float: right; }
  .panel h2 .transport { float: right; display: flex; gap: 6px; }
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
  .readout .big { font-size: 24px; font-weight: 800; transition: color 0.2s; }
  .readout .big.win { color: #f5c542; }
  .readout .big.bigwin { color: #ffd700; text-shadow: 0 0 18px rgba(245, 197, 66, 0.75); animation: bigpulse 0.55s ease-in-out infinite alternate; }
  @keyframes bigpulse { from { transform: scale(1); } to { transform: scale(1.08); } }
  .nearmiss { color: #ff6b6b; animation: flash 0.7s ease-in-out infinite alternate; }
  @keyframes flash { from { opacity: 0.45; } to { opacity: 1; } }
  .breakdown { font-size: 12px; }
  .simbtns, .actions { display: flex; gap: 8px; margin-bottom: 10px; }
  button { background: #16210f; color: #e8e8e8; border: 1px solid #2d6a4f; border-radius: 8px; padding: 7px 10px; cursor: pointer; font-size: 12px; }
  button:hover { border-color: #2d9c6f; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.primary { background: #2d6a4f; border-color: #2d9c6f; font-weight: 700; }
  button.mini { padding: 2px 8px; font-size: 11px; }
  button.mini.on { background: #2d6a4f; border-color: #2d9c6f; color: #fff; }
  .hrow { display: grid; grid-template-columns: 70px 1fr 24px; align-items: center; gap: 8px; font-size: 12px; padding: 2px 0; }
  .bar { height: 7px; background: #16210f; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, #2d6a4f, #f5c542); }
  .actions { margin-top: 12px; align-items: center; }
  .seg { display: inline-flex; gap: 4px; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
  .badges .b { font-size: 10px; padding: 2px 7px; border-radius: 8px; border: 1px solid #2b3a26; }
  .badges .real { color: #2d9c6f; border-color: #1c5b40; }
  .badges .gen { color: #c98a2b; border-color: #5a3f15; }
  .badges .ph { color: #e8b923; border-color: #6b5418; }
  .badges .miss { color: #e63946; border-color: #5a1d22; }
  .sndctl { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; font-size: 12px; }
  .sndctl .seg { display: inline-flex; gap: 4px; }
  .sndctl .chk { display: inline-flex; align-items: center; gap: 4px; }
  .sndctl .vol { display: inline-flex; align-items: center; gap: 6px; }
  .badge { background: #3a2a0f; color: #f5c542; border: 1px solid #6b5418; border-radius: 8px; padding: 2px 8px; font-size: 11px; }
  .sndhead, .sndrow { display: grid; grid-template-columns: 1.3fr 1.6fr 0.6fr 0.5fr; gap: 8px; font-size: 12px; padding: 3px 0; }
  .sndhead { color: #6b746a; border-bottom: 1px solid #16210f; }
  .sndrow { border-bottom: 1px dashed #16210f; }
  .sndrow.played { color: #f5c542; }
  .sndrow .file { color: #8a9388; }
  .sndrow .ph { color: #c98a2b; margin-left: 4px; }
</style>
