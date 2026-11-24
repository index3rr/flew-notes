# CardMirror ↔ Flew Notes

This API v1 companion plugin recreates Ebb's send, reveal and source-jump workflow for Flew's web app. CardMirror remains a native app; it does not need a new host API. Flew and the plugin exchange encrypted, ordered WebRTC messages directly. They make no requests to the CardMirror relay or Netlify functions.

## Connect

1. In Flew, open **Settings → Panels → CardMirror** and choose a position. Open or create a flow.
2. Download the companion plugin from that panel. In native CardMirror, enable plugins in Settings, then use **Load plugin from file…** to load the downloaded JavaScript. This developer loading method must be repeated after restarting CardMirror; it does not require relay allowlisting.
3. In Flew, click **Create connection key**. In CardMirror's command palette, run **Connect to Flew**, paste the key, and click **Create reply key**.
4. Paste the reply into Flew and click **Connect CardMirror**. Wait for **Connected to CardMirror**. You may close CardMirror's connection dialog.

Keep pairing keys private: they include the connection's SDP and any temporary TURN credentials. They expire after two minutes while pairing, are never saved, and should only be exchanged between your own app windows. Pair again after either app restarts. Collapsing or moving the panel preserves the connection; turning the panel Off disconnects it.

## Use

`Mod` means Cmd on macOS and Ctrl on Windows/Linux. All commands also appear in CardMirror's command palette.

| Command                           | Default shortcut | Behavior                                                              |
| --------------------------------- | ---------------- | --------------------------------------------------------------------- |
| Send to Flew                      | Mod+Alt+F        | Send in the configured layout.                                        |
| Send to Flew (one cell per line)  | —                | One cell per extracted item.                                          |
| Send to Flew (single cell)        | —                | Join the selection into one multiline cell.                           |
| Send to Flew as responses         | —                | Add replies in the next column of the selected argument.              |
| Toggle Flew Send Mode             | —                | Change the send-mode setting.                                         |
| Reveal in Flew                    | Mod+Alt+E        | Find sent cells across the current document; repeat to cycle matches. |
| Choose Flew Page                  | —                | Cycle destination pages in the connected Flew document.               |
| Connect to Flew / Disconnect Flew | —                | Pair or end the connection.                                           |

Disable or remap Ebb's matching shortcuts when using both plugins. The companion's settings provide the default send layout and 0–10 empty cells after each send.

Flew fills the selected blank cell or inserts siblings below the selected argument, preserving existing arguments and responses. With no selected cell it appends to the first column. It never creates a document implicitly. Headings are bold, tags carry a card icon, citations append to the preceding item, and analytics remain plain. Each send is one undo step and uses normal autosave and collaboration. Source references and self-contained evidence snapshots survive JSON save/load, undo/redo, page import, and cell copying. New imports retain the complete card body, citation, and formatting. Older flows containing only source references need their cards sent from CardMirror once to attach the evidence. Select an imported cell and use **Jump to source** in the panel to return to its CardMirror document (which must still be open).

## During a round

Use **Receive in** and **Speech column** to pin incoming blocks to a page and speech while browsing another flow. Choose **Follow selected cell** to return to normal insertion. **Send to Flew as responses** requires an unpinned, selected argument; existing replies are preserved. **Copy argument text** supplies plain text for a speech document. Collaboration's **Send selected argument** lets your partner jump to the same argument, including folded responses.

While an updated native companion is connected, SpeechDrop provides **Open in CardMirror** and an **Open DOCX downloads in CardMirror** option (on by default). Downloads are kept even if the handoff fails. One download is reused for opening and transcript comparison. The comparison document is named and stays an explicit choice.

Documents open as unsaved copies in a **new CardMirror window**, preserving existing work. The current plugin API cannot route bytes into an existing workspace slot. Developer-loaded plugin commands are window-local: load and pair the companion in a document's window to send directly from that window. Restart CardMirror before loading this plugin update because its command set has changed.

See the [two-person policy workflow and review findings](round-workflow.md).

## Networking and limits

Pairing is manual rather than an always-running signaling service. Flew's existing STUN/TURN configuration is used; temporary ICE server credentials are passed to the companion, never the TURN API key. Local connections usually work without TURN. Restrictive or different networks may require Flew's configured TURN service, whose own usage limits still apply. There is no automatic fallback through Netlify. CardMirror web has no supported plugin loader; this plugin targets the desktop app.

The versioned `FLEWCM1.` key format is independent of Flew's collaboration QR formats. Requests include `flow.insert`, `flow.reveal`, `flow.pages`, `flow.select`, `source.jump`, and `integration.capabilities`. Optional response placement is capability-checked. Documents use separate `document.begin`, `document.chunk`, `document.finish`, and `document.cancel` requests, capped at 50 MB with bounded chunks and cleanup deadlines. Payloads follow Ebb's extracted-item layout (`kind`, `text`, `source`, `key`, `docTitle`, `mode`, `space`). Headings and analytics remain the visible flow text. Card-backed items additionally carry a versioned snapshot of the complete CardMirror card; the companion reads the immutable card node and sanitized clipboard HTML. Flew stores these as data and never renders the HTML. The Autoflow panel exports saved cards to the current document or designated speech document, with unlinked cells inserted as analytics. Reload the updated companion to enable evidence export. A send accepts at most 500 items and two million JSON characters. Messages use bounded small data-channel frames, assembly deadlines and request timeouts. Flew treats source tokens as opaque and uses the public `jumpToSource` API for navigation. The companion resolves CardMirror's own versioned heading token locally when capturing evidence; it never rewrites source tokens.

## Build and verification

`npm run build:cardmirror` bundles `plugin.ts` and the shared protocol into `static/integrations/cardmirror/plugin.js`. Normal dev/build commands run it automatically. The bundle is generated and ignored; its release manifest is next to it. Publishing through CardMirror's GitHub installer would additionally require a release repository and relay allowlisting, neither of which this implementation changes.

Run `nix-shell --run 'npm run test -- tests/cardMirror.spec.ts'` for real browser-to-browser WebRTC using the downloadable companion against a simulated public API host. Native Electron verification is a separate check; the browser host cannot prove OS plugin loading or real CardMirror source-token behavior.

For the native check, first build an existing CardMirror desktop checkout and run its renderer development server. Then run:

```sh
CARDMIRROR_DESKTOP_PATH=/path/to/cardmirror/apps/desktop \
CARDMIRROR_DEV_URL=http://127.0.0.1:5174 \
nix-shell --run 'npm run test -- tests/cardMirrorDesktop.spec.ts --workers=1'
```

The checkout must support the `CARDMIRROR_DEV_URL` override (the relay integration checkout does). The test uses isolated profiles under `.local/` and Nix Electron, sends a real extracted tag, and resolves its real source token. It runs one browser at a time and leaves the normal CardMirror profile alone. Native Linux results do not establish Windows-specific behavior.

See [verification results](verification.md) for the checks run and their platform limits.
