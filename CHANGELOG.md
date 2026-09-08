# 0.6.0 — Chord Highways

- Added version-3 chord-highway metadata for Keyboard/Guitar charts.
- Matching MIDI groups simultaneous notes into named chord targets while preserving the original note data.
- Added local MP3 chord estimation using pitch-class energy and confidence-scored chord templates.
- Added default I–V–vi–IV assist with automatic major-key, phase and common chord-span fitting plus manual key override.
- Chord previews and gameplay show Roman numerals with chord names (for example `I C`, `V G`, `vi Am`, `IV F`).
- MIDI keyboard chord scoring supports arcade pitch-class matching and exact authored MIDI voicings. Partial chords count as one missed target.
- Live electric-guitar chord highways score strum timing only; the app does not claim reliable multi-string chord recognition from audio.
- Added sustained chord blocks, dedicated chord scoring tests, PCM progression tests and browser integration coverage.
- Existing rhythm-only audio charts remain version 2; ordinary manual/MIDI charts remain version 1 unless chord targets are present.

# 0.4.0 — Song Workshop

## 0.5.0 — Quick MP3 Highways

- Automatic local pulse/attack analysis after audio import, progress and cancellation.
- Compact instruments/difficulty → import → 12-second waveform/marker preview → Play now flow.
- Explicit rhythm-only scoring for MIDI drums/keys and clean live guitar/bass; no fabricated pitches.
- Cached regeneration, half/double tempo, tap fallback, silent-gap filtering, and guarded edits.
- Direct-start with optional chart/audio save; failed saving does not block playing.
- Version 2 rhythm chart semantics; version 1 MIDI/manual charts remain compatible.
- Worker execution with bounded fallback and protection against late cancelled imports.
- Extended numerical, browser, and real-storage regression coverage.
- Native-engine decision documented; no Godot port or full mixed-song transcription in this release.

- MIDI track-to-instrument assignment and editable highway generation, with optional
  density reduction and explicit single-note guitar/bass reduction.
- Local audio import, waveform/timing tools and labelled beat-practice generation.
- Four-part note editor: pitch, timing, sustain, velocity, snapping, undo/redo,
  playback preview and playhead note placement.
- IndexedDB chart/audio library, per-song backing restoration, schema-validated
  chart JSON import/export and editable original-song copies.
- Imported MIDI no longer removes other imported/custom entries from the setlist.
- New pure-model, browser workflow and separate real-persistence CI tests.
- Audio-to-exact-instrument transcription remains out of scope; practice patterns
  are not represented as transcriptions.

# Changes

## 0.3.0 — Live Strings

Added opt-in monophonic audio scoring for guitar and bass, independent MIDI/audio
mode selection, attack and stable-pitch tracking, exact-octave matching, verified
sustain/release, per-player manual timing corrections, live meters/next-note and
standard-tuning fret hints, and the four-part First Rehearsal practice song.

Added shared-channel rejection and startup/disconnect/pause/loop cleanup. Preserved
MIDI drums, keys, pedal and existing game behavior. Added a cross-platform test
runner and pinned GitHub Actions workflow. Chord recognition and automatic audio
calibration are not implemented; physical hardware remains untested.

## 0.2.0 — Audio Soundcheck

Added an opt-in audio device picker, per-role guitar/bass channel checks, input
meters, clipping warning, adjustable noise gate, single-note tuner, local device
report and capture lifecycle cleanup. MIDI gameplay is unchanged. Ordinary
instrument audio is not yet scored. The user's physical hardware has not been
tested. Added 49 checks; reran all 60 existing checks for a total of 109 passing.

## 0.1.0 — Playable MIDI prototype

Local MIDI/keyboard rhythm gameplay, four instrument parts, authored practice
tracks, MIDI Learn, import, sustained-note scoring, calibration and local co-op.
