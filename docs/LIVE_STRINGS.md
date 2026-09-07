# Live strings: architecture and acceptance

## Signal path

AudioInputHub opens an explicitly selected device. Guitar/bass may share a capture
stream only when they use distinct channels; they get separate splitter outputs,
analysers, trackers and scoring state. Speech processing is requested off, but the
browser/device can retain it: inspect the soundcheck's reported settings.

Soundcheck and gameplay use separate hub instances and never capture concurrently.
The setup panel pauses gameplay; closing soundcheck stops its diagnostic streams.
Start set opens live capture explicitly. All paths are muted and contain no
MediaRecorder, upload transport, recording buffer or transcript store.

Live analysis polls at 20 ms with power-of-two windows selected for approximately
42 ms of guitar or 85 ms of bass at the context's sample rate (rounded up). Pitch
uses the existing normalized-difference detector. Recent 20 ms level observations
help separate the envelope onset from the longer pitch-estimation window.

NoteTracker requires stable pitch, at least 90% periodicity, and a pitch within 40
cents of the nearest semitone. New attacks are envelope rises (7 dB or a gate
crossing); stable pitch transitions also form notes. It waits a full analysis
window after an attack to avoid scoring the previous note from an overlapping
buffer. Same-pitch retriggers have a minimum 110 ms envelope-rearm interval.
Confidence loss is debounced for 80 ms; its release time is the start of the loss.
These constants are provisional engineering choices, not hardware-derived tuning.

## Scoring and clock

The tracker does not see the chart, so it cannot choose a convenient expected note.
The judge uses exact pitch including octave. Extra and wrong-octave notes follow
the existing miss/extra scoring rules. Confirmed sustain is opt-in for audio
players; MIDI/pedal holds retain the original behavior.

A live hold must have matching pitch evidence through the end. Merely advancing
the song clock cannot award an audio sustain bonus. Evidence is conservatively
backdated by half an analysis window. Gated, clipped, muted or unconfident periods
do not confirm a hold; a long loss breaks it. This is still monophonic periodicity
analysis, not identification of every possible chord or noise signal.

Input timestamps map through the existing audible Web Audio clock. Global plus
per-player correction is applied in wall-clock milliseconds at every practice
speed. Audio miss expiry includes 260 ms of bounded detector lookback. This does
not widen the allowed human timing windows. An analysis stall beyond that budget
pauses play instead of filling in a burst of late scores.

## Lifecycle guarantees covered by tests

A session owns capture only while active or starting. Generation checks cancel
late permission results. Changing songs during startup cannot start the abandoned
song. Failure of one audio route closes the other; shared streams are reference
counted. Pause, resume, loop, disconnect, hidden-tab and autoplay paths are covered.
Autoplay never requests capture. Reports exclude audio samples and device IDs.

An unknown browser channel count is not treated as verified stereo during live
play: channel two is blocked until the stream reports its channel count. Reported
channels still do not identify physical jacks; both jacks could carry a copied or
mixed signal. Physical separation must be checked by playing one instrument at a
time while watching both meters.

## Hardware acceptance still outstanding

Using Scott's interface and real instruments, verify each MIDI device/channel and
each audio jack independently. Check silence, clean notes across the playing
range, repeated same-pitch plucks, legato, note changes, sustain/release, crosstalk,
clipping and unplug/replug. Measure practical timing variation at several tempos.
Record the model, drivers and browser settings in a local device report, not raw
audio unless a separate recording is explicitly requested.

Do not call the instrument path hardware-supported until these checks succeed.
Guitar chord recognition, automatic live-audio calibration and a full 88-key piano
view are not part of this milestone.

## Primary API references

- W3C Web Audio: https://www.w3.org/TR/webaudio-1.0/
- W3C capture/constraints: https://www.w3.org/TR/mediacapture-streams/
- Playwright CI: https://playwright.dev/python/docs/ci

These document APIs and test setup, not the accuracy of this game on live pickups.
