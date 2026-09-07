# Song Workshop architecture and scope

## v0.5 addition

The default MP3 path now performs local rhythm analysis. Exact/manual charts remain
version 1; rhythm-only charts are version 2 with explicit matching metadata. See
[QUICK_IMPORT.md](QUICK_IMPORT.md) for the additional schema and scoring contract.
The original v0.4 operations below remain in the advanced editor.

## Modules

`src/workshop.js` is the pure chart model plus the small IndexedDB adapter. Its
validation, generation, MIDI mapping, note edits and history functions are usable
from Node. `src/workshop-ui.js` implements the modal, file picker/drop target,
track assignments, waveform/timeline editor, preview player and library controls.
`src/app.js` bridges validated projects into the existing `StageCore.makeChart`
path; generated highways use the same scoring and transport as other songs.
`build.py` inlines both modules into the standalone HTML. No runtime dependencies
or remote transcription services were introduced.

## Input semantics

MIDI files provide events. Standard MIDI formats 0 and 1 are accepted by the
existing parser; SMPTE and format 2 are rejected. The workshop preserves absolute
note times and the parsed tempo/beat map. Source-track suggestions are editable,
not a promise that every MIDI exporter names parts conventionally. Unsupported
percussion notes are reported when skipped. Chord reduction is an explicit choice.

Audio files provide backing, not separate note events. The practice generator
creates deterministic, constant-BPM exercises with chosen pitches. It does not
perform onset/pitch transcription, beat inference, source separation, fingering
inference or original-arrangement reconstruction. Tap BPM is a human timing aid.
A full-song transcription workflow remains future work.

The song's grid origin (`firstBeat`) and audio-file start (`audioOffset`) are
independent. Changing either does not move existing note events. Built MIDI charts
can be edited without losing their tempo map; changing the displayed BPM requires
confirmation before replacing that grid with a constant-tempo grid.

## Portable schema

`schema` is `midi-stage-chart`, `version` is `1`. The ID has a restricted `chart-...`
syntax. A project contains title, BPM, duration, firstBeat, audioOffset, audioName,
origin, four `{type, notes}` parts, a tempoMap and beat markers. Notes contain
`time`, `duration`, integer MIDI `pitch` and `velocity`; all times are in seconds.
The validator rebuilds a known-key object instead of trusting imported objects.
It rejects nonfinite/out-of-range values, invalid drum lanes, missing parts,
unsorted timing maps, out-of-bounds notes, unsupported versions and oversized files.
Identical time/pitch notes within a part are deduplicated after combining tracks.

Audio bytes and URLs are never part of chart JSON. The browser library separately
stores the validated project and an optional source Blob in one transaction.
A save resolves at transaction completion, not at request success. Quota/open/abort
failures are surfaced. Deletion requires a user action and confirmation.

The game song ID includes a deterministic chart-content hash so edited versions
have separate score keys. Library IDs remain stable so saving updates the same
local entry. Original built-in songs are copied into new chart IDs before editing.

## Lifecycle and testing

Opening Workshop stops the game and soundcheck inputs; preview is playback-only.
No microphone/MIDI permission is requested by imports, editing or preview. Closing,
Escape or hiding the tab stops preview. Generation tickets prevent a file decode
that completes after closing from replacing the draft. Saved-backing selection is
also ticketed so a late decode cannot replace another song's audio.

The local browser suite uses in-memory documents and simulated IndexedDB requests;
MP3/WAV decoding, AudioBuffers, transport and rendered charts are actual browser
implementations. A separate CI suite uses a fresh temporary Chromium profile with
real IndexedDB and Blob storage, closes the browser, relaunches it and checks the
restored library, audio and offsets. This does not use Scott's browser profile.
Neither suite validates actual instrument hardware or every codec/driver/browser.

The authoring environment blocks file-origin and localhost navigation by browser
administrator policy. This policy was not altered or bypassed. The real-persistence
suite is explicitly requested with `python tests/run.py --browser --storage` in
GitHub-hosted CI, not represented as a completed local test.

## API references

- [Web Audio specification: decodeAudioData and scheduled buffer playback](https://webaudio.github.io/web-audio-api/)
- [Indexed Database specification: structured values, transactions and persistence](https://w3c.github.io/IndexedDB/)

The backing library belongs to the current browser profile and origin. Clearing
site data or using another address/profile can hide or remove that collection.
Export chart JSON and keep original audio files for backups independent of it.
