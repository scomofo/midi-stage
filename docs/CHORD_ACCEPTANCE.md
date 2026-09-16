# Chord Stage: one keyboard acceptance sitting

Software tests simulate MIDI. This checklist is the remaining physical acceptance
gate; no instrument model or end-to-end latency has been certified.

Use your 88-key keyboard, its normal USB/MIDI connection, and wired headphones or
speakers. Open the localhost launcher in desktop Chrome. Record the date, keyboard
model, operating system, browser, output device, and global/player corrections.

1. **Connect and calibrate.** Open Hardware setup wizard. Identify Keyboard by
   playing a key; run Keyboard calibration using the audio output you will play
   through. Run it twice and record both offsets and variation. Check MIDI OUT only
   if you actually use an external synth; use local sound otherwise.
2. **See the requested keys.** Select Open Stage, Chill, keyboard only. Check that
   gold keys and octave labels agree with your keyboard. Switch to All 88 keys and
   back to Song range. In full screen, keep both highway and guide readable.
3. **Play a shape.** Start the song. Play the complete displayed shape with a natural
   small roll, hold it through its tails, then release. Expect one chord judgment
   and sustain credit. Play only part of the next shape: expect one missed target.
4. **Check fairness.** In Arcade, add a doubled root in another octave; it must not
   create an Extra Hit. Try a wrong tone and a deliberately early release; these
   must be visible. Hold through a repeated target without attacking again: it
   must not score automatically.
5. **Check the pedal.** Hold a correct chord using CC64 after releasing the keys.
   Expect the sustain to continue. Release the pedal early on the next chord and
   expect a broken hold. Pause while holding a chord, resume after the count-in,
   and check that no notes remain stuck or score from the paused hold.
6. **Check register and difficulty.** In Exact MIDI mode, play the displayed octave,
   then deliberately try a different octave. Only the requested register should
   count. Compare Chill, Standard and Expert: the music itself changes. Standard
   and Expert include single-note answers between chords; they remain playable.
7. **Check practice audio.** With a matching backing file in Song Workshop, try 75%
   tempo. The music should slow without changing key. Compare a sustained known
   note against your keyboard; listen for obvious clicks, drift or stereo changes.
8. **Finish a set.** Play Open Stage through to results. Check stars, held-note
   results and personal progress. Watch demo and loop practice must not overwrite
   your recorded performance. Add MIDI drums if available, select separate routes,
   and verify independent hits and cooperative phrase bonuses.

| Check | Pass / Fail / Not tested | Evidence or reproduction |
|---|---|---|
| Connection and repeatable calibration | | |
| Readable piano, register and full screen | | |
| Complete / partial shapes | | |
| Octave doubling and wrong notes | | |
| Repeated attacks and early releases | | |
| Pedal, pause and stuck-note cleanup | | |
| Exact register and musical difficulties | | |
| Pitch-preserving backing and synchronization | | |
| Results, progression and optional band | | |

A reproducible software issue should include the song, arrangement, matching mode,
tempo, expected notes, actual MIDI notes, and whether the pedal was down. Audio
quality and physical latency need listening and real devices; synthetic checks do
not establish either. Electric-guitar audio still judges chord attacks by timing,
not fretted chord identity.
