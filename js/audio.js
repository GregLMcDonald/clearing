// Audio engine. Everything audible goes through one AudioContext so that:
//   - all timing is read from ctx.currentTime (sample-accurate, no setTimeout drift);
//   - pausing is just ctx.suspend(): voice, chimes, bells and their timers all freeze together.
//
// Assets come from ONE pre-built pack (audio/pack-<hash>.bin) described by
// audio/manifest.json — see scripts/build-audio.mjs. The pack is downloaded once
// into Cache Storage and each session's clips are decoded into AudioBuffers
// before Start, so nothing loads mid-practice.
//
// Every clip has a fallback so the app is fully usable before the pack exists:
//   voice → device speech synthesis, bells/breath chimes → synthesized tones,
//   music → a soft synthesized pad.

import { getClip, clipSpec, estimateSpeechSeconds, id as clipIds } from "./phrases.js";

const MANIFEST_URL = "audio/manifest.json";
const AUDIO_CACHE = "clearing-audio";
const MUSIC_XFADE = 6;      // seconds of crossfade when a music track loops
const DUCK_LEVEL = 0.45;    // music level while the voice speaks

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.manifest = null;
    this.pack = null;             // ArrayBuffer of the whole pack, once loaded
    this.buffers = new Map();     // clipId → AudioBuffer
    this.sources = new Set();     // playing voice/sfx nodes, for stopAll()
    this.musicUrls = new Map();   // clipId → blob: URL
    this.music = null;
    this.voicesActive = 0;
    this.vol = { voice: 1, sfx: 0.6, music: 0.5 };
  }

  // ───────── manifest + pack ─────────
  async loadManifest() {
    const prevFile = this.manifest && this.manifest.pack.file;
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const m = await res.json();
      this.manifest = m && m.pack && m.clips ? m : null;
    } catch (_) {
      this.manifest = null;
    }
    if (!this.manifest || this.manifest.pack.file !== prevFile) {
      // New (or no) pack: forget everything decoded from the old one.
      this.pack = null;
      this.buffers.clear();
      this.musicUrls.forEach((u) => URL.revokeObjectURL(u));
      this.musicUrls.clear();
    }
    return this.manifest;
  }
  get hasPack() { return !!this.manifest; }
  packBytes() { return this.manifest ? this.manifest.pack.bytes : 0; }
  packUrl() { return new URL(`audio/${this.manifest.pack.file}`, location.href).href; }

  async isPackCached() {
    if (!this.manifest) return false;
    if (this.pack) return true;
    if (!("caches" in window)) return false;
    const cache = await caches.open(AUDIO_CACHE);
    return !!(await cache.match(this.packUrl()));
  }

  async downloadPack(onProgress) {
    const url = this.packUrl();
    const total = this.manifest.pack.bytes;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Audio pack download failed (${res.status})`);
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress) onProgress(Math.min(1, received / total));
    }
    const blob = new Blob(chunks, { type: "application/octet-stream" });
    if (blob.size !== total) throw new Error("Audio pack is incomplete; try again.");
    if ("caches" in window) {
      const cache = await caches.open(AUDIO_CACHE);
      await cache.put(url, new Response(blob, { headers: { "Content-Type": "application/octet-stream" } }));
      for (const req of await cache.keys()) if (req.url !== url) await cache.delete(req); // drop old packs
    }
    this.pack = await blob.arrayBuffer();
  }

  async loadPack() {
    if (this.pack) return true;
    if (!this.manifest || !("caches" in window)) return false;
    const hit = await (await caches.open(AUDIO_CACHE)).match(this.packUrl());
    if (!hit) return false;
    this.pack = await hit.arrayBuffer();
    return true;
  }

  // The manifest entry for a clip, but only if it was rendered from the
  // current wording/prompt. Edited text without a rebuild → null → fallback.
  entryFor(clipId) {
    const entry = this.manifest && this.manifest.clips[clipId];
    const clip = getClip(clipId);
    return entry && clip && entry.spec === clipSpec(clip) ? entry : null;
  }

  // ───────── context + graph ─────────
  ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: "playback" });
    const master = ctx.createGain();
    // Gentle limiter so bells + voice + music together never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);
    const bus = { voice: ctx.createGain(), sfx: ctx.createGain(), music: ctx.createGain() };
    const duck = ctx.createGain();
    bus.voice.connect(master);
    bus.sfx.connect(master);
    bus.music.connect(duck).connect(master);
    this.ctx = ctx;
    this.bus = bus;
    this.duckNode = duck;
    this.applyVolumes();
    return ctx;
  }
  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const k of ["voice", "sfx", "music"]) this.bus[k].gain.setTargetAtTime(this.vol[k], t, 0.05);
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Decode the clips a session needs. Missing/stale clips are skipped (they
  // fall back at play time). Music is streamed from a blob URL, not decoded.
  async prepare(ids, onProgress) {
    this.ensureContext();
    let done = 0, ready = 0;
    const hasPack = await this.loadPack();
    for (const cid of ids) {
      const clip = getClip(cid);
      if (this.buffers.has(cid) || this.musicUrls.has(cid)) ready++;
      else if (hasPack && clip) {
        const e = this.entryFor(cid);
        if (e) {
          try {
            const bytes = this.pack.slice(e.offset, e.offset + e.length);
            if (clip.kind === "music") {
              this.musicUrls.set(cid, URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" })));
            } else {
              this.buffers.set(cid, await this.ctx.decodeAudioData(bytes));
            }
            ready++;
          } catch (_) { /* undecodable → fallback */ }
        }
      }
      done++;
      if (onProgress) onProgress(done / ids.length);
    }
    return { ready, total: ids.length };
  }

  // Best-known duration: decoded buffer > manifest > text estimate.
  duration(cid) {
    const buf = this.buffers.get(cid);
    if (buf) return buf.duration;
    const e = this.entryFor(cid);
    if (e && e.duration) return e.duration;
    const clip = getClip(cid);
    if (!clip) return 0;
    return clip.kind === "voice" ? estimateSpeechSeconds(clip.text) : clip.seconds;
  }

  async resume() { this.ensureContext(); if (this.ctx.state !== "running") await this.ctx.resume(); if (this.music) this.music.resume(); }
  async suspend() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (this.music) this.music.pause();
    if (this.ctx && this.ctx.state === "running") await this.ctx.suspend();
  }

  // Resolve after `sec` seconds of AUDIO time (so it freezes while suspended),
  // or as soon as `isLive()` turns false.
  wait(sec, isLive = () => true) {
    const ctx = this.ensureContext();
    const end = ctx.currentTime + sec;
    return new Promise((resolve) => {
      const tick = () => {
        if (!isLive() || ctx.currentTime >= end - 0.005) return resolve();
        setTimeout(tick, 40);
      };
      tick();
    });
  }

  // ───────── playback ─────────
  track(nodes, stopFn) {
    const rec = { nodes, stop: stopFn };
    this.sources.add(rec);
    return rec;
  }
  stopAll() {
    for (const rec of [...this.sources]) { try { rec.stop(); } catch (_) {} }
    this.sources.clear();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  playBuffer(cid, busName, maxSeconds) {
    const buf = this.buffers.get(cid);
    if (!buf) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g).connect(this.bus[busName]);
    const t = ctx.currentTime;
    if (maxSeconds && buf.duration > maxSeconds) {
      // Fit a ringing chime into its breath window with a short fade instead of a click.
      const fade = Math.min(0.4, maxSeconds / 4);
      g.gain.setValueAtTime(1, t + maxSeconds - fade);
      g.gain.linearRampToValueAtTime(0.0001, t + maxSeconds);
      src.stop(t + maxSeconds + 0.02);
    }
    src.start(t);
    let rec;
    const ended = new Promise((resolve) => {
      src.onended = () => { this.sources.delete(rec); resolve(); };
    });
    rec = this.track([src, g], () => src.stop());
    return ended;
  }

  // Returns { ended: Promise, tts: boolean }.
  voice(cid) {
    const clip = getClip(cid);
    this.duck(+1);
    const unduck = () => this.duck(-1);
    const ended = this.playBuffer(cid, "voice");
    if (ended) return { ended: ended.then(unduck), tts: false };
    return { ended: this.speak(clip ? clip.text : "").then(unduck), tts: true };
  }
  duck(delta) {
    this.voicesActive = Math.max(0, this.voicesActive + delta);
    if (!this.ctx) return;
    const target = this.voicesActive > 0 ? DUCK_LEVEL : 1;
    this.duckNode.gain.setTargetAtTime(target, this.ctx.currentTime, this.voicesActive > 0 ? 0.12 : 0.6);
  }

  // Fallback bells are pitched at G4 and up: phone and laptop speakers barely
  // reproduce anything below ~300 Hz, so a "deep" synthesized bowl is inaudible.
  sfx(cid, maxSeconds) {
    if (this.playBuffer(cid, "sfx", maxSeconds)) return;
    const t = this.ctx.currentTime;
    if (cid === "sfx.bell.start") this.synthBell(t, 392, 6, 0.7);
    else if (cid === "sfx.chime") this.synthBell(t, 1318.5, 1.8, 0.45);
    else if (cid === "sfx.bell.end") [0, 1.8, 3.6].forEach((d) => this.synthBell(t + d, 392, 5, 0.6));
  }

  // A chime as each inhale (higher, brighter) and exhale (lower, warmer) begins.
  // It rings into the phase and is faded out before the next one starts.
  breath(dir, seconds) {
    const cid = dir === "in" ? clipIds.inhale : clipIds.exhale;
    if (this.buffers.has(cid)) { this.playBuffer(cid, "sfx", seconds); return; }
    const decay = Math.min(2.4, seconds);
    if (dir === "in") this.synthBell(this.ctx.currentTime, 659.25, decay, 0.4); // E5
    else this.synthBell(this.ctx.currentTime, 440, decay, 0.4);                // A4
  }

  // ───────── device-voice fallback ─────────
  speak(text) {
    return new Promise((resolve) => {
      if (!text || !("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.volume = Math.min(1, this.vol.voice);
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => /en[-_](GB|US)/i.test(x.lang) && /female|samantha|serena|google uk/i.test(x.name))
        || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      let settled = false;
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
      u.onend = finish;
      u.onerror = finish;
      // Some engines never fire onend; don't let a session hang on it.
      const timer = setTimeout(finish, (estimateSpeechSeconds(text) * 1.8 + 3) * 1000);
      speechSynthesis.speak(u);
    });
  }

  // ───────── synthesized fallbacks ─────────
  synthBell(t, freq, decay, level) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.bus.sfx);
    const partials = [[1, 1], [2.71, 0.45], [5.15, 0.18]];
    const nodes = [out];
    for (const [ratio, amp] of partials) {
      for (const detune of [0, 1.3]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq * ratio + detune;
        const g = ctx.createGain();
        const d = decay / (1 + (ratio - 1) * 0.35);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp * 0.5, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
        nodes.push(o, g);
      }
    }
    const rec = this.track(nodes, () => nodes.forEach((n) => n.stop && n.stop()));
    setTimeout(() => this.sources.delete(rec), (t - ctx.currentTime + decay + 0.2) * 1000);
  }

  // ───────── music ─────────
  startMusic(trackId) {
    this.stopMusic(0);
    if (!trackId || trackId === "off") return;
    this.ensureContext();
    const url = this.musicUrls.get(trackId);
    this.music = url ? new LoopingTrack(this, url) : new SynthPad(this, trackId);
    this.music.start();
  }
  stopMusic(fade = 2) {
    if (!this.music) return;
    this.music.stop(fade);
    this.music = null;
  }
}

// Plays an mp3 on repeat with a crossfade at the seam (ambient tracks from the
// generator aren't seamless loops). Two <audio> elements → Web Audio gains.
class LoopingTrack {
  constructor(engine, url) {
    this.engine = engine;
    const ctx = engine.ctx;
    this.players = [0, 1].map(() => {
      const el = new Audio(url);
      el.preload = "auto";
      const g = ctx.createGain();
      g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(g).connect(engine.bus.music);
      return { el, g };
    });
    this.active = 0;
    this.timer = null;
  }
  fadeTo(p, v, secs) {
    const t = this.engine.ctx.currentTime;
    p.g.gain.cancelScheduledValues(t);
    p.g.gain.setValueAtTime(p.g.gain.value, t);
    p.g.gain.linearRampToValueAtTime(v, t + secs);
  }
  start() {
    const p = this.players[this.active];
    p.el.currentTime = 0;
    p.el.play().catch(() => {});
    this.fadeTo(p, 1, 4);
    this.timer = setInterval(() => this.check(), 250);
  }
  check() {
    const cur = this.players[this.active];
    const d = cur.el.duration;
    if (!d || cur.el.paused || cur.el.currentTime < d - MUSIC_XFADE) return;
    const nextIdx = 1 - this.active;
    const next = this.players[nextIdx];
    next.el.currentTime = 0;
    next.el.play().catch(() => {});
    this.fadeTo(next, 1, MUSIC_XFADE);
    this.fadeTo(cur, 0, MUSIC_XFADE);
    this.active = nextIdx;
  }
  pause() { this.players.forEach((p) => { if (!p.el.paused) { p.wasPlaying = true; p.el.pause(); } else p.wasPlaying = false; }); }
  resume() { this.players.forEach((p) => { if (p.wasPlaying) p.el.play().catch(() => {}); }); }
  stop(fade) {
    clearInterval(this.timer);
    this.players.forEach((p) => this.fadeTo(p, 0, Math.max(0.05, fade)));
    setTimeout(() => this.players.forEach((p) => { p.el.pause(); p.el.removeAttribute("src"); }), (fade + 0.2) * 1000);
  }
}

// Fallback ambience: a slow, filtered chord with a gently breathing filter.
const PAD_CHORDS = {
  "music.forest": [110, 164.81, 220, 261.63, 329.63],
  "music.meadow": [130.81, 196, 261.63, 293.66, 392],
};
class SynthPad {
  constructor(engine, trackId) {
    this.engine = engine;
    this.freqs = PAD_CHORDS[trackId] || PAD_CHORDS["music.forest"];
    this.nodes = [];
  }
  start() {
    const ctx = this.engine.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35, t + 5);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.Q.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(lp.frequency);
    lp.connect(out).connect(this.engine.bus.music);
    this.freqs.forEach((f, i) => {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.06 / (1 + i * 0.4);
        o.connect(g).connect(lp);
        o.start(t);
        this.nodes.push(o);
      }
    });
    lfo.start(t);
    this.nodes.push(lfo);
    this.out = out;
  }
  pause() {}   // ctx.suspend() freezes it
  resume() {}
  stop(fade) {
    const ctx = this.engine.ctx;
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
    this.nodes.forEach((n) => { try { n.stop(t + fade + 0.1); } catch (_) {} });
  }
}
