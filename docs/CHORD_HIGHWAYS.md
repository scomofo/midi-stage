# Chord Highways — v0.6

MIDI Stage chord highways are a separate playable layer for **Keyboard** and
**Guitar**. They do not replace the original note data in the chart.

## Two sources

### Matching MIDI

When an imported MIDI track contains two or more supported pitches starting within
35 ms, MIDI Stage attempts to name that voicing and stores it as a chord target.
Recognized templates include major, minor, dominant/minor/major seventh,
diminished, augmented, sus2, sus4 and power chords.

- **Arcade matching** accepts the required pitch classes in any octave.
- **Exact matching** requires the authored MIDI pitches for MIDI-sourced chords.
- A partial chord becomes one missed chord target, not one miss per tone.
- The original MIDI notes remain in the project for editing/export.

### MP3 / audio estimate

Audio chord labels are estimated locally from pitch-class energy in short windows.
No audio is uploaded and no model/service is contacted.

The result is intentionally described as an **estimate**. Dense mixes, distortion,
inversions, extended chords, key changes and sections outside the assumed harmonic
pattern can lower accuracy. Low-confidence labels should be reviewed.

## I–V–vi–IV assist

The initial chord workflow is optimized for songs containing the common
**I–V–vi–IV** progression. The assist is enabled by default during quick audio
import.

It evaluates all 12 major keys, four progression phases, and common one-, two- and
four-beat chord spans. A strong fit constrains labels to the four expected chords.
For C major this renders:

`I C  →  V G  →  vi Am  →  IV F`

If the user already knows the key, **Song key** can force the major key before
rebuilding. If the progression fit is weak, the analyzer falls back to the general
chord templates instead of forcing I–V–vi–IV.

A useful public reference set is Wikipedia's category **Songs containing the
I–V-vi-IV progression**. The category listed 73 pages when checked in September
2026. It is used only as a catalog/reference for future validation; MIDI Stage does
not download or redistribute those songs or their audio.

Reference:
https://en.wikipedia.org/wiki/Category:Songs_containing_the_I%E2%80%93V-vi-IV_progression

## Gameplay semantics

### 88-key MIDI keyboard

Estimated audio chords are judged by pitch class, so octave/inversion choice is
flexible as long as the required chord tones are present within the timing window.
MIDI-sourced chords may instead use exact authored MIDI pitches.

### Electric guitar through live audio

The highway shows the chord name and Roman numeral, but the current live guitar
path judges **strum timing only**. It does not claim to verify that the guitarist
fretted the displayed multi-string chord. This keeps the UI useful without turning
a monophonic pitch detector into an unreliable chord recognizer.

## Chart schema

Chord targets upgrade a chart to schema version 3. `chordHighways` is keyed by
`keys` and/or `guitar`; every target contains bounded time/duration, name, MIDI
pitches, derived pitch classes, confidence, source, and optional Roman numeral/key.

Existing compatibility is retained:

- version 1 — ordinary manual/MIDI pitch charts
- version 2 — explicit rhythm-only audio charts
- version 3 — charts that contain chord highways; they may also retain rhythm-only
  matching for their non-chord parts

## Validation boundary

Automated tests cover chord naming/grouping, schema round trips, strict/arcade
keyboard scoring, partial-chord misses, live-guitar strum timing, I–V–vi–IV key and
phase fitting, synthetic PCM progression recognition, and rejection of monophonic
pulse audio as a chord progression.

These tests are regression coverage, not proof of accuracy on commercial recordings
or certification of the user's physical instruments/interface. Real-song and
physical-hardware validation remain required.
