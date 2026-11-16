import { test } from "node:test";
import assert from "node:assert/strict";
import { POSES, FLOWS, FOCUSES, poseById, isFlow } from "../js/library.js";
import { getClip } from "../js/phrases.js";
import {
  generateSession, estimateSeconds, clipsFor, buildActions, LENGTH_OPTIONS, FOCUS_OPTIONS, focusMatch,
  removeItem, canRemove, swapOptions, swapItem, adjustHold, holdOf, EDIT_LIMITS,
} from "../js/session.js";
import { History, dayKey, streaks, weekGrid } from "../js/history.js";

const CFG = { inhale: 4, exhale: 5 };

// ───────── focus ─────────
test("every posture and flow is tagged with known focuses", () => {
  for (const p of [...POSES, ...FLOWS]) {
    assert.ok(Array.isArray(p.focus), p.id);
    for (const f of p.focus) assert.ok(FOCUSES[f] && f !== "all", `${p.id}: unknown focus ${f}`);
  }
  // Each focus can fill every flexible phase at beginner level.
  for (const f of FOCUS_OPTIONS.filter((f) => f !== "all")) {
    const n = POSES.filter((p) => p.level === 1 && p.focus.includes(f)).length;
    assert.ok(n >= 6, `${f}: only ${n} beginner postures`);
  }
});

test("focused sessions fit their length", () => {
  for (const focus of FOCUS_OPTIONS) {
    for (const style of ["steady", "flow"]) {
      for (const minutes of LENGTH_OPTIONS) {
        for (let seed = 1; seed <= 6; seed++) {
          const s = generateSession({ minutes, level: "beginner", seed, style, focus }, CFG);
          assert.equal(s.focus, focus);
          assert.ok(Math.abs(estimateSeconds(s, CFG) - minutes * 60) <= 60, `${focus} ${style} ${minutes} min seed ${seed}`);
          const ids = s.items.map((it) => it.poseId);
          assert.equal(new Set(ids).size, ids.length, "no repeats");
        }
      }
    }
  }
});

test("a body-area focus brings in more matching postures", () => {
  for (const focus of ["hips", "back", "shoulders"]) {
    let withFocus = 0, without = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const count = (s) => s.items.filter((it) => focusMatch(poseById(it.poseId), focus)).length;
      withFocus += count(generateSession({ minutes: 30, level: "beginner", seed, focus }, CFG));
      without += count(generateSession({ minutes: 30, level: "beginner", seed }, CFG));
    }
    assert.ok(withFocus > without * 1.3, `${focus}: ${withFocus} vs ${without}`);
  }
});

test("calm rests longer than energize", () => {
  let calm = 0, energize = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const sav = (focus) => generateSession({ minutes: 30, level: "beginner", seed, focus }, CFG).items.at(-1).seconds;
    calm += sav("calm");
    energize += sav("energize");
  }
  assert.ok(calm > energize, `${calm} vs ${energize}`);
});

test("unknown focus falls back to all-round", () => {
  const s = generateSession({ minutes: 20, level: "beginner", seed: 3, focus: "nope" }, CFG);
  assert.equal(s.focus, "all");
});

// ───────── editing ─────────
const base = () => generateSession({ minutes: 30, level: "beginner", seed: 7 }, CFG);

test("remove: bookends stay, others go, original untouched", () => {
  const s = base();
  assert.equal(canRemove(s, 0), false);
  assert.equal(canRemove(s, s.items.length - 1), false);
  assert.equal(removeItem(s, 0), s);
  const r = removeItem(s, 1);
  assert.equal(r.items.length, s.items.length - 1);
  assert.equal(r.edited, true);
  assert.ok(!s.edited);
  assert.ok(estimateSeconds(r, CFG) < estimateSeconds(s, CFG));
});

test("swap: options stay in phase and level, never duplicate; result keeps class order", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = generateSession({ minutes: 30, level: "beginner", seed, style: seed % 2 ? "flow" : "steady" }, CFG);
    assert.deepEqual(swapOptions(s, 0), [], "Arrive has no swaps");
    assert.deepEqual(swapOptions(s, s.items.length - 1), [], "Rest has no swaps");
    s.items.forEach((it, i) => {
      if (!canRemove(s, i)) return;
      const opts = swapOptions(s, i);
      const ids = new Set(s.items.map((x) => x.poseId));
      for (const o of opts) {
        assert.equal(o.phase, it.phase);
        assert.equal(o.level, 1);
        assert.ok(!ids.has(o.id));
      }
      if (!opts.length) return;
      const pick = opts[seed % opts.length];
      const r = swapItem(s, i, pick.id);
      const now = r.items.map((x) => x.poseId);
      assert.ok(now.includes(pick.id) && !now.includes(it.poseId));
      assert.equal(new Set(now).size, now.length);
      const seqs = r.items.filter((x) => x.phase === it.phase).map((x) => poseById(x.poseId).seq);
      assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), "phase stays in seq order");
      for (const cid of clipsFor(r, CFG)) assert.ok(getClip(cid), `missing clip ${cid}`);
      buildActions(r, CFG); // doesn't throw
    });
  }
});

