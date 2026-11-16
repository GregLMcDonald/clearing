#!/usr/bin/env node
// Pre-renders every voice line, sound effect and music track in js/phrases.js
// with ElevenLabs, then packs them into ONE file the app downloads up front:
//
//   audio/pack-<hash>.bin   all clips back to back (mp3)
//   audio/manifest.json     { pack, render, clips: { id: { spec, key, offset, length, duration } } }
//
// Post-processing at pack time (ffmpeg; without it clips are packed as generated):
//   1. CLEANUP per kind: generated sound effects carry broadband hiss and
//      grain that turns crackly once they're brought up to voice level, so
//      SFX are denoised and band-limited first.
//   2. LOUDNESS per kind: ElevenLabs returns each kind at very different
//      levels (music came back ~10 dB louder than the bells), so every clip
//      gets a plain gain to a target, capped below clipping.
// Processed clips are cached per (clip, processing) so changing a target or
// filter re-processes only what it affects, and nothing is encoded twice.
//
// Idempotent and cheap to re-run:
//   - each clip is cached in .audio-cache/<key>.mp3, key = sha256(spec + render settings);
//   - on a fresh clone the cache is rebuilt from the committed pack, so only
//     clips whose text/prompt/voice changed are sent to ElevenLabs;
//   - a clip that fails is skipped (the app falls back for it) and retried next run.
//
// Usage
//   npm run audio                 generate what's missing, then pack
//   npm run audio -- --dry-run    list what would be generated and the character cost, no API calls
//   npm run audio -- --only=voice,sfx     limit generation to some kinds (packing always includes all cached clips)
//   npm run audio -- --concurrency=4
//
// Environment (or a .env file at the repo root; see .env.example)
//   ELEVENLABS_API_KEY      required when anything needs generating
//   ELEVENLABS_VOICE_ID_EN  voice for English guidance (falls back to ELEVENLABS_VOICE_ID, then a default)
//   ELEVENLABS_VOICE_ID_FR  voice for Québec French guidance (French clips are skipped without it)
//   ELEVENLABS_TTS_MODEL    default eleven_multilingual_v2
//   ELEVENLABS_SFX_MODEL    default eleven_text_to_sound_v2
//   ELEVENLABS_MUSIC_MODEL  default music_v1

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalog, clipSpec } from "../js/phrases.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "audio");
const CACHE_DIR = path.join(ROOT, ".audio-cache");
const MANIFEST = path.join(OUT_DIR, "manifest.json");
const API = process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io/v1"; // override only for testing against a mock
const OUTPUT_FORMAT = "mp3_44100_128"; // constant bitrate → duration = bytes / 16000
const BYTES_PER_SECOND = 128000 / 8;

// Integrated loudness targets (LUFS) per kind. Voice and bells sit together;
// music is a quiet bed underneath. The app's volume sliders scale from here.
const LOUDNESS = { voice: -18, sfx: -18, music: -26 };
const CLEANUP = {
  voice: "",
  sfx: "afftdn=nr=20:nf=-45:tn=1,highpass=f=90,lowpass=f=7000:p=2",
  music: "",
};
const PEAK_CEILING = -1;   // dBTP: never push a clip's true peak above this
const GAIN_TOLERANCE = 1;   // dB: closer than this → leave the file untouched

// ───────── env ─────────
async function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
await loadDotEnv();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const DRY = !!args["dry-run"];
const ONLY = args.only ? new Set(String(args.only).split(",")) : null;
const CONCURRENCY = Math.max(1, parseInt(args.concurrency || "2", 10));

