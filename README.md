# MIDI Stage — v0.3 / Live Strings

A local rhythm game for MIDI drums, an 88-key MIDI-capable keyboard, and electric
guitar/bass through an audio interface. Original code, visuals and practice songs;
not affiliated with Rock Band or Harmonix. No account, cloud service, recording,
or audio uploads. The browser game has no runtime package dependencies.

**v0.3 adds live single-note guitar and bass scoring.** MIDI drums and keyboard
remain available in the same four-player band. Physical instrument compatibility
has not been verified: automated tests use simulated MIDI and generated audio.

## Run it

Extract or clone this source, then run `python3 start.py` (`python start.py` on
Windows). Open the displayed localhost address in desktop Chrome. The Mac and
Windows launchers call the same Python server; Python 3 is required.

`MIDI-Stage.html` is the standalone build. Use the localhost launcher for instrument
permissions. `index.html` loads the separate source modules for development.

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
```

Node.js is required for tests, not for playing. Browser tests use Playwright and
Chromium. `CHROMIUM_PATH` can select an installed browser. GitHub Actions is
configured for the same unit/browser suites and a generated-build consistency
check; consult the PR's checks for its actual run status.

See [TEST_REPORT.md](TEST_REPORT.md) for the executed validation and limitations,
[docs/LIVE_STRINGS.md](docs/LIVE_STRINGS.md) for architecture and hardware acceptance,
and [CHANGELOG.md](CHANGELOG.md) for the version history. Historical v0.2 guidance
and results are archived in `docs/V0.2_README.md` and `docs/V0.2_TEST_REPORT.md`.

The private project repository is `scomofo/midi-stage`. See [ROADMAP.md](ROADMAP.md)
for subsequent milestones and [docs/IMPORT_VALIDATION.md](docs/IMPORT_VALIDATION.md)
for the original v0.2 import record.

## Next

Validate the real interface, drum module and keyboard, then refine detection using
those results. A full 88-key piano-roll experience, guitar chords, vocals, online
multiplayer, native packaging and licensed commercial songs remain future work.
