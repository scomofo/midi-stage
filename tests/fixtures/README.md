# Test audio

`workshop-tone.mp3` is a generated 1.5-second, 220 Hz sine wave (16 kHz mono,
32 kbps MP3), created solely to test browser audio decoding. It is not commercial
music and does not record any real person or instrument.

The WAV fixtures used by Workshop browser suites are generated in memory by the
test scripts. Existing MIDI fixtures are generated/authored test inputs.

## quick-import-pulse.mp3

Original synthetic fixture created for v0.5 tests, not a user or commercial recording.
Mono 16 kHz, 12 seconds, 120 BPM with first onset at 0.350 s. Each 0.5-second pulse
is a 110 Hz sine with exponential decay (50/s); the first 0.12 s is retained.
Encoded with FFmpeg/libmp3lame at 32 kbit/s. Used for actual MP3 decoding, worker
analysis, rhythm generation, preview, direct play and storage tests.
