# MIDI Stage roadmap

## Quick MP3 highway milestone — implemented in v0.5

Import audio → local pulse/attack analysis → preview → direct play is implemented.
Generated charts explicitly judge rhythm, not the original instrument pitches.
Physical hardware and a diverse, legally supplied music corpus remain to be tested.

## Higher-fidelity song parts — future implementation

Evaluate instrument separation and transcription as a separate, optional pipeline.
Require per-instrument precision/recall and timing benchmarks against reference
MIDI, no invented notes in silence, uncertainty flags, editable outputs, and
explicit compute/download/privacy requirements. No model or service is included
in v0.5. Rendering-engine migration does not substitute for transcription.

## Native-engine gate — Godot permitted, not yet adopted

Keep chart/analysis data portable. A native prototype must demonstrate equal or
better measured timing, MIDI routing, separate guitar/bass audio inputs, local
imports, cancellation, persistence and accessible UI before replacing the browser
client. See docs/ENGINE_DECISION.md. No existing PR was merged for this work.

## Milestone 0.3 — Live strings become playable

Implementation is included in the v0.3 Live Strings PR. Physical-device validation
is still pending. Timing correction is manual; automatic audio calibration and
full chord recognition are not part of this milestone.

- Route guitar and bass soundcheck analysers into gameplay
- Detect fresh plucks, note changes, held notes, and releases
- Score pitch + timing + sustain confidence
- Add separate guitar and bass latency offsets
- Show suggested string/fret positions for authored parts
- Reject low-confidence/noisy pitch instead of guessing
- Add a short four-instrument validation song
- Regression-test MIDI drums and keys alongside two audio players

## Milestone 0.4 — Song import and highway authoring

Implemented in the Song Workshop PR: MIDI/audio import, editable instrument
highways, beat-practice exercises, preview, local library and chart JSON backups.
This is not full audio transcription. Actual instrument trials remain pending.

## Milestone 0.5 — 88-key keyboard experience

- Full piano-roll visualization
- Left/right hand ranges and fingering hints where authored
- Chord voicing and sustain-pedal feedback
- Difficulty reductions that preserve musical intent

## Milestone 0.6 — Band feel

- Shared crowd/energy meter
- Unison sections and band bonuses
- More responsive stage lighting and hit feedback
- Player-specific results and band summary

## Later

- Guitar chord recognition after single-note reliability is proven
- Expanded song authoring: tempo editing, stem workflow, transcription research
- Better stem/backing-track workflow
- Hardware compatibility profiles
- Native packaging
- Optional vocals
- Online play only after local latency and scoring are solid

## Validation rule

Do not call a hardware path supported until it has been exercised with a physical device. Synthetic/browser tests remain useful regression coverage but are not hardware certification.
