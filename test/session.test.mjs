import { test } from "node:test";
import assert from "node:assert/strict";
import { POSES, FLOWS, POSITIONS, FAMILIES, PHASES, poseById, isFlow } from "../js/library.js";
import { catalog, getClip, HOLD_RANGE, INHALE_RANGE, EXHALE_RANGE } from "../js/phrases.js";
import { generateSession, buildActions, estimateSeconds, clipsFor, LENGTH_OPTIONS, MIN_BREATHS } from "../js/session.js";

const BREATHS = [{ inhale: 4, exhale: 5 }, { inhale: INHALE_RANGE[0], exhale: EXHALE_RANGE[0] }, { inhale: INHALE_RANGE[1], exhale: EXHALE_RANGE[1] }];
const PHASE_ORDER = PHASES.map((p) => p.id);

test("library entries are well formed", () => {
  const ids = new Set();
  for (const p of POSES) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(PHASE_ORDER.includes(p.phase), `${p.id} phase`);
    assert.ok(POSITIONS[p.base], `${p.id} base`);
    assert.ok(FAMILIES[p.family], `${p.id} family`);
    assert.ok([1, 2].includes(p.level), `${p.id} level`);
    assert.ok(p.guide.length > 40, `${p.id} guide`);
  }
  assert.equal(POSES.filter((p) => p.phase === "center").length, 1);
  assert.equal(POSES.filter((p) => p.phase === "final").length, 1);
});

test("catalog ids are unique", () => {
  const ids = catalog().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const level of ["beginner", "intermediate"]) {
  for (const minutes of LENGTH_OPTIONS) {
    test(`${level} ${minutes} min sessions fit the request`, () => {
      for (const breath of BREATHS) {
        for (let seed = 1; seed <= 25; seed++) {
          const s = generateSession({ minutes, level, seed }, breath);
          const est = estimateSeconds(s, breath);
          assert.ok(Math.abs(est - minutes * 60) <= 60, `seed ${seed}: ${Math.round(est)}s vs ${minutes * 60}s`);

          const ids = s.items.map((it) => it.poseId);
          assert.equal(new Set(ids).size, ids.length, "no repeated postures");
          assert.equal(s.items[0].phase, "center");
          assert.equal(s.items[s.items.length - 1].phase, "final");
          const order = s.items.map((it) => PHASE_ORDER.indexOf(it.phase));
          assert.deepEqual(order, [...order].sort((a, b) => a - b), "phases in arc order");

          for (const it of s.items) {
            const p = poseById(it.poseId);
            if (level === "beginner") assert.equal(p.level, 1, `${p.id} is intermediate`);
            if (p.hold === "time") assert.ok(it.seconds >= 60);
            else assert.ok(it.breaths >= MIN_BREATHS && it.breaths <= HOLD_RANGE[1], `${p.id} ${it.breaths} breaths`);
          }
          for (const cid of clipsFor(s, breath)) assert.ok(getClip(cid), `missing clip ${cid}`);
        }
      }
    });
  }
}

test("readGuide off: no guidance clips, sessions still fit", () => {
  const cfg = { inhale: 4, exhale: 5, readGuide: false };
  for (const minutes of LENGTH_OPTIONS) {
    for (let seed = 1; seed <= 10; seed++) {
      const s = generateSession({ minutes, level: "beginner", seed }, cfg);
      assert.ok(Math.abs(estimateSeconds(s, cfg) - minutes * 60) <= 60, `${minutes} min seed ${seed}`);
      assert.ok(!clipsFor(s, cfg).some((c) => c.endsWith(".guide")), "guidance clip scheduled");
    }
  }
});

test("flows are well formed", () => {
  for (const f of FLOWS) {
    assert.ok(f.moves.length >= 2, f.id);
    for (const mv of f.moves) {
      assert.ok(["in", "out", "stay"].includes(mv.breath), `${f.id} breath`);
      assert.ok(mv.cue.split(/\s+/).length <= 5, `${f.id}: cue too long to fit one breath: ${mv.cue}`);
      if (mv.breath === "stay") assert.ok(mv.n >= 1);
    }
    // In/out moves must alternate (stays are whole breaths), round to round too.
    const halves = f.moves.filter((mv) => mv.breath !== "stay").map((mv) => mv.breath);
    for (let k = 0; k < halves.length; k++) assert.notEqual(halves[k], halves[(k + 1) % halves.length], `${f.id} breath order at ${k}`);
    for (const r of f.replaces) assert.ok(poseById(r), `${f.id} replaces unknown ${r}`);
  }
});

for (const level of ["beginner", "intermediate"]) {
  test(`${level} flow-style sessions fit and contain flows`, () => {
    for (const cfg of [{ inhale: 4, exhale: 5 }, { inhale: 4, exhale: 5, readGuide: false }, BREATHS[2]]) {
      for (const minutes of LENGTH_OPTIONS) {
        for (let seed = 1; seed <= 10; seed++) {
          const s = generateSession({ minutes, level, seed, style: "flow" }, cfg);
          assert.ok(Math.abs(estimateSeconds(s, cfg) - minutes * 60) <= 60, `${minutes} min seed ${seed}`);
          const flows = s.items.filter((it) => isFlow(poseById(it.poseId)));
          assert.ok(flows.length >= 1, "has a sun salutation");
          const replaced = new Set(flows.flatMap((it) => poseById(it.poseId).replaces));
          for (const it of s.items) assert.ok(!replaced.has(it.poseId), `${it.poseId} duplicated by a flow`);
          for (const cid of clipsFor(s, cfg)) assert.ok(getClip(cid), `missing clip ${cid}`);
        }
      }
    }
  });
}

test("steady style never includes flows", () => {
  for (const minutes of LENGTH_OPTIONS) {
    const s = generateSession({ minutes, level: "intermediate", seed: 5 }, BREATHS[0]);
    assert.ok(!s.items.some((it) => isFlow(poseById(it.poseId))));
  }
});

test("same seed, same session", () => {
  const a = generateSession({ minutes: 30, level: "intermediate", seed: 42 }, BREATHS[0]);
  const b = generateSession({ minutes: 30, level: "intermediate", seed: 42 }, BREATHS[0]);
  assert.deepEqual(a.items, b.items);
});

test("timeline: every step has actions; sided poses switch once", () => {
  const s = generateSession({ minutes: 45, level: "intermediate", seed: 9 }, BREATHS[0]);
  const actions = buildActions(s, BREATHS[0]);
  s.items.forEach((it, i) => {
    const mine = actions.filter((a) => a.step === i && a.stage !== "outro");
    assert.ok(mine.length > 0);
    const switches = mine.filter((a) => a.t === "voice" && a.clip === "v.switch").length;
    assert.equal(switches, poseById(it.poseId).sided ? 1 : 0, it.poseId);
  });
});