test("swap: a flow can come in, and it gets rounds", () => {
  const s = base();
  const i = s.items.findIndex((it) => it.phase === "main");
  const r = swapItem(s, i, "sun-a");
  const it = r.items.find((x) => x.poseId === "sun-a");
  assert.ok(it && isFlow(poseById("sun-a")) && it.rounds >= 1);
  assert.equal(swapItem(s, i, "pigeon"), s, "intermediate posture refused at beginner level");
  assert.equal(swapItem(s, i, "savasana"), s, "wrong phase refused");
});

test("adjust hold: breaths, rounds and seconds stay in range", () => {
  let s = base();
  const bi = s.items.findIndex((it) => it.breaths != null && it.phase !== "center");
  for (let k = 0; k < 20; k++) s = adjustHold(s, bi, +1);
  assert.equal(s.items[bi].breaths, EDIT_LIMITS.breaths[1]);
  for (let k = 0; k < 20; k++) s = adjustHold(s, bi, -1);
  assert.equal(s.items[bi].breaths, EDIT_LIMITS.breaths[0]);
  for (const cid of clipsFor(s, CFG)) assert.ok(getClip(cid), `missing clip ${cid}`);

  const last = s.items.length - 1;
  const before = s.items[last].seconds;
  s = adjustHold(s, last, +1);
  assert.equal(s.items[last].seconds % EDIT_LIMITS.secondsStep, 0);
  assert.ok(s.items[last].seconds > before);
  assert.equal(holdOf(s.items[last]).key, "seconds");

  let f = generateSession({ minutes: 20, level: "beginner", seed: 1, style: "flow" }, CFG);
  const fi = f.items.findIndex((it) => it.rounds != null);
  for (let k = 0; k < 10; k++) f = adjustHold(f, fi, -1);
  assert.equal(f.items[fi].rounds, EDIT_LIMITS.rounds[0]);
});

// ───────── history ─────────
const at = (y, m, d, h = 8) => new Date(y, m - 1, d, h).toISOString();

test("streaks count local days, current only while unbroken", () => {
  const h = [at(2026, 11, 10), at(2026, 11, 11), at(2026, 11, 11, 20), at(2026, 11, 12), at(2026, 11, 14), at(2026, 11, 15)]
    .map((dateISO) => ({ dateISO, practicedSec: 600 }));
  assert.deepEqual(streaks(h, new Date(2026, 10, 15, 12)), { current: 2, longest: 3, days: 5 });
  assert.equal(streaks(h, new Date(2026, 10, 16, 12)).current, 2, "yesterday still counts");
  assert.equal(streaks(h, new Date(2026, 10, 17, 12)).current, 0);
  assert.deepEqual(streaks([], new Date()), { current: 0, longest: 0, days: 0 });
  assert.equal(dayKey(at(2026, 1, 5, 23)), "2026-01-05");
});

test("week grid: whole weeks, today last, minutes summed per day", () => {
  const today = new Date(2026, 10, 16, 9); // a Monday
  const h = [{ dateISO: at(2026, 11, 16, 7), practicedSec: 600 }, { dateISO: at(2026, 11, 16, 8), practicedSec: 900 }];
  const g = weekGrid(h, 4, today);
  assert.equal(g.length, 4 * 7);
  assert.equal(new Date(g[0].key + "T00:00").getDay(), 0, "starts on a Sunday");
  const t = g.find((c) => c.key === "2026-11-16");
  assert.equal(t.minutes, 25);
  assert.ok(g.filter((c) => c.future).every((c) => c.key > "2026-11-16"));
});

test("history merge dedupes by id and normalizes entries", () => {
  const a = History.normalize([{ dateISO: at(2026, 11, 1), practicedSec: 300 }, { bogus: 1 }]);
  assert.equal(a.length, 1);
  assert.ok(a[0].id);
  const merged = History.merge(a, [...a, { id: "x", dateISO: at(2026, 11, 2), practicedSec: 60 }]);
  assert.equal(merged.length, 2);
  assert.ok(merged[0].dateISO < merged[1].dateISO, "sorted oldest first");
});
