# MIDI Stage roadmap

## Milestone 0.3 — Live strings become playable

- Route guitar and bass soundcheck analysers into gameplay
- Detect fresh plucks, note changes, held notes, and releases
- Score pitch + timing + sustain confidence
- Add separate guitar and bass latency offsets
- Show suggested string/fret positions for authored parts
- Reject low-confidence/noisy pitch instead of guessing
- Add a short four-instrument validation song
- Regression-test MIDI drums and keys alongside two audio players

## Milestone 0.4 — 88-key keyboard experience

- Full piano-roll visualization
- Left/right hand ranges and fingering hints where authored
- Chord voicing and sustain-pedal feedback
- Difficulty reductions that preserve musical intent

## Milestone 0.5 — Band feel

- Shared crowd/energy meter
- Unison sections and band bonuses
- More responsive stage lighting and hit feedback
- Player-specific results and band summary

## Later

- Guitar chord recognition after single-note reliability is proven
- Song-authoring/chart editor
- Better stem/backing-track workflow
- Hardware compatibility profiles
- Native packaging
- Optional vocals
- Online play only after local latency and scoring are solid

## Validation rule

Do not call a hardware path supported until it has been exercised with a physical device. Synthetic/browser tests remain useful regression coverage but are not hardware certification.