// How each kind is rendered. Part of every cache key: change a setting here
// (or the voice) and the affected clips regenerate on the next run.
// One voice per language. Keep each object's shape stable: it's hashed into
// the cache key, so reordering fields would regenerate every voice clip.
const voiceFor = (voiceId) => voiceId ? {
  voiceId,
  modelId: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
  voiceSettings: { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.9 },
} : null;
const VOICES = {
  en: voiceFor(process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"), // default: "Sarah", a premade voice
  fr: voiceFor(process.env.ELEVENLABS_VOICE_ID_FR),
};
const RENDER = {
  sfx: {
    modelId: process.env.ELEVENLABS_SFX_MODEL || "eleven_text_to_sound_v2",
    promptInfluence: 0.6,
  },
  music: {
    modelId: process.env.ELEVENLABS_MUSIC_MODEL || "music_v1",
  },
};

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const renderFor = (clip) => clip.kind === "voice" ? VOICES[clip.lang] : RENDER[clip.kind];
const keyFor = (clip) => sha256(`${clipSpec(clip)}|${OUTPUT_FORMAT}|${JSON.stringify(renderFor(clip))}`).slice(0, 32);
const cachePath = (key) => path.join(CACHE_DIR, `${key}.mp3`);
const fmtMB = (b) => `${(b / 1048576).toFixed(2)} MB`;

// ───────── ElevenLabs calls ─────────
function requestFor(clip) {
  const q = `?output_format=${OUTPUT_FORMAT}`;
  if (clip.kind === "voice") {
    const r = VOICES[clip.lang];
    return {
      url: `${API}/text-to-speech/${encodeURIComponent(r.voiceId)}${q}`,
      body: { text: clip.text, model_id: r.modelId, voice_settings: r.voiceSettings },
    };
  }
  if (clip.kind === "sfx") {
    return {
      url: `${API}/sound-generation${q}`,
      body: { text: clip.prompt, duration_seconds: clip.seconds, prompt_influence: RENDER.sfx.promptInfluence, model_id: RENDER.sfx.modelId },
    };
  }
  return {
    url: `${API}/music${q}`,
    body: { prompt: clip.prompt, music_length_ms: Math.round(clip.seconds * 1000), model_id: RENDER.music.modelId, force_instrumental: true },
  };
}

async function render(clip, apiKey) {
  const { url, body } = requestFor(clip);
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Network hiccup (reset socket, DNS, timeout): retry like a 5xx.
      if (attempt >= 4) throw new Error(`network error: ${e.cause?.code || e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
      continue;
    }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 512) throw new Error(`suspiciously small response (${buf.length} bytes)`);
      return buf;
    }
    const detail = (await res.text()).slice(0, 400);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 4) throw new Error(`HTTP ${res.status}: ${detail}`);
    const wait = 2000 * 2 ** (attempt - 1);
    console.warn(`  ${clip.id}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

// ───────── loudness normalization ─────────
const HAS_FFMPEG = spawnSync("ffmpeg", ["-version"]).status === 0;

function measure(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const lufs = parseFloat((summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/) || [])[1]);
  const peak = parseFloat((summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/) || [])[1]);
  return { lufs, peak };
}

// Tag identifying how a kind is processed; part of the processed file's name.
const procTag = (kind) => sha256(`${CLEANUP[kind]}|${LOUDNESS[kind]}|${PEAK_CEILING}`).slice(0, 10);
const procPath = (key, kind) => path.join(CACHE_DIR, "norm", `${key}.${procTag(kind)}.mp3`);

// Returns { file, proc } for the clip's processed audio (cached), or the raw file.
function processed(rawFile, kind, key) {
  if (!HAS_FFMPEG) return { file: rawFile, proc: null };
  const out = procPath(key, kind);
  if (existsSync(out)) return { file: out, proc: procTag(kind) };
  const ff = (args) => spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]).status === 0;

  // Clean into a lossless intermediate so the mp3 is encoded only once.
  let src = rawFile;
  const wav = path.join(CACHE_DIR, "norm", `${key}.tmp.wav`);
  if (CLEANUP[kind]) {
    if (!ff(["-i", rawFile, "-af", CLEANUP[kind], wav])) { console.warn(`  could not clean ${key}; packing as generated`); return { file: rawFile, proc: null }; }
    src = wav;
  }
  const { lufs, peak } = measure(src);
  let gain = Number.isFinite(lufs) && lufs > -60 ? Math.min(LOUDNESS[kind] - lufs, PEAK_CEILING - (Number.isFinite(peak) ? peak : 0)) : 0;
  if (!CLEANUP[kind] && Math.abs(gain) < GAIN_TOLERANCE) {
    spawnSync("cp", [rawFile, out]); // already on target: keep the original bytes
  } else if (!ff(["-i", src, "-af", `volume=${gain.toFixed(2)}dB`, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", out])) {
    console.warn(`  could not normalize ${key}; packing as generated`);
    return { file: rawFile, proc: null };
  } else {
    console.log(`  processed  ${kind.padEnd(5)} ${CLEANUP[kind] ? "cleaned, " : ""}${lufs.toFixed(1)} LUFS → ${(lufs + gain).toFixed(1)} (${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB)`);
  }
  if (src === wav) spawnSync("rm", ["-f", wav]);
  return { file: out, proc: procTag(kind) };
}

// ───────── cache seeding from the committed pack ─────────
async function seedCacheFromPack() {
  if (!existsSync(MANIFEST)) return 0;
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  if (!manifest.pack) return 0; // placeholder manifest
  const packFile = path.join(OUT_DIR, manifest.pack.file);
  if (!existsSync(packFile)) return 0;
  let pack = null, restored = 0;
  for (const entry of Object.values(manifest.clips)) {
    if (!entry.key || existsSync(cachePath(entry.key))) continue;
    pack = pack || await readFile(packFile);
    const bytes = pack.subarray(entry.offset, entry.offset + entry.length);
    await writeFile(cachePath(entry.key), bytes);
    // The pack holds PROCESSED audio: register it as such, so an unchanged
    // clip isn't cleaned and re-encoded a second time on a fresh clone.
    if (entry.proc) await writeFile(path.join(CACHE_DIR, "norm", `${entry.key}.${entry.proc}.mp3`), bytes);
    restored++;
  }
  return restored;
}

// ───────── main ─────────
await mkdir(path.join(CACHE_DIR, "norm"), { recursive: true });
await mkdir(OUT_DIR, { recursive: true });
const restored = await seedCacheFromPack();
if (restored) console.log(`Restored ${restored} clips into .audio-cache from the committed pack.`);

const clips = catalog();
const keys = new Map(clips.map((c) => [c.id, keyFor(c)]));
const missing = clips.filter((c) => !existsSync(cachePath(keys.get(c.id))));
const noVoice = missing.filter((c) => c.kind === "voice" && !VOICES[c.lang]);
const todo = missing.filter((c) => (!ONLY || ONLY.has(c.kind)) && !noVoice.includes(c));

const chars = todo.filter((c) => c.kind === "voice").reduce((n, c) => n + c.text.length, 0);
const byKind = (k) => todo.filter((c) => c.kind === k).length;
console.log(`Catalog: ${clips.length} clips. Cached: ${clips.length - missing.length}. To generate: ${todo.length}` +
  ` (voice ${byKind("voice")} = ${chars} characters, sfx ${byKind("sfx")}, music ${byKind("music")}).`);
for (const [lang, v] of Object.entries(VOICES)) console.log(`Voice ${lang}: ${v ? `${v.voiceId} · ${v.modelId}` : "not set"}`);
if (noVoice.length) console.warn(`Skipping ${noVoice.length} voice clips: no voice set for ${[...new Set(noVoice.map((c) => c.lang))].join(", ")} (ELEVENLABS_VOICE_ID_<LANG> in .env).`);

if (DRY) {
  for (const c of todo) console.log(`  ${c.kind.padEnd(5)} ${c.id.padEnd(34)} ${c.kind === "voice" ? JSON.stringify(c.text) : `${c.seconds}s`}`);
  process.exit(0);
}

const failures = noVoice.map((c) => ({ id: c.id, error: `no voice for ${c.lang}` }));
if (todo.length) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("\nELEVENLABS_API_KEY is not set. Put it in .env (see .env.example) or export it, then re-run.\n" +
      "Packing what's already cached; missing clips will use the app's fallbacks.");
    failures.push(...todo.map((c) => ({ id: c.id, error: "no API key" })));
  } else {
    let next = 0, done = 0;
    const worker = async () => {
      while (next < todo.length) {
        const clip = todo[next++];
        try {
          const buf = await render(clip, apiKey);
          await writeFile(cachePath(keys.get(clip.id)), buf);
          done++;
          console.log(`  [${done}/${todo.length}] ${clip.id} (${(buf.length / 1024).toFixed(0)} KB)`);
        } catch (e) {
          failures.push({ id: clip.id, error: e.message });
          console.error(`  FAILED ${clip.id}: ${e.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  }
}

// Pack every clip that has audio, in catalog order, cleaned and normalized.
if (!HAS_FFMPEG) console.warn("ffmpeg not found: packing clips without loudness normalization (brew install ffmpeg).");
const parts = [];
const entries = {};
let offset = 0;
for (const c of clips) {
  const raw = cachePath(keys.get(c.id));
  if (!existsSync(raw)) continue;
  const { file, proc } = processed(raw, c.kind, keys.get(c.id));
  const buf = await readFile(file);
  entries[c.id] = {
    kind: c.kind,
    spec: clipSpec(c),
    key: keys.get(c.id),
    proc,
    offset,
    length: buf.length,
    duration: +(buf.length / BYTES_PER_SECOND).toFixed(2),
  };
  parts.push(buf);
  offset += buf.length;
}

if (!parts.length) {
  console.log("Nothing to pack yet. The app will use device speech and synthesized sounds.");
  process.exit(failures.length ? 1 : 0);
}

const pack = Buffer.concat(parts);
const packFile = `pack-${createHash("sha256").update(pack).digest("hex").slice(0, 12)}.bin`;
let previous = null;
try { previous = JSON.parse(await readFile(MANIFEST, "utf8")); } catch (_) {}

if (previous && previous.pack && previous.pack.file === packFile && existsSync(path.join(OUT_DIR, packFile))) {
  console.log(`Pack unchanged (${packFile}, ${fmtMB(pack.length)}).`);
} else {
  await writeFile(path.join(OUT_DIR, packFile), pack);
  for (const f of await readdir(OUT_DIR)) {
    if (/^pack-.*\.bin$/.test(f) && f !== packFile) await rm(path.join(OUT_DIR, f));
  }
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pack: { file: packFile, bytes: pack.length },
    render: { format: OUTPUT_FORMAT, loudness: HAS_FFMPEG ? LOUDNESS : null, cleanup: HAS_FFMPEG ? CLEANUP : null, voice: VOICES, ...RENDER },
    clips: entries,
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
  console.log(`Wrote audio/${packFile} (${fmtMB(pack.length)}, ${Object.keys(entries).length} clips) and audio/manifest.json.`);
}

if (failures.length) {
  console.error(`\n${failures.length} clip(s) not generated:`);
  for (const f of failures.slice(0, 20)) console.error(`  ${f.id}: ${f.error}`);
  process.exit(1);
}
