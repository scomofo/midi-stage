# MIDI Stage 0.9.0 — Chord Stage validation

## Completed local validation

297 Node unit checks pass. Coverage includes chord overlap, octave doubling,
common tones, exact pitches, release/pedal paths, mixed charts, Workshop metadata
integrity, all three Open Stage arrangements, piano guidance, progression, and
pitch-preserving audio preparation.

The audio tests measure synthetic 440 Hz signals at 50%, 75%, and 125% speed,
check output duration and stereo coherence, and exercise cancellation and memory
limits. These are numerical regression checks, not listening tests of music.

## Hosted gate

The first scoring/editor commit passed the complete hosted suite (462 checks).
The final integrated change adds browser acceptance for the default chord song,
arrangement changes, octave doubling, early releases, CC64 holds, mixed passages,
Workshop chord editing and a narrow/four-player guide. The final hosted result is
pending; this report will be updated after the workflow finishes.

CI also runs the existing import, routing, audio-input, calibration, MIDI OUT,
onboarding, and real IndexedDB/process-restart suites. Browser screenshots are
retained as workflow artifacts to support visual review.

## Reproducible build

`python3 build.py` regenerates `MIDI-Stage.html`. CI requires a clean diff after
rebuilding the committed standalone file.

## Manual acceptance still required

Follow `docs/CHORD_ACCEPTANCE.md` with a real keyboard and sustain pedal. Validate
physical timing and MIDI OUT behavior with the actual devices. Listen for practice
stretch artifacts and play through each authored arrangement. Live guitar chord
input still verifies strum timing only. One authored chord song and four earlier
practice/validation songs are not a finished commercial song catalog.
