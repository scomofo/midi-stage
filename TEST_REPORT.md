# MIDI Stage 0.8.0 — Hardware Onboarding validation

## Completed local validation

**218 Node unit checks pass** on the authorized Mac. The standalone build regenerates
from source and `git diff --check` is clean. The ten new onboarding model checks cover
role-name suggestions, connected/missing/audio status, per-player calibration math,
readable report fields, clock-output resolution, and removal of raw browser device IDs.

The existing MIDI OUT, chord, input, audio, Song Workshop and analysis units remain
part of the same 218-check run.

## Browser/hosted gate

`tests/onboarding.browser.py` adds **17 browser checks** to the standard GitHub Actions
suite. It opens the real five-step wizard with simulated MIDI inputs/outputs and checks:

- opening onboarding does not request permission before the user presses Connect;
- Web MIDI permission keeps SysEx disabled;
- discovery displays MIDI IN/OUT labels;
- playing a drum pad and keyboard key binds the actual input and detected channel;
- External synth / feedback profiles and MIDI Clock settings persist;
- the wizard test-output button emits MIDI data;
- manual per-player correction persists;
- role calibration hands off to the named calibration dialog and returns to the wizard;
- the summary reflects routes and finish stores the onboarding completion marker;
- no JavaScript page errors occur.

The hosted runner also repeats all previous browser suites and the real
IndexedDB/process-restart storage gate. With the previous 408-check baseline, ten new
unit checks and 17 onboarding browser checks, the expected hosted total is **435** if
the complete workflow passes. This file does not claim that pending hosted result.

## Reproducible build

`python3 build.py` must reproduce the committed `MIDI-Stage.html`. CI verifies that
with `git diff --exit-code -- MIDI-Stage.html` after all tests.

## Product boundaries

- Browser/device labels and simulated ports are not physical-device certification.
- The role-specific click test includes human response and the audible monitoring path;
  it does not isolate USB MIDI, audio interface or OS driver latency.
- Guitar/bass audio setup still uses Audio soundcheck and manual player correction.
- Generic MIDI Note/CC feedback does not guarantee LED behavior on a real controller.
- SysEx remains disabled. The wizard does not install drivers or access firmware.
- Exported onboarding reports omit raw browser MIDI IDs and audio samples.

See `docs/HARDWARE_ONBOARDING.md` and `docs/MIDI_OUT.md`.
