# MIDI Stage

A local multiplayer rhythm game built for real instruments: MIDI electronic drums, an 88-key MIDI keyboard, electric guitar, and electric bass.

The project is inspired by the band-performance loop of rhythm games, but uses original code, visuals, and music. It is not affiliated with Rock Band or Harmonix.

## Prototype status

A playable v0.2 prototype has already been built and validated outside this repository. It currently includes:

- Web MIDI input and per-player device/channel routing
- MIDI Learn for drum pads and keys
- 1–4 local player note highways
- Timing judgments, streaks, multipliers, accuracy, sustains, and practice loops
- MIDI-file import and optional backing audio
- Guitar/bass audio soundcheck with input selection, channel routing, meters, clipping warnings, and single-note tuning
- Local-only operation; no account or audio uploads

This repository is now the canonical home for continued development. The first implementation PR after initialization will bring the playable prototype into a maintainable source layout and then add live guitar/bass scoring.

## Hardware target

- MIDI electronic drum kit
- 88-key MIDI keyboard
- Electric guitar through an audio interface / USB audio path
- Electric bass through an audio interface / USB audio path

Exact interface and controller models will be documented after physical-device validation.

## Next milestone

Live single-note guitar/bass scoring with attack detection, pitch confidence, held-note scoring, and independent latency correction—without regressing MIDI drums or keys.

See `ROADMAP.md` for the development sequence.
