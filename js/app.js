// Clearing — guided yoga sessions. Vanilla ES modules, no framework, no bundler.
// Persistence: one localStorage key (STORAGE_KEY). Audio: see audio.js.

import { POSES, PHASES, FAMILIES, LEVELS, POSITIONS, poseById } from "./library.js";
import { MUSIC_TRACKS, INHALE_RANGE, EXHALE_RANGE, getClip, id as clipId } from "./phrases.js";
import {
  LENGTH_OPTIONS, generateSession, newSeed, estimateSeconds, buildActions, actionSeconds, clipsFor, phasesOf,
} from "./session.js";
import { AudioEngine } from "./audio.js";
import { Player } from "./player.js";
import { ICONS } from "./icons.js";

const STORAGE_KEY = "clearing.state.v1";
const $ = (id) => document.getElementById(id);

// ───────── DOM helpers ─────────
// Text always goes through textContent; only the static, generated icon
// markup from icons.js is ever assigned as HTML.
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
function icon(name, extraClass = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `icon ${extraClass}`.trim());
  svg.innerHTML = ICONS[name] || "";
  return svg;
}
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((span) => {
    span.replaceWith(icon(span.dataset.icon, span.className));
  });
}
function setIcon(button, name) {
  const old = button.querySelector("svg.icon");
  const next = icon(name);
  if (old) old.replaceWith(next); else button.prepend(next);
}

const screens = {
  home: $("homeScreen"),
  preview: $("previewScreen"),
  player: $("playerScreen"),
  done: $("doneScreen"),
  library: $("libraryScreen"),
};
function show(name) {
  for (const s of Object.values(screens)) s.classList.remove("active");
  screens[name].classList.add("active");
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

// ───────── formatting ─────────
const fmtClock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtMin = (sec) => `${Math.max(1, Math.round(sec / 60))} min`;
const fmtMB = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function holdLabel(item, pose) {
  if (pose.hold === "time") return { main: fmtClock(item.seconds), sub: "rest" };
  return { main: plural(item.breaths, "breath"), sub: pose.sided ? "each side" : "" };
}

// ───────── state ─────────
const DEFAULT_SETTINGS = {
  minutes: 20, level: "beginner",
  inhale: 4, exhale: 5,
  music: "music.forest",
  volVoice: 1, volMusic: 0.5, volSfx: 0.6,
  theme: "auto",
  showGuide: false,
  readGuide: true,
};
const clampNum = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);

