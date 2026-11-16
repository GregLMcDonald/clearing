// Session generation + timeline. Pure logic, no DOM, no audio — testable in
// Node (see test/session.test.mjs).
//
// A *session* is the plan the user previews:
//   { id, createdISO, minutes, level, seed, style, focus, items: [item], estSeconds, edited? }
//   item: { poseId, phase, breaths }          (breaths per side)
//       | { poseId, phase, rounds }           (a flow; rounds per side)
//       | { poseId, phase, seconds }          (hold: "time", i.e. savasana)
//
// buildActions() expands a session into the flat list of timed actions the
// player runs. Its `cfg` is { inhale, exhale, readGuide } (readGuide defaults
// to true); the same cfg must be used for generating, estimating and playing. Session length estimates are computed from that same list, so
// the preview's "≈ 21 min" and the real run can't drift apart structurally.

import { POSES, FLOWS, PHASES, FOCUSES, poseById, isFlow, flowMoves } from "./library.js";
import { id, getClip, estimateSpeechSeconds, HOLD_RANGE } from "./phrases.js";

export const LENGTH_OPTIONS = [10, 15, 20, 30, 45, 60];
export const STYLES = { steady: "Steady", flow: "Flow" };
export const MIN_BREATHS = 3;
export const FOCUS_OPTIONS = Object.keys(FOCUSES);

// Share of the flexible time (after arriving + savasana) per phase. Energizing
// sessions spend longer in Build; calming ones in Cool down.
const PHASE_SHARE = {
  all:      { warmup: 0.28, main: 0.47, cooldown: 0.25 },
  energize: { warmup: 0.25, main: 0.57, cooldown: 0.18 },
  calm:     { warmup: 0.30, main: 0.30, cooldown: 0.40 },
};
// Where savasana starts inside its range before fitting (0 = min, 1 = max).
const SAVASANA_START = { all: 0.5, energize: 0.25, calm: 0.85 };

// Limits when editing a proposed session by hand.
export const EDIT_LIMITS = {
  breaths: HOLD_RANGE,        // one "Stay here for N breaths" clip per value
  rounds: [1, 6],
  seconds: [60, 900],         // savasana
  secondsStep: 30,
};

// Gaps (seconds) that give the body time to move between instructions.
export const GAP = {
  afterWelcome: 1.0,
  afterPosition: 0.6,
  afterName: 0.5,
  afterGuide: 1.5,  // settle into the pose before counting breaths
  noGuide: 6.0,     // guidance not read aloud: silent time to move into the pose
  afterSetup: 2.0,  // flows: settle into the starting shape
  afterFlowOn: 0.4,
  afterHold: 0.3,
  beforeSwitch: 0.4,
  afterSwitch: 3.0, // turning around for the other side takes a moment
  afterRelease: 0.8,
  beforeEndBell: 4.0,
  afterClose: 2.0,
};
export const SFX_WAIT = { start: 2.5, chime: 1.2, end: 4.0 };

export function maxBreathsFor(minutes) {
  return minutes <= 15 ? 8 : minutes <= 30 ? 10 : HOLD_RANGE[1];
}
function breathFactor(minutes) {
  return minutes <= 15 ? 0.8 : minutes <= 30 ? 1 : 1.25;
}
export function savasanaRange(minutes) {
  if (minutes <= 10) return [60, 150];
  if (minutes <= 15) return [90, 180];
  if (minutes <= 30) return [150, 300];
  if (minutes <= 45) return [210, 360];
  return [270, 480];
}

// ───────── deterministic randomness ─────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Default duration source: estimate from text. The app passes a function that
// prefers real clip durations from the audio manifest.
export function estimateDuration(clipId) {
  const c = getClip(clipId);
  if (!c) return 0;
  return c.kind === "voice" ? estimateSpeechSeconds(c.text) : c.seconds;
}

