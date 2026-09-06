# MIDI Stage

A local multiplayer rhythm game built for real instruments: MIDI electronic drums, an 88-key MIDI keyboard, electric guitar, and electric bass.

The project is inspired by the band-performance loop of rhythm games, but uses original code, visuals, and music. It is not affiliated with Rock Band or Harmonix.

## Current state

The imported v0.2 prototype includes:

- Web MIDI input and per-player device/channel routing
- MIDI Learn for drum pads and keys
- 1–4 local player note highways
- Timing judgments, streaks, multipliers, accuracy, sustains, and practice loops
- MIDI-file import and optional backing audio
- Guitar/bass audio soundcheck with input selection, channel routing, meters, clipping warnings, and single-note tuning
- Local-only operation; no account or audio uploads

The next milestone is live single-note guitar/bass scoring, followed by a full 88-key piano presentation and richer band/stage feedback.

## Reconstruct the imported prototype

The v0.2 self-contained HTML is stored as gzip/base64 parts in `artifacts/v0.2/parts/` so the original prototype can be carried into this repository losslessly.

```bash
./scripts/unpack-v0.2.sh
python3 -m http.server 8765 -d dist
```

Then open `http://localhost:8765/MIDI-Stage-v0.2.html` in desktop Chrome and grant MIDI/audio permissions when needed.

## Hardware target

- MIDI electronic drum kit
- 88-key MIDI keyboard
- Electric guitar through an audio interface / USB audio path
- Electric bass through an audio interface / USB audio path

Exact interface and controller models will be documented after physical-device validation.

## Development priorities

See `ROADMAP.md`.
