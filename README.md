# Clearing

A PWA that builds a beginner or intermediate yoga session of the length you pick (10 to 60 minutes) and guides you through it by voice. It names each posture in English and Sanskrit, explains how to get into it, and counts the hold in breaths. A breathing circle, soft chimes on each inhale and exhale, and quiet ambient music help you keep pace.

Same family as `../limber`: vanilla HTML/CSS/JS, no framework, no bundler, deployable as static files. The one build step generates the audio.

## Using it

1. **Practice**: pick a length and a level, then tap **Build my session**.
2. **Preview**: the session is grouped as Arrive, Warm up, Build, Cool down and Rest. Each posture shows its names and hold. Tap a posture, or turn on **Show guidance text**, to read exactly what will be spoken, plus a tip. **New mix** reshuffles the session with the same settings.
3. **Begin**: the player announces each posture, reads the guidance, then counts breaths. Each inhale and exhale has its own sound and the circle grows and shrinks with it. Two-sided postures are held on the first side, then on the other. Controls: previous / pause / next. On a keyboard: Space, ←, →.
4. **Library** (book icon): every posture, with search and filters by family.
5. **Settings** (sliders icon): breath pace (inhale 3–6 s, exhale 3–7 s), whether guidance is read aloud (when off, you hear only names and holds, and the text stays in the player's Guidance panel), music (Forest, Meadow, Off), volumes, theme, audio pack status.

## Running locally

```sh
npm install        # only needed for the icon generator (dev dependency)
npm run serve      # http://localhost:8077
npm test           # session generator tests
```

The service worker needs `http://localhost`, not `file://`.

## Audio: ElevenLabs build step

Every voice line, sound effect and music track is pre-generated with ElevenLabs and packed into **one file** (`audio/pack-<hash>.bin`, plus `audio/manifest.json`). On first launch the app downloads the pack into the browser's cache, so it works offline afterwards. Before a session starts, it decodes the clips that session needs. Nothing loads during practice, so there are no gaps between cues.

### Setup

```sh
cp .env.example .env
# put your key in .env: ELEVENLABS_API_KEY=...
# optional: ELEVENLABS_VOICE_ID=... (default is the premade voice "Sarah")
npm run audio:dry   # see what would be generated and how many characters it costs; no API calls
npm run audio       # generate missing clips and write the pack
```

Then commit `audio/` and deploy. The key is used only by the Node script. It never reaches the app or the browser.

What gets generated (all declared in [js/phrases.js](js/phrases.js)):

| Kind | Clips | Notes |
|---|---|---|
| Voice | 118 | Names and guidance for each posture, position changes ("Lie down on your back."), "Stay here for N breaths." for 2–12, side switch, welcome and closing. About 12k characters. |
| SFX | 5 | Opening bowl, transition chime, closing bowls, and the two breath cues: a higher chime as each inhale starts and a lower one as each exhale starts. |
| Music | 2 | "Forest" and "Meadow", 3 minutes each. They loop with a 6-second crossfade. |

The build is **idempotent and incremental**:

- Each clip is cached in `.audio-cache/` (git-ignored) under a hash of its text or prompt plus the render settings (voice, model, voice settings). Re-running only calls ElevenLabs for clips whose wording, prompt or voice changed.
- On a fresh clone, the cache is rebuilt from the committed pack, so unchanged clips are never paid for twice.
- If a clip fails (quota, plan limits, network), the others are still packed, the script exits non-zero and lists the failures. Re-run later to fill the gaps.
- When packing, every clip is loudness-normalized with ffmpeg (`brew install ffmpeg`): voice and bells to −18 LUFS, music to −26 LUFS so it stays underneath. This is a plain volume change capped below clipping, so bell attacks are untouched. ElevenLabs returns very different levels per kind; without this, the music drowned out the bells. Targets are `LOUDNESS` in the script.
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
js/phrases.js    audio clip catalog: every spoken line, SFX and music prompt
js/session.js    session generator + timeline (pure, tested)
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
