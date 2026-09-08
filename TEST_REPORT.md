# MIDI Stage 0.7.0 — MIDI OUT / Hardware Profiles validation

## Completed local validation

**208 Node unit checks pass** on the authorized Mac. The standalone `MIDI-Stage.html`
rebuilds from source and `git diff --check` is clean. This includes the existing chord,
MIDI-input, live-audio, Song Workshop and import suites plus new MIDI-output coverage.

New unit coverage verifies stable output signatures, SysEx rejection, timestamped safe
sends, queue clear/panic behavior, external guide-note planning, chord-tone guide
output, refusal to invent rhythm-chart pitches, note/CC hit feedback, 24-PPQN clock,
tempo-changing beat grids, Song Position Pointer, Start/Continue/Stop, and disconnected
saved-output handling.

## Browser/hosted gate

`tests/hardware.browser.py` is included in the standard browser runner. It uses two
simulated MIDI inputs and two simulated MIDI outputs while exercising the real
Instrument Setup UI, Web Audio song clock, score callbacks and session lifecycle. It
checks output enumeration, saved profiles, test notes, clock, guide output, feedback,
Stop/panic cleanup, resume/Continue, output disconnection, and absence of SysEx.

The complete GitHub Actions run also executes all pre-existing browser suites and the
real IndexedDB/process-restart storage suite. Hosted totals are intentionally not
claimed in this file until that PR run completes.

## Safety and product boundaries

- Web MIDI is requested with `sysex:false`; the MIDI OUT layer independently rejects
  messages beginning with SysEx status F0.
- Normal session cleanup only clears outputs configured by MIDI Stage. The explicit
  PANIC control intentionally targets every connected output and all 16 channels.
- Generic Note/CC feedback does not guarantee LED behavior on any particular device.
- Guide notes from MP3 chord charts may reflect heuristic chord estimates. Plain
  rhythm-only MP3 charts send no invented guide pitches.
- Automated MIDI ports are simulated. No physical synth, drum module, keyboard,
  controller, MIDI interface or clock follower has been certified by this test run.
- Browser/OS timing, USB MIDI driver behavior and physical round-trip latency remain
  unmeasured.

See `docs/MIDI_OUT.md` for the output protocol and profile contract.
