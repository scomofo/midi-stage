# MIDI Stage v0.8 — Hardware onboarding contract

## Purpose

The Hardware Setup Wizard reduces setup friction without guessing device identity.
It stores only routing/settings that MIDI Stage can observe or the player explicitly
selects. It does not certify a device model, driver, physical jack, LED protocol, or
latency from browser enumeration alone.

## Five-step flow

1. **Discovery** requests Web MIDI with `sysex:false` and lists connected input/output
   labels. No MIDI permission is requested merely by opening the wizard.
2. **Role identification** listens for the next Note On after the user selects a role.
   That event binds the browser MIDI input ID and detected channel to the role. The
   binding is internal; exported reports resolve it back to manufacturer/name labels.
3. **MIDI OUT** reuses v0.7 stable output signatures and safe presets. Test notes,
   Clock/transport and explicit panic are available here. No proprietary commands are
   inferred from a controller name.
4. **Calibration** schedules audible clicks through the existing Web Audio clock. A
   role-specific MIDI test accepts taps only from that role's saved device/channel and
   stores `measured correction - global correction` as the player offset. This includes
   human response/audio playback delay and is not isolated USB/interface latency.
5. **Review/save** marks onboarding complete and can export a JSON report containing
   labels, MIDI channels, output profiles and timing corrections. It excludes raw
   browser MIDI IDs and audio samples.

## Guitar and bass

Audio interfaces are not MIDI inputs unless they separately expose MIDI ports. The
wizard therefore hands guitar/bass setup to Audio soundcheck, which remains responsible
for browser audio-device/channel selection and signal checks. v0.8 does not add an
automatic audio-latency measurement.

## Persistence

Detailed routing remains in `midi-stage-settings-v1`. Wizard completion is a separate
`midi-stage-onboarding-v1` marker so the wizard can evolve without changing chart or
score identity. Rerunning the wizard edits the same underlying routing settings.

## Safety

SysEx remains disabled at permission and send layers. Explicit PANIC is intentionally
broad; routine pause/stop cleanup remains scoped to MIDI Stage's configured outputs.
No firmware access, driver installation or device-specific proprietary command is
performed by onboarding.

## Validation boundary

Automated tests use simulated Web MIDI ports and browser events. Physical support is
only established after the actual user's devices complete discovery, identification,
output tests where applicable, and repeatable timing trials.
