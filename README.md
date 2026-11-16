# Clearing

A PWA that builds a beginner or intermediate yoga session of the length you pick (10 to 60 minutes) and guides you through it by voice. It names each posture in English and Sanskrit, explains how to get into it, and counts the hold in breaths. A breathing circle, soft chimes on each inhale and exhale, and quiet ambient music help you keep pace.

Same family as `../limber`: vanilla HTML/CSS/JS, no framework, no bundler, deployable as static files. The one build step generates the audio.

## Using it

1. **Practice**: pick a length, a level, a style and a focus, then tap **Build my session**.
   - **Steady**: come into each posture and hold it still for a few breaths (closer to hatha).
   - **Flow**: adds vinyasa-style flows to the Build phase: a sun salutation (half for 10–15 minute sessions, Sun Salutation A from 20 minutes) and, from 20 minutes, a warrior flow. Round one is taught slowly; later rounds move one movement per chime, with a short spoken cue.
   - **Focus**: All-round, or Hips, Back or Shoulders (matching postures are picked first and get the longer holds), Energizing (more time in Build, shorter rest) or Calming (longer cool down and rest).
2. **Preview**: the session is grouped as Arrive, Warm up, Build, Cool down and Rest. Each posture shows its names and hold. Tap a posture, or turn on **Show guidance text**, to read exactly what will be spoken, plus a tip. An opened posture can also be edited: **−/+** changes its hold (breaths, rounds for a flow, time for the final rest), **Swap** replaces it with another posture from the same phase, and the bin removes it (Arrive and Rest stay). Removing and swapping can be undone from the message that follows. **New mix** reshuffles the session with the same settings and drops your edits.
3. **Begin**: the player announces each posture, reads the guidance, then counts breaths. Each inhale and exhale has its own sound and the circle grows and shrinks with it. Two-sided postures are held on the first side, then on the other. Controls: previous / pause / next. On a keyboard: Space, ←, →.
4. **Library** (book icon): every posture, with search and filters by family.
5. **Log** (the practice card on the home screen, once you've practiced): current and longest streak, sessions, total time, a 15-week calendar, and every session, which you can delete. A session is logged when it ends after at least a minute.
6. **Language** (globe icon): English or Québec French, for both the app and the voice. On first launch it follows the device language. Switching rebuilds the current session so it keeps its length (French clips run longer).
7. **Settings** (sliders icon): breath pace (inhale 3–6 s, exhale 3–7 s), whether guidance is read aloud (when off, you hear only names and holds, and the text stays in the player's Guidance panel), music (Forest, Meadow, Off), volumes, theme, export / import, Google Drive backup, audio pack status.

## Your data

Everything lives in this browser's `localStorage`: settings, the last proposed session and the log. **Export** saves the log and settings as `clearing-YYYY-MM-DD.json`; **Import** adds a file's log entries to yours (no duplicates) and takes its settings.

### Google Drive backup (optional)

Clearing can keep a copy of your log and settings in one file (`clearing-backup.json`) in your own Google Drive and restore it on another device. It stays off, and the app never contacts Google, until you paste an OAuth client ID into **Settings → Google Drive backup**. The same client ID as limber works if both apps are served from the same origin (for example `https://<user>.github.io`). To create one in the [Google Cloud Console](https://console.cloud.google.com/):

1. Create or pick a project, then **APIs & Services → Library →** enable the **Google Drive API**.
2. **OAuth consent screen**: configure it (External is fine) and add yourself as a test user.
3. **Credentials → Create credentials → OAuth client ID →** type **Web application**.
4. Under **Authorized JavaScript origins**, add the origin the app is served from, such as `https://<user>.github.io`, and `http://localhost:8077` for local testing (origins only, no path).
5. Copy the client ID (`…apps.googleusercontent.com`) and paste it into the app. It's saved on that device only.

The client ID is public by design: there's no secret. The scope is `drive.file`, so the app can see only the file it creates. The access token is kept in memory, never stored. Once connected, changes are backed up a few seconds after they happen, and **Back up now** and **Restore** are there for manual use. Restoring replaces this device's log and settings (the proposed session is kept).

## Running locally

```sh
npm install        # only needed for the icon generator (dev dependency)
npm run serve      # http://localhost:8077
npm test           # generator, editing, log and translation tests
```

The service worker needs `http://localhost`, not `file://`.

## Audio: ElevenLabs build step

Every voice line, sound effect and music track is pre-generated with ElevenLabs and packed into **one file** (`audio/pack-<hash>.bin`, plus `audio/manifest.json`). On first launch the app downloads the pack into the browser's cache, so it works offline afterwards. Before a session starts, it decodes the clips that session needs. Nothing loads during practice, so there are no gaps between cues.

### Setup

```sh
cp .env.example .env
# put your key in .env: ELEVENLABS_API_KEY=...
# ELEVENLABS_VOICE_ID_EN=...  English voice (default: the premade voice "Sarah")
# ELEVENLABS_VOICE_ID_FR=...  Québec French voice (French clips are skipped without it)
npm run audio:dry   # see what would be generated and how many characters it costs; no API calls
npm run audio       # generate missing clips and write the pack
```

Then commit `audio/` and deploy. The key is used only by the Node script. It never reaches the app or the browser.

What gets generated (all declared in [js/phrases.js](js/phrases.js)):

| Kind | Clips | Notes |
|---|---|---|
| Voice | 168 × 2 languages | Names and guidance for each posture and flow, flow teaching lines and short movement cues, position changes ("Lie down on your back."), "Stay here for N breaths." for 2–12, side switch, welcome and closing. About 15k characters. |
| SFX | 5 | Opening bowl, transition chime, closing bowls, and the two breath cues: a higher chime as each inhale starts and a lower one as each exhale starts. |
| Music | 2 | "Forest" and "Meadow", 3 minutes each. They loop with a 6-second crossfade. |

The build is **idempotent and incremental**:

- Each clip is cached in `.audio-cache/` (git-ignored) under a hash of its text or prompt plus the render settings (voice, model, voice settings). Re-running only calls ElevenLabs for clips whose wording, prompt or voice changed.
- On a fresh clone, the cache is rebuilt from the committed pack, so unchanged clips are never paid for twice.
- If a clip fails (quota, plan limits, network), the others are still packed, the script exits non-zero and lists the failures. Re-run later to fill the gaps.
- When packing, sound effects are first cleaned with ffmpeg (denoise, then band-limit to 90 Hz–7 kHz): generated SFX carry a hiss that turns crackly once raised to voice level. Filters are `CLEANUP` in the script.
- Every clip is then loudness-normalized with ffmpeg (`brew install ffmpeg`): voice and bells to −18 LUFS, music to −26 LUFS so it stays underneath. This is a plain volume change capped below clipping, so bell attacks are untouched. ElevenLabs returns very different levels per kind; without this, the music drowned out the bells. Targets are `LOUDNESS` in the script.
- `--only=voice,sfx` limits generation to some kinds, and `--concurrency=N` (default 2) sets how many requests run in parallel.

### Without a pack

The app is fully usable before you generate anything. Voice falls back to the device's speech synthesis, bells and breath swells are synthesized with Web Audio, and the music is a soft synthesized pad. The same fallback applies to any individual clip that is missing, or whose text was edited without re-running the build. The app compares each clip's text or prompt with the manifest and never plays outdated wording.

### Things to check on your first real run

- **Music API access.** `POST /v1/music` (`music_v1`) needs a plan that includes music. If it fails, the script tells you, and the app uses the synthesized pad for music.
- **Sanskrit pronunciation.** If the voice mangles a name, add a `say:` respelling to that posture in [js/library.js](js/library.js). Only that clip regenerates. Display text keeps the proper spelling.
- **Breath chimes.** Generated sound effects vary. If a chime sounds wrong, edit its prompt in `js/phrases.js` and re-run. Only that chime regenerates.

## Deploying (GitHub Pages)

Settings → Pages → Deploy from a branch → `main` / root. Bump `CACHE` in [sw.js](sw.js) when app files change. A new audio pack has a new hashed filename, so it is picked up automatically and doesn't need a cache bump.

## Layout

```
index.html, styles.css, sw.js, manifest.webmanifest
js/library.js    posture library (data, shared with the build)
js/phrases.js    audio clip catalog: every spoken line (per language), SFX and music prompt
js/lang/fr.js    Québec French content: postures, flows, spoken lines, labels
js/content.js    language-aware view of the content (French overlays English by id)
js/i18n.js       UI strings (English + French) and the current language
js/session.js    session generator, timeline and session editing (pure, tested)
js/history.js    practice log: streaks, calendar, merging (pure, tested)
js/backup.js     export / import and the optional Google Drive backup
js/audio.js      audio engine: pack download, decoding, playback, fallbacks
js/player.js     runs a session timeline on the audio clock
js/app.js        UI
js/icons.js      generated Material Icons subset (npm run icons)
scripts/         build-audio.mjs, build-icons.mjs, serve.mjs
audio/           manifest.json + pack-*.bin (generated, committed)
docs/decisions.md  choices made for v0 and why
```

## License

Code is [MIT](LICENSE). The generated audio in `audio/` is not covered by the MIT License. It was made with [ElevenLabs](https://elevenlabs.io) and is included for use within this app; forks should generate their own with `npm run audio`. Icons are [Material Icons](https://github.com/google/material-design-icons) (Apache 2.0).
