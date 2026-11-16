// Audio clip catalog — every voice line, sound effect and music track the app
// can play is declared HERE and nowhere else. scripts/build-audio.mjs walks
// catalog() to pre-render clips with ElevenLabs; the app looks clips up by id
// and checks clipSpec() against the manifest so stale audio is never played
// (it falls back to the device voice / synthesized sound instead).
//
// Clip shapes
//   { id, kind: "voice", text, caption }        text = what TTS reads, caption = what's shown
//   { id, kind: "sfx",   prompt, seconds }      ElevenLabs sound-generation
//   { id, kind: "music", prompt, seconds, label } ElevenLabs music, looped with crossfade

import { POSES, FLOWS, POSITIONS } from "./library.js";
import { LANGS, locPose, positionOf, linesFor, holdTextFor } from "./content.js";

// Breath pace options (seconds per inhale / exhale). The breath chimes are
// independent of pace, so these ranges can change freely.
export const INHALE_RANGE = [3, 6];
export const EXHALE_RANGE = [3, 7];
// Hold lengths the generator may produce (per side). One "Stay here for N
// breaths" line is rendered per value.
export const HOLD_RANGE = [2, 12];

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
  "eight", "nine", "ten", "eleven", "twelve"];

export const LINES = {
  welcome:    "Welcome. Let's begin our practice together.",
  release:    "And release.",
  switch:     "Now the other side.",
  lastBreath: "One more breath.",
  wake:       "Begin to deepen your breath. Wiggle your fingers and toes. When you're ready, roll onto your right side, and slowly come up to sit.",
  close:      "Thank you for practicing. Namaste.",
  flowOn:     "Now let's flow. One movement for each chime.",
};

export const MUSIC_TRACKS = [
  {
    id: "music.forest", label: "Forest", seconds: 180,
    prompt: "Calm ambient music for a yoga practice. Soft, warm synth pads and a slow evolving drone, gentle forest atmosphere with distant birdsong and light rustling leaves. Very slow, spacious and peaceful. No drums, no percussion, no vocals, no sudden changes.",
  },
  {
    id: "music.meadow", label: "Meadow", seconds: 180,
    prompt: "Gentle ambient music for yoga and meditation. Sparse soft felt piano notes over a warm low drone, a light breeze in an open meadow. Slow, airy and calming. No drums, no percussion, no vocals, no sudden changes.",
  },
];

const SFX_PROMPTS = {
  "sfx.bell.start": { seconds: 6, prompt: "A single deep Tibetan singing bowl struck softly, long warm shimmering resonance slowly fading out, calm meditation, clean recording, no other sounds." },
  "sfx.chime":      { seconds: 2.5, prompt: "One single soft strike of a small brass meditation bell, a clear pure tone with a gentle ring that fades out smoothly. Only one strike. Studio quality, completely clean, no background noise, no hiss, no other sounds." },
  "sfx.bell.end":   { seconds: 8, prompt: "Three soft singing bowl strikes, spaced slowly, warm resonance fading out gently, peaceful end of meditation, clean recording, no other sounds." },
};
// Breath cues: one tonal chime at the start of each inhale / exhale. Tones,
// not breath sounds. Inhale is higher and brighter, exhale lower and warmer,
// so they're told apart without looking.
const BREATH_CUES = {
  "sfx.in":  { seconds: 2.5, prompt: "One single soft strike of a small crystal singing bowl: a clear, pure, high bell tone that rings and fades out smoothly. Only one strike. Studio quality, completely clean, no background noise, no hiss, no shimmer, no breathing, no other sounds." },
  "sfx.out": { seconds: 2.5, prompt: "One single soft strike of a crystal singing bowl: a clear, pure, warm bell tone, noticeably lower and mellower, that rings and fades out smoothly. Only one strike. Studio quality, completely clean, no background noise, no hiss, no shimmer, no breathing, no other sounds." },
};

// ───────── ids ─────────
// The timeline uses language-neutral ids ("v.welcome"); voice clips exist once
// per language in the catalog ("en:v.welcome", "fr:v.welcome"). SFX and music
// are shared and never prefixed.
export const langId = (clipId, lang = "en") => clipId.startsWith("v.") ? `${lang}:${clipId}` : clipId;