// ───────── timeline ─────────
// Action types (all carry `step` = index into session.items, and `stage`):
//   { t: "voice", clip }                 play a voice line, wait for it to end
//   { t: "sfx", clip, wait }             fire a sound, wait `wait` seconds
//   { t: "gap", s }                      silence (music continues)
//   { t: "rest", s }                     timed rest (savasana)
//   { t: "breath", n, of, side, sides, inCue? }
//                                        one inhale + exhale, a chime at each;
//                                        optional voice line layered on the inhale
//   { t: "half", phase, cue }            flows: ONE inhale or exhale with its chime,
//                                        the movement cue spoken over it
// Flow actions also carry round, rounds and mv (index of the current move, or
// "setup"), so the UI can name the shape in the current language.
// stage: intro | enter | hold | switch | flow | release | rest | outro
export function buildActions(session, breath) {
  const A = [];
  const items = session.items;
  const last = items.length - 1;
  const add = (step, stage, a) => A.push({ step, stage, ...a });

  add(0, "intro", { t: "sfx", clip: "sfx.bell.start", wait: SFX_WAIT.start });
  add(0, "intro", { t: "voice", clip: id.line("welcome") });
  add(0, "intro", { t: "gap", s: GAP.afterWelcome });

  let prevBase = null;
  items.forEach((it, i) => {
    const p = poseById(it.poseId);
    if (i > 0) add(i, "enter", { t: "sfx", clip: "sfx.chime", wait: SFX_WAIT.chime });
    if (i > 0 && p.base !== prevBase) {
      add(i, "enter", { t: "voice", clip: id.pos(p.base) });
      add(i, "enter", { t: "gap", s: GAP.afterPosition });
    }
    add(i, "enter", { t: "voice", clip: id.name(p.id) });
    add(i, "enter", { t: "gap", s: GAP.afterName });
    if (breath.readGuide !== false) {
      add(i, "enter", { t: "voice", clip: id.guide(p.id) });
      add(i, "enter", { t: "gap", s: GAP.afterGuide });
    } else if (!isFlow(p)) {
      add(i, "enter", { t: "gap", s: GAP.noGuide });
    }

    if (isFlow(p)) {
      addFlow(add, i, p, it.rounds, session.level, breath.readGuide !== false);
    } else if (p.hold === "time") {
      add(i, "rest", { t: "rest", s: it.seconds });
    } else {
      const n = it.breaths;
      const sides = p.sided ? 2 : 1;
      add(i, "enter", { t: "voice", clip: id.hold(n) });
      add(i, "enter", { t: "gap", s: GAP.afterHold });
      for (let side = 1; side <= sides; side++) {
        if (side === 2) {
          add(i, "switch", { t: "gap", s: GAP.beforeSwitch });
          add(i, "switch", { t: "voice", clip: id.line("switch") });
          add(i, "switch", { t: "gap", s: GAP.afterSwitch });
        }
        for (let b = 1; b <= n; b++) {
          const a = { t: "breath", n: b, of: n, side, sides };
          if (b === n && n >= 4) a.inCue = id.line("lastBreath");
          add(i, "hold", a);
        }
      }
      add(i, "release", { t: "voice", clip: id.line("release") });
      add(i, "release", { t: "gap", s: GAP.afterRelease });
    }
    prevBase = p.base;
  });

  add(last, "outro", { t: "voice", clip: id.line("wake") });
  add(last, "outro", { t: "gap", s: GAP.beforeEndBell });
  add(last, "outro", { t: "sfx", clip: "sfx.bell.end", wait: SFX_WAIT.end });
  add(last, "outro", { t: "voice", clip: id.line("close") });
  add(last, "outro", { t: "gap", s: GAP.afterClose });
  return A;
}

