<script lang="ts">
  import { onMount } from "svelte";
  import {
    createInitialWizardState,
    createProjectFromTemplate,
    FEATURE_REGISTRY,
    getDefaultTemplate,
    getFeatureDefinition,
    getTemplateDefinition,
    loadProject,
    nextWizardStep,
    previousWizardStep,
    TEMPLATE_REGISTRY,
    WIZARD_STEPS,
    canCompleteWizard,
    advertisedTemplateMechanics,
    canCreateTemplate,
    getDefaultCreatableTemplate,
    getTemplateReadiness,
    type AnimationEvent,
    type ExportProfile,
    type FeatureFlags,
    type FeatureId,
    type SlotProject,
    type SlotTemplateDefinition,
    type TemplateId,
    type TemplatePreviewState,
    type WizardState,
  } from "@slotmaker/config";
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
  import { autoFix, computeHealth } from "@slotmaker/validator";
  import { exportBundle, serializeBundle, type ExportResult } from "@slotmaker/exporter";
  import {
    applyProposal,
    createAuditLog,
    createMockProvider,
    proposeProductionFixes,
    type ApplyResult,
    type AuditEntry,
    type Proposal,
  } from "@slotmaker/ai-copilot";
  import golden from "@project";
  import SlotBoard from "$lib/SlotBoard.svelte";
  import TimelineView from "$lib/Timeline.svelte";

  type AppView = "hub" | "wizard" | "builder";
  type BuilderTab =
    | "overview"
    | "board"
    | "symbols"
    | "features"
    | "character"
    | "animation"
    | "sound"
    | "math"
    | "copilot"
    | "export";

  const builderTabs: { id: BuilderTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "board", label: "Board" },
    { id: "symbols", label: "Symbols" },
    { id: "features", label: "Features" },
    { id: "character", label: "Character" },
    { id: "animation", label: "Animation" },
    { id: "sound", label: "Sound" },
    { id: "math", label: "Math" },
    { id: "copilot", label: "Copilot" },
    { id: "export", label: "Export" },
  ];

  const previewModes: { id: TemplatePreviewState; label: string; description: string }[] = [
    { id: "idle", label: "Idle", description: "Settled board state." },
    { id: "spin", label: "Spin", description: "Run a live spin." },
    { id: "small_win", label: "Small Win", description: "Quick win preview." },
    { id: "big_win", label: "Big Win", description: "High-value celebration path." },
    { id: "near_miss", label: "Near Miss", description: "Scatter tension state." },
    { id: "free_spins_trigger", label: "Free Spins", description: "Bonus trigger path." },
    { id: "coin_collect", label: "Coin Collect", description: "Coin feature cue." },
    { id: "cascade_chain", label: "Cascade Chain", description: "Tumble chain preview." },
  ];

  const devPack = createGoldenGoalRushDevPack();
  const aiProvider = createMockProvider();
  const audit = createAuditLog();
  const sampleProjects = [
    createProjectFromTemplate("candy_cascade", { projectName: "Candy Cascade Draft" }),
  ];

  let view = $state<AppView>("hub");
  let activeTab = $state<BuilderTab>("overview");
  let beginnerMode = $state(true);
  let timelineOpen = $state(false);
  let previewMode = $state<TemplatePreviewState>("spin");
  let toast = $state("");
  let project = $state<SlotProject>(loadProject(golden));
  let wizard = $state<WizardState>(createInitialWizardState());

  let round = $state<RoundResult | null>(null);
  let timeline = $state<Timeline | null>(null);
  let cues = $state<SoundCue[]>([]);
  let seed = $state(1);

  type Mut = { tMs: number; grid?: string[]; highlight?: number[] };
  let muts = $state<Mut[]>([]);
  let playheadMs = $state(0);
  let isPlaying = $state(false);
  let clock: ReturnType<typeof setInterval> | null = null;

  let audioMode = $state<"simulate" | "audio">("simulate");
  let masterVol = $state(0.8);
  let muteAll = $state(false);
  let player: SoundPlayer | null = null;

  let math = $state<MathReport | null>(null);
  let multi = $state<MultiSeedResult | null>(null);
  let mathBusy = $state(false);
  let mathProgress = $state(0);
  let seedCount = $state(5);
  let worker: Worker | null = null;

  let aiPrompt = $state("");
  let aiBusy = $state(false);
  let proposals = $state<Proposal[]>([]);
  let selected = $state<Proposal | null>(null);
  let preview = $state<ApplyResult | null>(null);
  let lastApply = $state<ApplyResult | null>(null);
  let auditEntries = $state<AuditEntry[]>([]);

  let exportProfile = $state<ExportProfile>("demo");
  let lastExport = $state<ExportResult | null>(null);

  const currentTemplate = $derived.by<SlotTemplateDefinition>(() =>
    TEMPLATE_REGISTRY.find((t) => t.id === project.template) ?? getDefaultTemplate(),
  );
  const activeTheme = $derived.by(() =>
    currentTemplate.themes.find((t) => t.id === project.theme) ?? currentTemplate.themes[0],
  );
  const activePalette = $derived.by(() => activeTheme?.palette ?? ["#0b0f0a", "#f5c542", "#2d6a4f"]);
  const selectedWizardTemplate = $derived.by(() =>
    wizard.selectedTemplateId ? getTemplateDefinition(wizard.selectedTemplateId) : null,
  );
  const selectedWizardTheme = $derived.by(() =>
    selectedWizardTemplate?.themes.find((t) => t.id === wizard.selectedThemeId) ?? selectedWizardTemplate?.themes[0] ?? null,
  );
  const recentProjects = $derived([project, ...sampleProjects]);

  const assetRegistry: AssetRegistry = $derived(buildAssetRegistry(project, { devPack }));
  const health = $derived(
    computeHealth(
      project,
      math ? { rtp: math.rtp.observed, hitFrequency: math.hitFrequency.mean, maxWin: math.maxWin } : undefined,
      { profile: exportProfile, devPack },
      math ?? undefined,
    ),
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
  const activeEvent = $derived.by(() => {
    if (!timeline) return null;
    let cur: string | null = null;
    for (const e of timeline.events) {
      if (e.tStartMs <= playheadMs && playheadMs < e.tStartMs + e.durationMs) cur = e.event;
    }
    return cur;
  });
  const boardState = $derived(eventToSymbolState((activeEvent ?? "static") as AnimationEvent));
  const symbolAssetStatus = $derived(assetRegistry.completeness.symbolStates > 0 ? "real" : "generated");
  const hasPlaceholderAudio = $derived(project.sounds.some((s) => !s.file.includes("/") && !/^https?:/.test(s.file)));
  const blockers = $derived(assetRegistry.production.blockers);
  const nextActions = $derived(project.templateMeta?.nextActions ?? ["Run a 100k simulation", "Review production blockers"]);

  const scatterIds = $derived.by(() => new Set(project.symbols.filter((s) => s.kind === "scatter").map((s) => s.id)));
  const baseScatters = $derived(round ? (round.steps[0]?.grid.filter((c) => scatterIds.has(c)).length ?? 0) : 0);
  const nearMiss = $derived(!!round && !round.freeSpinsTriggered && baseScatters === project.math.freeSpins.triggerScatters - 1);
  const bigWin = $derived(!!round && round.totalWin >= 10);
  let displayWin = $state(0);
  let countTimer: ReturnType<typeof setInterval> | null = null;

  const pctI = (n: number) => `${Math.round(n * 100)}%`;
  const pct = (n: number) => `${n.toFixed(2)}%`;
  const templateStatusLabel = (t: SlotTemplateDefinition) => getTemplateReadiness(t).label;
  const templateStatusClass = (t: SlotTemplateDefinition) => getTemplateReadiness(t).status;
  const templateActionLabel = (t: SlotTemplateDefinition) => {
    const readiness = getTemplateReadiness(t);
    if (readiness.createEnabled) return "Create";
    return readiness.status === "coming-soon" ? "Coming Soon" : "Preview only";
  };
  const missingMechanicSummary = (t: SlotTemplateDefinition) => {
    const missing = getTemplateReadiness(t).blockedMechanics.map((m) => getFeatureDefinition(m.featureId).displayName);
    if (missing.length === 0) return "";
    const visible = missing.slice(0, 2).join(", ");
    return missing.length > 2 ? `${visible} +${missing.length - 2} more` : visible;
  };

  function toastMsg(message: string) {
    toast = message;
    setTimeout(() => {
      if (toast === message) toast = "";
    }, 2600);
  }

  function projectHealthScore(p: SlotProject): number {
    return computeHealth(p, undefined, { profile: "demo", devPack }).score;
  }

  function projectAssetReadiness(p: SlotProject): string {
    const reg = buildAssetRegistry(p, { devPack });
    return `${pctI(reg.completeness.overall)} real`;
  }

  function startWizard(templateId?: TemplateId) {
    wizard = createInitialWizardState();
    const template = templateId ? getTemplateDefinition(templateId) : getDefaultCreatableTemplate();
    if (!canCreateTemplate(template)) {
      toastMsg(`${template.displayName} is preview-only until missing mechanics are implemented.`);
      return;
    }
    wizard.selectedTemplateId = template.id;
    wizard.selectedThemeId = template.defaultThemeId;
    wizard.projectName = `${template.displayName} Draft`;
    wizard.rtpTarget = template.defaultRtpTarget;
    wizard.volatility = template.volatility;
    wizard.enabledFeatures = advertisedTemplateMechanics(template).map((m) => m.featureId);
    wizard.characterEnabled = true;
    wizard.step = "template";
    view = "wizard";
  }

  function chooseWizardTemplate(templateId: TemplateId) {
    const template = getTemplateDefinition(templateId);
    if (!canCreateTemplate(template)) {
      toastMsg(`${template.displayName} is not creatable yet.`);
      return;
    }
    wizard.selectedTemplateId = template.id;
    wizard.selectedThemeId = template.defaultThemeId;
    wizard.projectName = `${template.displayName} Draft`;
    wizard.rtpTarget = template.defaultRtpTarget;
    wizard.volatility = template.volatility;
    wizard.enabledFeatures = advertisedTemplateMechanics(template).map((m) => m.featureId);
  }

  function toggleWizardFeature(id: FeatureId) {
    wizard.enabledFeatures = wizard.enabledFeatures.includes(id)
      ? wizard.enabledFeatures.filter((f) => f !== id)
      : [...wizard.enabledFeatures, id];
  }

  function withWizardFeatures(next: SlotProject): SlotProject {
    const enabled = new Set(wizard.enabledFeatures);
    const features = { ...next.features };
    const mutable = features as Record<keyof FeatureFlags, boolean>;
    for (const feature of FEATURE_REGISTRY) {
      if (feature.configKey) mutable[feature.configKey] = enabled.has(feature.id);
    }
    return { ...next, features };
  }

  function createWizardProject() {
    if (!canCompleteWizard(wizard) || !wizard.selectedTemplateId) return;
    if (!canCreateTemplate(wizard.selectedTemplateId)) {
      toastMsg("This template is preview-only until all mechanics are implemented.");
      return;
    }
    const next = createProjectFromTemplate(wizard.selectedTemplateId, {
      projectName: wizard.projectName,
      themeId: wizard.selectedThemeId,
      rtpTarget: wizard.rtpTarget,
      volatility: wizard.volatility,
      characterEnabled: wizard.characterEnabled,
    });
    openProject(withWizardFeatures(next));
    toastMsg("Project created from template");
  }

  function openProject(next: SlotProject) {
    project = next;
    activeTab = "overview";
    view = "builder";
    exportProfile = "demo";
    math = null;
    multi = null;
    proposals = [];
    selected = null;
    preview = null;
    lastApply = null;
    lastExport = null;
    reset();
    doSpin();
  }

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

  function applyPreviewMode(mode: TemplatePreviewState) {
    previewMode = mode;
    if (mode === "idle") {
      reset();
      return;
    }
    doSpin();
  }

  function runMath(spins: number) {
    if (!worker || mathBusy) return;
    mathBusy = true;
    mathProgress = 0;
    worker.postMessage({ project: JSON.parse(JSON.stringify(project)), spins, seeds: seedCount });
    activeTab = "math";
  }

  function syncPlayer() {
    player?.setMasterVolume(masterVol);
    player?.setMuted(muteAll || audioMode === "simulate");
  }

  function doAutoFix() {
    project = autoFix(project).project;
    toastMsg("Validator auto-fix applied");
  }

  function doAutoSync() {
    project = { ...project, sounds: autoSyncSounds(project) };
    if (round && timeline) cues = buildSoundCues(project, timeline);
    toastMsg("Sound cues synced");
  }

  async function propose(kind: string) {
    aiBusy = true;
    try {
      let p: Proposal;
      if (kind === "theme") p = await aiProvider.generateThemeProposal(project, aiPrompt);
      else if (kind === "animation") p = await aiProvider.generateAnimationProposal(project, aiPrompt);
      else if (kind === "sound") p = await aiProvider.generateSoundProposal(project, aiPrompt);
      else if (kind === "math") p = await aiProvider.generateBalanceProposal(project, math ?? undefined, aiPrompt);
      else if (kind === "reskin") p = await aiProvider.generateReskinProposal(project, aiPrompt);
      else p = proposeProductionFixes(project);
      proposals = [p, ...proposals].slice(0, 8);
      selectProposal(p);
    } finally {
      aiBusy = false;
    }
  }

  function selectProposal(p: Proposal) {
    selected = p;
    preview = applyProposal(project, p);
    lastApply = null;
  }

  function logAudit(p: Proposal, decision: "accepted" | "rejected", res: ApplyResult | null) {
    audit.record({
      prompt: aiPrompt,
      proposalId: p.id,
      proposalType: p.type,
      summary: p.title,
      decision,
      validation: res ? (res.applied ? "passed" : "failed") : "n/a",
      errors: res?.errors ?? [],
    });
    auditEntries = [...audit.entries()];
  }

  function acceptProposal() {
    if (!selected) return;
    const res = applyProposal(project, selected);
    if (res.applied) project = res.project;
    lastApply = res;
    logAudit(selected, res.applied ? "accepted" : "rejected", res);
    toastMsg(res.applied ? "Proposal applied and validated" : "Proposal rejected by validation");
  }

  function rejectProposal() {
    if (!selected) return;
    logAudit(selected, "rejected", null);
    selected = null;
    preview = null;
    lastApply = null;
  }

  function doExport() {
    const stats = math ? { rtp: math.rtp.observed, hitFrequency: math.hitFrequency.mean, maxWin: math.maxWin } : undefined;
    const res = exportBundle(project, {
      profile: exportProfile,
      stats,
      devPack,
      mathReport: math ?? undefined,
      force: exportProfile === "demo",
    });
    lastExport = res;
    if (!res.ok) {
      toastMsg("Production export blocked. Review blockers.");
      return;
    }
    const blob = new Blob([serializeBundle(res.bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id}.slot.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastMsg(`${exportProfile} export prepared`);
  }

  async function copyExportSummary() {
    const lines = [
      `Project: ${project.projectName}`,
      `Template: ${currentTemplate.displayName}`,
      `Health: ${health.score}/100`,
      `RTP target: ${project.math.targetRtp}%`,
      `Math report: ${math ? `${pct(math.rtp.observed)} observed` : "not run"}`,
      `Production: ${assetRegistry.production.ready ? "ready" : `blocked (${blockers.length} blockers)`}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toastMsg("Export summary copied");
  }

  onMount(() => {
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

  $effect(() => {
    void masterVol;
    void muteAll;
    void audioMode;
    syncPlayer();
  });
</script>

<svelte:head>
  <title>SLOT FACTORY - Product Builder</title>
</svelte:head>

<div class="app" style={`--accent:${activePalette[1]}; --accent-2:${activePalette[2]};`}>
  {#if toast}<div class="toast">{toast}</div>{/if}

  {#if view === "hub"}
    <section class="hub">
      <div class="hubtop">
        <div>
          <div class="brand"><span>SLOT</span> FACTORY</div>
          <h1>Create a slot in minutes</h1>
          <p>Choose a proven template, make the theme yours, preview the game, run math, and export a demo without touching engine internals.</p>
          <div class="heroactions">
            <button class="primary" onclick={() => startWizard()}>New Slot</button>
            <button onclick={() => openProject(project)}>Open Current Builder</button>
          </div>
        </div>
        <div class="explain">
          <h2>Demo vs Production</h2>
          <p><b>Demo</b> can use generated placeholders for fast iteration.</p>
          <p><b>Production</b> stays blocked until required assets are real and validation is clean.</p>
          <div class="metricrow">
            <span>Current health</span><b>{health.score}/100</b>
          </div>
          <div class="metricrow">
            <span>Production</span><b class:bad={!assetRegistry.production.ready}>{assetRegistry.production.ready ? "Ready" : `${blockers.length} blockers`}</b>
          </div>
        </div>
      </div>

      <div class="sectionhead">
        <h2>Recent Projects</h2>
        <span>Open a draft or use it as a starting point.</span>
      </div>
      <div class="cards three">
        {#each recentProjects as p (p.id)}
          <button class="projectcard" onclick={() => openProject(p)}>
            <span class="statuspill">{p.template}</span>
            <h3>{p.projectName}</h3>
            <div class="gridmeta">
              <span>Health</span><b>{projectHealthScore(p)}/100</b>
              <span>RTP</span><b>{p.math.targetRtp}%</b>
              <span>Assets</span><b>{projectAssetReadiness(p)}</b>
              <span>Production</span><b>{buildAssetRegistry(p, { devPack }).production.ready ? "ready" : "blocked"}</b>
            </div>
          </button>
        {/each}
      </div>

      <div class="sectionhead">
        <h2>Template Gallery</h2>
        <span>Neutral, configurable templates. No trademarked clones.</span>
      </div>
      <div class="cards gallery">
        {#each TEMPLATE_REGISTRY as template (template.id)}
          {@const readiness = getTemplateReadiness(template)}
          <article class="templatecard">
            <div class="mock" style={`--a:${template.themes[0]?.palette[1] ?? "#f5c542"}; --b:${template.themes[0]?.palette[2] ?? "#2d6a4f"}`}>
              <div class="mockgrid" style={`grid-template-columns: repeat(${template.grid.columns}, 1fr);`}>
                {#each template.symbols.slice(0, template.grid.columns * Math.min(template.grid.rows, 4)) as s, i (`${template.id}-${s.id}-${i}`)}
                  <span style={`--c:${s.color}`}>{s.label.slice(0, 3)}</span>
                {/each}
              </div>
            </div>
            <div class="cardtop">
              <span class="statuspill">{template.type}</span>
              <span class={`statuspill ${templateStatusClass(template)}`}>{templateStatusLabel(template)}</span>
            </div>
            <h3>{template.displayName}</h3>
            <p>{template.description}</p>
            <div class="badges">
              <span>{template.grid.columns}x{template.grid.rows}</span>
              <span>{template.volatility}</span>
              <span>{template.defaultRtpTarget}% RTP</span>
              <span>{template.complexity}</span>
            </div>
            <p class="best">Best for: {template.bestFor}</p>
            <div class="mechanics">
              {#each advertisedTemplateMechanics(template) as m (`${template.id}-${m.featureId}`)}
                <span class="implemented">{getFeatureDefinition(m.featureId).displayName}</span>
              {/each}
            </div>
            {#if readiness.blockedMechanics.length > 0}
              <div class="missinglist">
                <b>Missing before Create</b>
                {#each readiness.blockedMechanics as m (`missing-${template.id}-${m.featureId}`)}
                  <span>{getFeatureDefinition(m.featureId).displayName}: {m.note}</span>
                {/each}
              </div>
            {/if}
            <button class="primary full" disabled={!readiness.createEnabled} onclick={() => startWizard(template.id)}>{templateActionLabel(template)}</button>
          </article>
        {/each}
      </div>
    </section>
  {:else if view === "wizard"}
    <section class="wizard">
      <div class="wizardbar">
        <button class="ghost" onclick={() => (view = "hub")}>Back</button>
        <div>
          <div class="brand mini"><span>SLOT</span> FACTORY</div>
          <h1>New Slot Wizard</h1>
        </div>
        <div class="progress"><i style={`width:${Math.round((WIZARD_STEPS.findIndex((s) => s.id === wizard.step) + 1) / WIZARD_STEPS.length * 100)}%`}></i></div>
      </div>

      <div class="wizardlayout">
        <aside class="steps">
          {#each WIZARD_STEPS as step}
            <button class:active={wizard.step === step.id} onclick={() => (wizard.step = step.id)}>
              <span>{WIZARD_STEPS.findIndex((s) => s.id === step.id) + 1}</span>{step.label}
            </button>
          {/each}
        </aside>

        <div class="wizardpanel">
          {#if wizard.step === "template"}
            <h2>Choose a template</h2>
            <p class="muted">Start from mechanics, not blank config.</p>
            <div class="cards compact">
              {#each TEMPLATE_REGISTRY as template (template.id)}
                {@const readiness = getTemplateReadiness(template)}
                <button class="selectcard" class:active={wizard.selectedTemplateId === template.id} disabled={!readiness.createEnabled} onclick={() => chooseWizardTemplate(template.id)}>
                  <span class="statuspill">{template.type}</span>
                  <h3>{template.displayName}</h3>
                  <p>{template.bestFor}</p>
                  <div class="badges">
                    <span>{template.grid.columns}x{template.grid.rows}</span>
                    <span>{template.volatility}</span>
                    <span class={templateStatusClass(template)}>{templateStatusLabel(template)}</span>
                  </div>
                  {#if !readiness.createEnabled}<p class="missingline">Missing: {missingMechanicSummary(template)}</p>{/if}
                </button>
              {/each}
            </div>
          {:else if wizard.step === "theme"}
            <h2>Choose a theme</h2>
            <p class="muted">Themes set tone, placeholder palette and character direction.</p>
            <div class="cards compact">
              {#each selectedWizardTemplate?.themes ?? [] as theme (theme.id)}
                <button class="selectcard theme" class:active={wizard.selectedThemeId === theme.id} onclick={() => (wizard.selectedThemeId = theme.id)}>
                  <div class="swatches">{#each theme.palette as c}<span style={`background:${c}`}></span>{/each}</div>
                  <h3>{theme.name}</h3>
                  <p>{theme.description}</p>
                </button>
              {/each}
            </div>
          {:else if wizard.step === "math"}
            <h2>Layout, volatility and RTP</h2>
            <div class="formgrid">
              <label>Project name <input bind:value={wizard.projectName} /></label>
              <label>RTP target <input type="number" min="50" max="120" step="0.1" bind:value={wizard.rtpTarget} /></label>
              <label>Volatility
                <select bind:value={wizard.volatility}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="extreme">Extreme</option>
                </select>
              </label>
              <div class="summarybox">
                <b>{selectedWizardTemplate?.grid.columns}x{selectedWizardTemplate?.grid.rows}</b>
                <span>{selectedWizardTemplate?.winSystem} system</span>
              </div>
            </div>
          {:else if wizard.step === "features"}
            <h2>Choose features</h2>
            <p class="muted">Only implemented and tested mechanics are selectable.</p>
            <div class="featurelist">
              {#each selectedWizardTemplate ? advertisedTemplateMechanics(selectedWizardTemplate) : [] as m (m.featureId)}
                {@const feature = getFeatureDefinition(m.featureId)}
                <label class="featuretoggle">
                  <input type="checkbox" checked={wizard.enabledFeatures.includes(m.featureId)} onchange={() => toggleWizardFeature(m.featureId)} />
                  <span>
                    <b>{feature.displayName}</b>
                    <em>{m.status}: {m.note}</em>
                  </span>
                </label>
              {/each}
            </div>
          {:else if wizard.step === "symbols"}
            <h2>Symbols and character</h2>
            <div class="symbolpreview">
              {#each selectedWizardTemplate?.symbols ?? [] as s (s.id)}
                <span style={`--c:${s.color}`}>{s.label}</span>
              {/each}
            </div>
            <label class="featuretoggle">
              <input type="checkbox" bind:checked={wizard.characterEnabled} />
              <span>
                <b>{selectedWizardTemplate?.character.name}</b>
                <em>{selectedWizardTemplate?.character.description}</em>
              </span>
            </label>
          {:else}
            <h2>Create project</h2>
            <div class="createbox">
              <h3>{wizard.projectName || "Untitled Slot"}</h3>
              <p>{selectedWizardTemplate?.displayName} / {selectedWizardTheme?.name}</p>
              <div class="badges">
                <span>{wizard.rtpTarget}% RTP</span>
                <span>{wizard.volatility}</span>
                <span>{wizard.enabledFeatures.length} features</span>
                <span>{wizard.characterEnabled ? "character on" : "character off"}</span>
              </div>
              <button class="primary" disabled={!canCompleteWizard(wizard)} onclick={createWizardProject}>Create Project</button>
            </div>
          {/if}

          <div class="wizardactions">
            <button disabled={wizard.step === "template"} onclick={() => (wizard.step = previousWizardStep(wizard.step))}>Previous</button>
            {#if wizard.step !== "create"}
              <button class="primary" onclick={() => (wizard.step = nextWizardStep(wizard.step))}>Next</button>
            {:else}
              <button class="primary" disabled={!canCompleteWizard(wizard)} onclick={createWizardProject}>Create Project</button>
            {/if}
          </div>
        </div>
      </div>
    </section>
  {:else}
    <section class="builder">
      <header class="topbar">
        <button class="ghost" onclick={() => (view = "hub")}>Hub</button>
        <div>
          <div class="brand mini"><span>SLOT</span> FACTORY</div>
          <h1>{project.projectName}</h1>
        </div>
        <span class="statuspill">{currentTemplate.type}</span>
        <span class="statuspill">Health {health.score}/100</span>
        <span class="statuspill">{project.math.targetRtp}% RTP</span>
        <span class:bad={!assetRegistry.production.ready} class="statuspill">{assetRegistry.production.ready ? "Production ready" : `${blockers.length} production blockers`}</span>
        <span class="spacer"></span>
        <button onclick={() => runMath(100000)} disabled={mathBusy}>Run 100k Sim</button>
        <button onclick={doAutoFix}>Validate</button>
        <button class="primary" onclick={doExport}>Export</button>
      </header>

      <div class="buildergrid">
        <nav class="rail">
          {#each builderTabs as tab}
            <button class:active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>{tab.label}</button>
          {/each}
          <div class="mode">
            <span>Mode</span>
            <button class:active={beginnerMode} onclick={() => (beginnerMode = true)}>Beginner</button>
            <button class:active={!beginnerMode} onclick={() => (beginnerMode = false)}>Advanced</button>
          </div>
        </nav>

        <main class="work">
          <div class="previewbar">
            <div>
              <h2>Live Preview</h2>
              <p>{currentTemplate.displayName} / {activeTheme?.name}</p>
            </div>
            <div class="previewmodes">
              {#each previewModes as mode (mode.id)}
                {@const supported = currentTemplate.supportedPreviewStates.includes(mode.id)}
                <button title={supported ? mode.description : "Not implemented for this template yet"} disabled={!supported} class:active={previewMode === mode.id} onclick={() => applyPreviewMode(mode.id)}>
                  {mode.label}
                </button>
              {/each}
            </div>
          </div>

          <section class="stage">
            {#key `${project.id}-${project.grid.columns}x${project.grid.rows}`}
              <SlotBoard {project} grid={currentGrid} {highlight} renderState={boardState} assetStatus={symbolAssetStatus} />
            {/key}
            <div class="hud">
              <button class="spin" onclick={doSpin}>SPIN</button>
              <div class="readout">
                <div class="big" class:win={!!round && round.totalWin > 0} class:bigwin={bigWin}>{displayWin.toFixed(2)}x WIN</div>
                <p>
                  {#if bigWin}<b>BIG WIN</b> / {/if}
                  {#if round?.freeSpinsTriggered}<b>FREE SPINS x{round.freeSpinsCount}</b> / {/if}
                  {#if nearMiss}<b class="danger">NEAR MISS</b> / {/if}
                  active: <b>{activeEvent ?? "idle"}</b>
                </p>
              </div>
            </div>
          </section>

          <section class="tabcontent">
            {#if activeTab === "overview"}
              <div class="panel hero">
                <h2>Your slot at a glance</h2>
                <div class="overviewgrid">
                  <div><span>Template</span><b>{currentTemplate.displayName}</b></div>
                  <div><span>Mechanics</span><b>{currentTemplate.mechanics.length}</b></div>
                  <div><span>Health</span><b>{health.score}/100</b></div>
                  <div><span>Production</span><b>{assetRegistry.production.ready ? "Ready" : `${blockers.length} blockers`}</b></div>
                </div>
                <h3>Next best actions</h3>
                <div class="actiongrid">
                  {#each nextActions as action (action)}
                    <button onclick={() => (activeTab = action.includes("simulation") ? "math" : action.includes("asset") ? "symbols" : "export")}>{action}</button>
                  {/each}
                  <button onclick={() => (activeTab = "copilot")}>Ask Copilot</button>
                </div>
              </div>
            {:else if activeTab === "board"}
              <div class="panel">
                <h2>Board</h2>
                <div class="overviewgrid">
                  <div><span>Grid</span><b>{project.grid.columns}x{project.grid.rows}</b></div>
                  <div><span>Cell size</span><b>{project.grid.cellSize}px</b></div>
                  <div><span>Win system</span><b>{project.templateMeta?.winSystem ?? currentTemplate.winSystem}</b></div>
                  <div><span>Preview mode</span><b>{previewMode}</b></div>
                </div>
              </div>
            {:else if activeTab === "symbols"}
              <div class="panel">
                <h2>Symbols</h2>
                <div class="symboltable">
                  {#each project.symbols as s (s.id)}
                    <div><span style={`--c:${s.color}`}>{s.label}</span><b>{s.name}</b><em>{s.kind} / weight {s.weight}</em></div>
                  {/each}
                </div>
              </div>
            {:else if activeTab === "features"}
              <div class="panel">
                <h2>Features</h2>
                <div class="featurecards">
                  {#each advertisedTemplateMechanics(currentTemplate) as m (m.featureId)}
                    {@const feature = getFeatureDefinition(m.featureId)}
                    <div class="implemented">
                      <span>implemented</span>
                      <h3>{feature.displayName}</h3>
                      <p>{feature.description}</p>
                      <small>{m.note}</small>
                    </div>
                  {/each}
                </div>
                {#if getTemplateReadiness(currentTemplate).blockedMechanics.length > 0}
                  <div class="missinglist">
                    <b>Preview-only mechanics still missing</b>
                    {#each getTemplateReadiness(currentTemplate).blockedMechanics as m (m.featureId)}
                      <span>{getFeatureDefinition(m.featureId).displayName}: {m.note}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if activeTab === "character"}
              <div class="panel characterpanel">
                <h2>Character</h2>
                {#if project.character?.enabled}
                  <div class="characterart">{project.character.name.slice(0, 2).toUpperCase()}</div>
                  <div class="overviewgrid">
                    <div><span>Name</span><b>{project.character.name}</b></div>
                    <div><span>Position</span><b>{project.character.position}</b></div>
                    <div><span>Status</span><b>{project.character.assetStatus}</b></div>
                    <div><span>Production</span><b>{project.character.requiredForProduction ? "required" : "optional"}</b></div>
                  </div>
                {:else}
                  <p class="muted">Character layer is disabled for this project.</p>
                {/if}
              </div>
            {:else if activeTab === "animation"}
              <div class="panel">
                <h2>Animation</h2>
                <div class="transport">
                  <button onclick={play} disabled={isPlaying}>Play</button>
                  <button onclick={pause} disabled={!isPlaying}>Pause</button>
                  <button onclick={reset}>Reset</button>
                </div>
                {#if timeline}<TimelineView {timeline} {cues} {playheadMs} />{/if}
              </div>
            {:else if activeTab === "sound"}
              <div class="panel">
                <h2>Sound</h2>
                <div class="sndctl">
                  <button class:active={audioMode === "simulate"} onclick={() => (audioMode = "simulate")}>Simulate</button>
                  <button class:active={audioMode === "audio"} onclick={() => (audioMode = "audio")}>Play Audio</button>
                  <label><input type="checkbox" bind:checked={muteAll} /> Mute</label>
                  <label>Master <input type="range" min="0" max="1" step="0.05" bind:value={masterVol} /> {Math.round(masterVol * 100)}%</label>
                  <button onclick={doAutoSync}>Auto-Sync</button>
                </div>
                {#if hasPlaceholderAudio}<p class="warning">Placeholder audio is demo-only.</p>{/if}
                <div class="soundlist">
                  {#each project.sounds as s (s.event)}
                    <div><b>{s.event}</b><span>{s.file}</span><em>{s.delayMs}ms / {Math.round(s.volume * 100)}%</em></div>
                  {/each}
                </div>
              </div>
            {:else if activeTab === "math"}
              <div class="panel">
                <h2>Math Lab</h2>
                <div class="simbtns">
                  <button onclick={() => runMath(1000)} disabled={mathBusy}>1k</button>
                  <button onclick={() => runMath(10000)} disabled={mathBusy}>10k</button>
                  <button onclick={() => runMath(100000)} disabled={mathBusy}>100k</button>
                  <button onclick={() => runMath(1000000)} disabled={mathBusy}>1M</button>
                </div>
                <label class="range">Seeds <input type="range" min="1" max="20" step="1" bind:value={seedCount} disabled={mathBusy} /> {seedCount}</label>
                {#if mathBusy}
                  <div class="bar"><i style={`width:${mathProgress * 100}%`}></i></div>
                  <p>Simulating in worker... {Math.round(mathProgress * 100)}%</p>
                {:else if math}
                  <div class="overviewgrid">
                    <div><span>Observed RTP</span><b>{pct(math.rtp.observed)}</b></div>
                    <div><span>Target</span><b>{math.rtp.target}%</b></div>
                    <div><span>Confidence</span><b>{pct(math.rtp.confidenceLow)}-{pct(math.rtp.confidenceHigh)}</b></div>
                    <div><span>Hit frequency</span><b>{pct(math.hitFrequency.mean)}</b></div>
                  </div>
                  {#if !beginnerMode}
                    <h3>Distribution</h3>
                    {#each math.distribution as b (b.label)}
                      <div class="metricrow"><span>{b.label}</span><b>{b.count.toLocaleString()}</b></div>
                    {/each}
                  {/if}
                {:else}
                  <p class="muted">Run a simulation to measure RTP, volatility and feature contribution.</p>
                {/if}
              </div>
            {:else if activeTab === "copilot"}
              <div class="panel copilotpanel">
                <h2>AI Copilot</h2>
                <input class="prompt" placeholder="Describe what you want to improve..." bind:value={aiPrompt} />
                <div class="aibtns">
                  <button onclick={() => propose("theme")} disabled={aiBusy}>Theme</button>
                  <button onclick={() => propose("animation")} disabled={aiBusy}>Animation</button>
                  <button onclick={() => propose("sound")} disabled={aiBusy}>Sound</button>
                  <button onclick={() => propose("math")} disabled={aiBusy}>Math</button>
                  <button onclick={() => propose("production")} disabled={aiBusy}>Production fixes</button>
                  <button onclick={() => propose("reskin")} disabled={aiBusy}>Reskin</button>
                </div>
                <p class="muted">AI proposes. User approves. Validator, Math and Assets decide.</p>
                <div class="copilotgrid">
                  <div>
                    <h3>Proposals</h3>
                    {#each proposals as p (p.id)}
                      <button class="plistitem" class:active={selected?.id === p.id} onclick={() => selectProposal(p)}>{p.risk} / {p.title}</button>
                    {/each}
                    {#if proposals.length === 0}<p class="muted">No proposals yet.</p>{/if}
                  </div>
                  <div>
                    <h3>Review</h3>
                    {#if selected}
                      <p>{selected.summary}</p>
                      <div class="diff">
                        {#each (preview?.diff ?? []).slice(0, 8) as d (d.path)}
                          <div><b>{d.path}</b><span>{d.before} -> {d.after}</span></div>
                        {/each}
                      </div>
                      <button class="primary" onclick={acceptProposal} disabled={!!selected.blockedReason}>Apply</button>
                      <button onclick={rejectProposal}>Reject</button>
                      {#if lastApply}<p class={lastApply.applied ? "ok" : "danger"}>{lastApply.applied ? "Applied and validated." : `Rolled back: ${lastApply.errors[0] ?? "validation failed"}`}</p>{/if}
                    {:else}
                      <p class="muted">Select a proposal to review diff and validation.</p>
                    {/if}
                  </div>
                  <div>
                    <h3>Audit</h3>
                    {#each [...auditEntries].reverse() as a (a.at + a.proposalId)}
                      <div class="metricrow"><span>{a.decision}</span><b>{a.validation}</b></div>
                    {/each}
                  </div>
                </div>
              </div>
            {:else}
              <div class="panel">
                <h2>Export Center</h2>
                <div class="exportgrid">
                  <button class:active={exportProfile === "demo"} onclick={() => (exportProfile = "demo")}>Demo export</button>
                  <button class:active={exportProfile === "production"} onclick={() => (exportProfile = "production")}>Production export</button>
                  <button class="primary" onclick={doExport}>Export</button>
                  <button onclick={copyExportSummary}>Copy summary</button>
                </div>
                <div class="overviewgrid">
                  <div><span>Demo</span><b>Allowed with generated assets</b></div>
                  <div><span>Production</span><b>{assetRegistry.production.ready ? "Ready" : "Blocked"}</b></div>
                  <div><span>Math report</span><b>{math ? "Available" : "Missing"}</b></div>
                  <div><span>Asset manifest</span><b>{assetRegistry.assets.length} slots</b></div>
                </div>
                {#if blockers.length > 0}
                  <h3>Why production is blocked</h3>
                  <div class="blockers">
                    {#each blockers.slice(0, 12) as b (b.key)}
                      <span>{b.key} / {b.status}</span>
                    {/each}
                  </div>
                {/if}
                {#if lastExport && !lastExport.ok}
                  <p class="danger">{lastExport.blockers[0]}</p>
                {/if}
              </div>
            {/if}
          </section>
        </main>

        <aside class="inspector">
          <h2>Inspector</h2>
          <div class="metricrow"><span>Active tab</span><b>{activeTab}</b></div>
          <div class="metricrow"><span>Template</span><b>{currentTemplate.displayName}</b></div>
          <div class="metricrow"><span>Assets</span><b>{assetRegistry.counts.real} real / {assetRegistry.counts.generated} generated</b></div>
          <div class="metricrow"><span>Validation</span><b>{health.exportReady ? "pass" : "needs review"}</b></div>
          <h3>Warnings</h3>
          {#each health.issues.slice(0, beginnerMode ? 4 : 10) as issue (`${issue.category}-${issue.message}`)}
            <p class={issue.severity}>{issue.category}: {issue.message}</p>
          {/each}
          {#if health.issues.length === 0}<p class="ok">No active warnings.</p>{/if}
        </aside>
      </div>

      {#if !beginnerMode || timelineOpen}
        <section class="bottompanel">
          <button class="ghost" onclick={() => (timelineOpen = !timelineOpen)}>{timelineOpen ? "Hide" : "Show"} session detail</button>
          <div class="sessionlog">
            <span>Last spin: {round ? `${round.totalWin.toFixed(2)}x` : "none"}</span>
            <span>Math: {math ? `${math.sampleSize.toLocaleString()} spins` : "not run"}</span>
            <span>Copilot decisions: {auditEntries.length}</span>
            <span>Export profile: {exportProfile}</span>
          </div>
        </section>
      {/if}
    </section>
  {/if}
</div>

<style>
  :global(body) { margin: 0; background: #080b0d; color: #edf2f4; font-family: Inter, ui-sans-serif, system-ui, Arial, sans-serif; }
  :global(*) { box-sizing: border-box; }
  .app { min-height: 100vh; background: radial-gradient(circle at 25% 0%, rgba(245,197,66,.08), transparent 28rem), #080b0d; }
  button, input, select { font: inherit; }
  button { border: 1px solid #263238; background: #10161a; color: #edf2f4; border-radius: 8px; padding: 8px 11px; cursor: pointer; }
  button:hover { border-color: var(--accent-2); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button.primary { background: var(--accent-2); border-color: #43b477; color: white; font-weight: 800; }
  button.ghost { background: transparent; }
  button.active, .selectcard.active { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent); }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: clamp(30px, 6vw, 64px); line-height: .95; margin-bottom: 16px; letter-spacing: 0; }
  h2 { font-size: 18px; margin-bottom: 10px; }
  h3 { font-size: 14px; margin-bottom: 8px; }
  p { color: #aab4b8; line-height: 1.5; }
  input, select { width: 100%; border: 1px solid #263238; border-radius: 8px; background: #0d1317; color: #edf2f4; padding: 10px; }
  .brand { font-weight: 900; letter-spacing: 1px; color: #edf2f4; margin-bottom: 18px; }
  .brand span { color: var(--accent); }
  .brand.mini { margin: 0; font-size: 12px; }
  .hub, .wizard { max-width: 1380px; margin: 0 auto; padding: 28px; }
  .hubtop { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, .7fr); gap: 24px; align-items: stretch; min-height: 420px; }
  .hubtop > div:first-child { display: flex; flex-direction: column; justify-content: center; }
  .heroactions, .wizardactions, .simbtns, .aibtns, .transport, .exportgrid, .previewmodes { display: flex; gap: 8px; flex-wrap: wrap; }
  .explain, .panel, .templatecard, .projectcard, .selectcard, .createbox { background: rgba(14, 20, 23, .92); border: 1px solid #1e2a30; border-radius: 8px; padding: 18px; }
  .explain { align-self: center; }
  .sectionhead { display: flex; align-items: end; justify-content: space-between; margin: 34px 0 14px; gap: 16px; }
  .sectionhead span, .muted { color: #8f9ca3; }
  .cards { display: grid; gap: 14px; }
  .cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cards.gallery { grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); }
  .cards.compact { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .projectcard, .selectcard { text-align: left; }
  .statuspill { display: inline-flex; align-items: center; min-height: 24px; border: 1px solid #2b3940; border-radius: 999px; padding: 3px 9px; color: #b8c4c9; font-size: 12px; white-space: nowrap; }
  .statuspill.fully-implemented, .badges .fully-implemented { color: #43b477; border-color: #1f5f42; }
  .statuspill.partially-implemented, .badges .partially-implemented, .warning, .info { color: #f5c542; border-color: #6b5418; }
  .statuspill.coming-soon, .badges .coming-soon { color: #9d8cff; border-color: #51428e; }
  .bad, .danger, .error { color: #ff6b6b !important; }
  .ok { color: #43b477; }
  .gridmeta, .overviewgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .gridmeta span, .overviewgrid span, .metricrow span { color: #87939a; font-size: 12px; display: block; }
  .gridmeta b, .overviewgrid b, .metricrow b { font-size: 13px; }
  .mock { border-radius: 8px; padding: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--a) 22%, #111), color-mix(in srgb, var(--b) 18%, #10161a)); margin-bottom: 14px; }
  .mockgrid { display: grid; gap: 5px; }
  .mockgrid span, .symbolpreview span, .symboltable span { min-height: 30px; display: grid; place-items: center; border-radius: 6px; background: var(--c); color: #071012; font-size: 10px; font-weight: 900; }
  .cardtop, .badges, .mechanics { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .badges span, .mechanics span { border: 1px solid #2b3940; border-radius: 999px; padding: 3px 8px; color: #b8c4c9; font-size: 11px; }
  .mechanics .implemented { color: #43b477; border-color: #1f5f42; }
  .missinglist { border-top: 1px dashed #263238; margin-top: 12px; padding-top: 10px; display: grid; gap: 6px; }
  .missinglist b { color: #f5c542; font-size: 12px; }
  .missinglist span, .missingline { color: #aab4b8; font-size: 12px; line-height: 1.35; }
  .missingline { margin: 8px 0 0; }
  .best { font-size: 13px; }
  .full { width: 100%; justify-content: center; margin-top: 14px; }
  .wizardbar, .topbar { display: flex; align-items: center; gap: 12px; }
  .wizardbar h1, .topbar h1 { font-size: 20px; margin: 2px 0 0; }
  .progress { height: 8px; flex: 1; background: #10161a; border-radius: 999px; overflow: hidden; }
  .progress i, .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
  .wizardlayout { display: grid; grid-template-columns: 220px 1fr; gap: 18px; margin-top: 22px; }
  .steps, .rail { display: flex; flex-direction: column; gap: 8px; }
  .steps button, .rail button { text-align: left; }
  .steps span { display: inline-grid; place-items: center; width: 22px; height: 22px; margin-right: 8px; border-radius: 50%; background: #182228; color: var(--accent); }
  .wizardpanel { background: rgba(14, 20, 23, .72); border: 1px solid #1e2a30; border-radius: 8px; padding: 20px; min-height: 560px; }
  .formgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .formgrid label { color: #aab4b8; font-size: 13px; display: grid; gap: 6px; }
  .summarybox { border: 1px solid #263238; border-radius: 8px; padding: 14px; display: grid; gap: 5px; }
  .featurelist { display: grid; gap: 10px; }
  .featuretoggle { display: flex; gap: 12px; align-items: flex-start; border: 1px solid #263238; border-radius: 8px; padding: 12px; }
  .featuretoggle input { width: auto; margin-top: 4px; }
  .featuretoggle em { display: block; color: #8f9ca3; font-size: 12px; font-style: normal; margin-top: 3px; }
  .symbolpreview { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; margin-bottom: 14px; }
  .createbox { max-width: 520px; }
  .topbar { padding: 12px 16px; border-bottom: 1px solid #1e2a30; background: rgba(11, 15, 17, .94); position: sticky; top: 0; z-index: 4; }
  .spacer { flex: 1; }
  .buildergrid { display: grid; grid-template-columns: 168px minmax(0, 1fr) 310px; gap: 14px; padding: 14px; align-items: start; }
  .rail, .inspector { position: sticky; top: 76px; }
  .rail { background: #0e1417; border: 1px solid #1e2a30; border-radius: 8px; padding: 10px; }
  .mode { border-top: 1px solid #1e2a30; margin-top: 8px; padding-top: 10px; display: grid; gap: 7px; }
  .mode span { color: #87939a; font-size: 11px; text-transform: uppercase; }
  .work { min-width: 0; display: grid; gap: 14px; }
  .previewbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; background: #0e1417; border: 1px solid #1e2a30; border-radius: 8px; padding: 14px; }
  .previewbar h2, .previewbar p { margin: 0; }
  .previewmodes button { padding: 6px 8px; font-size: 12px; }
  .stage { display: grid; justify-items: center; gap: 12px; background: #0b1013; border: 1px solid #1e2a30; border-radius: 8px; padding: 16px; overflow: hidden; }
  .hud { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; }
  .spin { width: 72px; height: 72px; border-radius: 50%; border: none; background: radial-gradient(circle at 30% 30%, #43b477, #1f5f42); font-weight: 900; }
  .readout .big { font-size: 24px; font-weight: 900; }
  .readout .win { color: var(--accent); }
  .readout .bigwin { text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 70%, transparent); }
  .tabcontent { min-width: 0; }
  .panel.hero { border-color: color-mix(in srgb, var(--accent) 35%, #1e2a30); }
  .actiongrid, .featurecards, .copilotgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .featurecards > div { border: 1px solid #263238; border-radius: 8px; padding: 12px; }
  .featurecards span { text-transform: uppercase; font-size: 11px; color: #8f9ca3; }
  .featurecards .implemented { border-color: #1f5f42; }
  .symboltable { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .symboltable div { display: grid; grid-template-columns: 48px 1fr; gap: 8px; align-items: center; border: 1px solid #263238; border-radius: 8px; padding: 8px; }
  .symboltable em { grid-column: 2; color: #8f9ca3; font-style: normal; font-size: 12px; }
  .characterpanel { display: grid; justify-items: start; }
  .characterart { width: 120px; aspect-ratio: 1; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #071012; font-weight: 900; font-size: 34px; margin-bottom: 14px; }
  .sndctl, .range { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .range input { width: 160px; }
  .soundlist { display: grid; gap: 8px; margin-top: 12px; }
  .soundlist div, .diff div { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 8px; border-bottom: 1px dashed #263238; padding: 5px 0; font-size: 12px; }
  .soundlist span, .soundlist em, .diff span { color: #8f9ca3; font-style: normal; }
  .bar { height: 8px; background: #10161a; border-radius: 999px; overflow: hidden; margin: 12px 0; }
  .prompt { margin-bottom: 10px; }
  .plistitem { display: block; width: 100%; margin-bottom: 6px; text-align: left; }
  .blockers { display: flex; flex-wrap: wrap; gap: 6px; }
  .blockers span { border: 1px solid #5a1d22; color: #ffb0b0; border-radius: 999px; padding: 3px 8px; font-size: 11px; }
  .inspector { background: #0e1417; border: 1px solid #1e2a30; border-radius: 8px; padding: 14px; max-height: calc(100vh - 94px); overflow: auto; }
  .metricrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px dashed #263238; }
  .inspector p { font-size: 12px; margin-bottom: 8px; }
  .bottompanel { margin: 0 14px 14px 196px; border: 1px solid #1e2a30; border-radius: 8px; padding: 10px; background: #0e1417; }
  .sessionlog { display: flex; gap: 14px; flex-wrap: wrap; color: #aab4b8; font-size: 12px; margin-top: 8px; }
  .toast { position: fixed; top: 18px; right: 18px; z-index: 10; background: #14231a; border: 1px solid #43b477; border-radius: 8px; padding: 10px 12px; color: #dff7e8; box-shadow: 0 12px 40px rgba(0,0,0,.35); }

  @media (max-width: 1180px) {
    .hubtop, .buildergrid { grid-template-columns: 1fr; }
    .rail, .inspector { position: static; }
    .rail { flex-direction: row; overflow-x: auto; }
    .rail button { white-space: nowrap; }
    .mode { border-top: 0; border-left: 1px solid #1e2a30; padding-top: 0; padding-left: 10px; min-width: 170px; }
    .bottompanel { margin-left: 14px; }
  }
  @media (max-width: 760px) {
    .hub, .wizard { padding: 16px; }
    .cards.three, .formgrid, .wizardlayout, .previewbar, .overviewgrid { grid-template-columns: 1fr; }
    .wizardbar, .topbar { align-items: flex-start; flex-wrap: wrap; }
    .topbar { position: static; }
    .previewmodes { width: 100%; }
    .buildergrid { padding: 10px; }
    .sectionhead { display: block; }
    .soundlist div, .diff div { grid-template-columns: 1fr; }
  }
</style>