function validateState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const st = s.settings || {};
  const settings = {
    minutes: LENGTH_OPTIONS.includes(st.minutes) ? st.minutes : DEFAULT_SETTINGS.minutes,
    level: st.level === "intermediate" ? "intermediate" : "beginner",
    inhale: Math.round(clampNum(st.inhale, ...INHALE_RANGE, DEFAULT_SETTINGS.inhale)),
    exhale: Math.round(clampNum(st.exhale, ...EXHALE_RANGE, DEFAULT_SETTINGS.exhale)),
    music: st.music === "off" || MUSIC_TRACKS.some((t) => t.id === st.music) ? st.music : DEFAULT_SETTINGS.music,
    volVoice: clampNum(st.volVoice, 0, 1, DEFAULT_SETTINGS.volVoice),
    volMusic: clampNum(st.volMusic, 0, 1, DEFAULT_SETTINGS.volMusic),
    volSfx: clampNum(st.volSfx, 0, 1, DEFAULT_SETTINGS.volSfx),
    theme: ["auto", "forest", "meadow"].includes(st.theme) ? st.theme : "auto",
    showGuide: !!st.showGuide,
    readGuide: st.readGuide !== false,
  };
  let session = s.session;
  const okItem = (it) => it && poseById(it.poseId) && (Number.isFinite(it.breaths) || Number.isFinite(it.seconds));
  if (!session || !Array.isArray(session.items) || !session.items.length || !session.items.every(okItem)) session = null;
  const history = Array.isArray(s.history) ? s.history.filter((h) => h && h.dateISO).slice(-200) : [];
  return { version: 1, settings, session, history };
}
function loadState() {
  try { return validateState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (_) { return validateState(null); }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}
let state = loadState();
// Everything that shapes a session's timing. Generating, estimating and
// playing must all use the same cfg or lengths drift.
const timingCfg = () => ({ inhale: state.settings.inhale, exhale: state.settings.exhale, readGuide: state.settings.readGuide });

// Timing settings changed: rebuild the current session (same seed, so the same
// mix where possible) so it still fits the length the user asked for.
function refitSession() {
  if (!state.session) return;
  const { minutes, level, seed } = state.session;
  state.session = generateSession({ minutes, level, seed }, timingCfg(), durOf);
  saveState();
  if (document.body.dataset.screen === "preview") { renderPreview(); prepareAudio(); }
}

// ───────── audio pack lifecycle ─────────
const engine = new AudioEngine();
const durOf = (cid) => engine.duration(cid);
let audio = { state: "checking", pct: 0, error: "" };
let audioReady = Promise.resolve();

function setAudio(next) {
  audio = { ...audio, ...next };
  renderAudioStatus();
  renderPackInfo();
  if (document.body.dataset.screen === "preview") renderPrepChip();
}

async function initAudio() {
  setAudio({ state: "checking" });
  await engine.loadManifest();
  if (!engine.manifest) return setAudio({ state: "none" });
  if (await engine.isPackCached()) return setAudio({ state: "ready" });
  if (!navigator.onLine) return setAudio({ state: "missing" });
  return downloadPack();
}
async function downloadPack() {
  setAudio({ state: "downloading", pct: 0 });
  try {
    await engine.downloadPack((pct) => setAudio({ state: "downloading", pct }));
    setAudio({ state: "ready" });
  } catch (e) {
    setAudio({ state: "error", error: e.message || "Download failed" });
  }
}

function renderAudioStatus() {
  const box = $("audioStatus");
  box.replaceChildren();
  box.className = "status-card";
  box.hidden = audio.state === "checking";
  const row = (iconName, title, sub, extra) => {
    box.append(icon(iconName), el("div", { class: "grow" }, [title, sub ? el("small", { text: sub }) : null, extra || null]));
  };
  switch (audio.state) {
    case "none":
      box.classList.add("warn");
      row("record_voice_over", "Using your device's voice", "No audio pack has been built yet, so guidance uses built-in speech and simple tones.");
      break;
    case "downloading": {
      const bar = el("div", { class: "bar" }, el("i", { style: `width:${Math.round(audio.pct * 100)}%` }));
      row("cloud_download", `Downloading audio pack ${Math.round(audio.pct * 100)}%`, fmtMB(engine.packBytes()), bar);
      break;
    }
    case "ready":
      row("check_circle", "Audio pack ready", `${fmtMB(engine.packBytes())}, works offline`);
      break;
    case "missing":
    case "error": {
      box.classList.add("warn");
      const btn = el("button", { class: "ghost", type: "button", text: "Download", onclick: () => { audioReady = downloadPack(); } });
      box.append(icon(audio.state === "missing" ? "cloud_off" : "error_outline"),
        el("div", { class: "grow" }, [
          audio.state === "missing" ? "Audio pack not downloaded" : "Audio download failed",
          el("small", { text: audio.state === "missing" ? "Connect to download it. Until then your device's voice is used." : audio.error }),
        ]), btn);
      break;
    }
  }
}

function renderPackInfo() {
  const info = $("packInfo");
  const btn = $("packBtn");
  const m = engine.manifest;
  btn.disabled = audio.state === "downloading" || audio.state === "checking";
  if (!m) {
    info.textContent = "No audio pack is published with this build. Voice uses your device's speech, and bells, breath chimes and music are synthesized.";
    btn.textContent = "Check again";
    return;
  }
  const when = m.generatedAt ? new Date(m.generatedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "unknown date";
  const n = Object.keys(m.clips).length;
  const tail = audio.state === "ready" ? "Downloaded to this device." : audio.state === "downloading" ? `Downloading ${Math.round(audio.pct * 100)}%…` : "Not downloaded yet.";
  info.textContent = `${n} clips, ${fmtMB(m.pack.bytes)}, built ${when}. ${tail}`;
  btn.textContent = audio.state === "ready" ? "Check for updates" : "Download now";
}

// ───────── home ─────────
function renderHome() {
  const chips = $("lengthChips");
  chips.replaceChildren(...LENGTH_OPTIONS.map((m) => el("button", {
    class: `chip${m === state.settings.minutes ? " active" : ""}`,
    type: "button", role: "radio", "aria-checked": String(m === state.settings.minutes),
    onclick: () => { state.settings.minutes = m; saveState(); renderHome(); },
  }, [String(m), el("small", { text: " min" })])));

  document.querySelectorAll("#levelSeg .seg-btn").forEach((b) => {
    const on = b.dataset.level === state.settings.level;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });

  const s = state.session;
  $("lastSessionCard").hidden = !s;
  if (s) {
    const poses = s.items.length;
    $("lastSessionSub").textContent = `${s.minutes} min · ${plural(poses, "posture")} · ${LEVELS[s.level === "intermediate" ? 2 : 1]}`;
  }

  const last = state.history[state.history.length - 1];
  $("lastPractice").hidden = !last;
  if (last) {
    const d = new Date(last.dateISO).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    $("lastPractice").textContent = `Last practice: ${d}, ${fmtMin(last.practicedSec)}${last.completed ? "" : " (ended early)"}`;
  }
  renderAudioStatus();
}

function buildSession() {
  const { minutes, level } = state.settings;
  state.session = generateSession({ minutes, level, seed: newSeed() }, timingCfg(), durOf);
  saveState();
}

// ───────── preview ─────────
let prep = { state: "idle", pct: 0, ready: 0, total: 0 };
let prepPromise = Promise.resolve();
let prepToken = 0;

function openPreview() {
  renderPreview();
  show("preview");
  prepareAudio();
}

function stepSecondsOf(session) {
  const out = new Array(session.items.length).fill(0);
  const breath = timingCfg();
  for (const a of buildActions(session, breath)) out[a.step] += actionSeconds(a, breath, durOf);
  return out;
}

function renderPreview() {
  const s = state.session;
  const stepSecs = stepSecondsOf(s);
  const total = stepSecs.reduce((a, b) => a + b, 0);
  $("previewTitle").textContent = `${s.minutes}-minute session`;
  $("previewMeta").textContent = `About ${fmtMin(total)} · ${plural(s.items.length, "posture")} · ${LEVELS[s.level === "intermediate" ? 2 : 1]}`;
  $("guidanceToggle").checked = state.settings.showGuide;

  const list = $("previewList");
  list.replaceChildren();
  for (const group of phasesOf(s)) {
    const secs = group.items.reduce((sum, it) => sum + stepSecs[it.index], 0);
    const ul = el("ul", { class: "step-list" });
    for (const it of group.items) ul.append(stepCard(it, poseById(it.poseId)));
    list.append(el("section", {}, [
      el("h2", { class: "phase-head" }, [el("span", { text: group.label }), el("span", { text: fmtMin(secs) })]),
      ul,
    ]));
  }
  renderPrepChip();
}

function stepCard(item, pose) {
  const hold = holdLabel(item, pose);
  const card = el("li", { class: `step-card${state.settings.showGuide ? " open" : ""}` });
  const row = el("button", {
    class: "step-row", type: "button", "aria-expanded": String(state.settings.showGuide),
    onclick: () => {
      const open = card.classList.toggle("open");
      row.setAttribute("aria-expanded", String(open));
    },
  }, [
    el("span", { class: "step-num", text: String(item.index + 1) }),
    el("span", { class: "step-names" }, [
      el("span", { class: "step-en", text: pose.english }),
      pose.sanskrit ? el("span", { class: "step-sa", text: pose.sanskrit }) : null,
    ]),
    el("span", { class: "step-hold" }, [el("b", { text: hold.main }), hold.sub]),
    icon("expand_more", "chev"),
  ]);
  const body = el("div", { class: "step-body" }, [
    el("p", { class: "guide-quote", text: pose.guide }),
    el("p", { class: "mods", text: pose.mods }),
  ]);
  card.append(row, body);
  return card;
}

function renderPrepChip() {
  const chip = $("prepChip");
  chip.replaceChildren();
  chip.className = "chip-status";
  let iconName = "check_circle", text = "Audio ready";
  if (audio.state === "none" || audio.state === "missing" || audio.state === "error") {
    chip.classList.add("warn");
    iconName = "record_voice_over";
    text = "Device voice";
  } else if (audio.state === "downloading") {
    iconName = "cloud_download";
    text = `Downloading audio ${Math.round(audio.pct * 100)}%`;
  } else if (prep.state === "preparing" || audio.state === "checking") {
    iconName = "graphic_eq";
    text = `Preparing audio ${Math.round(prep.pct * 100)}%`;
  } else if (prep.state === "ready" && prep.ready < prep.total) {
    chip.classList.add("warn");
    iconName = "graphic_eq";
    text = `Audio ${prep.ready}/${prep.total}, rest uses device voice`;
  }
  chip.append(icon(iconName), text);
}

function prepareAudio() {
  const token = ++prepToken;
  const s = state.session;
  const ids = clipsFor(s, timingCfg());
  if (state.settings.music !== "off") ids.push(state.settings.music);
  prep = { state: "preparing", pct: 0, ready: 0, total: ids.length };
  renderPrepChip();
  prepPromise = (async () => {
    await audioReady;
    const r = await engine.prepare(ids, (pct) => {
      if (token !== prepToken) return;
      prep.pct = pct;
      renderPrepChip();
    });
    if (token !== prepToken) return;
    prep = { state: "ready", pct: 1, ready: r.ready, total: r.total };
    // Real clip lengths may differ from estimates; refresh the numbers.
    if (document.body.dataset.screen === "preview") renderPreview();
  })().catch(() => { prep = { state: "ready", pct: 1, ready: 0, total: ids.length }; renderPrepChip(); });
  return prepPromise;
}

// ───────── player ─────────
let player = null;
let rafId = 0;
let discScale = 0.62;
let reloadWhenIdle = false;

async function startSession() {
  const btn = $("startBtn");
  btn.disabled = true;
  // Unlock audio inside the tap: AudioContext + speech synthesis.
  engine.ensureContext();
  engine.ctx.resume();
  if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  await prepPromise;
  btn.disabled = false;

  engine.setVolumes({ voice: state.settings.volVoice, sfx: state.settings.volSfx, music: state.settings.volMusic });
  const { music } = state.settings;
  player = new Player(engine, state.session, { ...timingCfg(), music }, {
    onChange: renderPlayer,
    onFinish: () => finishSession(true),
  });
  show("player");
  requestWakeLock();
  renderPlayer();
  player.start();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function stageWord(p) {
  switch (p.stage) {
    case "intro": return "Arrive";
    case "enter": return "Move in";
    case "switch": return "Switch";
    case "release": return "Release";
    case "rest": return "Rest";
    case "outro": return "Return";
    default: return "";
  }
}

function renderPlayer() {
  const p = player;
  if (!p) return;
  const items = p.session.items;
  const item = p.item;
  const pose = poseById(item.poseId);
  const phase = PHASES.find((x) => x.id === item.phase);
  $("playerPhase").textContent = p.stage === "outro" ? "Closing" : phase ? phase.label : "";
  $("playerCount").textContent = `${p.step + 1} of ${items.length}`;
  $("poseEnglish").textContent = pose.english;
  $("poseSanskrit").textContent = pose.sanskrit || "";

  const showSide = pose.sided && (p.stage === "hold" || p.stage === "switch");
  $("sidePill").hidden = !showSide;
  if (showSide) $("sidePill").textContent = p.side === 1 ? "First side" : "Other side";

  $("caption").textContent = p.caption;
  $("guideText").textContent = pose.guide;
  $("guideMods").textContent = pose.mods;

  const next = items[p.step + 1];
  $("nextUp").textContent = p.stage === "outro" ? "" : next ? `Next: ${poseById(next.poseId).english}` : "Next: closing";

  const pp = $("playPauseBtn");
  setIcon(pp, p.paused ? "play_arrow" : "pause");
  pp.setAttribute("aria-label", p.paused ? "Resume" : "Pause");
  $("pauseOverlay").hidden = !p.paused;
}

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
function frame() {
  const p = player;
  if (!p || p.finished) return;
  const now = engine.now();
  const bs = p.breathState;
  const LOW = 0.62, HIGH = 1;
  let word, count = "";
  if (bs) {
    const t = (now - bs.t0) / bs.dur;
    discScale = bs.phase === "in" ? LOW + (HIGH - LOW) * ease(t) : HIGH - (HIGH - LOW) * ease(t);
    word = bs.phase === "in" ? "Breathe in" : "Breathe out";
    count = `${bs.n} of ${bs.of}`;
  } else {
    const target = p.stage === "rest" ? 0.7 + 0.03 * Math.sin(now * 0.6) : LOW;
    discScale += (target - discScale) * 0.06;
    word = stageWord(p);
    if (p.stage === "rest") count = fmtClock(p.durs[p.i] - (now - p.actionT0));
  }
  $("breathDisc").style.transform = `scale(${discScale.toFixed(4)})`;
  $("breathHalo").style.transform = `scale(${(discScale * 1.02).toFixed(4)})`;
  $("breathHalo").style.opacity = String(0.4 + 0.6 * ((discScale - LOW) / (HIGH - LOW)));
  if ($("breathWord").textContent !== word) $("breathWord").textContent = word;
  if ($("breathCount").textContent !== count) $("breathCount").textContent = count;

  $("playerTime").textContent = fmtClock(p.remaining());
  $("progressFill").style.width = `${(100 * p.elapsed() / p.total).toFixed(2)}%`;
  rafId = requestAnimationFrame(frame);
}

function finishSession(completed) {
  const p = player;
  if (!p) return;
  const practiced = p.elapsed();
  if (!p.finished) p.stop();
  player = null;
  cancelAnimationFrame(rafId);
  releaseWakeLock();
  $("pauseOverlay").hidden = true;
  if (practiced >= 60) {
    state.history.push({ dateISO: new Date().toISOString(), minutes: state.session.minutes, practicedSec: Math.round(practiced), completed });
    state.history = state.history.slice(-200);
    saveState();
  }
  $("doneText").textContent = completed
    ? `You practiced for ${fmtMin(practiced)}. Take a moment before you get up.`
    : `You practiced for ${fmtMin(practiced)}. Every bit counts.`;
  show("done");
}

function goHome() {
  if (reloadWhenIdle) { location.reload(); return; }
  renderHome();
  show("home");
}

// ───────── wake lock ─────────
let wakeLock = null;
async function requestWakeLock() {
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (_) {}
}
function releaseWakeLock() {
  try { if (wakeLock) wakeLock.release(); } catch (_) {}
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && player && !player.finished) requestWakeLock();
});

// ───────── library ─────────
let libFamily = "all";
let libQuery = "";
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function renderLibrary() {
  const fams = ["all", ...Object.keys(FAMILIES).filter((f) => POSES.some((p) => p.family === f))];
  $("familyChips").replaceChildren(...fams.map((f) => el("button", {
    class: `chip${f === libFamily ? " active" : ""}`, type: "button",
    text: f === "all" ? "All" : FAMILIES[f],
    onclick: () => { libFamily = f; renderLibrary(); },
  })));
  const q = norm(libQuery.trim());
  const poses = POSES
    .filter((p) => libFamily === "all" || p.family === libFamily)
    .filter((p) => !q || norm(p.english).includes(q) || norm(p.sanskrit).includes(q))
    .sort((a, b) => a.english.localeCompare(b.english));
  $("libraryList").replaceChildren(...poses.map((p) => el("li", {}, el("button", {
    class: "pose-card", type: "button", onclick: () => openPose(p.id),
  }, [
    el("span", { class: "step-en", text: p.english }),
    p.sanskrit ? el("span", { class: "step-sa", text: p.sanskrit }) : null,
    el("span", { class: "pose-meta", text: [FAMILIES[p.family], LEVELS[p.level], p.sided ? "Each side" : null].filter(Boolean).join(" · ") }),
  ]))));
  $("libraryEmpty").hidden = poses.length > 0;
}

function openPose(poseId) {
  const p = poseById(poseId);
  $("poseTitle").textContent = p.english;
  $("poseSubtitle").textContent = p.sanskrit || "";
  const tags = [
    [FAMILIES[p.family]],
    [LEVELS[p.level], p.level === 2 ? "level-2" : ""],
    [`Starts: ${POSITIONS[p.base].label}`],
    p.sided ? ["Each side"] : null,
    [p.hold === "time" ? "Timed rest" : `${p.breaths} breaths by default`],
  ].filter(Boolean);
  $("poseTags").replaceChildren(...tags.map(([t, c]) => el("span", { class: `tag ${c || ""}`.trim(), text: t })));
  $("poseGuide").textContent = p.guide;
  $("poseMods").textContent = p.mods;
  openModal($("poseModal"));
}

// ───────── settings ─────────
function applyTheme() {
  const theme = state.settings.theme;
  document.documentElement.dataset.theme = theme;
  const dark = theme === "forest" || (theme === "auto" && !matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#101a14" : "#f2f5ec");
}

function renderSettings() {
  const s = state.settings;
  $("inhaleVal").textContent = `${s.inhale} s`;
  $("exhaleVal").textContent = `${s.exhale} s`;
  const musicOpts = [...MUSIC_TRACKS.map((t) => ({ id: t.id, label: t.label })), { id: "off", label: "Off" }];
  $("musicSeg").replaceChildren(...musicOpts.map((o) => el("button", {
    class: `seg-btn${s.music === o.id ? " active" : ""}`, type: "button", text: o.label,
    onclick: () => { s.music = o.id; saveState(); renderSettings(); if (document.body.dataset.screen === "preview") prepareAudio(); },
  })));
  $("readGuideToggle").checked = s.readGuide;
  $("volVoice").value = s.volVoice;
  $("volMusic").value = s.volMusic;
  $("volSfx").value = s.volSfx;
  document.querySelectorAll("#themeSeg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.themeOpt === s.theme));
  renderPackInfo();
}

function stepBreath(which, delta) {
  const [lo, hi] = which === "inhale" ? INHALE_RANGE : EXHALE_RANGE;
  state.settings[which] = Math.max(lo, Math.min(hi, state.settings[which] + delta));
  saveState();
  renderSettings();
  refitSession();
}

function openModal(m) { m.hidden = false; }
function closeModal(m) { m.hidden = true; }

// ───────── wiring ─────────
function wire() {
  hydrateIcons();

  $("libraryBtn").addEventListener("click", () => { renderLibrary(); show("library"); });
  $("settingsBtn").addEventListener("click", () => { renderSettings(); openModal($("settingsModal")); });
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => goHome()));

  // Home
  document.querySelectorAll("#levelSeg .seg-btn").forEach((b) => b.addEventListener("click", () => {
    state.settings.level = b.dataset.level;
    saveState();
    renderHome();
  }));
  $("buildBtn").addEventListener("click", () => { buildSession(); openPreview(); });
  $("lastSessionCard").addEventListener("click", () => openPreview());

  // Preview
  $("guidanceToggle").addEventListener("change", (e) => {
    state.settings.showGuide = e.target.checked;
    saveState();
    renderPreview();
  });
  $("regenBtn").addEventListener("click", () => {
    const { level } = state.session;
    state.session = generateSession({ minutes: state.session.minutes, level, seed: newSeed() }, timingCfg(), durOf);
    saveState();
    renderPreview();
    prepareAudio();
    toast("New mix ready");
  });
  $("startBtn").addEventListener("click", startSession);

  // Player
  $("playPauseBtn").addEventListener("click", () => { if (!player) return; player.paused ? player.resume() : player.pause(); });
  $("resumeBtn").addEventListener("click", () => player && player.resume());
  $("endBtn").addEventListener("click", () => player && player.pause());
  $("quitBtn").addEventListener("click", () => finishSession(false));
  $("nextBtn").addEventListener("click", () => player && player.next());
  $("prevBtn").addEventListener("click", () => player && player.prev());
  document.addEventListener("keydown", (e) => {
    if (document.body.dataset.screen !== "player" || !player) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); player.paused ? player.resume() : player.pause(); }
    else if (e.key === "ArrowRight") player.next();
    else if (e.key === "ArrowLeft") player.prev();
    else if (e.key === "Escape") player.pause();
  });

  // Done
  $("againBtn").addEventListener("click", () => { openPreview(); });
  $("homeBtn").addEventListener("click", goHome);

  // Library
  $("librarySearch").addEventListener("input", (e) => { libQuery = e.target.value; renderLibrary(); });

  // Settings
  for (const which of ["inhale", "exhale"]) {
    $(`${which}Stepper`).querySelectorAll(".step-btn").forEach((b) =>
      b.addEventListener("click", () => stepBreath(which, +b.dataset.step)));
  }
  for (const [inputId, key, bus] of [["volVoice", "volVoice", "voice"], ["volMusic", "volMusic", "music"], ["volSfx", "volSfx", "sfx"]]) {
    $(inputId).addEventListener("input", (e) => {
      state.settings[key] = +e.target.value;
      engine.setVolumes({ [bus]: +e.target.value });
      saveState();
    });
  }
  $("readGuideToggle").addEventListener("change", (e) => {
    state.settings.readGuide = e.target.checked;
    saveState();
    refitSession();
  });
  document.querySelectorAll("#themeSeg .seg-btn").forEach((b) => b.addEventListener("click", () => {
    state.settings.theme = b.dataset.themeOpt;
    saveState();
    applyTheme();
    renderSettings();
  }));
  $("packBtn").addEventListener("click", async () => {
    const before = engine.manifest && engine.manifest.pack.file;
    audioReady = initAudio();
    await audioReady;
    const after = engine.manifest && engine.manifest.pack.file;
    toast(!after ? "No audio pack published" : before === after ? "Audio pack is up to date" : "Audio pack updated");
  });

  // Sheets: close buttons + backdrop
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); });
    m.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal(m)));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal:not([hidden])").forEach(closeModal);
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
}

// ───────── service worker ─────────
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;            // first install, nothing stale
    if (player) reloadWhenIdle = true;     // never reload mid-practice
    else location.reload();
  });
}

// ───────── boot ─────────
applyTheme();
wire();
renderHome();
show("home");
registerSW();
audioReady = initAudio();

// Exposed for debugging in DevTools.
window.clearing = { state: () => state, engine, getClip, clipId, estimateSeconds };
