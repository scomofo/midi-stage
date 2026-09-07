# MIDI Stage v0.4 — Song Workshop validation

## Local result

**259 automated checks passed, with zero JavaScript page errors in the browser
suites.** Command: `python tests/run.py --browser`. Raw output is retained in
`tests/v0.4-validation.txt`.

| Suite | Passed | Method |
| --- | ---: | --- |
| Existing chart/MIDI/scoring core | 30 | Node |
| Existing audio input and pitch detection | 22 | Synthetic samples and mocks |
| Existing live-string tracker and scoring | 37 | Node |
| New workshop model, validation and editor operations | 47 | Node |
| Existing browser gameplay | 19 | In-memory Chromium |
| Existing browser edge cases | 11 | In-memory Chromium |
| Existing soundcheck integration | 28 | Generated browser MediaStreams |
| Existing live-string integration | 27 | Generated audio + simulated MIDI |
| New workshop integration | 38 | In-memory Chromium, real audio decoding, simulated IndexedDB |
| **Local total** | **259** | **136 unit + 123 browser checks** |

## Workshop coverage

MIDI import is exercised through an actual four-track MIDI fixture and the source
track assignment controls, preserving tempo and pitch through editable highways.
Unit tests cover route suggestions, merged tracks, supported drum aliases, skipped
percussion warnings, density reduction and explicit monophonic reduction. The
model rejects malformed, unsupported, over-limit and out-of-range projects.

Real MP3 and WAV files are decoded by Chromium's Web Audio implementation. Audio
imports start with empty note parts, not fabricated transcriptions. The practice
builder produces four independently editable exercise highways at the selected
BPM/first beat, with its non-transcription label intact. Tests author and edit
notes by form, canvas and live playhead; exercise sustain, delete, quantize,
undo/redo; and reject duration changes that would truncate notes.

The browser suite previews through the actual playback transport, saves chart and
optional audio Blob, exports a real JSON download, reimports chart-only JSON,
reattaches backing, publishes all four parts to the game, and completes an autoplay
session through the existing gameplay judge. Save failure is simulated after the
request succeeds but before transaction commit to verify that failure is surfaced.
Untrusted titles render as text. Desktop/narrow layouts are checked and rendered.
Closing stops preview immediately, and late decode completion cannot replace the
draft after closing. Workshop import/edit/preview makes no capture requests.

## Standalone build

`python build.py` rebuilds the complete HTML from the modular source.
SHA-256 of `MIDI-Stage.html`:

`0cee9841b258885b808edcd1ca4efed5aea754fe48911caa942fe005fbd11156`

## GitHub-hosted storage verification

CI additionally requests `--storage`, which runs seven checks using a fresh
Chromium profile and **real IndexedDB/Blob storage**. The test closes Chromium,
restarts it on the same temporary profile, then verifies the saved chart, decoded
backing, audio alignment, editable arrangement and deletion. The intended hosted
total is **266**; consult the PR's checks for the actual completed run status.
This is separate from the 259 completed local checks and never uses the user's
browser profile.

## Mac build and unit verification

All **136 Node unit checks passed** again on the authorized Mac with Node
20.20.2. Python 3.9.6 rebuilt the same standalone HTML SHA-256 shown above.
This verified build reproducibility and unit behavior, not physical instruments.

## Boundaries

The authoring environment's browser administrator policy blocks file-origin and
localhost navigation. The policy was not altered or bypassed. Local integration
uses in-memory documents. Its IndexedDB request/transaction implementation is
simulated; the real-persistence suite is reserved for an environment permitting
normal file navigation, such as GitHub-hosted CI.

Existing hardware suites simulate devices, permission responses, MIDI messages
and input signals. Actual guitar/bass pickups, the audio interface, drum module,
88-key keyboard, OS permission dialogs, drivers and physical latency remain
unverified. No real instrument recording or capture was performed for this work.
MP3/WAV coverage does not establish every codec, damaged file or browser variant.
Long-session endurance, exhaustive accessibility and cross-browser certification
are not claimed. The native launchers have not been retested on Windows.

Audio-to-four-instrument transcription, stem separation, streaming URL import,
automatic tempo inference and full guitar-chord recognition are not implemented.
Audio-generated highways are beat-practice exercises, not original-song notes.
JSON exports omit audio; preserve source audio files separately. Browser storage
can be cleared and is not a substitute for exported backups.

Historical v0.2/v0.3 reports are retained in `docs/` and `tests/`.
