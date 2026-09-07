# MIDI Stage — v0.4 / Song Workshop

A local rhythm game for MIDI drums, an 88-key MIDI-capable keyboard, and electric
guitar/bass through an audio interface. Original code, visuals and practice songs;
not affiliated with Rock Band or Harmonix. No account, cloud service, recording,
or audio uploads. The browser game has no runtime package dependencies.

**v0.4 adds Song Workshop: import MIDI/audio, create and edit highways, save a local
song library, and export portable chart JSON.** The v0.3 live single-note guitar/
bass scoring and MIDI drums/keys remain available. Actual instruments and physical
interface latency still need validation.

## Run it

Extract or clone this source, then run `python3 start.py` (`python start.py` on
Windows). Open the displayed localhost address in desktop Chrome. The Mac and
Windows launchers call the same Python server; Python 3 is required.

`MIDI-Stage.html` is the standalone build. Use the localhost launcher for instrument
permissions. `index.html` loads the separate source modules for development.

## Import songs and create highways

Open **Song Workshop** above the setlist.

### Matching MIDI → exact-note highways

Import a `.mid` or `.midi` file, assign each source track to Drums, Keyboard, Guitar,
Bass or Skip, then select **Build highways from MIDI**. Multiple tracks may feed one
instrument. Note times, pitches, velocities, tails and tempo changes are retained;
identical time/pitch duplicates are combined. Unsupported drum pitches are reported.
Use **All notes** to keep the original density, or thin fast runs for an easier
arrangement. Difficulty here changes the chart; the game's difficulty control
continues to change timing tolerance, not the composition.

**Reduce guitar/bass to single notes** is optional and destructive to chord voicings:
it keeps the upper guitar/lower bass tone at a chord onset and trims overlaps. This
makes suitable single-note charts for the existing live-audio scoring path. Without
reduction, imported chords remain editable but cannot be scored by the monophonic
live guitar/bass detector.

### Audio → backing track and editable beat-practice highways

Import an unprotected MP3/WAV (other formats depend on browser decoding). Set BPM,
**First beat**, and the instruments to generate, then choose **Generate selected
highways**. Tap BPM is available when you do not know the tempo. The generator uses
a constant 4/4 quarter-note beat grid: kick/snare/hi-hat exercises plus fixed-pitch
keyboard/guitar/bass exercises. Density and practice pitches are adjustable.

**This is not automatic instrument transcription.** An MP3/WAV does not supply the
actual guitar, bass, piano or drum notes in this version. Generated notes are
clearly labelled **Beat practice**. Import a matching MIDI or author the parts in
the editor for a faithful arrangement. No streaming-link import or stem separation
is provided, and no purchased or licensed commercial songs are bundled.

### Edit, preview and play

Click a blank timeline cell to place a note; click a note or use the note list to
select it. The numeric form edits time, pitch/drum, sustain and velocity. Use
Undo/Redo, grid snap, page/zoom controls, the lowest-pitch view setting and per-part
clear to refine the chart. **Preview from view** plays the backing audio, or the
synthesized chart when no file is attached. During preview, **Add note at playhead**
(or T outside text fields) places the selected pitch at the current/snap time.
Restart preview to hear changes in synthesized chart playback.

**Attach / replace audio** retains existing highways. Audio starts at is an
independent alignment offset in chart seconds: positive values delay the file;
negative values start it part-way through. First beat adjusts the authoring grid.
Changing timing does **not** stretch or move existing notes; regenerate a practice
chart or edit/quantize the part. Reducing song duration cannot silently delete notes.

**Save to library** retains the chart and, by default, its original audio file in
this browser's IndexedDB. Disable **Keep audio in this browser library** to save
only notes and timing. Save failures are reported rather than treated as success.
Saved songs appear in the setlist. **Use highways in game** loads the current draft
and enables its nonempty instrument parts, but does not itself save the draft.
Use **Watch demo** to inspect the highways without playing or capturing hardware.

**Export chart JSON** creates a `.midistage.json` file for backup/transfer. Audio is
not embedded: keep the matching source file and reattach it after JSON import.
Browser storage is tied to the browser/profile/origin and can be cleared. Use the
same launcher/address for the same local collection; exported backups are portable.
The supplied `songs/workshop-example.midistage.json` is an original practice chart.

