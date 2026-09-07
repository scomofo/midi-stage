# MIDI Stage 0.5.0 — Quick MP3 Highways validation

## Completed local regression

**334 automated checks passed** against the v0.5 standalone build. No JavaScript
page errors were reported by any browser suite.

| Suite | Passed | Environment |
| --- | ---: | --- |
| All chart/MIDI/audio/workshop/analysis unit tests | 175 | Node, synthetic data |
| Gameplay integration | 19 | Chromium, simulated MIDI |
| Completion and edge cases | 11 | Chromium |
| Audio soundcheck integration | 28 | Chromium, synthetic capture graphs |
| Live strings integration | 27 | Chromium, synthetic capture graphs |
| Original Song Workshop integration | 38 | Chromium, real MP3/WAV decoding; simulated storage |
| Quick MP3 import integration | 36 | Chromium, real MP3 decode and Worker; simulated MIDI/devices/storage |
| **Total** | **334** | **All listed suites passed locally** |

Reproduce with `python3 tests/run.py --browser`. The raw run is included in
`tests/v0.5-validation.txt`. Automatic generation is disabled intentionally in
legacy manual-import tests to preserve their original scope; the new suite tests
the default automatic path. Existing assertions were retained.

## New coverage

Known synthetic pulse trains test 60, 90, 96, 120, 137, 180 and 215 BPM, intro
alignment, 44.1/48/96 kHz samples, inverted stereo, silence, noise, continuous tones,
short clips, invalid input, density limits, and bounded ten-minute processing.
Passing reference tolerances do not establish accuracy on arbitrary mixed music.

The browser suite decodes an original 12-second MP3 and runs a real Blob Worker.
It exercises automatic four-part generation, cached regeneration, half/double
correction, waveform/marker preview, direct save/start, JSON round trips, source
reattachment and wrong-mode labels. Autoplay blocking is simulated with a suspended
context property and a resume promise that never resolves; decode must not call it.

Real generated two-channel Web Audio streams and simulated MIDI hit arbitrary
(non-placeholder) pitches through the actual live tracker and rhythm judges.
A ringing note cannot score repeatedly. Normal pitch/octave judgments remain
covered by the original tests. No microphone is acquired by import or preview.

Cancellation during decoding/analysis, a late result after a newer import, Worker
termination/fallback, invalid MP3, protected manual edits and storage failure are
exercised. A failed library save still allows Play now with an unsaved warning.
Desktop and narrow-screen layouts were rendered; screenshots use a synthetic test
song and simulated devices, not Scott's instruments.

## Real persistent storage: separate hosted gate

The extended real IndexedDB/Blob suite adds version-2 rhythm charts to the existing
process-restart checks. It requests **12 checks**, including preserving matching,
marker times and source MP3 across Chromium process restarts, plus deletion.
It requires file-origin navigation. That navigation is blocked by this local
execution environment's administrator policy, so it is not counted above.
No bypass was attempted. GitHub Actions runs this suite with the regular tests.

Expected hosted total is **346** if all suites pass. Consult the PR's actual
GitHub Actions check and follow-up validation comment for the observed result;
this section does not claim a pending hosted run has passed.

## Reproducible build

SHA-256 of `MIDI-Stage.html`:

`2adce1fd0b1bbbc45ad7abea09a30cbc88b9d53411aa05abd019d6c0398b794c`

CI runs `python3 build.py` and verifies the committed standalone file is unchanged.
All 175 Node unit checks passed on the authorized Mac. Python rebuilt the same
standalone HTML SHA-256 there. This verifies code/build behavior, not physical
instruments or interface latency.

## Boundaries

- Local browser tests use in-memory HTML, mocked device enumeration, permission
  responses and relevant storage APIs. They do not test Scott's hardware/drivers.
- Audio import is rhythm analysis, not instrument separation or pitch transcription.
  It does not identify original bass lines, guitar frets, piano notes or drum pieces.
- Tempo/phase confidence is heuristic, not a probability or detected bar downbeat.
  Diverse commercial/live recordings and a reference-chart corpus are not tested.
- Import decode does not resume audio, but real OS/browser permission UX and exact
  end-to-end hardware latency remain unverified. Live input still needs clean DI.
- Worker fitting has a bounded synchronous fallback; no guarantee of zero stalls
  on every device. Very large files may allocate memory before decoded-size checks.
- Real storage tests, when passed in CI, establish that tested browser/profile/origin
  only. User storage quotas, clearing and cross-origin library transfer still vary.
- No Godot port, native installer, full 88-key view, chord recognition, online play,
  streaming-link import, AI model downloads or cloud transcription are included.

See `docs/QUICK_IMPORT.md` and `docs/ENGINE_DECISION.md` for implementation contracts
and the native-client gates. Physical support must be validated with actual devices.