// A flow: optional setup into the starting shape, then rounds of moves. With
// guidance on, the first round on the first side is taught (teach line + one
// full breath in each shape); every other round flows, one move per chime.
function addFlow(add, i, f, rounds, level, teach) {
  const lvl = level === "intermediate" ? 2 : 1;
  const moves = flowMoves(f, lvl);
  const sides = f.sided ? 2 : 1;
  for (let side = 1; side <= sides; side++) {
    if (side === 2) {
      add(i, "switch", { t: "gap", s: GAP.beforeSwitch, side, sides });
      add(i, "switch", { t: "voice", clip: id.line("switch"), side, sides });
      add(i, "switch", { t: "gap", s: GAP.afterSwitch, side, sides });
    }
    if (f.setup) {
      const clip = teach && side === 1 ? id.setup(f.id) : id.cue(f.setup.cue);
      add(i, "enter", { t: "voice", clip, side, sides, mv: "setup" });
      add(i, "enter", { t: "gap", s: GAP.afterSetup, side, sides, mv: "setup" });
    }
    for (let r = 1; r <= rounds; r++) {
      const teaching = teach && side === 1 && r === 1;
      const ctx = { side, sides, round: r, rounds };
      if (teach && side === 1 && r === 2) {
        add(i, "flow", { t: "voice", clip: id.line("flowOn"), ...ctx });
        add(i, "flow", { t: "gap", s: GAP.afterFlowOn, ...ctx });
      }
      moves.forEach((mv, k) => {
        const c = { ...ctx, mv: k };
        if (teaching) {
          add(i, "enter", { t: "voice", clip: id.teach(f.id, k, lvl === 2 && !!f.moves[k].l2), ...c });
          const n = mv.breath === "stay" ? mv.n : 1;
          for (let b = 1; b <= n; b++) add(i, "enter", { t: "breath", n: b, of: n, ...c });
        } else if (mv.breath === "stay") {
          for (let b = 1; b <= mv.n; b++) add(i, "flow", { t: "breath", n: b, of: mv.n, ...c, ...(b === 1 ? { inCue: id.cue(mv.cue) } : {}) });
        } else {
          add(i, "flow", { t: "half", phase: mv.breath, cue: id.cue(mv.cue), ...c });
        }
      });
    }
  }
  add(i, "release", { t: "voice", clip: id.line("release") });
  add(i, "release", { t: "gap", s: GAP.afterRelease });
}

export function actionSeconds(a, breath, durOf = estimateDuration) {
  switch (a.t) {
    case "voice":  return durOf(a.clip);
    case "sfx":    return a.wait;
    case "gap":
    case "rest":   return a.s;
    case "breath": return breath.inhale + breath.exhale;
    case "half":   return a.phase === "in" ? breath.inhale : breath.exhale;
    default:       return 0;
  }
}

export function estimateSeconds(session, breath, durOf = estimateDuration) {
  return buildActions(session, breath).reduce((s, a) => s + actionSeconds(a, breath, durOf), 0);
}

// Clip ids a session needs (for decoding ahead of time).
export function clipsFor(session, breath) {
  const set = new Set([id.inhale, id.exhale]);
  for (const a of buildActions(session, breath)) {
    if (a.clip) set.add(a.clip);
    if (a.inCue) set.add(a.inCue);
    if (a.cue) set.add(a.cue);
  }
  return [...set];
}

// ───────── generator ─────────
// 1. Fixed bookends: one centering pose, savasana.
// 2. Split the remaining time across warm up / build / cool down; in each
//    phase take priority poses first, then a seeded shuffle of the rest, while
//    they fit the phase budget (leftover rolls into the next phase).
// 3. Order each phase by `seq` so the flow follows a natural class arc and
//    position changes are few.
// 4. Nudge breath counts, then savasana length, until the estimate is close to
//    the requested length.
// Style "flow" adds a sun salutation (half for short sessions) and, from 20
// minutes, the warrior flow to the Build phase, and drops the standalone
// postures those flows already contain (each flow's `replaces`).
export function sunRounds(minutes) {
  return minutes <= 10 ? 2 : minutes <= 15 ? 3 : minutes <= 20 ? 2 : minutes <= 30 ? 3 : minutes <= 45 ? 4 : 5;
}
export const focusMatch = (p, focus) => !!focus && focus !== "all" && p.focus.includes(focus);

// A fresh item for pose `p` in a session of `minutes`, with the default hold.
export function itemFor(p, minutes, phase = p.phase) {
  if (isFlow(p)) return { poseId: p.id, phase, rounds: p.rounds };
  if (p.hold === "time") { const [lo, hi] = savasanaRange(minutes); return { poseId: p.id, phase, seconds: Math.round((lo + hi) / 2) }; }
  return { poseId: p.id, phase, breaths: clamp(Math.round(p.breaths * breathFactor(minutes)), MIN_BREATHS, maxBreathsFor(minutes)) };
}