export const id = {
  line:  (k) => `v.${k}`,
  hold:  (n) => `v.hold.${n}`,
  pos:   (base) => `v.pos.${base}`,
  name:  (poseId) => `v.pose.${poseId}.name`,
  guide: (poseId) => `v.pose.${poseId}.guide`,
  // Flow cues are keyed by their text, so "Fold." is one clip for every flow.
  cue:   (text) => `v.cue.${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  teach: (flowId, k, l2 = false) => `v.flow.${flowId}.${k}.teach${l2 ? "2" : ""}`,
  setup: (flowId) => `v.flow.${flowId}.setup`,
  inhale: "sfx.in",
  exhale: "sfx.out",
};

export function holdText(n) {
  const w = NUMBER_WORDS[n] || String(n);
  return n === 1 ? "Stay here for one breath." : `Stay here for ${w} breaths.`;
}

function range([a, b]) { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; }
function voiceClips(lang) {
  const clips = [];
  const voice = (clipId, text, caption = text) => clips.push({ id: langId(clipId, lang), kind: "voice", lang, text, caption });
  const lines = linesFor(LINES, lang);
  const hold = holdTextFor(holdText, lang);
  for (const k of Object.keys(LINES)) voice(id.line(k), lines[k]);
  for (const n of range(HOLD_RANGE)) voice(id.hold(n), hold(n));
  for (const base of Object.keys(POSITIONS)) voice(id.pos(base), positionOf(base, lang).cue);
  for (const base of [...POSES, ...FLOWS]) {
    const p = locPose(base, lang);
    const spoken = p.sanskrit ? `${p.english}. ${p.say || p.sanskrit}.` : `${p.english}.`;
    const shown  = p.sanskrit ? `${p.english}. ${p.sanskrit}.` : `${p.english}.`;
    voice(id.name(p.id), spoken, shown);
    voice(id.guide(p.id), p.guide);
  }
  // Cue clips are keyed by the ENGLISH cue text; the clip says it in `lang`.
  const cues = new Map();
  for (const en of FLOWS) {
    const f = locPose(en, lang);
    if (en.setup) { voice(id.setup(f.id), f.setup.teach); cues.set(id.cue(en.setup.cue), f.setup.cue); }
    en.moves.forEach((mv, k) => {
      const lm = f.moves[k];
      voice(id.teach(f.id, k), lm.teach);
      cues.set(id.cue(mv.cue), lm.cue);
      if (mv.l2) { voice(id.teach(f.id, k, true), lm.l2.teach); cues.set(id.cue(mv.l2.cue), lm.l2.cue); }
    });
  }
  for (const [clipId, text] of cues) voice(clipId, text);
  return clips;
}

function buildCatalog() {
  const clips = LANGS.flatMap(voiceClips);
  for (const [clipId, s] of Object.entries(SFX_PROMPTS)) clips.push({ id: clipId, kind: "sfx", ...s });
  for (const [clipId, s] of Object.entries(BREATH_CUES)) clips.push({ id: clipId, kind: "sfx", ...s });
  for (const t of MUSIC_TRACKS) clips.push({ id: t.id, kind: "music", seconds: t.seconds, prompt: t.prompt, label: t.label });
  return clips;
}

const CATALOG = buildCatalog();
const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export function catalog() { return CATALOG; }
// Accepts a full id ("fr:v.welcome", "sfx.chime") or a timeline id + lang.
export function getClip(clipId, lang = "en") { return BY_ID.get(clipId) || BY_ID.get(langId(clipId, lang)) || null; }

// Canonical description of WHAT a clip should sound like (not how it's
// rendered). The manifest stores clipSpec per clip; if the text or prompt
// changes and nobody re-runs the build, the app notices the mismatch and
// falls back rather than playing the old wording.
export function clipSpec(clip) {
  if (clip.kind === "voice") return `voice|${clip.text}`;
  return `${clip.kind}|${clip.seconds}|${clip.prompt}`;
}

// Rough spoken duration before real audio exists (calm pace, ~2.3 words/s).
export function estimateSpeechSeconds(text) {
  const words = text.trim().split(/\s+/).length;
  return words / 2.3 + 0.4;
}
