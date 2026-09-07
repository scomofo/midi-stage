# Engine decision — ship smoother import before a native rewrite

## Decision for v0.5

Keep the working browser client for this release. Scott has explicitly permitted
Godot or another engine when it improves quality. That permission does not require
a wholesale rewrite before the import flow can be improved. v0.5 supplies pure
analysis data and explicit, renderer-independent chart JSON, so a later native
client can consume the same arrangements. This is portability of data, not an
already implemented or validated Godot client.

## What the Godot documentation establishes

Godot has MIDI input events, connected-device discovery and open/close methods.
Its official rhythm/audio timing guide describes mix/output latency compensation
and audio-position synchronization. These make a native prototype worth evaluating;
they do not prove lower latency than this browser client on Scott's hardware.
The guide also describes the buffer-size/CPU/dropout tradeoff.

The documented AudioServer input selection is one global `input_device` property.
Do not assume that setting it twice yields two independent capture devices. A
native prototype must test one stereo interface with separate channels and, when
needed, an explicit multi-device audio backend. Built-in MIDI output is not
provided by InputEventMIDI; a future MIDI-output requirement needs separate work.

Primary references, checked during this implementation:
- Godot MIDI input: https://docs.godotengine.org/en/stable/classes/class_inputeventmidi.html
- Godot rhythm timing: https://docs.godotengine.org/en/stable/tutorials/audio/sync_with_audio.html
- Godot audio devices: https://docs.godotengine.org/en/stable/classes/class_audioserver.html

## Gates before switching the production client

1. Import the same v1/v2 charts and backing file with matching timing and scoring.
2. Prove simultaneous MIDI keyboard/drums and isolated live guitar/bass capture.
3. Measure input-to-judgment, playback-to-display drift and frame pacing on the
   actual machine; do not replace a tested path with unmeasured latency claims.
4. Preserve device mapping, calibration, pause/resume, cancellation and disconnect
   cleanup. No capture on merely opening the app or song editor.
5. Match local song storage/export and ship a tested installer/launcher on the
   intended operating system. Record the exact tested engine and audio backend.
6. Demonstrate useful presentation gains (highway readability, band visuals,
   full piano range) rather than duplicating the existing editor in a new engine.

## Separate problem: faithful MP3 instrument parts

The renderer and song analysis are separate concerns. v0.5 finds rhythmic attacks;
it does not recover original instrument notes. A higher-fidelity pipeline would
need its own separation/transcription implementation, reference-data evaluation,
uncertainty handling and hardware/runtime cost review. No such service, model
weights, cloud uploads or auto-transcription guarantee is included in this PR.
