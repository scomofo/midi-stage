# MIDI Stage roadmap

## Quick MP3 highway milestone — implemented in v0.5

Import audio → local pulse/attack analysis → preview → direct play is implemented.
Generated charts explicitly judge rhythm, not the original instrument pitches.
Physical hardware and a diverse, legally supplied music corpus remain to be tested.

## Chord highway milestone — implemented in v0.6

Version-3 charts can store playable Keyboard/Guitar chord targets. Matching MIDI
groups simultaneous voicings automatically. MP3/audio import can estimate chord
changes locally, with an I–V–vi–IV assist enabled by default for the initial song
focus. The assist infers a major key/cycle phase when confidence is strong and
allows a manual key override. Roman numerals and chord names are rendered on the
highway.

Keyboard/MIDI players can be judged on pitch classes or exact authored MIDI pitches.
Live guitar uses the chord highway as a strum-timing target only; verifying that the
player actually fretted the displayed multi-string chord remains future work.
A diverse legally supplied song corpus and physical-device timing still need
validation.

## MIDI OUT / hardware milestone — implemented in v0.7

Web MIDI outputs can now receive authored guide notes, chord tones, hit-feedback note
or CC pulses, 24-PPQN MIDI Clock and transport messages. Player profiles persist by
manufacturer/name signature and support external-synth, feedback, hybrid and custom
routing. Non-zero practice starts send Song Position Pointer + Continue; pause/finish
clear scheduled sends and use scoped panic cleanup. An explicit panic control targets
all connected outputs and all channels. SysEx is disabled.

Browser/synthetic coverage is regression evidence only. Actual synths, drum modules,
LED controllers, MIDI interfaces and clock followers still require physical testing.
Device-specific feedback profiles can be added after their models and MIDI
implementations are known.

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

## Milestone 0.8 — 88-key keyboard experience

- Full piano-roll visualization
- Left/right hand ranges and fingering hints where authored
- Chord voicing and sustain-pedal feedback
- Difficulty reductions that preserve musical intent

## Milestone 0.9 — Band feel

- Shared crowd/energy meter
- Unison sections and band bonuses
- More responsive stage lighting and hit feedback
- Player-specific results and band summary

## Later

- Guitar chord recognition after single-note reliability is proven
- Expanded song authoring: tempo editing, stem workflow, transcription research
- Better stem/backing-track workflow
- Device-specific hardware profile presets after physical validation
- Native packaging
- Optional vocals
- Online play only after local latency and scoring are solid

## Validation rule

Do not call a hardware path supported until it has been exercised with a physical device. Synthetic/browser tests remain useful regression coverage but are not hardware certification.
