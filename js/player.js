// Session player: walks the action list from session.buildActions() against
// the audio clock. UI reads its public fields (step, stage, caption,
// breathState, paused…) every animation frame; onChange() fires on discrete
// changes (new action, pause) so the UI can update text.
//
// Cancellation: every run of the loop owns a token; skipping or stopping bumps
// `tok`, which makes in-flight waits resolve and the old loop exit quietly.

import { buildActions, actionSeconds } from "./session.js";
import { getClip } from "./phrases.js";

export class Player {
  constructor(engine, session, { inhale, exhale, readGuide, music }, { onChange, onFinish } = {}) {
    this.engine = engine;
    this.session = session;
    this.breath = { inhale, exhale, readGuide };
    this.music = music;
    this.onChange = onChange || (() => {});
    this.onFinish = onFinish || (() => {});

    this.actions = buildActions(session, this.breath);
    this.durs = this.actions.map((a) => actionSeconds(a, this.breath, (c) => engine.duration(c)));
    this.prefix = [0];
    for (const d of this.durs) this.prefix.push(this.prefix[this.prefix.length - 1] + d);
    this.total = this.prefix[this.prefix.length - 1];
    this.stepStarts = [];
    this.actions.forEach((a, i) => {
      if (a.stage !== "outro" && this.stepStarts[a.step] == null) this.stepStarts[a.step] = i;
    });
    this.outroStart = this.actions.findIndex((a) => a.stage === "outro");

    this.i = 0;
    this.tok = 0;
    this.actionT0 = 0;
    this.paused = false;
    this.finished = false;
    this.restartOnResume = false;
    this.ttsActive = false;
    this.caption = "";
    this.breathState = null; // { phase: "in"|"out", t0, dur, n, of }
    this.startedAt = 0;
  }

  get action() { return this.actions[this.i]; }
  get step() { return this.action ? this.action.step : 0; }
  get stage() { return this.action ? this.action.stage : "intro"; }
  get item() { return this.session.items[this.step]; }
  get side() { const a = this.actions[this.i]; return a && a.t === "breath" ? a.side : this.stage === "switch" ? 2 : 1; }

  elapsed() {
    const into = Math.max(0, this.engine.now() - this.actionT0);
    return this.prefix[this.i] + Math.min(this.durs[this.i] || 0, into);
  }
  remaining() { return Math.max(0, this.total - this.elapsed()); }

  async start() {
    this.startedAt = Date.now();
    await this.engine.resume();
    this.engine.startMusic(this.music);
    this.runFrom(0);
  }

  async runFrom(index) {
    const tok = ++this.tok;
    this.engine.stopAll();
    for (let k = index; k < this.actions.length; k++) {
      if (tok !== this.tok) return;
      this.i = k;
      this.actionT0 = this.engine.now();
      const a = this.actions[k];
      if (a.t !== "breath") this.breathState = null;
      if (a.t === "voice") this.caption = getClip(a.clip).caption;
      this.onChange();
      await this.perform(a, tok);
    }
    if (tok === this.tok) this.complete();
  }

  async perform(a, tok) {
    const e = this.engine;
    const live = () => tok === this.tok;
    switch (a.t) {
      case "voice": {
        const r = e.voice(a.clip);
        this.ttsActive = r.tts;
        await r.ended;
        if (live()) this.ttsActive = false;
        return;
      }
      case "sfx":
        e.sfx(a.clip);
        return e.wait(a.wait, live);
      case "gap":
      case "rest":
        return e.wait(a.s, live);
      case "breath": {
        const { inhale, exhale } = this.breath;
        this.breathState = { phase: "in", t0: e.now(), dur: inhale, n: a.n, of: a.of };
        e.breath("in", inhale);
        if (a.inCue) this.overlay(a.inCue);
        this.onChange();
        await e.wait(inhale, live);
        if (!live()) return;
        this.breathState = { phase: "out", t0: e.now(), dur: exhale, n: a.n, of: a.of };
        e.breath("out", exhale);
        this.onChange();
        await e.wait(exhale, live);
        return;
      }
    }
  }

  // A short voice line layered over a breath (not awaited).
  overlay(cid) {
    this.engine.voice(cid);
    this.caption = getClip(cid).caption;
  }

  async pause() {
    if (this.paused || this.finished) return;
    this.paused = true;
    // Device speech can't be frozen mid-word like the AudioContext, so abort
    // the loop and replay the current line on resume.
    if (this.ttsActive) { this.restartOnResume = true; this.tok++; }
    await this.engine.suspend();
    this.onChange();
  }

  async resume() {
    if (!this.paused) return;
    this.paused = false;
    await this.engine.resume();
    if (this.restartOnResume) { this.restartOnResume = false; this.runFrom(this.i); }
    this.onChange();
  }

  jump(index) {
    if (this.finished) return;
    if (this.paused) {
      // Don't start talking while paused: move the cursor, run on resume.
      this.tok++;
      this.engine.stopAll();
      this.i = index;
      this.actionT0 = this.engine.now();
      this.breathState = null;
      this.caption = "";
      this.restartOnResume = true;
      this.onChange();
      return;
    }
    this.runFrom(index);
  }

  next() {
    const s = this.step;
    const target = this.stage === "outro" ? -1 : (this.stepStarts[s + 1] ?? this.outroStart);
    if (target == null || target < 0 || target <= this.i) { this.complete(); return; }
    this.jump(target);
  }

  prev() {
    const s = this.step;
    const start = this.stepStarts[s];
    const intoStep = this.elapsed() - this.prefix[start];
    const target = intoStep > 4 || s === 0 ? start : this.stepStarts[s - 1];
    this.jump(target);
  }

  stop() {
    this.tok++;
    this.finished = true;
    this.engine.stopAll();
    this.engine.stopMusic(1.5);
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    this.tok++;
    this.engine.stopAll();
    this.engine.stopMusic(4);
    this.onFinish(true);
  }
}
