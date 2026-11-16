import { test } from "node:test";
import assert from "node:assert/strict";
import { POSES, FLOWS } from "../js/library.js";
import { FR_POSES, FR_FLOWS, FR_POSITIONS, FR_PHASES, FR_FAMILIES, FR_LINES } from "../js/lang/fr.js";
import { POSITIONS, PHASES, FAMILIES } from "../js/library.js";
import { catalog, getClip, LINES, estimateSpeechSeconds, id } from "../js/phrases.js";
import { generateSession, estimateSeconds, clipsFor, LENGTH_OPTIONS } from "../js/session.js";
import { allKeys, isTranslated } from "../js/i18n.js";

test("every posture has French names and guidance", () => {
  for (const p of POSES) {
    const f = FR_POSES[p.id];
    assert.ok(f, `missing ${p.id}`);
    assert.ok(f.english && f.guide && f.guide.length > 40, `${p.id} incomplete`);
    if (p.mods) assert.ok(f.mods, `${p.id} mods`);
  }
});

test("every flow is translated move for move", () => {
  const cueMap = new Map();
  for (const en of FLOWS) {
    const fr = FR_FLOWS[en.id];
    assert.ok(fr && fr.english && fr.guide, `missing ${en.id}`);
    assert.equal(fr.moves.length, en.moves.length, `${en.id} move count`);
    assert.equal(!!fr.setup, !!en.setup, `${en.id} setup`);
    const pairs = en.moves.map((mv, k) => [mv, fr.moves[k]]);
    if (en.setup) pairs.push([en.setup, fr.setup]);
    for (const [e, f] of pairs) {
      assert.ok(f.cue && f.teach, `${en.id}: incomplete move`);
      assert.ok(f.cue.split(/\s+/).length <= 6, `${en.id}: French cue too long for one breath: ${f.cue}`);
      assert.equal(!!e.l2, !!f.l2, `${en.id}: l2 mismatch`);
      // Cue clips are keyed by English text: one English cue, one French cue.
      for (const [ec, fc] of [[e.cue, f.cue], ...(e.l2 ? [[e.l2.cue, f.l2.cue]] : [])]) {
        if (cueMap.has(ec)) assert.equal(cueMap.get(ec), fc, `"${ec}" translated two ways`);
        cueMap.set(ec, fc);
      }
    }
  }
});

test("labels, positions and spoken lines are all translated", () => {
  for (const k of Object.keys(POSITIONS)) assert.ok(FR_POSITIONS[k]?.cue && FR_POSITIONS[k]?.label, k);
  for (const ph of PHASES) assert.ok(FR_PHASES[ph.id], ph.id);
  for (const f of Object.keys(FAMILIES)) assert.ok(FR_FAMILIES[f], f);
  for (const k of Object.keys(LINES)) assert.ok(FR_LINES[k], k);
  for (const k of allKeys()) assert.ok(isTranslated(k), `UI string ${k}`);
});

test("every voice clip exists in both languages", () => {
  const voice = catalog().filter((c) => c.kind === "voice");
  const en = voice.filter((c) => c.lang === "en").map((c) => c.id.slice(3)).sort();
  const fr = voice.filter((c) => c.lang === "fr").map((c) => c.id.slice(3)).sort();
  assert.deepEqual(fr, en);
  for (const c of voice) assert.ok(c.text.trim().length > 0, c.id);
  assert.equal(getClip(id.line("welcome"), "fr").text, FR_LINES.welcome);
});

test("French sessions fit their length with French clip durations", () => {
  const durFr = (cid) => { const c = getClip(cid, "fr"); return !c ? 0 : c.kind === "voice" ? estimateSpeechSeconds(c.text) : c.seconds; };
  for (const style of ["steady", "flow"]) {
    for (const minutes of LENGTH_OPTIONS) {
      for (let seed = 1; seed <= 5; seed++) {
        const cfg = { inhale: 4, exhale: 5 };
        const s = generateSession({ minutes, level: "intermediate", seed, style }, cfg, durFr);
        assert.ok(Math.abs(estimateSeconds(s, cfg, durFr) - minutes * 60) <= 60, `${style} ${minutes} min seed ${seed}`);
        for (const cid of clipsFor(s, cfg)) assert.ok(getClip(cid, "fr"), `missing fr clip ${cid}`);
      }
    }
  }
});
