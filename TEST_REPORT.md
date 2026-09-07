# MIDI Stage v0.3 — Live Strings validation

## Executed result

**174 automated checks passed; zero JavaScript page errors in the browser suites.**
Run date: September 6, 2026. Command: `python tests/run.py --browser` (exit 0).
Raw output: [`tests/v0.3-validation.txt`](tests/v0.3-validation.txt).

| Suite | Passed | Method |
| --- | ---: | --- |
| Chart, MIDI routing and score core | 30 | Node test runner |
| Audio input and pitch detection | 22 | Synthetic samples and capture mocks |
| Live-string tracker, verified holds, routing and timing | 37 | Node deterministic unit tests |
| Existing browser gameplay | 19 | In-memory Chromium + simulated MIDI |
| Existing browser edge cases | 11 | In-memory Chromium |
| Soundcheck browser integration | 28 | Generated browser MediaStreams |
| Live-string browser integration | 27 | Generated two-channel MediaStreams + simulated MIDI |
| **Total** | **174** | **All suites run against v0.3** |

Environment: Node 22.16.0, Python 3.13.5, Playwright 1.57.0, Chromium 144.0.7559.96
on Linux. Browser tests are software simulations, not physical-device tests.

## What was exercised

The new browser suite sends generated audio through the application's actual
MediaStream source, channel splitter, analyser, pitch detector, note tracker and
gameplay judge. The four-player test independently scores MIDI drums and keys,
live-audio guitar, and live-audio bass. It does not inject precomputed pitch or hit
messages into the audio scoring path.

Tests reject wrong octaves and extras, break early guitar releases, award confirmed
bass sustains, and distinguish one continuously ringing note from two separate
plucks. A steady tone cannot earn two repeated chart hits. Other checks cover
confidence thresholds, pitch changes, quiet/noisy/clipped observations, adaptive
analysis windows, finite inputs, onset expiration, independent timing corrections,
exact-pitch matching, monophonic chart validation, and standard-tuning hints.

Capture lifecycle checks include shared-device/separate-channel routes, duplicate
channel rejection, unknown stereo metadata, mono/channel-two rejection, permission
denial, mid-start song changes, delayed permission, pause/resume, loop restart,
device interruption, hidden tabs and cleanup. Autoplay and merely opening setup
never start live gameplay capture. Live audio mode excludes MIDI/computer-key
shortcuts from that player's score. Soundcheck analysis remains separate.

The original gameplay regressions still exercise MIDI Learn, isolated device and
channel routing, keyboard chords, CC64 sustain, MIDI import, count-in, practice
loops, eligible score saving, demo exclusion, calibration and error handling.
Desktop and narrow layouts were rendered; the new live-input screenshots label
simulated inputs as TEST. No external page requests were observed in browser tests.

The standalone HTML was rebuilt from source. SHA-256:
`7c89c43936c7f3f429bda90eeb87c7a4907f6606cd1130e89adbfce907952d03`.
The new First Rehearsal MIDI export was also parsed back into four parts.

## Additional Mac verification

The 89 Node unit checks were rerun successfully on the authorized Mac with Node
20.20.2. Python 3.9.6 rebuilt the standalone HTML with the same SHA-256 shown above.
This is build/unit verification only; no microphone or MIDI hardware was acquired.

## Boundaries

Device enumeration, permissions, secure-context detection, MIDI messages and
local storage are mocked in relevant suites. Audio streams use real browser audio
graphs driven by synthetic oscillators, not OS-enumerated instruments. Browser
navigation to a localhost server is restricted in this execution environment;
integration fixtures inline the actual source rather than bypassing that policy.
This does not test the user's OS permission UI, drivers or real localhost workflow.

Not verified: Scott's interface make/model, jack mapping, physical channel
separation, MIDI controllers, actual guitar/bass attack reliability, gain, noise,
crosstalk, real input/output latency, or sustained four-player hardware performance.
Synthetic tests do not establish general chord/noise/effect rejection accuracy.

Not implemented: full guitar-chord recognition; automatic live-audio latency
calibration; full 88-key piano-roll presentation; vocals; online multiplayer;
native installers; commercial song licensing. Per-player correction is manual;
the existing global tap calibration uses MIDI/button taps. Long endurance,
cross-browser support and formal accessibility certification remain unverified.

The GitHub Actions workflow is included, but this local result is not itself an
Actions result. Consult the PR checks for the hosted run's status. Earlier v0.2
reports remain in `docs/V0.2_TEST_REPORT.md` and existing historical test logs.
