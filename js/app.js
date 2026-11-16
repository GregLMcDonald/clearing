// Clearing — guided yoga sessions. Vanilla ES modules, no framework, no bundler.
// Persistence: one localStorage key (STORAGE_KEY). Audio: see audio.js.

import { POSES, FLOWS, FAMILIES, poseById, isFlow, flowMoves } from "./library.js";
import { MUSIC_TRACKS, INHALE_RANGE, EXHALE_RANGE, getClip, id as clipId } from "./phrases.js";
import {
  LENGTH_OPTIONS, generateSession, newSeed, estimateSeconds, buildActions, actionSeconds, clipsFor, phasesOf,
  FOCUS_OPTIONS, focusMatch, canRemove, removeItem, swapOptions, swapItem, adjustHold, holdOf,
} from "./session.js";
import { History, streaks, totals, weekGrid, dayKey } from "./history.js";
import { BACKUP_APP, downloadJSON, parseBackup, getClientId, setClientId, isDriveConfigured, loadGis, DriveSync } from "./backup.js";
import { AudioEngine } from "./audio.js";
import { Player } from "./player.js";
import { ICONS } from "./icons.js";
import { t, plural, getLang, setLang, locale, applyStatic } from "./i18n.js";
import { LANGS, LANG_NAMES, locPose, positionOf, phaseLabel, familyLabel, levelLabel, musicLabel, focusLabel } from "./content.js";

// A pose or flow in the current language.
const L = (p) => locPose(p, getLang());

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
  log: $("logScreen"),
};
function show(name) {
  for (const s of Object.values(screens)) s.classList.remove("active");
  screens[name].classList.add("active");
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}

// action: optional { label, run } shown as a button (e.g. Undo).
let toastTimer = null;
function toast(msg, action) {
  const box = $("toast");
  box.replaceChildren(msg);
  if (action) {
    box.append(el("button", { class: "toast-btn", type: "button", text: action.label,
      onclick: () => { box.hidden = true; clearTimeout(toastTimer); action.run(); } }));
  }
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, action ? 5000 : 2400);
}

// ───────── formatting ─────────
const fmtClock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtMin = (sec) => `${Math.max(1, Math.round(sec / 60))} min`;
function fmtTotal(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}
const fmtMB = (bytes) => `${(bytes / 1048576).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0${t("unit.mb")}`;
function holdLabel(item, pose) {
  if (isFlow(pose)) return { main: plural(item.rounds, "round"), sub: pose.sided ? t("hold.eachSide") : "" };
  if (pose.hold === "time") return { main: fmtClock(item.seconds), sub: t("hold.rest") };
  return { main: plural(item.breaths, "breath"), sub: pose.sided ? t("hold.eachSide") : "" };
}
const levelName = (level) => levelLabel(level === "intermediate" ? 2 : 1, getLang());