export function generateSession({ minutes, level, seed, style = "steady", focus = "all" }, breath, durOf = estimateDuration) {
  if (!FOCUS_OPTIONS.includes(focus)) focus = "all";
  const rng = mulberry32(seed);
  const target = minutes * 60;
  const maxLevel = level === "intermediate" ? 2 : 1;
  const maxB = maxBreathsFor(minutes);
  const share = PHASE_SHARE[focus] || PHASE_SHARE.all;
  const match = (p) => focusMatch(p, focus);
  const flows = [];
  if (style === "flow") {
    flows.push({ poseId: minutes <= 15 ? "half-sun" : "sun-a", phase: "main", rounds: sunRounds(minutes) });
    if (minutes >= 20) flows.push({ poseId: "warrior-flow", phase: "main", rounds: minutes >= 45 ? 3 : 2 });
  }
  const replaced = new Set(flows.flatMap((f) => poseById(f.poseId).replaces));
  const pool = POSES.filter((p) => p.level <= maxLevel && !replaced.has(p.id));
  const mkItem = (p) => itemFor(p, minutes);

  const [savMin, savMax] = savasanaRange(minutes);
  const centerItem = mkItem(pool.find((p) => p.phase === "center"));
  const savItem = { ...mkItem(pool.find((p) => p.phase === "final")), seconds: Math.round(savMin + (savMax - savMin) * (SAVASANA_START[focus] ?? 0.5)) };

  // Cost of one item in isolation (assume a position change, the common case).
  const itemCost = (item) => {
    const s = { items: [item, item], level };
    const acts = buildActions(s, breath).filter((a) => a.step === 1 && a.stage !== "outro");
    return acts.reduce((sum, a) => sum + actionSeconds(a, breath, durOf), 0);
  };

  const fixed = estimateSeconds({ items: [centerItem, savItem], level }, breath, durOf);
  const flexible = Math.max(0, target - fixed);

  const chosen = { warmup: [], main: [], cooldown: [] };
  let carry = 0;
  for (const phase of ["warmup", "main", "cooldown"]) {
    const budget = flexible * share[phase] + carry;
    const cands = pool.filter((p) => p.phase === phase);
    const prio = cands.filter((p) => p.priority).sort((a, b) => a.seq - b.seq);
    const rest = shuffle(cands.filter((p) => !p.priority), rng);
    // With a focus: matching postures first (priority ones leading), then the
    // usual anchors, then everything else.
    const ordered = focus === "all" ? [...prio, ...rest] : [
      ...prio.filter(match), ...rest.filter(match),
      ...prio.filter((p) => !match(p)), ...rest.filter((p) => !match(p)),
    ];
    let spent = 0;
    if (phase === "main") for (const f of flows) { chosen.main.push(f); spent += itemCost(f); }
    for (const p of ordered) {
      const item = mkItem(p);
      const c = itemCost(item);
      // Allow a small overshoot so a phase isn't left badly short.
      if (spent + c <= budget + c * 0.35) { chosen[phase].push(item); spent += c; }
    }
    carry = budget - spent;
  }

  const bySeq = (a, b) => poseById(a.poseId).seq - poseById(b.poseId).seq;
  const items = [
    centerItem,
    ...chosen.warmup.sort(bySeq),
    ...chosen.main.sort(bySeq),
    ...chosen.cooldown.sort(bySeq),
    savItem,
  ];
  const session = { items, level };

  // Fine-tune breath counts toward the target.
  const breathSec = breath.inhale + breath.exhale;
  let total = estimateSeconds(session, breath, durOf);
  for (let guard = 0; guard < 400; guard++) {
    const diff = target - total;
    const up = diff > 0;
    const cands = items.filter((it) => it.breaths != null &&
      (up ? it.breaths < maxB : it.breaths > MIN_BREATHS));
    // Only consider changes that move us closer.
    const useful = cands.filter((it) => {
      const step = breathSec * (poseById(it.poseId).sided ? 2 : 1);
      return Math.abs(diff) - Math.abs(Math.abs(diff) - step) > 0;
    });
    if (!useful.length) break;
    // With a focus, matching postures get the extra breaths and lose them last.
    const preferred = focus === "all" ? useful : useful.filter((it) => match(poseById(it.poseId)) === up);
    const from = preferred.length ? preferred : useful;
    // Random pick spreads the changes across the session.
    const pick = from[Math.floor(rng() * from.length)];
    pick.breaths += up ? 1 : -1;
    total = estimateSeconds(session, breath, durOf);
  }
  // Savasana absorbs what's left, within its bounds.
  savItem.seconds = clamp(Math.round(savItem.seconds + (target - total)), savMin, savMax);
  total = estimateSeconds(session, breath, durOf);

  return {
    id: `s_${seed.toString(36)}`,
    createdISO: new Date().toISOString(),
    minutes, level, seed, style, focus,
    items,
    estSeconds: Math.round(total),
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

// Group items by phase for the preview.
export function phasesOf(session) {
  return PHASES.map((ph) => ({
    ...ph,
    items: session.items.map((it, i) => ({ ...it, index: i })).filter((it) => it.phase === ph.id),
  })).filter((g) => g.items.length);
}

// ───────── editing a proposed session ─────────
// Pure helpers: each returns a NEW session marked `edited` (or the same one
// when nothing changes). Arrive and Rest are the bookends: they can be
// adjusted but not removed or swapped for something else.
const BOOKENDS = new Set(["center", "final"]);
const cloneSession = (s) => ({ ...s, items: s.items.map((it) => ({ ...it })), edited: true });
const maxLevelOf = (s) => (s.level === "intermediate" ? 2 : 1);

export const canRemove = (session, index) => !BOOKENDS.has(session.items[index]?.phase);

export function removeItem(session, index) {
  if (!canRemove(session, index)) return session;
  const s = cloneSession(session);
  s.items.splice(index, 1);
  return s;
}

// Postures and flows that could take the place of item `index`: same phase,
// within the level, not already in the session. Ordered as they'd appear in a
// class. Unlike the generator, a flow's `replaces` isn't enforced here: a sun
// salutation plus a separate Downward dog is a normal class, and it's the
// person's call.
export function swapOptions(session, index) {
  const cur = session.items[index];
  if (!cur || BOOKENDS.has(cur.phase)) return [];
  const taken = new Set(session.items.map((it) => it.poseId));
  return [...POSES, ...FLOWS]
    .filter((p) => p.phase === cur.phase && p.level <= maxLevelOf(session) && !taken.has(p.id))
    .sort((a, b) => a.seq - b.seq);
}

// Replace item `index` with `poseId` (default hold), then keep the phase in
// class order so position changes stay few.
export function swapItem(session, index, poseId) {
  const p = poseById(poseId);
  if (!p || !swapOptions(session, index).some((o) => o.id === poseId)) return session;
  const s = cloneSession(session);
  const phase = s.items[index].phase;
  s.items[index] = itemFor(p, s.minutes, phase);
  const seqOf = (it) => poseById(it.poseId).seq;
  const idx = s.items.map((it, i) => (it.phase === phase ? i : -1)).filter((i) => i >= 0);
  const sorted = idx.map((i) => s.items[i]).sort((a, b) => seqOf(a) - seqOf(b));
  idx.forEach((i, k) => { s.items[i] = sorted[k]; });
  return s;
}

// The editable amount of an item: breaths (per side), rounds, or seconds.
export function holdOf(item) {
  if (item.rounds != null) return { key: "rounds", value: item.rounds, min: EDIT_LIMITS.rounds[0], max: EDIT_LIMITS.rounds[1], step: 1 };
  if (item.seconds != null) return { key: "seconds", value: item.seconds, min: EDIT_LIMITS.seconds[0], max: EDIT_LIMITS.seconds[1], step: EDIT_LIMITS.secondsStep };
  return { key: "breaths", value: item.breaths, min: EDIT_LIMITS.breaths[0], max: EDIT_LIMITS.breaths[1], step: 1 };
}

export function adjustHold(session, index, dir) {
  const it = session.items[index];
  if (!it) return session;
  const h = holdOf(it);
  // Seconds snap to the step so odd fitted values line up after one press.
  const next = h.key === "seconds"
    ? clamp((dir > 0 ? Math.floor(h.value / h.step) + 1 : Math.ceil(h.value / h.step) - 1) * h.step, h.min, h.max)
    : clamp(h.value + dir * h.step, h.min, h.max);
  if (next === h.value) return session;
  const s = cloneSession(session);
  s.items[index][h.key] = next;
  return s;
}
