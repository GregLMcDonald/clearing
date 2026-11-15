# v0 decisions

Choices made while building v0, where the brief left room. Each one can be revisited.

## Architecture

- **Same stack as limber.** Vanilla ES modules, no framework or bundler, static hosting. The only build step is audio generation (`npm run audio`) plus a rarely-run icon generator. The app's source is what ships.
- **Library and phrases are shared code.** `js/library.js` and `js/phrases.js` are imported by both the browser and the Node build script. The words the build sends to ElevenLabs are therefore the words the app shows and expects. This is the same single-source idea as limber's `phraseFor()`.
- **One audio pack, not many files.** The build concatenates every mp3 into one `pack-<hash>.bin` and writes a manifest with byte offsets. The app downloads it once with a progress bar and keeps it in Cache Storage. That's one request, an atomic update (new hash, new name), and a simple offline story. A `.bin` was chosen over `.zip` because the browser can slice it with no unzip code.
- **Generated audio is committed.** GitHub Pages serves the repo as is, and running ElevenLabs in CI would need the key as a secret. The per-clip cache (`.audio-cache/`) is not committed: the build rebuilds it from the pack, so the pack is the only copy in git.
- **Staleness check by spec string.** Each manifest entry stores the clip's text or prompt. If you edit guidance and forget to rebuild, the app uses the device voice for that line instead of playing the old wording.
- **Fallbacks everywhere.** Device speech synthesis, Web Audio bells, swells and a pad. That makes v0 usable before the key exists, and lets a partial pack work.
- **Material Icons inlined as SVG** from `@material-design-icons/svg` (Round style), and only the glyphs in use. No icon font and no CDN request, which keeps the app offline-first like limber.

## Audio and timing

- **Everything runs on the AudioContext clock.** Waits read `ctx.currentTime`, so pause is just `ctx.suspend()`: voice, swells, bells and timers freeze together and resume exactly. The device-voice fallback can't be frozen mid-word, so after a pause it replays the current line.
- **Clips are decoded before Start.** Opening the preview creates a (suspended) AudioContext and decodes the session's clips. Begin then only resumes it. Music streams from a blob URL through `<audio>` elements, because decoding three minutes of stereo would take about 60 MB of RAM.
- **Breath cues are tones, not breath sounds.** A higher, brighter chime starts each inhale and a lower, warmer one starts each exhale. They work at any pace, and the circle shows the duration. The voice never says "breathe in" or "breathe out"; the chimes and the circle are the only breath cues. Its only line during a hold is "One more breath." at the start of the last breath of holds of four or more. (The first version used breath-like whooshes and voiced the first two breaths; Greg didn't want either.)
- **Loudness is normalized at build time** with ffmpeg: voice and bells at −18 LUFS, music at −26. As generated, the music was about 10 dB louder than the bells, which were inaudible under it. The in-browser fallback bells are pitched at G4 and above, because small speakers can't reproduce a 200 Hz bowl, and a limiter on the master output prevents clipping.
- **Music ducks** to about 45% while the voice speaks.
- **Voice defaults:** `eleven_multilingual_v2` (pre-rendered, so quality beats latency), voice "Sarah", `speed: 0.9`, `stability: 0.6`. All can be overridden with env vars or in `RENDER` in the script.

## Sessions

- **Arc:** Arrive (Easy pose) → Warm up (28% of the flexible time) → Build (47%) → Cool down (25%) → Savasana. Each posture has a `seq` number, and postures are ordered by it within a phase, so the flow follows a normal class shape (seated → hands and knees → standing → floor → lying down) with few position changes.
- **Position changes are announced** with a generic line ("Come onto your hands and knees.") whenever consecutive postures start from different positions. Guidance text is written from the posture's starting position.
- **Selection:** each phase takes its "priority" postures first (Cat and cow, Downward dog, Mountain, Warrior two, Tree, Bridge, Supine twist), then a seeded shuffle of the rest, as long as they fit the phase's time budget.
- **Hitting the length:** after selection, breath counts are nudged up or down one at a time (3 to 8/10/12 depending on length), then savasana absorbs the remainder within a range set by session length. Tests check that every length is within 60 seconds of the estimate across seeds and paces. The real run can drift a little when the device voice is used, because its speed is only estimated.
- **Sides:** two-sided postures are held fully on the first side, then "Now the other side." Each side gets the same number of breaths. The guidance describes the first side, using right and left explicitly.
- **Breath counts mean per side.** The preview says "5 breaths each side".
- **Level:** Beginner excludes postures marked intermediate (Warrior three, Half moon, Eagle, Side plank, Boat, Locust, Pigeon, High crescent lunge). Intermediate includes everything. Nothing advanced is in the library.
- **English first, then Sanskrit** when a posture is announced. English is understood instantly, and Sanskrit follows as reinforcement. Sanskrit is shown without diacritics (the common Western usage). A `say` field holds TTS respellings ("Shavasana", "Virabhadrasana Two") without changing what's displayed.
- **No repeats within a session.** At 60 minutes the beginner pool is nearly used up, so long sessions vary less from mix to mix. Adding postures to the library is the fix.

## UI

- **Palette:** two woodland themes. *Forest* (dark: forest-floor background, sage and moss accents, a warm "canopy light" gold for side and tip highlights) and *Meadow* (light: pale grass, fern green). *Auto* follows the device. Practising in a dim room favours Forest.
- **Type:** a serif (Iowan Old Style / Palatino) for posture names and headings, which feels calmer. System sans for everything else. No web fonts.
- **Player:** one column on phones (circle, names, caption, collapsible full guidance, next up, big controls at thumb height). Two columns from 900 px wide (circle left, text right) for the office.
- **Guidance read aloud is optional** (Settings, on by default). When on, the caption shows each line as it's spoken. When off, the voice says only the posture's name and "Stay here for N breaths", a 6-second silent pause replaces the guidance as time to move into the posture, and the text stays in the collapsible Guidance panel. Changing this, or the breath pace, rebuilds the current session with the same seed so it still fits the chosen length. Without guidance, 20 minutes fits about two more postures.
- **The caption** shows the line being spoken. The full guidance and tip sit in a collapsible panel.
- **No reload mid-session.** When a new service worker takes over, limber reloads right away. Clearing waits until you leave the player.
- **History:** completed or ended sessions longer than a minute are recorded in localStorage, but v0 only shows the last one on the home screen.

## Not in v0 (ideas)

- Flows between sides (for example Warrior two → Reverse warrior → Side angle on the right, then all three on the left).
- Sun salutations as repeatable sequences, so long sessions don't run out of postures.
- Editing a proposed session (swap or remove a posture, change a hold).
- Focus options (hips, back, shoulders, energising or calming).
- Log screen, streaks, export/import, Drive backup (limber has these patterns ready to borrow).
- Media Session controls (lock-screen play/pause).
