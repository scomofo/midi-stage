# MIDI Stage — v0.6 / Chord Highways

A local rhythm game for MIDI drums, an 88-key MIDI-capable keyboard, and electric
guitar/bass through an audio interface. Original code, visuals and practice songs;
not affiliated with Rock Band or Harmonix. No account, cloud service, recording,
or audio uploads. The browser game has no runtime package dependencies.

**v0.6 adds playable chord highways on top of the v0.5 quick MP3 flow.** Matching
MIDI groups simultaneous notes into chord targets. MP3/audio imports can estimate
major/minor chord changes locally, with an I–V–vi–IV assist enabled by default for
pop-progressions such as `I C → V G → vi Am → IV F`. Keyboard/MIDI can score chord
tones; live guitar chord charts score strum timing without claiming reliable chord
identity. Actual instruments, real recordings, and physical interface latency still
need validation.

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

**Reduce guitar/bass to single notes** remains optional and destructive to chord
voicings. Leave it off to preserve simultaneous MIDI notes: recognized voicings are
grouped into version-3 chord targets for Keyboard/Guitar highways. MIDI keyboard
players may use arcade pitch-class matching or exact authored MIDI pitches. Live
guitar uses the same chord labels/highway but judges the strum attack only because
the monophonic audio detector does not verify multi-string chord identity.

### MP3 / WAV → automatic rhythm highways

In **Song Workshop**, choose the instruments and difficulty (or **Full band**), then
drop an MP3 or choose **Import song / chart**. Automatic generation is on by default.
A local analyzer estimates the pulse and finds rhythmic attacks. There is progress,
cancellation, and a waveform/marker preview. Choose **Preview 12 seconds**, then
**Play now**. This saves the chart and audio locally by default and starts the game
without another Start click. Disable **Save song & audio locally** to just play.

**This mode scores RHYTHM, not the song's actual notes.** Each selected instrument
gets a timing lane: hit any MIDI pad/key, or play any clean single guitar/bass note
at a marker. Audio players still require confident single-note detection; a ringing
note cannot score future markers repeatedly. These are not separated instrument
parts, identified drum sounds, chords, or a Rocksmith-style transcription.

Normal auto charts place markers at detected attacks. Easy reduces their density;
Busy keeps more. Long silent gaps are left empty. Half/double-tempo and Tap BPM
controls help when the estimated pulse feels wrong. Density and tempo changes use
cached analysis; they do not decode the song again. Preview and **Rebuild with these
settings** apply corrections. If there are too few reliable attacks or no stable
pulse, the app asks for a tempo rather than making up a playable transcription.
Manual-tempo fallback creates rhythm-grid exercises within active audio regions.
A completely silent file cannot produce a usable chart.

### MP3 chord highways and I–V–vi–IV assist

Enable **Estimate chord highways for Keys / Guitar** during quick audio import. The
analyzer converts short audio windows to pitch-class energy and proposes chord
labels locally. **I–V–vi–IV assist** is enabled by default: it searches all major
keys, cycle phase and common one/two/four-beat chord spans, then constrains a strong
fit to `I → V → vi → IV`. Choose a major key manually when you already know it.
The preview displays both the Roman numeral and chord name.

This is a *guided chord estimate*, not source separation or authoritative
transcription. If the progression fit is weak, the analyzer falls back to general
major/minor/seventh/sus/diminished/augmented chord templates. Low-confidence labels
are visually subdued and should be reviewed. Songs that only use I–V–vi–IV in one
section, modulate, use inversions/extensions, or have dense/distorted mixes may need
manual correction or matching MIDI.

For estimated chord charts, an 88-key MIDI keyboard scores the required pitch
classes so any octave/inversion containing the displayed chord tones can work.
Chord targets imported from MIDI can instead require exact authored MIDI pitches
when Exact matching is selected. A partial chord is one missed chord target, not
three independent misses. Live electric guitar displays the same `I/V/vi/IV` chord
labels but scores one clean strum attack at the target time; it does **not** claim
that the audio input played the displayed chord correctly.

The confidence badge is a heuristic, not an accuracy guarantee. First beat is an
estimated pulse phase, not a detected bar downbeat. Live/drifting tempo, rubato,
soft intros and dense mixes may need manual editing or matching MIDI.

All analysis runs locally, without accounts, audio uploads, API keys or model
files. A browser Worker handles pulse fitting; audio preparation yields between
bounded batches. A Worker-blocked environment has a bounded local fallback.
Cancelling, closing or hiding the panel keeps the previous chart; late results
cannot replace a newer import. Saving failure produces an unsaved warning and
still permits playing. Export the chart and keep the original audio as a backup.

Open **Advanced editor** for exact timing, note editing, MIDI track assignments or
the local library. The older fixed-pitch beat-practice generator remains there and
is explicitly an exercise, not a transcription. **Load without starting** loads a
rhythm arrangement into the game for input setup or Watch demo without starting it.

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

For MIDI/manual pitch charts, live audio uses **exact pitch including octave**,
attack timing and sustained-note confidence. Auto MP3 rhythm charts instead accept
any clean single note in the instrument detector range and judge its attack timing.
Changing to a pitch chart restores the player's existing matching settings. It detects new plucks and stable note changes (including legato).
One ringing note does not repeatedly hit future chart notes. An octave mistake is
not silently changed to the expected note. Quiet, low-confidence, clipped and muted
observations are not eligible note attacks.

Keyboard shortcuts and MIDI do not score a player set to live audio; switch that
player back to **MIDI / computer keys** for those input paths. MIDI Learn, CC64 pedal
support, import, practice loops and existing MIDI timing remain available.

Live-audio **chord identity recognition is not implemented**. Chord highways and
labels are implemented, but guitar audio scores their strum timing only. Distortion,
strong harmonics, noise, crosstalk or mixed signals can still confuse the underlying
single-note/attack detector. Use matching MIDI for authoritative chord pitches.

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
`docs/V0.2_TEST_REPORT.md`, `docs/V0.3_README.md`, `docs/V0.3_TEST_REPORT.md`, `docs/V0.4_README.md`, and
`docs/V0.4_TEST_REPORT.md`.

The private project repository is `scomofo/midi-stage`. See [ROADMAP.md](ROADMAP.md)
for subsequent milestones and [docs/IMPORT_VALIDATION.md](docs/IMPORT_VALIDATION.md)
for the original v0.2 import record.

## Engine direction

This release remains the working browser game; it is **not a Godot port**. The
analysis result and chart JSON are independent of the renderer. See
[docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md) for the native-engine evaluation
and the input/timing gates before replacing the current client.

## Next

Validate the real interface, drum module and keyboard, then refine detection using
those results. A full 88-key piano-roll experience, guitar chords, vocals, online
multiplayer, native packaging and licensed commercial songs remain future work.
