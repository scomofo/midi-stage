# MIDI Stage 0.9.0 — Chord Stage validation

## Completed local validation

298 Node unit checks pass. Coverage includes chord overlap, octave doubling,
common tones, exact pitches, release/pedal paths, mixed charts, Workshop metadata
integrity, all three Open Stage arrangements, piano guidance, progression, and
pitch-preserving audio preparation.

The audio tests measure synthetic 440 Hz signals at 50%, 75%, and 125% speed,
check output duration and stereo coherence, and exercise cancellation and memory
limits. These are numerical regression checks, not listening tests of music.

## Hosted gate

The first scoring/editor commit passed the complete hosted suite (462 checks).
The integrated change passed all 528 unit/browser/storage checks in workflow
35048250312, including standalone build reproducibility. Its screenshot upload
step failed on an unsupported relative path; that path is corrected here.
Browser acceptance covers the default chord song,
arrangement changes, octave doubling, early releases, CC64 holds, mixed passages,
Workshop chord editing, earned/saved stars, and a narrow/four-player guide. The
final follow-up adds preserved keyboard scrolling and checks centered 88-key
targets on a narrow screen. Its expected total is 530 checks; the hosted result
will be recorded on the PR when that workflow completes.

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
