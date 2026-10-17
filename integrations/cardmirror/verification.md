# CardMirror integration verification

Verified locally on 2026-10-16 against CardMirror 1.15.0 (plugin API v1) in the relay's isolated integration checkout. Native checks used Nix Electron 43.7.7 on Linux. The original CardMirror checkout and the relay's pending changes were left unchanged.

- The production build generated the downloadable companion bundle and completed successfully.
- `tests/cardMirror.spec.ts` and `tests/cardMirrorDesktop.spec.ts`: **15 passed**, sequentially across Chromium, Firefox and WebKit. The native suite was enabled with `CARDMIRROR_DESKTOP_PATH` pointing at the built isolated desktop checkout and its renderer running on port 5174.
- The panel regression batch (`cardMirror.spec.ts` and `panels.spec.ts`, before the final reload/copy checks were added): **52 passed, 2 skipped**. The skips were the existing browser-specific microphone tests.
- Type checking and focused ESLint checks completed without errors. ESLint reports non-null-assertion style warnings.

The integration checks exercise actual WebRTC between separate browser contexts, the downloadable plugin's public API commands, mismatched-key rejection, multiline/Unicode transfers, card markers, citation folding, undo/redo, autosave, spacing between repeated sends, page selection, reveal cycling, source jumps, disconnect/reconnect, bundle reload, collapsed panels, no-open-flow errors, and larger framed messages. JSON round trips, clipboard copying and page import preserve source references.

The native checks load the generated file through CardMirror's real Electron preload and registry. They create and extract a real tag, send it to Flew, move the editor cursor to the end, jump back through the opaque source token, verify the cursor returns to the source start without an error, and reveal the argument in Flew. They use disposable profiles under `.local/`; normal CardMirror profiles are untouched.

Final browser tests ran with `--workers=1` and a 2 GiB Node heap cap. No deployment or CardMirror relay requests were needed for pairing. These are local Linux results; Windows-specific behavior and restrictive-network TURN routing have not been tested. The integration uses Flew's existing ICE configuration and does not change its collaboration QR protocol.
