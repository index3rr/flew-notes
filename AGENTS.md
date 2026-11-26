# AGENTS.md

Guidance for agents working on Flew Notes. This file describes the `panels` branch. Read **Design System** and **Panels** before touching any UI. Every color, size, and duration in this app can be changed by the user at runtime, so a change can look fine in one theme and break in others.

## Project Overview

Flew Notes is a browser app for flowing (note-taking) in competitive debate. Debaters record arguments in a grid of speech columns. Responses sit to the right of the argument they answer. There are no accounts, and the only server code is a small SpeechDrop proxy (see Panels). Data lives in `localStorage`, an optional linked folder on disk, or JSON/XLSX files. Collaboration is peer-to-peer over WebRTC.

- Live: https://flew-notes.netlify.app/ (Netlify, `netlify.toml`, Node 24)
- Source: https://github.com/index3rr/flew-notes, a fork of [debate-flow](https://github.com/Ashwagandhae/debate-flow)
- Current release on this branch: `2.0.0` (cache `flew-notes-v2.0.0-r7`). It includes `main` through 1.4.0 (1.3.1's sharing and autosave rewrite, grouped replies, drag selection, Extemp).

### Terminology

- **Document**: one saved file. It holds every flow page, the notes text (`sideDocText`), a title, and a created date. Title helpers live in `document.ts`; `documentOpen` and persistence live in `autoSave.ts` and `flowLibrary.ts`.
- **Flow**: one page/tab inside a document, such as "aff" or "neg". The `Flow` node in code.
- **Box**: one cell (argument) in a flow.
- **Aff / neg**: the two debate sides. They map to the primary and secondary accent colors throughout the UI.
- **Panel**: a configurable card in the left or right sidebar (tabs, timers, notes, coverage, starred, library, transcript, collaboration, SpeechDrop, CardMirror).

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 4 (options API: `export let`, `$:`, stores; no runes). `$lib` = `src/lib`.
- **Language**: TypeScript, `strict`.
- **Build**: Vite 5, `@sveltejs/adapter-netlify`. `+layout.ts` sets `ssr = false`, `prerender = true`. Browser globals (`window`, `localStorage`) are safe at module top level.
- **Styling**: hand-written component-scoped CSS on CSS custom properties. No CSS framework, no preprocessor.
- **Font**: Merriweather Sans 300 and 700 (`@fontsource/merriweather-sans`).
- **State**: `svelte/store` writables/deriveds plus a `Settings` class.
- **Results**: `ts-results` (`Option`, `Some`, `None`) for node lookups.
- **Libraries**: anime.js (landing-page scenes only), exceljs (XLSX export), posthog-js (telemetry), pako (QR DEFLATE), qrcode and qr-scanner (QR sharing), `@huggingface/transformers` (local Whisper transcription, worker only), mammoth (SpeechDrop DOCX text, and speech-document headings read as text, never rendered).
- **Unused dependencies**: `@urql/svelte` and `graphql` are in `package.json` but not imported anywhere. Don't build on them.
- **Testing**: Playwright E2E in Chromium, Firefox, and WebKit against `npm run build && npm run preview` (port 4173).
- **Lint/format**: ESLint + Prettier 2 with `prettier-plugin-svelte`.

## Commands

- `npm run dev`: builds the CardMirror plugin, then starts the dev server (the service worker is not registered in dev)
- `npm run build`: builds the CardMirror plugin, then the app
- `npm run build:cardmirror`: bundles `integrations/cardmirror/plugin.ts` into the gitignored `static/integrations/cardmirror/plugin.js`
- `npm run preview`: serve the build
- `npm run check`: `svelte-kit sync` + `svelte-check` (currently 0 errors, 0 warnings; keep it that way)
- `npm run lint`: Prettier check + ESLint
- `npm run format`: Prettier write (whole repo; see Code Style before running)
- `npm run test`: Playwright E2E

On NixOS, run everything through `nix-shell --run "…"`. Node and npm are not on the bare PATH. `shell.nix` provides Node 24, Playwright browsers, Electron (for the optional native CardMirror test), and the GStreamer plugins. It sets `GST_PLUGIN_SYSTEM_PATH_1_0`. Without `appsink`/`appsrc`, headless WebKit crashes when a canvas camera starts. Keep dependencies project-scoped in `shell.nix`; never use `nix-env`. If Playwright reports a missing `chromium_headless_shell-<rev>`, the nixpkgs browser bundle doesn't match `@playwright/test`'s expected revision. Point `launchOptions.executablePath` at the bundled `chromium-<rev>/chrome-linux64/chrome` in a local, uncommitted config rather than downloading browsers.

TURN for cross-network sharing is optional. To enable it, copy `.env.example` to `.env` and set `VITE_METERED_APP_NAME` and `VITE_METERED_TURN_API_KEY` (use the credential-scoped TURN key, never the account secret). Without them, `iceServers.ts` falls back to Google STUN only.

## Directory Structure

```
src/
  app.html                      # HTML shell
  routes/
    +layout.svelte              # Global CSS import, theme/class switching, settings→CSS variable bridge,
                                #   telemetry init, join/confirm link handling, popup host, SW registration
    +layout.ts                  # ssr=false, prerender=true, ?ref= telemetry referrer
    +page.svelte                # Landing page ("/"): hero, Benefit scenes, links to /app
    global.css                  # ALL theme tokens, light/dark/custom palettes, .palette-* classes, scrollbars
    app/+page.svelte            # The app: left sidebar (header, document title, left PanelContainer),
                                #   Title, BoxControl, Flow, optional right sidebar (right PanelContainer)
    api/speechdrop/[roomId]/    # Server routes proxying speechdrop.net room indexes and file downloads
  lib/
    models/                     # Logic and state (no markup)
    components/                 # Svelte UI
    components/panels/          # Panel bodies rendered by PanelContainer.svelte
    components/scenes/          # anime.js demo scenes + Fake* presentational parts for the landing page
    integrations/cardmirror/    # Flew side of the CardMirror protocol, WebRTC connection, document transfer
    svg/                        # Source art for icons (not imported; icons are inlined in Icon.svelte)
  mammoth.d.ts                  # Types for mammoth's browser build
integrations/cardmirror/        # CardMirror companion plugin source + README, workflow, verification notes
scripts/build-cardmirror-plugin.mjs
static/
  sw.js                         # Service worker
  manifest.json                 # PWA manifest
  transcript-capture.js         # AudioWorklet that forwards microphone or tab PCM to the transcript panel
  favicon.png
tests/                          # Playwright specs
test-files/                     # Fixtures (including cardmirror/1NC.docx)
```

## Core Domain Model (`node.ts`, `store.ts`)

The document is a tree stored as a flat `Nodes` map (id → node).

```typescript
type Nodes = { root: Node<Root> } & { [key: FlowId]: Node<Flow> | undefined } & {
	[key: BoxId]: Node<Box> | undefined;
};
type Node<T> = { value: T; level: number; parent: ParentIdFor<T>; children: ChildIdFor<T>[] };
```

- **Root**: `{ tag: 'root' }`, id is literally `'root'`, level `-1`. Children are flows.
- **Flow**: `{ tag: 'flow', content, invert, columns }`, level `0`. `content` is the tab name, `columns` the speech names (e.g. `['1AC', '1NC', …]`), `invert` is `true` for neg-side flows and swaps the color assignment. Children are top-level boxes.
- **Box**: `{ tag: 'box', content, flowId, placeholder?, empty?, crossed?, bold?, isExtension?, starred?, starNote?, cardMirror?, cardMirrorSpacer?, respondsTo? }`. `starred`/`starNote` feed the Starred panel; `cardMirror` is source provenance (`Provenance` from `integrations/cardmirror/protocol.ts`) and makes the cell multiline. Top-level boxes are level `1`. A box at level `n` sits in column `n - 1`. Children are responses in the next column.
- **Extensions** (`isExtension: true`) are blank filler cells for an argument that skips a speech. They always sit at index 0 of their parent. `addNewExtension` creates the extension plus a child box. The UI shows an `arrowRightThroughCircle` icon; XLSX export writes `→ Extended →`.
- **Empty** boxes (`empty: true`) are invisible spacers created by `addNewEmpty` to start an argument in a later column.
- **Group replies** use the normal parent for the first target and optional `respondsTo: BoxId[]` for the other targets in the same flow and previous column. `groupReplyTargets` uses the leftmost selected column, skips empty/extension cells, and requires a next column. Shift+Enter and the add-response toolbar button create one reply through `addGroupReply`. `groupReplyParents` in `groupReply.ts` maps grouped source cards to their common parent. Their right-side plus is hidden; Shift+Enter and the toolbar append through `addGroupResponse`, preserving that parent and focusing the new response. `GroupReplyLines` calculates a themed curve from the lowest target's bottom line to the final visible sibling response's bottom line using registered cell elements and updates on resize/folding. The curve renders inside that bottom line in `Box`, sharing `currentColor` so focus, descendant focus, hover, and color transitions match exactly. Missing targets are ignored without removing their stored IDs, so undo restores their connections. JSON saves preserve links; cell paste deliberately drops them to avoid linking to the original IDs.

IDs are branded strings: `NodeId`, `FlowId`, `BoxId` (all `crypto.randomUUID()` via `newNodeId`/`newFlowId`/`newBoxId`), `RootId = 'root'`, `AnyId`. Don't cast between them casually; the brands exist to catch FlowId/BoxId mix-ups.

`store.ts` holds `_nodesMut` (writable, mutate only via the action system) and `nodes` (derived, read-only), plus `connections`, `pendingAction`, `frozen`, `sideDocText`, and small UI stores.

## Key Systems

### Actions (`nodeAction.ts`, `nodeDecorateAction.ts`)

All tree mutations go through actions: `add`, `delete`, `update` (with optional changed `fields`), `move`, `replace` (whole-map swap, used for imports), and `identity` (returned when an action can't apply).

- `applyAction` mutates in place and returns the inverse. `applyActionBundle` returns the reversed inverse bundle.
- `doActionBundle(actions, owner)` applies the bundle, sends it to peers (`sharingChannel.sendActionBundle`), and records the inverse in history. It refuses with an alert while `frozen`.
- `syncUi` (`nodeSyncUi.ts`) publishes the new map to `_nodesMut`.
- `decorate()` in `nodeDecorateAction.ts` wraps creators. It resolves any pending action, then runs `doActionBundle`. Public mutators: `addNewBox`, `addNewExtension`, `addNewFlow`, `addNewEmpty`, `toggleBoxFormat` (`bold`, `crossed`, `starred`), `addGroupReply`, `addGroupResponse`, `deleteBox`, `deleteFlow`, `moveFlow`, `replaceNodes`, `importFlowPage` (copies a page from another document with fresh IDs). `buildPasteActions` must copy every optional `Box` field; extend it when you add one.

Never write to `_nodesMut` or mutate node objects directly from components. Add a decorated function instead, so undo, sharing, and autosave keep working.

### Pending actions (`nodePendingAction.ts`)

Typing creates a `PendingAction` holding a lazy builder instead of an action per keystroke. It resolves (into `doActionBundle`) before any other action, on focus change, and on undo/redo.

### History (`history.ts`)

`HistoryHolder` keeps one undo/redo stack per flow plus `'root'` for flow-level operations. Each entry stores the inverse bundle plus `beforeFocus`/`afterFocus`, so undo restores the cursor.

### Focus and selection (`focus.ts`, `selection.ts`, `dragSelection.ts`, `fold.ts`)

`focusId` (focused FlowId/BoxId), `selectedFlowId` (active tab), `lastFocusIds` (per-flow last focus, for tab switching), `selectionAnchorId` + `selectedBoxIds` (shift range selection), `folded` (collapsed boxes).

`dragSelect` attaches to the flow scroll container and reuses the same range and selection stores. A mouse/pen drag from cell padding becomes a cell selection after entering another cell. Drags started in cell text retain native text selection even outside the cell, and touch keeps native scrolling. Active drags capture the pointer, scroll at the flow edges, and suppress native text selection. `Box.updateSelection` leaves selection alone during a cell drag. Pointer release/cancellation, Escape, window blur, and action teardown clean up the gesture and listeners.

### Settings (`settings.ts`)

`settings.data` is a dictionary of typed settings: `toggle`, `radio`, `slider`, `color`. Each has a `name`, `value`, `auto` (default), optional `info` and `visibilityCondition`. `settingsGroups` defines the sections of the Settings popup. A setting key can appear in several groups. Each panel has its own settings group, generated from the panel registry; the Panels group holds sidebar widths.

- `settings.subscribe(keys, cb)` calls `cb` immediately and on every change. It returns an unsubscribe; wrap it in `onDestroy(...)`. The key `'any'` fires on every change.
- `setValue` validates setting types and radio indices and clamps finite sliders to their supported ranges. Imports validate their envelope, ignore unknown keys, and preserve valid preferences; malformed stored JSON falls back to defaults. Storage write failures return `false` rather than throwing during popup teardown.
- Settings persist to `localStorage['settings']` (only non-default values) when the Settings popup closes. They can be exported and imported as JSON (`isSettings: true`).
- `SETTINGS_VERSION` is 4. Version 4 removes `showSaveButton`, retires the content-upload telemetry tiers (3/4 migrate to Usage), and defaults fresh installations to no telemetry. Existing exports that omitted the old Usage default retain it. Version 2 exports retain the previous default panel positions when those settings were omitted. Fresh version 4 settings use the minimal layout. Loading older settings migrates `showSideDoc` into `notesPanel` (visible → Right, hidden → Off) and re-saves. Bump the version and add a migration whenever you rename or remove a setting key.
- `randomize()` and fun mode skip `funMode`, `telemetry`, and `maxLocalSaves`. Fun mode is never saved. Don't make other settings unsafe to randomize.

### Debate styles (`debateStyle.ts`)

12 formats, in setting order: Policy, Public Forum, Lincoln Douglas, Congress, World Schools, Big Questions, NOF SPAR, Parli, Classic, British Parliamentary, IPPF, Extemp Debate. Each defines `flows` (`name`, `columns`, optional `columnsSwitch` for speaker order, `invert`, optional `starterBoxes`), `timerSpeeches`, optional `prepTime`, and optionally `alternativeFlows<N>` chosen by the setting named in `alternativeFlowSelectorSettingName` (LD: `LDSubstyle`, Classical vs TOC Circuit). The order of `debateStyleMap` must match the `debateStyle` radio options. Settings store the index, so append new styles at the end.

### Documents, autosave, and the flow library (`document.ts`, `autoSave.ts`, `flowLibrary.ts`)

- An edit marks the document dirty. Autosave runs after a **1 s** debounce (`maybeSaveNodes` → `saveNodes`), and writes are serialized.
- Browser saves: `localStorage['flow:<uuid>']` holds the JSON. `localStorage['savedFlows']` holds the `SavedNodesDatas` metadata (created, modified, title, flow names and sides). The oldest saves are trimmed past the `maxLocalSaves` setting (default 20, 0 = unlimited).
- Flow library: in Chromium (`showDirectoryPicker`), the user can link a folder. The handle is remembered in IndexedDB (`flew-flow-library`), and autosave writes to the real file. Other browsers can bulk-import a folder into browser saves instead.
- Opening, closing, and creating documents goes through `openDocument`/`closeDocument`/`createDocument`, which save first.

### File I/O (`file.ts`)

JSON save format `{ nodes, version: 1, sideDocText, title, created }`, with an upgrade path from v0 (`oldType.ts`). `loadNodes` validates the whole tree (levels, parents, flowIds, reachability) and throws on bad input. Also: XLSX export (one worksheet per flow, aff/neg colored), settings JSON export/import, and drag-and-drop upload on the app page.

### Keyboard (`key.ts`)

`createKeyDownHandler()` maps modifier+key combos to handlers with `require` guards, repeat prevention, and `preventDefault` control. `commandControl` means cmd on macOS and ctrl elsewhere. When adding a shortcut, document it in `Shortcuts.svelte`, and pass `shortcut` to the relevant `Button` so its tooltip shows it (`tests/shortcuts.spec.ts` checks these match). Star is `cmd/ctrl+shift+8` (bound as both `8` and `*`, since layouts report either); `cmd/ctrl+shift+s` saves a copy; cross out is `ctrl+shift+x`.

### Timers (`timer.ts`, `Timers.svelte`, `SpeechTimer.svelte`, `PacingTimer.svelte`, `Timer.svelte`, `Time.svelte`)

The sidebar shows a speech timer and prep timers for the current debate style. With `pacingEnabled`, `PacingTimer` spreads the remaining speech time across the remaining arguments in the current column. It skips blank boxes and extensions. `timerAutoAdvance` pauses and selects the next speech when time runs out. `timerStartOnSpeech` starts a paused speech timer when transcription first matches the opponent document (`speechDetected`).

### Popups (`popup.ts`, `Popup.svelte`)

`openPopup(Component, title, props)` (or `openTopPopup` to jump the queue). Only the first popup renders. `+layout.svelte` draws the `--color-screen` overlay; Escape or a backdrop click closes it. The component receives a `closePopup` prop. See Design System for layout rules.

### Sharing (`sharingConnection.ts`, `sharingChannel.ts`, `sharingIce.ts`, `sharingQr.ts`, `iceServers.ts`)

Peer-to-peer collaboration over WebRTC DataChannels with no signaling server.

- **Roles**: the host creates an offer and shares a join link or QR. The guest answers with a confirm link or QR. The host manages multiple guests and relays actions between them. When join/confirm links open in the same browser, `+layout.svelte` passes keys between tabs over `BroadcastChannel`.
- **Protocol** (`sharingChannel.ts`): both sides first exchange `hello` with `PROTOCOL = 'flew-document-v3'`; mismatches are rejected. Host → guest: `sync`, `action`, `actionRecieved` (spelling is wire format; don't fix it), `name`, `metadata`. Guest → host: `requestSync`, `action`, `document`, `metadata`. Both directions: `partnerMessage` (text plus optional `argumentId`) and `speechDrop` (room code); the host relays them to other guests and sends its room code after the first sync. Peers ignore tags they don't know, so main and panels builds still collaborate (main just drops partner messages). Guests apply local actions optimistically and rebase unacknowledged ones on every host event, in host order. `frozen` is true while a guest awaits sync.
- **Transport** (`sharingTransport.ts`): `Channel` JSON-encodes messages, splits them into `flew-json-chunk-v1` chunks of 4000 characters, and applies send-buffer backpressure. Large documents must not depend on the negotiated SCTP message size.

QR codes carry offer and answer data without any signaling service. The rules below are wire-format invariants; treat them as frozen.

- **`F2:`** uses Base45 in QR alphanumeric mode, raw DEFLATE, and a shared static dictionary shipped with the app. Header bit 0 marks offer vs answer. The remaining bits select literal UTF-8 (0), binary fields (2), binary fields plus static phrase tokens (4), or separate structure/field streams (6). The encoder tries all four forms with default and fixed Huffman coding and emits the shortest.
- The dictionary, grammar examples, token order, and tag meanings are part of the `F2:` wire format. Freeze them once released. Future changes get a new format prefix, and the old decoder stays. Packing must be reversible and preserve every SDP character, candidate, and credential. IPv6 and base64 use binary encoding only when decoding reproduces the original spelling. Unknown attributes and noncanonical values stay literal. Legacy `FLEW1.` codes and join/confirm URLs still decode. The lossless formats keep every candidate. Never replace dynamic credentials with shared static values.
- **`F3:`** adds reconstructed ICE credentials (bit 3), omitted room identity (bit 4), a fingerprint-derived SDP session ID (bit 5), and packed priority preferences (bit 6; tags 250–254). **`F3+`** answers use the already-scanned host offer as an extra compression dictionary. A four-byte FNV tag rejects mismatched offers before decoding. The offer dictionary and its construction are versioned wire format too. No server state is used: the first QR supplies the context for the second.
- **`sharingIce.ts`** tries a 22-character ICE password and a four-character username fragment, derived from separate bytes of the fresh SHA-256 certificate fingerprint. If a browser rejects this local SDP override, it retries its original description, and QR encoding then includes the real native credentials. Derived ICE passwords can be computed from the public fingerprint; DTLS fingerprint checks and encryption stay enabled. This requires a fresh certificate per peer connection, so don't add certificate reuse without revisiting credential and room-identity generation. Room IDs reuse the ICE password. Signaled SDP session IDs derive from other fingerprint bytes. Long candidate foundation labels are renamed bijectively to short ones, preserving candidate groups, priorities, addresses, ports, and routes. The QR codec restores the published key exactly, including these signaled identities.
- **`F5:`** offers signal one real IPv4 UDP relay candidate whose local allocation `getStats()` identifies as TLS. The full native local candidate list stays intact. **`F5+`** replies use that reduced offer as context. A reply may also select its own verified TLS relay; otherwise it keeps its full candidate list. If stats or a matching allocation are unavailable, fall back to F3. F5 needs working TURN, and must stay covered by a test that forces relay on both peers and checks the selected candidate type. Candidate-free offers broke relay pairing because they lacked the remote address TURN permissions need; don't reintroduce them. Don't wait only for completed host gathering before showing a QR, because Chromium may gather indefinitely. The three-second snapshot remains the fallback.
- **`F6:`** is a fixed data-channel SDP template for verified IPv4 relay endpoints with derived credentials, MID 0, SCTP port 5000, and standard active/actpass roles. Unknown negotiated attributes fall back to F5. Its 43-byte binary payload holds: flags (answer, message-size choice), the full 32-byte SHA-256 fingerprint, the IPv4 address, a uint16 relay port, and a uint32 candidate priority. Answers append four bytes binding the room identity (47 bytes). In Base45 that is 68/74 characters; both fit QR version 3 at L correction (29×29 modules). The template preserves fingerprint, credentials, endpoint, priority, SCTP port, and max-message-size, and reconstructs the rest of the SDP metadata plus a single foundation label. It preserves the transport but does not round-trip the SDP exactly. Native-credential and full-description fallbacks stay covered. F5 contextual decoding must accept both the previous full relay template and F6 reconstruction.
- Guest replies become available after a relay candidate, an established ICE path, or completed gathering. They update with later candidates while waiting for confirmation. Waiting only for the final gathering event can stall Firefox-host/Chromium-guest pairing. Keep mixed-browser tests in both directions, plus a test that forces rejection of credential overrides.
- **Tests**: `tests/sharingQr.spec.ts` checks exact round trips, legacy decoding, malformed codes, Unicode, and QR module counts against the previous format. The QR collaboration test in `tests/share.spec.ts` feeds generated images into a canvas camera in separate browser contexts, so shared localStorage or BroadcastChannel can't help the handshake, and checks that edits travel both ways after the two scans. The fake camera must repaint continuously so WebKit can finish video startup. Replace the `mediaDevices` getter with a consistent virtual device object, and bring the scanning page to the front. `tests/collaboration.spec.ts` and `tests/iceCredentials.spec.ts` cover sync, partner messages, and credentials.

### Telemetry (`telemetry.ts`)

Cookieless PostHog with memory persistence, no person profiles, IP enrichment, automatic capture, pageviews, replay, surveys, remote feature flags or external SDK extensions. Fresh users choose None (0, default), Errors only (1), or Errors and usage (2) in onboarding. Global Privacy Control overrides every choice. Version 4 settings migrate old 3/4 content-upload tiers to Usage and retain existing users’ prior default of Usage. No flow/notes/file contents or collaboration URLs are sent.

`telemetry.ts` owns the outbound event/property allowlist (schema 2). Initialization emits one `app_opened` per app/home surface per tab session. Onboarding outcome, tutorial completion/cancellation, document creation/opening, successful file import/export, collaboration attempts and actual connections are low-volume workflow events. Editing and panel/tool use accumulate in `usage_summary` at most once a minute, and flush on hide/close. Only useful preference keys are buffered in `settings_changed`; cosmetic sliders and all text settings are ignored. Errors are sanitized and deduplicated, capped at 30 distinct errors per tab session. Fun mode suppresses every event, including errors. Opt-out/tier reductions discard buffers and use SDK opt-out (SDK `shutdown()` would flush queued events).

Use the data for home→app→document activation, onboarding completion/skip rates, completed workflows vs attempts, actual tool usage, and errors by release/browser. Cookieless/memory operation does not promise durable cross-device or long-term user identity. `tests/telemetry.spec.ts` verifies gating, batching, outbound filtering, error redaction and opt-out.


### Service worker (`static/sw.js`)

Precaches `/`, `/favicon.png`, `/manifest.json`. Navigations and same-origin assets are **network-first** with a cache fallback (the cache exists only for offline use). Cross-origin requests (PostHog, TURN, Hugging Face model files) are network-only. `/api/speechdrop/*` responses are same-origin and `no-store`. Activation deletes every cache except `CACHE_NAME`. Registered only when `!dev`.

### Versioning and releases (`version.ts`)

`CURRENT_VERSION` (`'2.0.0'` on this branch) is the source of truth and is sent with telemetry. `isChangelogVersionCurrent` compares it with `localStorage['lastUsedVersion']` to show the update dot. Every release updates all of these together:

- `src/lib/models/version.ts`: `CURRENT_VERSION`
- `package.json`: `version`
- `package-lock.json`: the top-level `version` and `packages[""].version` only
- `static/sw.js`: `CACHE_NAME` = `flew-notes-v<release>`, with an optional `-r<n>` cache-revision suffix. Changing the worker bytes triggers its update lifecycle; skip this and PWA users keep stale assets.
- `src/lib/components/Changelog.svelte`: the in-app release notes users actually see. `changelog.md` is the maintainer's own log; updating it alone changes nothing in the app.

To refresh the cache within a release, bump only the revision suffix (`flew-notes-v1.4.0-panels-r2` → `-r3`).

## Panels

Both sidebars are built from panels. Each panel has a radio setting with the options `['Off', 'Left', 'Right', 'Left collapsed', 'Right collapsed']` (values 0–4). Defaults: Tabs Left, Timers Left collapsed, everything else Off. Imported version 2 settings retain their previous default positions. The left column width is `--sidebar-width` ("Left panel width"); the right column (`.right-sidebar`, shown only when some panel is on the right) is `--panel-width` ("Right panel width").

`src/lib/models/panels.ts` is the registry: `panelIds` (render order), `panelNames`, `panelIcons`, `documentPanelIds`, and `panelSide()`. The app page and `PanelContainer` both read it; don't keep a second list anywhere.

### Layout: one surface per panel

- A sidebar is a transparent column of surfaces separated by `--gap`, exactly like the title bar, toolbar, and flow beside it. The left one starts with `.sidebar-head` (header buttons and document title); then `PanelContainer` renders one `.panel` card per visible panel (`--background`, `--border-radius`, `--padding`). There are no dividers or hairlines between panels.
- `.panel` grows (`flex: 1`), clips, and its body scrolls inside itself. `.panel.auto-size` keeps natural height. Timers, Starred, SpeechDrop, CardMirror, Collaboration while sharing is off, and every document panel without an open flow are auto-sized.
- Collapsed panels (3/4) appear as icon `Button`s in a tray card at the bottom of their side, named by `panelNames`. One collapsed panel per side opens at a time. Dragging a file, selected cells, or library pages over a tray icon opens its panel for dropping. Collapsed panels stay mounted (hidden with `display: none`), so timers, transcription, and connections keep running; never destroy panel state on collapse.
- **Document panels** (Notes, Coverage, Starred) need an open document. Independent tools such as Library, Autoflow, Transcript, SpeechDrop, Collaboration, and CardMirror stay available before one is open. `PanelContainer` handles this centrally: without a flow it renders `PanelPlaceholder` (the name, styled exactly like a `PanelHeader`, tooltip "No flow is open.") with a New flow menu command instead of the panel component. Panel components never take an `available` prop.

### Motion

- When a panel's body replaces its placeholder (a flow opens), the body enters with `panelIn` (fade and settle from `--padding` above), staggered by the panel's position on its side. Because the placeholder and the header share a style, the name stays put and only the body arrives.
- Whenever the set of visible panels, flow availability, or sharing state changes, `PanelContainer` measures every card before the update and animates each one to its new size with `panelResize` (a Web Animations `flex-basis` tween). Expanding a collapsed panel grows it from zero the same way.
- Both read `--transition-speed` through `settings.data.transitionSpeed` and do nothing at 0.

### Panel anatomy

Build panels from the primitives in `components/panels/`, not from hand-styled elements:

- **`PanelHeader`**: every panel starts with it. Each panel has a `<panelId>ShowName` setting (true by default), and one shared menu containing help/tutorial, settings, placement, collapse and hide commands. Panel-specific commands use the `actions` prop; pass a function when availability depends on state, so the menu reads current state when opened. Name in `--text-weak` at `1em`, an optional short `detail` (counts, state, "2AC · 3 open"), an optional `tooltip` explaining the panel, and the shared context menu. Frequent body actions (recording, importing selected rows) remain directly accessible. Tutorial descriptions and steps live in `panelHelp.ts`. `PanelGuide` uses the same `Walkthrough` component as the main tutorial in a temporary right-hand card. Panel actions, shared options, and a persistent bottom placement row are separate menu groups.
- **`PanelRow`**: list items. A block button styled like a `Tab` (palette text, indent on hover, active when pressed or `selected`), with an `actions` slot for trailing icon buttons. It prevents mousedown so clicking a row doesn't blur the cell being edited. Use it for arguments, files, folders, sources.
- **`PanelStatus`**: the one status line style (`--text-weak`, `0.85em`, horizontal `--padding` so it aligns with row text, `role="status"`, or `role="alert"` with `error`). Empty states are one `PanelStatus` sentence, not a paragraph.
- **`PanelField`**: text inputs and textareas, following the Form fields rules.
- Content is a vertical flex column with `gap: var(--padding-small)`. Everything inside aligns to the same left edge: header name, row text, and status lines all sit one `--padding` in from the card's content box.
- Actions are icon `Button`s with lowercase tooltips. Use text buttons only for multi-step flows inside a panel body (CardMirror pairing); they need the wrapping override (`:global(.element)` with auto width; `:global(button.top)` with `height: auto`, `min-height: calc(var(--button-size) + var(--padding) * 2)`, `white-space: normal`, `overflow-wrap: anywhere`).
- Explanations belong in tooltips (`PanelHeader`'s or a button's), not in the body. No `<details>`, no `<h2>`/`<h3>` of your own, no labels above fields (use `aria-label` and a placeholder).
- Side-colored content uses `palette-accent` / `palette-accent-secondary`, derived the same way the flow does (column parity XOR `invert`), never chosen by hand.
- Floating UI (`PartnerNotifications`) sits on `--background-active` with `--border-radius` and `--padding-big`, and no shadow.

### Adding a panel

1. Add a radio setting `<name>Panel` with the five standard options to `settings.ts` and to the Panels group in `settingsGroups`.
2. Add the id, name, and icon to `models/panels.ts` (and to `documentPanelIds` if it needs an open flow). Add the render branch in `PanelContainer.svelte` and decide whether it is auto-sized.
3. Put the body in `src/lib/components/panels/<Name>Panel.svelte`: a root with a descriptive class and an `aria-label`, a `PanelHeader`, then content. No background, outer padding, border, or fixed height (the card provides them).
4. Add a `tests/panels.spec.ts` case covering placement on both sides, the collapsed state, and the placeholder if applicable. Put pure logic in a model and unit-test it in `tests/roundTools.spec.ts` style (no `page` fixture, so no browser is launched).

### Panel features

- **Coverage** (`models/coverage.ts`, `CoveragePanel`): for a speech, lists on every page the other side's arguments from the previous column that have no real response yet ("open"), and your arguments from two columns back that the other side skipped ("dropped"). A response is a child cell with text; extensions and blank cells count as skipped. Short lines ("ext", "no") show the top-level argument they descend from. The speech follows the speech timer once it is in use (CX and prep resolve to the next speech via `currentSpeech.upcoming`); before that it is inferred as the speech after the furthest column anyone has written in; clicking a speech pins it. "Answer" (`addResponse`) adds a response cell and focuses it; "Extend" (`extendArguments`) adds an extension where the other side was silent plus a cell reading "dropped", one undo step per page. Coverage options independently show or hide dropped and already-extended arguments.
- **Timer state for panels** (`timer.ts`): `Timers` publishes `currentSpeech` (`name`, `secondary`, `upcoming`) only once the speech timer has been touched, and keeps `speechClock` (read with `speechElapsed()`) current every frame without being a store.
- **Starred**: lists `starred` boxes in tab order, then by level. Clicking reveals the argument (`showArgument` unfolds ancestors). The note textarea edits `starNote` through a `PendingAction`, so it batches like cell typing.
- **Flow library** (Off by default): compact `FlowCard` rows from the linked folder or browser saves. Clicking a page label imports it with `importFlowPage`; dragging sets `application/x-flew-page` (`{ nodes, ids }`, with legacy `id` support), which the app page drops between tabs. Ctrl/Cmd and Shift select multiple pages. `panelDrag.ts` also accepts these pages on a box, replacing an empty target or adding responses to a populated one. Cell drags use `application/x-flew-boxes`; moves preserve IDs, relevel branches, and remove incompatible grouped links in the same undo bundle. File management stays in the full library on the start screen.
- **Autoflow** (`AutoflowPanel`): browses DOCX heading blocks independently of SpeechDrop. Accepts local files and `application/x-flew-speechdrop` room/file references. Selected blocks drag as pages onto tabs or as responses onto cells. Cell drops near the top or bottom insert siblings before or after the target; center drops add responses or replace empty cells. Dragged parent boxes include their descendants. Library rows select and preview, and their plus buttons import the selected set. Optionally reads headings from current and speech CardMirror documents through its menu. Sending cells happens in the CardMirror panel or by native rich drag, not in Autoflow. Blocks also drag their complete text into Notes; citations in flowed tags are optional. Imports replace the current empty page by default (configurable). The isolated companion adapter is `integrations/cardmirror/outline.ts`; do not assume ProseMirror view internals are exposed on DOM nodes.
- **Transcript** (`TranscriptPanel`, `transcript.ts`, `transcript.worker.ts`): captures the microphone, or a tab/window through `getDisplayMedia` for online rounds. Microphone capture turns off echo cancellation (it would erase an online opponent coming out of the speakers) and noise suppression. The `AudioContext` runs at the device rate; `Segmenter` cuts audio at pauses with an adaptive noise floor (soft limit 7 s at a 200 ms pause, hard limit 18 s at the quietest point of the last 4 s) and never sends silence, which is what made Whisper invent text. Segments are resampled to 16 kHz. The shared `speechModel.ts` service loads and retains the worker when the model selection changes or recording first starts. Stopping, collapsing or hiding Transcript keeps it ready; changing models replaces it. Inferences are serialized and carry request IDs so an old recording cannot feed a new session. The worker loads the `transcriptModel` choice (Automatic, Fast = whisper-tiny.en, Balanced = base.en, Accurate = small.en, Best = large-v3-turbo); Automatic picks Best on half-precision WebGPU and Accurate otherwise. WebGPU uses an fp32 encoder with a 4-bit decoder and falls back to WASM q8. Decoding is capped by audio length, and `cleanTranscript` drops stock hallucinations and collapses loops. Lines are labeled with the speech timer's speech and time into it, grouped by speech, auto-scroll unless the user scrolled up, and "Add to flow" (`insertTextNear`) puts a line into the selected cell or below it. Transcript entries also drag as copied `application/x-flew-boxes` payloads with no source IDs, using the normal cell insertion/replacement and undo paths. `compareSpeech` matches word pairs against the opponent document; under 40% is "Outside document" (likely an analytic), a review hint, not a verdict. Model files download from Hugging Face on first use; no audio leaves the device.
- **Collaboration**: `collaboration.ts` holds `partnerNotices` (last 50), SpeechDrop room/document state, and `speechDetected`. Messages (Enter sends, Shift+Enter breaks a line) and "Send selected argument" go over the existing sharing connection. Received notices also appear as dismissible `PartnerNotifications` (rendered in `+layout.svelte`, visible even when the panel is collapsed). With sharing off, the panel has a Start collaboration button that opens Share. After hosting or joining, that button is replaced by messages and the composer. Notifications are enabled from the shared menu.
- **SpeechDrop**: the room code syncs between partners. `src/routes/api/speechdrop/[roomId]` and `[roomId]/[fileIndex]` are SvelteKit server routes (`prerender = false`, deployed as Netlify functions). They validate the room id, fetch speechdrop.net with an 8 s timeout and no redirects, cap the list at 100 files and downloads at 50 MB, and return `no-store`. DOCX text extraction uses mammoth's raw-text API. Each file row can download or delete; drag files into Transcript, Autoflow or CardMirror. Upload files is in the shared panel menu; local files can also be dropped onto a connected room. Completed downloads do not leave a status message.
- **Flowing a speech document** (`models/speechDoc.ts`, `DocImport` popup, `importSpeechDoc`): mammoth converts the DOCX with Verbatim's style names mapped to h1–h4, and `blocksFromHtml` reads that HTML as text with a regex (it is never rendered or parsed into the DOM). Blocks are the deepest heading level above the tags (usually h3), tags are h4. Each block is matched to a page by its words (filler like "AT", "DA", "2AC" ignored), falling back to its pocket/hat, or becomes a new page using the template where the speech comes earliest. Tags land in the speech column (from the file name, the timer, or the inferred next speech) under a spacer chain, optionally shortened to the claim before the first dash. The whole import is one undo step owned by `root`.
- **CardMirror**: pairs with the CardMirror desktop app over a direct WebRTC connection using connection and confirmation links (with copy-paste key fallback) (`src/lib/integrations/cardmirror/`, `models/cardMirror.ts`). Incoming cards are inserted with `insertionActions`/`columnInsertionActions` as single undo steps and keep provenance for "Jump to source". User workflow, commands, and limits are documented in `integrations/cardmirror/README.md`. The companion plugin (`integrations/cardmirror/plugin.ts`) and `protocol.ts` are versioned together; don't change one without the other, and leave the plugin alone unless the task is about it.

## Design System

Consistency and themeability come first in this project. Users can switch light, dark, and fully custom themes, pick both accent hues, and resize padding, gaps, radii, button size, line width, column width, both panel widths, fonts, font size, weights, and animation speed. Fun mode randomizes all of these many times per second. Any hard-coded value breaks under at least one of these. The app's look is flat, borderless, rounded, low-contrast, and light-weight; new UI should be indistinguishable from existing UI.

### How theming works

1. **Tokens** live only in `src/routes/global.css`:
   - Base and layout tokens on `body` (`--padding`, `--gap`, `--button-size`, …).
   - Light colors on `body`, dark on `body.dark`, custom on `body.custom`. Each custom token points to a `--custom-*` variable.
   - Accent colors are computed from `--accent-hue` (aff/primary, default 192) and `--accent-secondary-hue` (neg/secondary, default 26).
2. **Theme switching** happens in `+layout.svelte` by toggling the `dark` and `custom` classes on `<body>` (there is no `data-theme` attribute). `colorTheme`: 0 = system (`prefers-color-scheme`), 1 = light, 2 = dark, 3 = custom.
3. **Settings → CSS**: `cssVarIndex` in `+layout.svelte` maps setting keys to CSS variables plus a unit and writes them as inline styles on `body`. `fontFamily` and `fontSize` have dedicated subscribers (font size is rounded to whole pixels).
4. **Palettes**: `.palette-plain`, `.palette-plain-secondary`, `.palette-accent`, `.palette-accent-secondary`, and `.palette-disabled` set local `--this-*` variables (`--this-background`, `--this-background-indent`, `--this-background-active`, `--this-text`, `--this-text-weak`, `--this-text-select`, `--this-color`, `--this-color-fade`). Reusable components style themselves **only** with `--this-*`, and the parent chooses the palette. That is how one `Button` works on every surface and side.

### Token reference

| Purpose            | Tokens                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces           | `--background-back` (page backdrop), `--background` (panels: sidebar, title bar, flow, popups), `--background-secondary` (alternate surface: neg columns, popup outlines/sidebars)                                                            |
| Interaction states | `-indent` = hover/highlight, `-active` = pressed/selected/focused. Variants: `--background-{indent,active}`, `--background-secondary-{indent,active}`, `--background-accent-{indent,active}`, `--background-accent-secondary-{indent,active}` |
| Text               | `--text`, `--text-weak` (secondary, placeholder, disabled), `--text-select` (selection), `--text-error`, `--text-accent*`, `--text-accent-secondary*` (each with `-weak`, `-select`)                                                          |
| Lines and accents  | `--color`, `--color-fade`, `--color-accent[-fade]`, `--color-accent-secondary[-fade]`                                                                                                                                                         |
| Overlay            | `--color-screen` (popup backdrop)                                                                                                                                                                                                             |
| Spacing            | `--padding`, `--padding-small` (½), `--padding-big` (×2), `--gap` (between top-level panels), `--main-margin`                                                                                                                                 |
| Shape              | `--border-radius` (controls, panels, popups), `--border-radius-small` (cells, tabs, nested surfaces), `--line-width`                                                                                                                          |
| Sizing             | `--button-size` (icon and control unit), `--column-width`, `--sidebar-width` (left panel column), `--panel-width` (right panel column), `--title-height`, `--main-height`, `--view-height`                                                    |
| Type               | `--font-family`, `--font-size`, `--font-weight` (300), `--font-weight-bold` (700)                                                                                                                                                             |
| Motion             | `--transition-speed` (ms; the user may set 0)                                                                                                                                                                                                 |
| Scrollbars         | `--scrollbar-*`, `--custom-scrollbar-width`                                                                                                                                                                                                   |
| Sliders            | `--slider-saturation`, `--slider-lightness[-hover]`, `--slider-switch-lightness`                                                                                                                                                              |

There is no `--accent` or `--accent-secondary` variable. Use the derived tokens above.

### Rules

**Color**

- Never hard-code colors (`#hex`, `rgb()`, `hsl()`, or named colors) in components. Use a token or a palette class. The existing exceptions are deliberate: `QRCode.svelte`'s white background (scanner contrast), the hue slider's rainbow (built from `--slider-*`), and one landing-scene glyph.
- Never compute colors from `--accent-hue`/`--accent-secondary-hue` in components. The custom theme replaces hue-derived colors with user-picked ones, so only `global.css` may use the hues.
- Aff vs neg is never chosen by hand. Derive it the way existing code does: `Tab` uses `flow.invert`, `Flow` column and header palettes use column-index parity XOR `invert`, and `Box` uses `level` parity XOR `invert`. Use `palette-accent` for the primary side and `palette-accent-secondary` for the secondary side.
- To add a color token, you must add it in all of these places, or the custom theme breaks:
  1. The light value on `body`, the dark value on `body.dark`, and `var(--custom-…)` on `body.custom` in `global.css`.
  2. A `color` setting `custom…` with `visibilityCondition: () => settings.data.colorTheme.value == 3` in `settings.ts`.
  3. A `cssVarIndex` entry in `+layout.svelte`.
  4. A `settingsGroups` entry under the right "… Colors" group.
  5. The matching `--this-*` mapping in each relevant `.palette-*` class, if components need it through palettes.
- Before adding a token, check whether an existing one already expresses the hierarchy. It usually does.

**Size, spacing, and shape**

- Build all spacing from `--padding`, `--padding-small`, `--padding-big`, and `--gap` (with `calc()` when needed). Size controls from `--button-size`. Avoid fixed `px`. The few remaining literals (the 6px notification dot, 2px scrollbar borders, 3px line caps) are legacy; don't add more.
- To make a new dimension user-adjustable, add a `slider` setting, a `cssVarIndex` entry (with unit), a default in `global.css`, and a `settingsGroups` entry (usually Spacing, Borders, or Panels).
- Popup widths follow `width: min(calc(100vw - var(--padding) * 2), <N>px)` and `height: min(calc(100vh - var(--padding) * 2), …)`. Existing widths are 400 (Message), 500 (Help, Changelog), 600 (Share), 700 (Shortcuts), and 1100 (Settings).
- No borders (`border: none`), no outlines, and no drop shadows. Hierarchy comes from surface color and spacing. The only shadows are the inset tutorial highlight rings.
- Rounded corners everywhere: `--border-radius` for controls, panels, and popups; `--border-radius-small` for cells and anything nested inside a rounded surface.

**Typography**

- Inherit `--font-family` and `--font-size`. Size headings and emphasis relative to them (`em`/`rem`). Global `h1`/`h2` already set size, weight, and zero margin.
- Use only `font-weight: var(--font-weight)` or `var(--font-weight-bold)`. Never `bold` or a number; the user controls both weights. `global.css` maps `<strong>`/`<b>` to `--font-weight-bold`.
- Secondary and status text uses `--text-weak` at `0.85em` (see the `.status` classes in the panels). Size panel text in `em`, not `rem`, so it follows `--font-size`.

**Motion**

- Every CSS transition uses `var(--transition-speed)`. Pressed or active states set `transition: none` so press feedback is instant (see `Button`, `Tab`).
- Svelte transitions go in `src/lib/models/transition.ts`. Read the duration from `settings.data.transitionSpeed.value` and return a zero-duration transition when it is 0 (see `boxIn`). Don't use `svelte/transition` presets with fixed durations in the app. Landing-page scenes (anime.js, `Benefit`) are the exception.

**Interaction states**

- Controls are transparent at rest. Hover uses `--this-background-indent`, active or selected uses `--this-background-active`, and disabled uses `--this-text-weak` with no hover background. Keyboard focus in the flow (`.focus`, `.childFocus`) uses the same indent/active backgrounds.
- Settings controls mark changed values: at default they use `palette-accent-secondary`, changed they use `palette-accent`, and off toggles use `palette-plain` (see `Toggle`, `Slider`, `Radio`).
- Box add buttons fade in with `opacity` over `--transition-speed`. Column-header "+" buttons stay visible.

**Form fields**

- Text inputs, textareas, and selects that aren't `Text.svelte`: `background: var(--background-indent)`, `border: none`, `outline: none`, `border-radius: var(--border-radius)`, `padding: var(--padding)`, `font: inherit`, `color: var(--text)`. Focus switches the background to `--background-active` over `--transition-speed`. Placeholders use `--text-weak`. Native checkboxes use `accent-color: var(--color-accent)`.
- Don't add `cursor: pointer` (buttons signal interactivity with hover backgrounds), and don't dim disabled controls with `opacity`; use `--this-text-weak`.

**Scrolling**

- Scroll containers opt into themed scrollbars with `class:customScrollbar={settings.data.customScrollbar.value}`.

**Responsiveness**

- The main breakpoint is `@media (max-width: 800px)`; the landing page and Shortcuts also use 700px and 600px. Popups must stay usable at small viewport sizes.

### Use the existing building blocks

- **`Button.svelte`** for every icon action. It requires `icon` and supports `text`, `tooltip`, `shortcut`, `palette`, `disabled` + `disabledReason`, `toggled`, `notification` (accent dot), `inline`, `link`/`target`, and `tutorialHighlight`. `preventBlur` defaults to `true` so clicks don't steal focus from the box being edited; keep that for flow-editing actions. **`ButtonBar.svelte`** lays out button groups and can collapse overflow into a "…" menu (`resize`).
- **`Icon.svelte`** holds every icon as inline SVG in its `icons` array. To add one, use a 100×100 viewBox with strokes only (no fills), `stroke-width="10"`, round line caps and joins, and `currentColor`. Size is set by the caller (usually `var(--button-size)`). `src/lib/svg/` is reference art only.
- **`Tooltip.svelte`** for hover help. It respects the `useTooltips` setting and can show a `shortcut`. Use it through `Button` where possible.
- **`Text.svelte`** for editable text: an auto-growing textarea that respects `frozen`.
- **Settings controls** `Toggle`, `Slider` (with a `hue` mode), `Radio` (with an optional custom value), and `ColorSelector`, rendered by `Setting.svelte`. A new setting needs only a `settings.ts` entry plus a `settingsGroups` entry; don't hand-build settings UI.
- **`Message.svelte`** for simple info or error popups (`openPopup(Message, title, { message, error })`).
- **Popup content components**: accept `export let closePopup` (or `export const closePopup = () => {}` if unused). Give the root a palette class (usually `palette-plain`). Reserve space for the floating close button with `padding-top: calc(var(--button-size) + var(--padding) * 2)` on the first row. Two-pane popups (Settings, Shortcuts) put the outline on `--background-secondary`.
- **Grid surfaces** in `app/+page.svelte` (`.sidebar-head`, each sidebar `.panel`, `.title`, `.box-control`, `.flow`) are `--background` surfaces with `--border-radius` and `--padding`, separated by `--gap`, and sized from `--main-height` / `--view-height` / `--title-height`. `.sidebar` and `.right-sidebar` themselves are transparent columns. Content inside a surface adds no background or padding of its own.

### Keeping the codebase clean

`svelte-check` doesn't catch undefined CSS variables. After editing styles, make sure every `var(--…)` you use is defined in `global.css`, `+layout.svelte`'s `cssVarIndex`, or a palette class. This command should print nothing:

```bash
comm -23 <(grep -rhoE 'var\(--[a-zA-Z0-9-]+' src | sed 's/var(//' | sort -u) \
  <({ grep -rhoE -- '--[a-zA-Z0-9-]+ ?:' src | sed -E 's/ ?:$//'; \
      grep -rhoE "setProperty\('--[a-zA-Z0-9-]+" src | sed "s/setProperty('//"; \
      grep -hoE "name: ?'[a-z-]+'" src/routes/+layout.svelte | sed -E "s/name: ?'/--/; s/'//"; } | sort -u)
```

### Verifying UI changes

Run `npm run dev` and check the change:

- In light, dark, and custom themes (and system mode with the OS in both modes).
- On aff and neg flows (`invert` both ways), and at alternating box levels.
- With both accent hues changed, and in a custom theme with very different colors.
- With extreme padding, button size, border radius, font size, and font weights, and with transition duration 0.
- With "Randomize" in Settings, which stress-tests most of the above at once.
- For panels: on both sides, expanded and collapsed, with and without an open flow, with many panels stacked on one side (nothing may overlap; the panel must scroll), and with extreme left/right panel widths.

## Code Style

- Prettier: tabs, single quotes, no trailing commas, `printWidth` 100. About 18 existing files aren't Prettier-clean. Format the files you change (`npx prettier --write <files>`), not the whole repo, so diffs stay reviewable.
- Svelte 4 idioms: `export let` props, `$:` reactivity, `$store` auto-subscriptions in components, `on:event` and `createEventDispatcher`, `class:name={cond}`. Don't introduce runes or Svelte 5 syntax.
- In `.ts` modules, mirror stores into module-level variables via `.subscribe()` (`let $nodes; nodes.subscribe(v => $nodes = v)`) or use `get()`.
- Subscriptions created in components (`settings.subscribe`, store subscribes) must be unsubscribed in `onDestroy`.
- Store naming: `_xMut` for the private writable and `x` for the public derived (`_nodesMut`/`nodes`).
- Use `Option` from `ts-results` for node lookups (`getNode(...).unwrap()` only where existence is guaranteed).
- Comments are sparse and explain _why_. Match surrounding density.
- Component files are PascalCase in `src/lib/components/`; model files are camelCase in `src/lib/models/`.
- UI copy: setting names and button labels use sentence case ("Maximum browser saves", "Close flow"); tooltips are short and lowercase ("close"). The changelog, README, and some messages are written in the maintainer's casual voice. Don't rewrite that voice.

## Testing

- `tests/flow.spec.ts`: editing, boxes, and flows.
- `tests/selection.spec.ts`: drag ranges, native text selection, copy/cut, grouping, edge scrolling, and gesture cleanup.
- `tests/groupReply.spec.ts`: group reply selection, keyboard/toolbar creation, undo, persistence, peer sync, themed connections, and the Extemp preset.
- `tests/persistancy.spec.ts`: autosave, browser saves, flow library, import/export.
- `tests/panels.spec.ts`: placement, collapsing, placeholders, panel cards, library import/drag, transcript (fake microphone and worker), timer auto-advance, starred notes.
- `tests/roundTools.spec.ts`: unit tests (no browser) for Coverage, speech-document parsing and import actions, transcript cleanup, and the pause segmenter.
- `tests/shortcuts.spec.ts`: tooltip shortcuts match the real handlers; Help lists them.
- `tests/collaboration.spec.ts`, `tests/share.spec.ts`: multi-peer sync, partner messages, and QR handshakes.
- `tests/sharingQr.spec.ts`, `tests/iceCredentials.spec.ts`: codec units run in the browser.
- `tests/cardMirror.spec.ts`, `tests/cardMirrorProtocol.spec.ts`: CardMirror insertion, provenance, and wire protocol against a simulated plugin. `tests/cardMirrorDesktop.spec.ts` drives the real desktop app and is skipped unless `CARDMIRROR_DESKTOP_PATH` and `PLAYWRIGHT_ELECTRON_EXECUTABLE_PATH` are set.

Add or extend a spec whenever you change behavior in the models. Sharing, persistence, and the QR wire format must stay covered in all three browsers. Tests locate panels by `data-panel`, `.panel-placeholder`, and accessible names; keep those stable.

## Component Map

| Area          | Components                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell     | `app/+page.svelte`, `Title` (flow name + delete), `BoxControl` (toolbar: undo/redo, add, extension, star/cross/bold, save), `Tab`, `AddTab`, `SortableList` (drag-reorder tabs; ignores `application/x-flew-page` drops), `DownloadUpload`                                                                                                                                                                            |
| Panels        | `PanelContainer`, `panels/TabsPanel`, `TimersPanel`, `NotesPanel` (`SideDoc`), `CoveragePanel`, `StarredPanel`, `LibraryPanel` + `LibraryPanelRow` (compact `FlowCard`), `TranscriptPanel`, `CollaborationPanel`, `SpeechDropPanel` (+ `DocImport` popup), `CardMirrorPanel`; primitives `PanelHeader`, `PanelRow`, `PanelStatus`, `PanelField`, `PanelPlaceholder`; global `PartnerNotifications` and `ArgumentLink` |
| Flow grid     | `Flow` (columns, headers, sets `invert`/`columnCount` context), `Header` (column name + visible "+"), `Box` (recursive cell, keyboard navigation), `GroupReplyLines` (group response curves), `Fold`                                                                                                                                                                                                                  |
| Start screen  | `Prelude` → `SavedFlows` → `SavedFlow`, `FlowLibrary`, `FlowCard`; `FlowLibrarySetup`; main and panel tutorials share `Walkthrough`                                                                                                                                                                                                                                                                                   |
| Timers        | `Timers`, `SpeechTimer`, `PacingTimer`, `Timer`, `Time`                                                                                                                                                                                                                                                                                                                                                               |
| Popups        | `Popup`, `Message`, `Settings`/`Setting`, `Help`, `Shortcuts`/`Shortcut`, `Changelog`, `Share` → `ConnectLink`, `ConnectManual`, `ConnectQR` (`QRCode`, `QRScanner`), `ConnectStatus`, `CopyBox`; `CloseWindow`                                                                                                                                                                                                       |
| Primitives    | `Button`, `ButtonBar`, `Icon`, `Tooltip`, `Text` (`multiline` for CardMirror cells), `Link`, `Toggle`, `Slider`, `Radio`, `ColorSelector`                                                                                                                                                                                                                                                                             |
| Landing (`/`) | Flower hero with editable copy constants, a themed `HeroDemo` (mock app typing a round, built from `DemoCell`), then `Benefit` scenes grouped under headings in `routes/+page.svelte` (`compact` cards in a grid; `still` is the frame shown with reduced motion). Scenes pause offscreen                                                                                                                             |
| Unused        | `NavTab`, `NavTabList`, `TextInput`                                                                                                                                                                                                                                                                                                                                                                                   |

### First-run setup and the main tutorial

`models/tutorial.ts` manages first-run setup, tutorial visibility, step and docking. Existing settings or saves skip setup. Setup is a dismissible popup using `Setting` controls; preferences apply and save immediately. Importing settings skips the tutorial. Closing or skipping setup writes an `onboardingComplete` marker. The main tutorial uses the maintainer’s eight steps, including flow management. Panel walkthroughs also use the maintainer’s copy, with keyboard badges rendered by `TutorialText`. It begins in the main prelude area, then docks in a temporary right-hand card once an actual flow page exists. This card is not a configurable panel and does not count toward `panelIds`. Ending the tutorial removes its highlights and restores Tabs if the tutorial temporarily revealed them. `highlightTutorial` marks controls with `data-tutorial-active` without wrapping or resizing them.