// ───────── state ─────────
const DEFAULT_SETTINGS = {
  minutes: 20, level: "beginner",
  inhale: 4, exhale: 5,
  music: "music.forest",
  volVoice: 1, volMusic: 0.5, volSfx: 0.6,
  theme: "auto",
  showGuide: false,
  readGuide: true,
  style: "steady",
  focus: "all",
  // First launch follows the device language.
  lang: (typeof navigator !== "undefined" && /^fr/i.test(navigator.language || "")) ? "fr" : "en",
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
    style: st.style === "flow" ? "flow" : "steady",
    focus: FOCUS_OPTIONS.includes(st.focus) ? st.focus : "all",
    lang: LANGS.includes(st.lang) ? st.lang : DEFAULT_SETTINGS.lang,
  };
  let session = s.session;
  const okItem = (it) => it && poseById(it.poseId) && (Number.isFinite(it.breaths) || Number.isFinite(it.seconds) || Number.isFinite(it.rounds));
  if (!session || !Array.isArray(session.items) || !session.items.length || !session.items.every(okItem)) session = null;
  if (session && !FOCUS_OPTIONS.includes(session.focus)) session = { ...session, focus: "all" };
  return { version: 1, settings, session, history: History.normalize(s.history) };
}
function loadState() {
  try { return validateState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (_) { return validateState(null); }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  drive?.schedule(); // debounced Drive backup; no-op unless connected
}
let state = loadState();
// Optional Drive backup. Declared before anything can call saveState().
const drive = new DriveSync({ payload: backupPayload, onChange: () => updateDriveUI() });
setLang(state.settings.lang);
// Everything that shapes a session's timing. Generating, estimating and
// playing must all use the same cfg or lengths drift.
const timingCfg = () => ({ inhale: state.settings.inhale, exhale: state.settings.exhale, readGuide: state.settings.readGuide });

// Timing settings changed: rebuild the current session (same seed, so the same
// mix where possible) so it still fits the length the user asked for. A
// session edited by hand is kept as is: its length simply changes.
function refitSession() {
  if (!state.session) return;
  if (!state.session.edited) {
    const { minutes, level, seed, style, focus } = state.session;
    state.session = generateSession({ minutes, level, seed, style, focus }, timingCfg(), durOf);
    saveState();
  }
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
    setAudio({ state: "error", error: e.message || t("audio.error") });
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
      row("record_voice_over", t("audio.device"), t("audio.deviceSub"));
      break;
    case "downloading": {
      const bar = el("div", { class: "bar" }, el("i", { style: `width:${Math.round(audio.pct * 100)}%` }));
      row("cloud_download", t("audio.downloading", { pct: Math.round(audio.pct * 100) }), fmtMB(engine.packBytes()), bar);
      break;
    }
    case "ready":
      row("check_circle", t("audio.ready"), t("audio.readySub", { mb: fmtMB(engine.packBytes()) }));
      break;
    case "missing":
    case "error": {
      box.classList.add("warn");
      const btn = el("button", { class: "ghost", type: "button", text: t("audio.download"), onclick: () => { audioReady = downloadPack(); } });
      box.append(icon(audio.state === "missing" ? "cloud_off" : "error_outline"),
        el("div", { class: "grow" }, [
          audio.state === "missing" ? t("audio.missing") : t("audio.error"),
          el("small", { text: audio.state === "missing" ? t("audio.missingSub") : audio.error }),
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
    info.textContent = t("pack.none");
    btn.textContent = t("pack.checkAgain");
    return;
  }
  const when = m.generatedAt ? new Date(m.generatedAt).toLocaleDateString(locale(), { dateStyle: "medium" }) : t("pack.unknownDate");
  const n = Object.keys(m.clips).length;
  const tail = audio.state === "ready" ? t("pack.isReady") : audio.state === "downloading" ? t("pack.isDownloading", { pct: Math.round(audio.pct * 100) }) : t("pack.notYet");
  info.textContent = `${t("pack.info", { n, mb: fmtMB(m.pack.bytes), when })} ${tail}`;
  btn.textContent = audio.state === "ready" ? t("pack.check") : t("pack.downloadNow");
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
  document.querySelectorAll("#styleSeg .seg-btn").forEach((b) => {
    const on = b.dataset.style === state.settings.style;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });
  $("styleHint").textContent = t(state.settings.style === "flow" ? "style.hint.flow" : "style.hint.steady");

  $("focusChips").replaceChildren(...FOCUS_OPTIONS.map((f) => el("button", {
    class: `chip${f === state.settings.focus ? " active" : ""}`,
    type: "button", role: "radio", "aria-checked": String(f === state.settings.focus),
    text: focusLabel(f, getLang()),
    onclick: () => { state.settings.focus = f; saveState(); renderHome(); },
  })));
  $("focusHint").textContent = t(`focus.hint.${state.settings.focus}`);

  const s = state.session;
  $("lastSessionCard").hidden = !s;
  if (s) $("lastSessionSub").textContent = sessionSummary(s, estimateSeconds(s, timingCfg(), durOf));

  const last = state.history[state.history.length - 1];
  $("logCard").hidden = !last;
  if (last) {
    $("logCardTitle").textContent = streakLine();
    const d = new Date(last.dateISO).toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric" });
    $("logCardSub").textContent = t("home.lastPractice", { date: d, dur: fmtMin(last.practicedSec) }) + (last.completed ? "" : t("home.endedEarly"));
  }
  renderAudioStatus();
}

function streakLine() {
  const { current } = streaks(state.history);
  const last = state.history[state.history.length - 1];
  if (!last) return t("streak.log");
  const today = dayKey(last.dateISO) === dayKey(new Date().toISOString());
  if (today) return current > 1 ? t("streak.todayN", { n: current }) : t("streak.today");
  if (current > 1) return t("streak.keep", { n: current });
  if (current === 1) return t("streak.yesterday");
  return t("streak.log");
}

function sessionSummary(s, seconds) {
  const flows = s.items.filter((it) => isFlow(poseById(it.poseId))).length;
  const poses = s.items.length - flows;
  return [t("summary.about", { dur: fmtMin(seconds) }), plural(poses, "posture"), flows ? plural(flows, "flow") : null,
    levelName(s.level), s.focus && s.focus !== "all" ? focusLabel(s.focus, getLang()) : null].filter(Boolean).join(" · ");
}

// Ordered list of a flow's moves: breath, shape, and the teaching line.
// `f` must already be localized (L(flow)).
function movesList(f, level) {
  const lvl = level === "intermediate" ? 2 : level;
  const breathLabel = (mv) => mv.breath === "in" ? t("moves.in") : mv.breath === "out" ? t("moves.out") : plural(mv.n, "breath");
  return el("ol", { class: "moves" }, [
    f.setup ? el("li", {}, [el("span", { class: "move-breath", text: t("moves.start") }), el("span", { class: "move-body" }, [
      el("span", { class: "move-show", text: f.setup.cue.replace(/\.$/, "") }), el("span", { class: "move-teach", text: f.setup.teach })])]) : null,
    ...flowMoves(f, lvl).map((mv) => el("li", {}, [
      el("span", { class: `move-breath ${mv.breath}`, text: breathLabel(mv) }),
      el("span", { class: "move-body" }, [el("span", { class: "move-show", text: mv.show }), el("span", { class: "move-teach", text: mv.teach })]),
    ])),
  ]);
}

function buildSession() {
  const { minutes, level, style, focus } = state.settings;
  state.session = generateSession({ minutes, level, style, focus, seed: newSeed() }, timingCfg(), durOf);
  openSteps.clear();
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
  $("previewTitle").textContent = t("preview.title", { n: s.minutes });
  $("previewMeta").textContent = sessionSummary(s, total) + (s.style === "flow" ? ` · ${t("style.flow")}` : "") +
    (s.edited ? ` · ${t("preview.edited")}` : "");
  $("guidanceToggle").checked = state.settings.showGuide;

  const list = $("previewList");
  list.replaceChildren();
  for (const group of phasesOf(s)) {
    const secs = group.items.reduce((sum, it) => sum + stepSecs[it.index], 0);
    const ul = el("ul", { class: "step-list" });
    for (const it of group.items) ul.append(stepCard(it, L(poseById(it.poseId))));
    list.append(el("section", {}, [
      el("h2", { class: "phase-head" }, [el("span", { text: phaseLabel(group.id, getLang()) }), el("span", { text: fmtMin(secs) })]),
      ul,
    ]));
  }
  renderPrepChip();
  if (flashId) {
    list.querySelector(".step-card.flash")?.scrollIntoView({ block: "center", behavior: "smooth" });
    flashId = null;
  }
}

// Cards the person opened, kept open across re-renders after an edit.
const openSteps = new Set();
let flashId = null;

function stepCard(item, pose) {
  const hold = holdLabel(item, pose);
  const isOpen = state.settings.showGuide || openSteps.has(item.poseId);
  const card = el("li", { class: `step-card${isOpen ? " open" : ""}${item.poseId === flashId ? " flash" : ""}` });
  const row = el("button", {
    class: "step-row", type: "button", "aria-expanded": String(isOpen),
    onclick: () => {
      const open = card.classList.toggle("open");
      row.setAttribute("aria-expanded", String(open));
      if (open) openSteps.add(item.poseId); else openSteps.delete(item.poseId);
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
    isFlow(pose) ? movesList(pose, state.session.level) : null,
    el("p", { class: "mods", text: pose.mods }),
  ]);
  card.append(row, editRow(item.index), body);
  return card;
}

// ───────── editing the proposed session ─────────
function editRow(index) {
  const s = state.session;
  const h = holdOf(s.items[index]);
  const val = h.key === "seconds" ? fmtClock(h.value) : plural(h.value, h.key === "rounds" ? "round" : "breath");
  const stepBtn = (dir, sign, label) => el("button", {
    class: "step-btn", type: "button", "aria-label": t(label), title: t(label), text: sign,
    disabled: dir < 0 ? h.value <= h.min : h.value >= h.max,
    onclick: () => applyEdit(adjustHold(state.session, index, dir)),
  });
  const name = L(poseById(s.items[index].poseId)).english;
  return el("div", { class: "edit-row" }, [
    el("div", { class: "stepper small" }, [stepBtn(-1, "−", "edit.less"), el("span", { class: "step-val", text: val }), stepBtn(1, "+", "edit.more")]),
    el("span", { class: "grow" }),
    swapOptions(s, index).length ? el("button", { class: "edit-btn", type: "button", onclick: () => openSwap(index) },
      [icon("swap_horiz"), t("edit.swap")]) : null,
    canRemove(s, index) ? el("button", {
      class: "edit-btn icon-only", type: "button", "aria-label": t("edit.remove"), title: t("edit.remove"),
      onclick: () => applyEdit(removeItem(state.session, index), t("edit.removed", { name })),
    }, [icon("delete_outline")]) : null,
  ]);
}

// Swap, remove and hold changes all come through here. With undoMsg, the
// toast offers to put the previous version back.
function applyEdit(next, undoMsg) {
  if (next === state.session) return;
  const prev = state.session;
  state.session = next;
  saveState();
  renderPreview();
  prepareAudio();
  if (undoMsg) toast(undoMsg, { label: t("edit.undo"), run: () => { state.session = prev; saveState(); renderPreview(); prepareAudio(); } });
}

function openSwap(index) {
  const s = state.session;
  const cur = L(poseById(s.items[index].poseId));
  const lang = getLang();
  $("swapSubtitle").textContent = t("swap.instead", { name: cur.english });
  const opts = swapOptions(s, index);
  // Postures that match the session's focus first; otherwise class order.
  const ranked = [...opts.filter((p) => focusMatch(p, s.focus)), ...opts.filter((p) => !focusMatch(p, s.focus))].map(L);
  $("swapList").replaceChildren(...ranked.map((p) => el("li", {}, el("button", {
    class: "pose-card", type: "button",
    onclick: () => {
      closeModal($("swapModal"));
      openSteps.delete(cur.id);
      openSteps.add(p.id);
      flashId = p.id;
      applyEdit(swapItem(state.session, index, p.id), t("edit.swapped", { name: p.english }));
    },
  }, [
    el("span", { class: "step-en", text: p.english }),
    p.sanskrit ? el("span", { class: "step-sa", text: p.sanskrit }) : null,
    el("span", { class: "pose-meta", text: [...new Set([familyLabel(p.family, lang), positionOf(p.base, lang).label]),
      p.sided ? t("library.eachSide") : null, focusMatch(p, s.focus) ? focusLabel(s.focus, lang) : null].filter(Boolean).join(" · ") }),
  ]))));
  openModal($("swapModal"));
  $("swapList").scrollTop = 0;
}

function renderPrepChip() {
  const chip = $("prepChip");
  chip.replaceChildren();
  chip.className = "chip-status";
  let iconName = "check_circle", text = t("prep.ready");
  if (audio.state === "none" || audio.state === "missing" || audio.state === "error") {
    chip.classList.add("warn");
    iconName = "record_voice_over";
    text = t("prep.device");
  } else if (audio.state === "downloading") {
    iconName = "cloud_download";
    text = t("prep.downloading", { pct: Math.round(audio.pct * 100) });
  } else if (prep.state === "preparing" || audio.state === "checking") {
    iconName = "graphic_eq";
    text = t("prep.preparing", { pct: Math.round(prep.pct * 100) });
  } else if (prep.state === "ready" && prep.ready < prep.total) {
    chip.classList.add("warn");
    iconName = "graphic_eq";
    text = t("prep.partial", { ready: prep.ready, total: prep.total });
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
  return ["intro", "enter", "switch", "release", "rest", "outro"].includes(p.stage) ? t(`stage.${p.stage}`) : "";
}

function renderPlayer() {
  const p = player;
  if (!p) return;
  const items = p.session.items;
  const item = p.item;
  const pose = L(poseById(item.poseId));
  $("playerPhase").textContent = p.stage === "outro" ? t("player.closing") : phaseLabel(item.phase, getLang()) || "";
  $("playerCount").textContent = t("player.count", { a: p.step + 1, b: items.length });
  $("poseEnglish").textContent = pose.english;
  $("poseSanskrit").textContent = pose.sanskrit || "";

  const showSide = pose.sided && ["hold", "switch", "flow"].includes(p.stage);
  $("sidePill").hidden = !showSide;
  if (showSide) $("sidePill").textContent = t(p.side === 1 ? "side.first" : "side.other");

  $("caption").textContent = p.caption;
  const mv = p.move;
  const shape = mv === null || !isFlow(pose) ? "" : mv === "setup" ? pose.setup.cue.replace(/\.$/, "") : pose.moves[mv].show;
  $("poseShape").hidden = !shape;
  $("poseShape").textContent = shape;
  const guideKey = `${pose.id}|${getLang()}`;
  if ($("guideText").dataset.for !== guideKey) {
    $("guideText").dataset.for = guideKey;
    $("guideText").textContent = pose.guide;
    $("guideMoves").replaceChildren(...(isFlow(pose) ? [movesList(pose, p.session.level)] : []));
    $("guideMods").textContent = pose.mods;
  }

  const next = items[p.step + 1];
  $("nextUp").textContent = p.stage === "outro" ? "" : next ? t("player.next", { name: L(poseById(next.poseId)).english }) : t("player.nextClosing");

  const pp = $("playPauseBtn");
  setIcon(pp, p.paused ? "play_arrow" : "pause");
  pp.setAttribute("aria-label", t(p.paused ? "player.resume" : "player.pause"));
  pp.setAttribute("title", t(p.paused ? "player.resume" : "player.pause"));
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
    word = t(bs.phase === "in" ? "breath.in" : "breath.out");
    count = bs.round ? t("breath.round", { a: bs.round, b: bs.rounds }) : t("player.count", { a: bs.n, b: bs.of });
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
    const s = state.session;
    state.history = History.normalize([...state.history, {
      id: `h_${Date.now().toString(36)}`, dateISO: new Date().toISOString(),
      minutes: s.minutes, practicedSec: Math.round(practiced), completed,
      style: s.style, level: s.level, focus: s.focus || "all", poses: s.items.length,
    }]);
    saveState();
  }
  $("doneText").textContent = t(completed ? "done.completed" : "done.early", { dur: fmtMin(practiced) });
  const run = streaks(state.history).current;
  $("doneStreak").hidden = run < 2;
  $("doneStreak").textContent = t("done.streak", { n: run });
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
  const lang = getLang();
  const fams = ["all", ...Object.keys(FAMILIES).filter((f) => [...POSES, ...FLOWS].some((p) => p.family === f))];
  $("familyChips").replaceChildren(...fams.map((f) => el("button", {
    class: `chip${f === libFamily ? " active" : ""}`, type: "button",
    text: f === "all" ? t("library.all") : familyLabel(f, lang),
    onclick: () => { libFamily = f; renderLibrary(); },
  })));
  const q = norm(libQuery.trim());
  const poses = [...POSES, ...FLOWS].map(L)
    .filter((p) => libFamily === "all" || p.family === libFamily)
    .filter((p) => !q || norm(p.english).includes(q) || norm(p.sanskrit).includes(q))
    .sort((a, b) => a.english.localeCompare(b.english, locale()));
  $("libraryList").replaceChildren(...poses.map((p) => el("li", {}, el("button", {
    class: "pose-card", type: "button", onclick: () => openPose(p.id),
  }, [
    el("span", { class: "step-en", text: p.english }),
    p.sanskrit ? el("span", { class: "step-sa", text: p.sanskrit }) : null,
    el("span", { class: "pose-meta", text: [familyLabel(p.family, lang), levelLabel(p.level, lang), p.sided ? t("library.eachSide") : null].filter(Boolean).join(" · ") }),
  ]))));
  $("libraryEmpty").hidden = poses.length > 0;
}

function openPose(poseId) {
  const p = L(poseById(poseId));
  const lang = getLang();
  $("poseTitle").textContent = p.english;
  $("poseSubtitle").textContent = p.sanskrit || "";
  const tags = [
    [familyLabel(p.family, lang)],
    [levelLabel(p.level, lang), p.level === 2 ? "level-2" : ""],
    [t("pose.starts", { pos: positionOf(p.base, lang).label })],
    p.sided ? [t("library.eachSide")] : null,
    [isFlow(p) ? plural(p.moves.length, "move") : p.hold === "time" ? t("pose.timedRest") : t("pose.defaultBreaths", { n: p.breaths })],
    ...p.focus.map((f) => [focusLabel(f, lang), "focus"]),
  ].filter(Boolean);
  $("poseTags").replaceChildren(...tags.map(([t, c]) => el("span", { class: `tag ${c || ""}`.trim(), text: t })));
  $("poseGuide").textContent = p.guide;
  $("poseMoves").replaceChildren(...(isFlow(p) ? [movesList(p, state.settings.level)] : []));
  $("poseMods").textContent = p.mods;
  openModal($("poseModal"));
}

// ───────── log ─────────
const CAL_WEEKS = 15;
function renderLog() {
  const h = state.history;
  const lang = getLang();
  const st = streaks(h);
  const tot = totals(h);
  const tile = (value, label) => el("div", { class: "stat" }, [el("b", { text: value }), el("span", { text: label })]);
  $("logStats").replaceChildren(
    tile(plural(st.current, "day"), t("log.current")),
    tile(plural(st.longest, "day"), t("log.longest")),
    tile(String(tot.sessions), t("log.sessions")),
    tile(fmtTotal(tot.seconds), t("log.total")),
  );

  const cells = weekGrid(h, CAL_WEEKS);
  const level = (m) => (m <= 0 ? 0 : m < 15 ? 1 : m < 30 ? 2 : 3);
  const dateOf = (key) => new Date(key + "T12:00").toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric" });
  const grid = el("div", { class: "cal-grid", role: "img",
    "aria-label": t("log.calAria", { n: CAL_WEEKS, d: plural(cells.filter((c) => c.minutes > 0).length, "day") }) },
    cells.map((c) => el("i", { class: `l${level(c.minutes)}${c.future ? " future" : ""}`,
      title: c.future ? null : t("log.cellTitle", { date: dateOf(c.key), dur: c.minutes ? `${c.minutes} min` : "–" }) })));
  $("logCal").replaceChildren(el("div", { class: "cal-head", text: t("log.weeks", { n: CAL_WEEKS }) }), grid);
  $("logCal").hidden = !h.length;
  $("logStats").hidden = !h.length;

  const list = $("logList");
  list.replaceChildren();
  let month = "";
  let ul = null;
  for (const e of [...h].reverse()) {
    const d = new Date(e.dateISO);
    const m = d.toLocaleDateString(locale(), { month: "long", year: "numeric" });
    if (m !== month) {
      month = m;
      ul = el("ul", { class: "log-items" });
      list.append(el("h2", { class: "phase-head", text: m }), ul);
    }
    const title = [e.minutes ? t("preview.title", { n: e.minutes }) : t("log.session"),
      e.style === "flow" ? t("style.flow") : null,
      e.focus && e.focus !== "all" ? focusLabel(e.focus, lang) : null].filter(Boolean).join(" · ");
    ul.append(el("li", { class: "log-item" }, [
      el("div", { class: "log-main" }, [
        el("span", { class: "log-title", text: title }),
        el("span", { class: "log-date", text: d.toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) }),
      ]),
      el("div", { class: "log-side" }, [
        el("b", { text: fmtMin(e.practicedSec) }),
        e.completed ? null : el("small", { text: t("log.endedEarly") }),
      ]),
      el("button", { class: "icon-btn small", type: "button", "aria-label": t("log.delete"), title: t("log.delete"),
        onclick: () => {
          if (!confirm(t("log.deleteConfirm"))) return;
          state.history = state.history.filter((x) => x.id !== e.id);
          saveState();
          renderLog();
        } }, [icon("delete_outline")]),
    ]));
  }
  $("logEmpty").hidden = h.length > 0;
}

// ───────── your data: export / import / Drive ─────────
function backupPayload() {
  return { app: BACKUP_APP, version: 1, lastModified: new Date().toISOString(), settings: state.settings, history: state.history };
}

// Settings were replaced wholesale (import or restore): bring everything in line.
function afterSettingsReplaced() {
  setLang(state.settings.lang);
  engine.lang = getLang();
  engine.setVolumes({ voice: state.settings.volVoice, sfx: state.settings.volSfx, music: state.settings.volMusic });
  applyStatic();
  applyTheme();
  refitSession();
  renderSettings();
  const screen = document.body.dataset.screen;
  if (screen === "home") renderHome();
  else if (screen === "log") renderLog();
  else if (screen === "library") renderLibrary();
}

async function importFile(file) {
  try {
    const data = parseBackup(await file.text());
    const before = state.history.length;
    state.history = History.merge(state.history, data.history);
    if (data.settings) state.settings = validateState({ settings: data.settings }).settings;
    saveState();
    afterSettingsReplaced();
    toast(t("data.imported", { what: plural(state.history.length - before, "entry") }));
  } catch (_) {
    toast(t("data.badFile"));
  }
}

function restoreFrom(data) {
  state = validateState({ settings: data.settings || state.settings, history: data.history, session: state.session });
  saveState();
  afterSettingsReplaced();
}

const fmtWhen = (iso) => new Date(iso).toLocaleString(locale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function updateDriveUI() {
  const dot = $("driveDot");
  const txt = $("driveStatusText");
  const configured = isDriveConfigured();
  dot.className = "drive-dot";
  $("driveConnectBtn").disabled = !configured;
  $("driveDisconnected").hidden = drive.connected;
  $("driveConnected").hidden = !drive.connected;
  $("driveDisconnectBtn").hidden = !drive.connected;
  $("driveSyncedHint").hidden = !(drive.connected && drive.lastSynced);
  if (drive.lastSynced) $("driveSyncedHint").textContent = t("drive.lastSynced", { when: fmtWhen(drive.lastSynced) });
  if (!configured) { txt.textContent = t("drive.notSetUp"); return; }
  if (drive.syncing) dot.classList.add("syncing");
  else if (drive.connected) dot.classList.add("connected");
  txt.textContent = drive.connected ? t(drive.syncing ? "drive.syncing" : "drive.connected")
    : t(drive.syncing ? "drive.connecting" : "drive.notConnected");
}

async function connectDrive() {
  if (!isDriveConfigured()) return;
  // The consent popup must open inside the tap, so GIS has to be loaded
  // already (it starts loading when Settings opens with a client ID).
  if (!window.google?.accounts?.oauth2) {
    loadGis().then(() => toast(t("drive.loading")), () => toast(t("drive.loadFailed")));
    return;
  }
  try {
    const remote = await drive.connect();
    if (remote) {
      if (confirm(t("drive.newerConfirm", { when: fmtWhen(remote.lastModified) }))) {
        restoreFrom(remote);
        drive.markRestored();
        toast(t("drive.restored"));
      } else {
        toast(t(await drive.push() ? "drive.backedUp" : "drive.backupFailed"));
      }
    } else {
      toast(t("drive.backedUp"));
    }
  } catch (_) {
    toast(t("drive.connectFailed"));
  }
}

async function restoreDrive() {
  if (!navigator.onLine) { toast(t("drive.offline")); return; }
  drive.set({ syncing: true });
  try {
    const remote = await drive.fetchRemote();
    drive.set({ syncing: false });
    if (!remote) { toast(t("drive.noBackup")); return; }
    if (!confirm(t("drive.restoreConfirm"))) return;
    restoreFrom(remote);
    drive.markRestored();
    toast(t("drive.restored"));
  } catch (e) {
    if (e?.message === "auth") drive.dropConnection();
    toast(t("drive.restoreFailed"));
  } finally {
    drive.set({ syncing: false });
  }
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
  const musicOpts = [...MUSIC_TRACKS.map((tr) => ({ id: tr.id, label: musicLabel(tr.id, tr.label, getLang()) })), { id: "off", label: t("settings.musicOff") }];
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
  $("driveClientId").value = getClientId();
  updateDriveUI();
}

function stepBreath(which, delta) {
  const [lo, hi] = which === "inhale" ? INHALE_RANGE : EXHALE_RANGE;
  state.settings[which] = Math.max(lo, Math.min(hi, state.settings[which] + delta));
  saveState();
  renderSettings();
  refitSession();
}

// ───────── language ─────────
function renderLangSheet() {
  $("langList").replaceChildren(...LANGS.map((l) => el("button", {
    class: `lang-option${l === getLang() ? " active" : ""}`, type: "button", role: "radio",
    "aria-checked": String(l === getLang()), lang: l === "fr" ? "fr-CA" : "en",
    onclick: () => setLanguage(l),
  }, [LANG_NAMES[l], l === getLang() ? icon("check") : null])));
}

// Switch UI + voice language. Clip durations differ by language, so the
// current session is rebuilt (same seed) to keep its length.
function setLanguage(l) {
  closeModal($("langModal"));
  if (l === getLang()) return;
  state.settings.lang = l;
  setLang(l);
  engine.lang = l;
  saveState();
  applyStatic();
  const screen = document.body.dataset.screen;
  if (state.session) refitSession(); // re-renders the preview when it's showing
  if (screen === "home") renderHome();
  else if (screen === "library") renderLibrary();
  else if (screen === "log") renderLog();
  renderPackInfo();
  updateDriveUI();
}

function openModal(m) { m.hidden = false; }
function closeModal(m) { m.hidden = true; }

// ───────── wiring ─────────
function wire() {
  hydrateIcons();

  $("libraryBtn").addEventListener("click", () => { renderLibrary(); show("library"); });
  $("settingsBtn").addEventListener("click", () => {
    renderSettings();
    openModal($("settingsModal"));
    if (isDriveConfigured()) loadGis().catch(() => {}); // ready before Connect is tapped
  });
  $("langBtn").addEventListener("click", () => { renderLangSheet(); openModal($("langModal")); });
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => goHome()));

  // Home
  document.querySelectorAll("#levelSeg .seg-btn").forEach((b) => b.addEventListener("click", () => {
    state.settings.level = b.dataset.level;
    saveState();
    renderHome();
  }));
  document.querySelectorAll("#styleSeg .seg-btn").forEach((b) => b.addEventListener("click", () => {
    state.settings.style = b.dataset.style;
    saveState();
    renderHome();
  }));
  $("buildBtn").addEventListener("click", () => { buildSession(); openPreview(); });
  $("lastSessionCard").addEventListener("click", () => openPreview());
  $("logCard").addEventListener("click", () => { renderLog(); show("log"); });

  // Preview
  $("guidanceToggle").addEventListener("change", (e) => {
    state.settings.showGuide = e.target.checked;
    saveState();
    renderPreview();
  });
  $("regenBtn").addEventListener("click", () => {
    const { level, style, focus } = state.session;
    state.session = generateSession({ minutes: state.session.minutes, level, style, focus, seed: newSeed() }, timingCfg(), durOf);
    openSteps.clear();
    saveState();
    renderPreview();
    prepareAudio();
    toast(t("toast.newMix"));
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
    toast(t(!after ? "toast.packNone" : before === after ? "toast.upToDate" : "toast.updated"));
  });

  // Your data
  $("exportBtn").addEventListener("click", () => {
    downloadJSON(backupPayload(), `clearing-${dayKey(new Date().toISOString())}.json`);
    toast(t("data.exported"));
  });
  $("importBtn").addEventListener("click", () => $("importInput").click());
  $("importInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) importFile(file);
  });
  $("driveClientId").addEventListener("change", (e) => {
    const id = e.target.value.trim();
    if (id === getClientId()) return;
    if (drive.connected) drive.disconnect();
    setClientId(id);
    updateDriveUI();
    if (isDriveConfigured()) loadGis().catch(() => {});
  });
  $("driveConnectBtn").addEventListener("click", connectDrive);
  $("driveBackupBtn").addEventListener("click", async () => {
    if (!navigator.onLine) { toast(t("drive.offline")); return; }
    toast(t(await drive.push() ? "drive.backedUp" : "drive.backupFailed"));
  });
  $("driveRestoreBtn").addEventListener("click", restoreDrive);
  $("driveDisconnectBtn").addEventListener("click", () => { drive.disconnect(); toast(t("drive.disconnected")); });
  window.addEventListener("online", () => drive.schedule());

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
engine.lang = getLang();
applyTheme();
wire();
applyStatic();
renderHome();
show("home");
registerSW();
audioReady = initAudio();
drive.autoReconnect(); // only if Drive was connected last time

// Exposed for debugging in DevTools.
window.clearing = { state: () => state, engine, getClip, clipId, estimateSeconds };
