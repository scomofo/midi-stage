# v0.2 repository import validation

The repository imports the delivered `MIDI-Stage-v0.2-Soundcheck.zip` prototype, not an implementation of the planned v0.3 audio-scoring milestone.

## Checks rerun during import

| Suite | Passed | Environment |
| --- | ---: | --- |
| Core chart/scoring/MIDI unit tests | 30 | Node, synthetic inputs |
| Audio-input and pitch-analysis unit tests | 21 | Node, synthetic samples and mocks |
| Gameplay browser integration | 19 | In-memory Chromium + Playwright |
| Browser completion and edge cases | 11 | In-memory Chromium + Playwright |
| Audio soundcheck browser integration | 28 | In-memory Chromium, simulated devices, real Web Audio graphs |
| Total | 109 | All listed suites passed |

The 51 Node checks were also rerun successfully on the authorized macOS machine with Node 20.20.2. No physical instrument capture was requested or tested.

Running `python3 build.py` in both environments reproduced the delivered standalone HTML byte-for-byte. SHA-256 of `MIDI-Stage.html`:

`9f2b1b4836cc584032a2011fd17341f233e2623f4763c95588f20240b3177fc3`

These are locally executed tests, not GitHub Actions results. The original detailed report and test scripts are retained in `TEST_REPORT.md` and `tests/`.

## Boundaries

Browser devices, permissions and secure-context behavior are simulated; real input routing, hardware latency and live-pickup accuracy remain unverified. Audio input is soundcheck-only. There is no audio-to-gameplay scoring in v0.2. See `ROADMAP.md` for planned work.
