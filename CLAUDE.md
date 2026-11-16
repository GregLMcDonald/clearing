# Clearing: project context for Claude

## What this is
A static PWA that generates beginner/intermediate yoga sessions of a chosen length (10–60 min) and guides the user through them by voice: posture names (English, then Sanskrit), how to come in, and holds counted in breaths, with breath chimes, a breathing circle and ambient music. Sibling of `../limber` (same stack and conventions). Design choices and their reasons are in [docs/decisions.md](docs/decisions.md). Read it before changing behaviour.

## Target platform
Chrome on Android as an installed PWA (primary). Desktop Chrome for occasional sessions at a desk (layout goes two-column from 900 px). iOS is not a constraint.

## Hard constraints
- Vanilla HTML/CSS/JS ES modules. No framework, no bundler. The app must stay deployable as static files from the repo root (GitHub Pages).
- The only build step is audio (`npm run audio`). It needs `ELEVENLABS_API_KEY` (in `.env`, git-ignored). The key must never be shipped to or used by the browser.
- No runtime requests other than the app's own files and `audio/`. No CDNs, icon fonts or analytics.
- Everything beginner/intermediate. Don't add advanced postures (inversions such as headstand, arm balances, deep backbends) without an explicit ask.
- No emojis anywhere in the UI. Icons are Material Icons (Round), inlined via `js/icons.js`. Add a name to `scripts/build-icons.mjs` and run `npm run icons`.
- No posture illustrations.
- Build DOM with `el()` and `textContent`. Only the generated icon markup goes through `innerHTML`.

## Architecture
- [js/library.js](js/library.js): posture data (phase, base position, seq, level, sided, default breaths, spoken `guide`, displayed `mods`, optional `say` respelling), and `FLOWS`: vinyasa-style sequences of `moves` (each one inhale, one exhale or a multi-breath stay) with short `cue`s and fuller `teach` lines; `l2` overrides for intermediate.
- [js/phrases.js](js/phrases.js): the audio clip catalog. **Every** spoken line, SFX and music prompt is declared here. The build script and the app both use `catalog()` / `clipSpec()`.
- [js/session.js](js/session.js): `generateSession()` (styles `steady` / `flow`) and `buildActions()` (the flat timeline the player runs; flows add `half` actions: one inhale or exhale with its chime and cue). Duration estimates come from the same timeline. Pure code with tests in `test/`.
- [js/audio.js](js/audio.js): `AudioEngine`. Downloads the single pack into Cache Storage (`clearing-audio`), decodes a session's clips before Start, plays everything through one AudioContext, and provides fallbacks (speech synthesis, synthesized bells, breath chimes and pad).
- [js/player.js](js/player.js): runs the timeline. All waits read `ctx.currentTime`, and pause is `ctx.suspend()`. Skips use a token to cancel the running loop.
- [js/app.js](js/app.js): screens (home / preview / player / done / library), two bottom sheets (settings, pose), and state in localStorage key `clearing.state.v1`: `{ version, settings, session, history }`.
- [scripts/build-audio.mjs](scripts/build-audio.mjs): ElevenLabs TTS, SFX and music → `.audio-cache/<hash>.mp3` → cleaned (`CLEANUP`, SFX only) and loudness-normalized (`LOUDNESS`) with ffmpeg → `audio/pack-<hash>.bin` + `audio/manifest.json`. Idempotent, and seeds its cache from the committed pack.
- Flow cues must stay 1–2 seconds (they are spoken inside one inhale or exhale) and name the movement only.
- Breath cues are two chimes (inhale higher, exhale lower) plus the circle. Never breath or whoosh sounds, and the voice never says "breathe in" / "breathe out".

## Languages
- English and Québec French. The English content lives in `library.js` / `phrases.js`; French overlays it by id in [js/lang/fr.js](js/lang/fr.js), merged by `locPose()` in [js/content.js](js/content.js). UI strings for both languages are in [js/i18n.js](js/i18n.js) (`t()`, plus `data-i18n` / `data-i18n-aria` / `data-i18n-ph` attributes in `index.html`).
- **Every content or UI change needs its French counterpart.** `test/i18n.test.mjs` fails if anything is missing.
- French register: professional Québec French, "vous", Québec vocabulary (trousse, assoyez-vous, courriel…), no gendered agreement with the listener ("lorsque vous le souhaitez", not "quand vous êtes prêt"). Non-breaking space before ":" and "%". "Clearing" is not translated.
- Voice clips exist per language (`en:v.…`, `fr:v.…`); the timeline uses language-neutral ids and `AudioEngine.lang` picks the clip. Flow cue clips are keyed by the ENGLISH cue text, so one English cue must always map to one French cue.
- One ElevenLabs voice per language (`ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_VOICE_ID_FR`). The English voice settings object is hashed into cache keys; keep its shape stable.

## Editing content
- Changing a posture's `guide`, names or `say`, a line in `LINES`, or a prompt makes those clips stale. The app falls back to the device voice for them until `npm run audio` is re-run, which only regenerates what changed.
- Keep guidance short (2–4 sentences), written from the posture's `base` position, with right and left explicit for the first side of sided postures. Favour cues that protect knees, lower back and neck.
- Hold lengths outside `HOLD_RANGE` in `phrases.js` need new "Stay here for N breaths" clips. Widen the range there. Breath pace ranges don't affect clips.
- Run `npm test` after touching the library or generator.

## Release
- Bump `CACHE` in [sw.js](sw.js) when app files change. A new audio pack doesn't need a bump: its filename changes and the manifest is fetched network-first.
- Commit `audio/` after generating. Never commit `.env` or `.audio-cache/`.
