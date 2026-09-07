# Quick MP3 import — implementation and limitations

## Common path

Song Workshop opens with auto generation enabled and the advanced editor collapsed.
Select the desired instruments (Drums default; Full band selects all four), choose
Easy/Normal/Busy density, and drop one local audio file. After decode, preparation
and pulse analysis, preview twelve seconds or choose Play now. The game enables
nonempty parts. Existing player device/channel/audio routes are retained; MIDI
and audio permissions are still opt-in and may need first-time setup.

The preview draws the backing waveform and all generated timing lanes. It is not
an audio spectrum, instrument separation, guitar tablature, or chord transcription.
Markers in the game are labelled HIT, not invented note names. Any valid MIDI
note on the assigned input can score; live audio requires one clean note in the
existing detector range. Short .07-second markers do not require a sustained pitch.

## Analysis algorithm

`src/song-analysis.js` separates pure DSP from its browser job wrapper. Audio is
reduced to 10 ms energy frames in three bands. Stereo combines energy to avoid
cancelling inverted channels. Positive energy differences produce attack candidates;
thresholds suppress quiet noise and a minimum separation bounds density. Pairwise
attack intervals suggest tempo candidates; phase coherence, alignment and beat
coverage refine a constant pulse. The estimator is not an instrument classifier.

Tempo fitting considers 55–220 BPM and at most 1,800 distributed attacks; manual
entry accepts 20–400 BPM. It needs at least six attacks spanning three seconds and
sufficient fit strength. Confidence labels are heuristic, not calibrated confidence
intervals. Audio with changing tempo or few clear attacks may fail or estimate
half/double tempo. No downbeat, time signature, key, chord or note pitch is inferred.

Auto-generation retains attack timestamps and varies density by role/difficulty.
It does not assert which instrument caused an attack. When no stable pulse can be
estimated, users can tap/enter a tempo and generate grid exercises only over active
audio regions. Energy gating can miss very soft notes or soft sections after loud
ones; manual editing remains available. No usable energy means no playable chart.

The prepared energy arrays are sent to a Blob Worker, not uploaded. Audio-buffer
preparation yields in bounded batches. Worker startup/error/timeout uses the same
bounded local algorithm as fallback. Its numerical fitting itself is synchronous;
no claim is made of zero stalls on every device. The original playback samples
are not transferred/detached. File decoding does not call AudioContext.resume(),
so an autoplay restriction cannot leave the import waiting for playback permission. A generation token prevents stale decode or worker
results replacing the current draft. Browser decoding cannot be interrupted at
the decoder level, but cancellation makes its eventual result inert.

Limits inherit the workshop: under 80 MB input, 0.25–600 seconds, up to 256 MB decoded.
Those checks occur after browser decoding; they cannot prevent every transient
allocation during decoding. No microphone is opened by analysis or preview.

## Chart semantics and persistence

Existing exact/manual/practice charts stay `version: 1`. Auto rhythm charts use
`version: 2`, `matching: "rhythm"`, and `origin: "audio-rhythm"`. The rest of the
schema (parts, seconds, duration, velocity, tempo, audio name) is unchanged. Stored
pitch numbers are inert serialization placeholders, never judged or shown as song
notes. Readers must reject unsupported versions. v0.4 rejects v2 rather than
silently interpreting placeholders as required pitches. v0.5 requires version 2
and rhythm matching together. MIDI-based generation remains version 1. Converting to fixed-pitch practice must
replace every populated rhythm part, so untouched placeholder pitches cannot
suddenly become exact-note targets.

The app chooses one ANY NOTE / PAD lane per player only for rhythm charts. Switching
to a normal chart restores that player's exact/arcade setting; no controller learn
maps are changed. Version 2 persists in JSON export and IndexedDB, including after
browser restarts. JSON still excludes the source audio file. Library storage is
origin/profile-specific and is not a substitute for portable backups.

Play now attempts to save chart + original audio unless disabled. It still starts
with an explicit warning when storage fails. Existing Save/Export controls remain.
Regenerating over manual edits asks permission and remains undoable.

## Test scope

Numerical tests use known synthetic pulses, silence, noise, sample-rate variations,
phase-inverted stereo and bounded long inputs. Browser checks use an original MP3
fixture, a real Worker, real audio graphs/decoding and simulated instrument devices.
Real IndexedDB process-restart checks are separate. None establishes accurate
transcription of commercial music, physical interface timing or hardware support.
