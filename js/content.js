// Language-aware view of the content in library.js. Pure (no DOM): used by
// the app for display AND by phrases.js to build each language's voice clips.
// English is the base data; other languages overlay it by id.

import { POSITIONS, PHASES, FAMILIES, LEVELS } from "./library.js";
import { FR_POSES, FR_FLOWS, FR_POSITIONS, FR_PHASES, FR_FAMILIES, FR_LEVELS, FR_LINES, frHoldText, FR_MUSIC } from "./lang/fr.js";

export const LANGS = ["en", "fr"];
export const LANG_NAMES = { en: "English", fr: "Français (Québec)" };

// A pose or flow with names/guidance/moves in `lang`.
export function locPose(p, lang) {
  if (!p || lang === "en") return p;
  const o = (p.kind === "flow" ? FR_FLOWS : FR_POSES)[p.id];
  if (!o) return p;
  const out = { ...p, english: o.english || p.english, guide: o.guide || p.guide, mods: o.mods ?? p.mods };
  if (p.kind === "flow") {
    out.setup = p.setup && o.setup ? { ...p.setup, ...o.setup } : p.setup;
    out.moves = p.moves.map((mv, k) => {
      const f = (o.moves || [])[k] || {};
      return { ...mv, show: f.show || mv.show, cue: f.cue || mv.cue, teach: f.teach || mv.teach,
        l2: mv.l2 ? { cue: f.l2?.cue || mv.l2.cue, teach: f.l2?.teach || mv.l2.teach } : undefined };
    });
  }
  return out;
}

export const positionOf = (base, lang) => (lang === "fr" ? FR_POSITIONS : POSITIONS)[base];
export const phaseLabel = (phaseId, lang) => lang === "fr" ? FR_PHASES[phaseId] : PHASES.find((p) => p.id === phaseId)?.label;
export const familyLabel = (f, lang) => (lang === "fr" ? FR_FAMILIES : FAMILIES)[f];
export const levelLabel = (n, lang) => (lang === "fr" ? FR_LEVELS : LEVELS)[n];
export const musicLabel = (trackId, englishLabel, lang) => lang === "fr" ? FR_MUSIC[trackId] || englishLabel : englishLabel;
export const linesFor = (enLines, lang) => lang === "fr" ? FR_LINES : enLines;
export const holdTextFor = (enHoldText, lang) => lang === "fr" ? frHoldText : enHoldText;
