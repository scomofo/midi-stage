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
