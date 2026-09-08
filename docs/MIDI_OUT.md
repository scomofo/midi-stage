# MIDI Stage v0.7 — MIDI OUT contract

## Goals

MIDI OUT is an optional hardware layer. Gameplay and chart data do not depend on a
particular synthesizer, controller or renderer. Web MIDI permission is still requested
with `sysex:false`; the send layer also rejects SysEx messages.

## Persistent profile model

Each player stores an output signature, MIDI channel, preset, guide flag, feedback
kind, and Note/CC number. Output signatures use normalized manufacturer + port name +
an occurrence suffix. This is more stable across reconnects than relying only on the
browser's current port ID, but identical duplicate devices may still require choosing
the correct occurrence after topology changes.

Presets are Off, External synth, Pad/LED feedback, Hybrid and Custom. Presets only set
ordinary channel-voice behavior; no device-specific SysEx or firmware commands exist.

## Guide output

Normal note charts send the authored note-on/note-off events for the player's selected
song track. Chord charts send the chord target's stored pitches. MP3 chord pitches can
be heuristic estimates. Rhythm-only MP3 charts without chord metadata send no guide
notes because MIDI Stage refuses to fabricate pitch content.

## Clock and transport

MIDI Clock is 24 pulses per quarter note. Tick times derive from the song beat grid so
imported tempo changes can alter pulse spacing. A zero-position start sends Start
(FA). A non-zero section/loop start or resume sends Song Position Pointer (F2, in MIDI
beats/16th notes) followed by Continue (FB). Pause/finish sends Stop (FC).

Output messages use Web MIDI timestamps. The scheduler looks ahead briefly, and stop
or seek clears queued future messages on outputs configured by MIDI Stage.

## Hit feedback

Perfect/Great/Good judgments can pulse either a MIDI Note or CC at velocity/value
127/104/78, followed by zero after a short interval. This is generic feedback; whether
it drives LEDs depends on the target hardware's MIDI implementation.

## Panic and cleanup

Normal session cleanup clears configured queues and sends Sustain Off, All Notes Off,
and All Sound Off on configured player channels. The explicit PANIC button performs
those controls on all 16 channels of every connected output.

## Validation boundary

Automated tests mock Web MIDI outputs and inspect bytes/timestamps through the real UI
and application lifecycle. They verify routing, clock, transport, guide notes,
feedback, reconnect state, SysEx blocking and panic logic. They do not establish that
a physical instrument accepts those messages, flashes an LED as expected, follows
clock accurately, or has acceptable end-to-end latency. Physical-device validation is
required before adding a named hardware preset.
