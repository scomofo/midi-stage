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

## Hardware onboarding milestone — implemented in v0.8

A five-step wizard now discovers MIDI ports, identifies player roles from real incoming
MIDI events, routes guitar/bass users to Audio soundcheck, configures optional MIDI
OUT/Clock profiles, launches per-player MIDI timing calibration, and saves a sanitized
local hardware profile report. Advanced routing remains available separately.

The software path is tested with simulated ports. The next hardware gate is to run the
wizard on the actual drum kit, 88-key keyboard, audio interface and any MIDI OUT gear,
record the detected labels/channels, and validate repeatable timing before adding
named device presets.

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

## Chord Stage milestone — implemented in v0.9

- Trustworthy chord attacks, octave doubling, common tones, holds and pedal releases.
- Mixed chord/single-note charts and consistent source-note/chord editing.
- Original 90-second Open Stage song with three musical difficulty arrangements.
- Stable-range/88-key piano guide, authored hand ranges, missing/wrong-tone feedback,
  and upcoming changes. Fingering numbers and a full scrolling piano roll remain future work.
- Pitch-preserving practice audio, separate backing/monitor/guide levels, and
  per-player synthesized guide response. Imported mixes are not separated stems.
- Shared energy, cooperative phrase bonuses, stars, local records and Exact mastery.

### Next acceptance and content gates

Run `docs/CHORD_ACCEPTANCE.md` on the real 88-key keyboard and pedal, then listen to
Open Stage at all three difficulty levels and imported audio at 50/75/100% tempo.
Expand the dedicated chord repertoire after that first arrangement passes a musician's
play-through. The four earlier generated practice/validation songs remain available;
they are not a verified chord-song catalog. Add artist-quality sounds and true stems
as separate content work. Do not equate unit tests with an enjoyable finished game.

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