Limits: audio below 80 MB, 0.25–600 seconds and at most 256 MB decoded; MIDI below
8 MB with the existing one-hour/60,000-note parser limits; chart JSON below 12 MB,
up to one hour and 60,000 notes. The editor retains at most 20 undo states. Imported
metadata is treated as text, and chart JSON never loads URLs or executes code.

See [docs/SONG_WORKSHOP.md](docs/SONG_WORKSHOP.md) for the schema, architecture and
validation boundaries.

## Play guitar and bass

1. Open **Audio soundcheck → Allow & find audio inputs**. Choose your interface and
   browser channel for each instrument. Use **Check guitar / Check bass** to verify
   levels, tuning and channel separation. Do not use a room microphone or a loopback
   feed of the game: backing audio can otherwise be mistaken for instrument input.
2. Click **Use live guitar in game** or **Use live bass in game**. Reopen the panel
   for the other role. Each button enables that player and selects audio mode.
   Alternatively choose **Play input → Live audio** under **Instrument setup**.
3. Select **First Rehearsal**, a 20-second original song with single-note guitar and
   bass, sustained notes, repeated plucks, keyboard notes and drums. Add the MIDI
   players in **Your lineup**, then assign their separate device/channel routes.
4. Click **Start set** and play after the count-in. The status strip shows detected
   notes, input level, the next note and suggested standard-tuning string/fret.
   Capture stops on pause, finish, disconnect, hidden tab or cancelled startup.

Choose clean direct guitar/bass signals and one note at a time. The app keeps input
playback muted; use your interface/amp monitoring to hear the instruments, and
headphones for the game. No specific interface model is assumed. Two audio players
must use independent inputs or verified exposed channels, never the same channel.

## What is scored

Live audio uses **exact pitch including octave**, attack timing and sustained-note
confidence. It detects new plucks and stable note changes (including legato).
One ringing note does not repeatedly hit future chart notes. An octave mistake is
not silently changed to the expected note. Quiet, low-confidence, clipped and muted
observations are not eligible note attacks.

Keyboard shortcuts and MIDI do not score a player set to live audio; switch that
player back to **MIDI / computer keys** for those input paths. MIDI Learn, CC64 pedal
support, import, practice loops and existing MIDI timing remain available.

Full chord recognition is **not** implemented. Chords, distortion, strong harmonics,
noise, crosstalk or mixed signals can still confuse a monophonic detector. Imported
chords/overlapping chart notes and out-of-range string parts are blocked with a
message rather than presented as playable polyphonic audio charts.

## Timing

**Instrument setup → Player correction (ms)** applies independently to all four
players, in addition to the global correction. Positive values compensate late
input. The results show each player's average timing after correction.

The tracker backdates an accepted attack to its observed onset, and allows bounded
processing lookback before calling a miss. These are software measures, not a
measurement of your interface latency. The global tap calibration remains a
MIDI/button exercise; there is no automatic live-audio latency calibration yet.
Changing player settings resets the set. Test at the headphones, interface gain
and tempo you will actually use.

## Development and tests

```sh
python3 build.py
python3 tests/run.py
# Optional browser regression suite:
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
python3 tests/run.py --browser
# Where browser file navigation is permitted, also verify persistent storage:
python3 tests/run.py --browser --storage
```

Node.js is required for tests, not for playing. Browser tests use Playwright and
Chromium. `CHROMIUM_PATH` can select an installed browser. GitHub Actions is
configured for those suites, an additional real IndexedDB/Blob persistence test
across browser process restarts, and a generated-build consistency check. Consult
the PR's checks for its actual run status.

See [TEST_REPORT.md](TEST_REPORT.md) for the executed validation and limitations,
[docs/LIVE_STRINGS.md](docs/LIVE_STRINGS.md) for architecture and hardware acceptance,
and [CHANGELOG.md](CHANGELOG.md) for the version history. Historical guidance and results are archived in `docs/V0.2_README.md`,
`docs/V0.2_TEST_REPORT.md`, `docs/V0.3_README.md`, and `docs/V0.3_TEST_REPORT.md`.

The private project repository is `scomofo/midi-stage`. See [ROADMAP.md](ROADMAP.md)
for subsequent milestones and [docs/IMPORT_VALIDATION.md](docs/IMPORT_VALIDATION.md)
for the original v0.2 import record.

## Next

Validate the real interface, drum module and keyboard, then refine detection using
those results. A full 88-key piano-roll experience, guitar chords, vocals, online
multiplayer, native packaging and licensed commercial songs remain future work.
