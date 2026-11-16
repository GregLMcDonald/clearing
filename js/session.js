// Session generation + timeline. Pure logic, no DOM, no audio — testable in
// Node (see test/session.test.mjs).
//
// A *session* is the plan the user previews:
//   { id, createdISO, minutes, level, seed, items: [item], estSeconds }
//   item: { poseId, phase, breaths }          (breaths per side)
//       | { poseId, phase, rounds }           (a flow; rounds per side)
//       | { poseId, phase, seconds }          (hold: "time", i.e. savasana)
//
// buildActions() expands a session into the flat list of timed actions the
// player runs. Its `cfg` is { inhale, exhale, readGuide } (readGuide defaults
// to true); the same cfg must be used for generating, estimating and playing. Session length estimates are computed from that same list, so
// the preview's "≈ 21 min" and the real run can't drift apart structurally.

import { POSES, FLOWS, PHASES, poseById, isFlow, flowMoves } from "./library.js";
import { id, getClip, estimateSpeechSeconds, HOLD_RANGE } from "./phrases.js";

export const LENGTH_OPTIONS = [10, 15, 20, 30, 45, 60];
export const STYLES = { steady: "Steady", flow: "Flow" };
export const MIN_BREATHS = 3;

// Share of the flexible time (after arriving + savasana) per phase.
const PHASE_SHARE = { warmup: 0.28, main: 0.47, cooldown: 0.25 };

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
// Flow actions also carry round, rounds and show (the current shape's name).
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
      const show = f.setup.cue.replace(/\.$/, "");
      const clip = teach && side === 1 ? id.setup(f.id) : id.cue(f.setup.cue);
      add(i, "enter", { t: "voice", clip, side, sides, show });
      add(i, "enter", { t: "gap", s: GAP.afterSetup, side, sides, show });
    }
    for (let r = 1; r <= rounds; r++) {
      const teaching = teach && side === 1 && r === 1;
      const ctx = { side, sides, round: r, rounds };
      if (teach && side === 1 && r === 2) {
        add(i, "flow", { t: "voice", clip: id.line("flowOn"), ...ctx });
        add(i, "flow", { t: "gap", s: GAP.afterFlowOn, ...ctx });
      }
      moves.forEach((mv, k) => {
        const c = { ...ctx, show: mv.show };
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
export function generateSession({ minutes, level, seed, style = "steady" }, breath, durOf = estimateDuration) {
  const rng = mulberry32(seed);
  const target = minutes * 60;
  const maxLevel = level === "intermediate" ? 2 : 1;
  const maxB = maxBreathsFor(minutes);
  const factor = breathFactor(minutes);
  const flows = [];
  if (style === "flow") {
    flows.push({ poseId: minutes <= 15 ? "half-sun" : "sun-a", phase: "main", rounds: sunRounds(minutes) });
    if (minutes >= 20) flows.push({ poseId: "warrior-flow", phase: "main", rounds: minutes >= 45 ? 3 : 2 });
  }
  const replaced = new Set(flows.flatMap((f) => poseById(f.poseId).replaces));
  const pool = POSES.filter((p) => p.level <= maxLevel && !replaced.has(p.id));
  const mkItem = (p) => p.hold === "time"
    ? { poseId: p.id, phase: p.phase, seconds: 0 }
    : { poseId: p.id, phase: p.phase, breaths: clamp(Math.round(p.breaths * factor), MIN_BREATHS, maxB) };

  const [savMin, savMax] = savasanaRange(minutes);
  const centerItem = mkItem(pool.find((p) => p.phase === "center"));
  const savItem = { ...mkItem(pool.find((p) => p.phase === "final")), seconds: Math.round((savMin + savMax) / 2) };

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
    const budget = flexible * PHASE_SHARE[phase] + carry;
    const cands = pool.filter((p) => p.phase === phase);
    const ordered = [
      ...cands.filter((p) => p.priority).sort((a, b) => a.seq - b.seq),
      ...shuffle(cands.filter((p) => !p.priority), rng),
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
    // Random pick spreads the changes across the session.
    const pick = useful[Math.floor(rng() * useful.length)];
    pick.breaths += up ? 1 : -1;
    total = estimateSeconds(session, breath, durOf);
  }
  // Savasana absorbs what's left, within its bounds.
  savItem.seconds = clamp(Math.round(savItem.seconds + (target - total)), savMin, savMax);
  total = estimateSeconds(session, breath, durOf);

  return {
    id: `s_${seed.toString(36)}`,
    createdISO: new Date().toISOString(),
    minutes, level, seed, style,
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
