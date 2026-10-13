# AGENTS.md

## Project Overview

Flew Notes is a web-based note-taking app for competitive debate. It lets debaters organize arguments across speech rounds in a flowing grid layout. Deployed at https://flew-notes.netlify.app/. Forked from debate-flow.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 4 (using `$lib` alias for `src/lib`)
- **Language**: TypeScript
- **Build**: Vite 5, `@sveltejs/adapter-netlify`
- **Styling**: CSS custom properties (no CSS framework), Merriweather Sans font
- **State**: Svelte writable/derived stores (`svelte/store`)
- **Result types**: `ts-results` (`Option`, `Some`, `None`)
- **Animations**: anime.js
- **Excel export**: exceljs
- **Telemetry**: PostHog (cookieless, US region, tiers 0-4)
- **PWA**: Service worker (`static/sw.js`) + manifest, network-first navigation, cache-first same-origin assets
- **GraphQL**: `@urql/svelte` + `graphql` (present in deps, usage minimal)
- **Testing**: Playwright (E2E)
- **Linting**: ESLint + Prettier

## Commands

- `npm run dev` - dev server
- `npm run build` - production build
- `npm run test` - Playwright E2E tests
- `npm run check` - TypeScript/Svelte type checking
- Use `nix-shell --run "npm run test"` for browser tests on Nix. `shell.nix` includes GStreamer plugins and sets `GST_PLUGIN_SYSTEM_PATH_1_0`; missing `appsink`/`appsrc` makes headless WebKit crash when a canvas camera starts. Keep these dependencies project-scoped; never use `nix-env`.
- `npm run lint` - ESLint + Prettier check
- `npm run format` - Prettier format

## Directory Structure

```
src/
  routes/
    +layout.svelte          # Root layout (fonts, global styles, service worker, telemetry init)
    +layout.ts              # SSR disabled
    +page.svelte            # Landing/prelude page (redirects to /app)
    global.css              # CSS variables, color themes, base styles
    app/
      +page.svelte          # Main application page (sidebar, flows, timers)
  lib/
    models/                 # Business logic and state (no UI)
    components/             # Svelte UI components
    components/scenes/      # Animated scene components for landing page
    svg/                    # SVG icon assets
static/
  sw.js                     # Service worker (network-first navigation, cache-first assets)
  manifest.json             # PWA manifest
tests/                      # Playwright E2E specs
test-files/                 # Test fixture data (JSON)
```

## Core Domain Model

Everything revolves around a tree stored as a flat `Nodes` map (dictionary of id -> node).

### Node Types

- **Root**: The invisible top-level container. Has `tag: 'root'`, id is always the literal string `'root'`. Children are Flows.
- **Flow**: A single debate case/speech path (e.g. "aff" or "neg"). Has `tag: 'flow'`. Children are Boxes. Each Flow defines `columns` (speech round names like `['1AC', '1NC', '2AC', ...]`), and `invert` (boolean, controls color theme for neg-side flows).
- **Box**: An individual argument/cell within a Flow. Has `tag: 'box'`. Children are nested Boxes (responses on the next speech). Properties: `content` (text), `flowId` (which Flow this box belongs to), `placeholder`, `empty`, `crossed`, `bold`, `isExtension`.

### Branded ID Types

IDs use TypeScript branded types for type safety:
- `NodeId` - base branded string (UUID)
- `FlowId` - extends NodeId (readonly brand `FlowId`)
- `BoxId` - extends NodeId (readonly brand `BoxId`)
- `RootId` - literal string `'root'`
- `AnyId` = `RootId | BoxId | FlowId`

Constructors: `newNodeId()`, `newFlowId()`, `newBoxId()` (all use `crypto.randomUUID()`).

### Nodes Map

```typescript
type Nodes = { root: Node<Root> } & {
  [key: FlowId]: Node<Flow> | undefined;
} & { [key: BoxId]: Node<Box> | undefined;
};
```

Each `Node<T>` has: `value: T`, `level: number`, `parent: ParentIdFor<T>`, `children: ChildIdFor<T>[]`.

`level` is the depth in the tree. Root is `-1`. Flow children (top-level boxes) are `0`. Their children are `1`, etc. The `level` determines which column the box sits in (column index = `level - 1` for boxes inside a flow).

### Extensions

Extensions (`isExtension: true` on a Box) are blank filler cells used when an argument from one speech isn't responded to in the next speech, but reappears two speeches later. They display an arrow (`→ Extended →`) indicating the gap. Extensions always sit at index 0 of their parent.

## Key Systems

### Action System (`nodeAction.ts`, `nodeDecorateAction.ts`)

All mutations go through an action system. Actions are:
- `AddAction` - insert a node
- `DeleteAction` - remove a node
- `UpdateAction` - change a node's value
- `MoveAction` - reorder a node within its parent's children
- `ReplaceAction` - replace entire Nodes map (used for file imports)
- `IdentityAction` - no-op (returned when an action fails)

`applyAction()` mutates the Nodes map in-place and returns the inverse action. `applyActionBundle()` applies an array of actions and returns the reversed inverse bundle (for undo).

`nodeDecorateAction.ts` wraps action creation with a `decorate()` helper that: resolves any pending action, applies the action, sends it over the network, and records it in history. Functions like `addNewBox`, `deleteBox`, `addNewFlow`, `moveFlow`, `replaceNodes` are all decorated.

### Pending Actions (`nodePendingAction.ts`)

Text editing is batched: typing creates a `PendingAction` that holds a lazy action builder. It resolves (flushes) when: focus changes, another action is performed, or undo/redo is triggered. This avoids sending a network message per keystroke.

### History / Undo-Redo (`history.ts`)

`HistoryHolder` maintains per-Flow undo/redo stacks (plus a `'root'` stack for flow-level operations). Each `HistoryAction` stores the inverse `actionBundle`, `beforeFocus`, and `afterFocus` for restoring cursor position on undo/redo.

### Sharing / WebRTC (`sharingConnection.ts`, `sharingChannel.ts`)

Peer-to-peer sharing via WebRTC DataChannels (no server, uses BroadcastChannel for signaling within the same browser). Two roles:
- **Host**: Creates an offer, shares a join link. Manages multiple guest connections. Relays actions between guests.
- **Guest**: Receives the offer via join link, creates an answer, shares it back via a confirm link.

Message protocol: `HostMessage` (sync, action, actionReceived, name) and `GuestMessage` (requestSync, action). Uses an optimistic prediction system for guests - local actions are applied immediately and confirmed/reconciled when the host acknowledges.

The `frozen` store is `true` when a guest is awaiting sync (prevents edits during sync).

QR sharing (`sharingQr.ts`) exchanges offer and answer connection data without a signaling service. The `F2:` format uses Base45 in QR alphanumeric mode, raw DEFLATE, and a shared static dictionary shipped with the app. Header bit 0 identifies offer/answer; the remaining bits select literal UTF-8 (0), binary fields (2), binary fields plus static phrase tokens (4), or separated structure/field streams (6). The encoder measures all four forms with default and fixed Huffman compression and emits the shortest.

The dictionary, grammar examples, token order, and tag meanings are part of the `F2:` wire format: freeze them once released; change the format prefix for future changes and keep the old decoder. Packing is reversible and must preserve every SDP character, candidate, and credential. IPv6 and base64 use binary encoding only when decoding reproduces the original spelling; unknown attributes and noncanonical values remain literal. Legacy `FLEW1.` codes and join/confirm URLs still decode. The lossless formats preserve every candidate. The separate F5 format may select a verified live TLS TURN allocation; do not remove every candidate or invent an endpoint. Never replace dynamic credentials with shared static values.


QR format `F3:` additionally supports reconstructing ICE credentials (bit 3), omitted room identity (bit 4), a fingerprint-derived SDP session ID (bit 5), and packed priority preferences (bit 6; tags 250–254). `F3+` answers use the already-scanned host offer as an additional compression dictionary, with a four-byte FNV tag to reject mismatched offers before decoding. The offer dictionary and its construction are also versioned wire format. No shared server state is used; the first QR supplies the context needed for the second.

`sharingIce.ts` tries a 22-character password and four-character username fragment derived from separate bytes of the fresh SHA-256 certificate fingerprint. Browsers that reject this local SDP override retry their original description; QR encoding then includes the actual native credentials. Derived ICE passwords are computable from the public fingerprint; DTLS fingerprint checks and encryption remain enabled. This approach requires a fresh certificate per peer connection: do not introduce certificate reuse without revisiting credential and room identity generation. Room IDs reuse the already-present ICE password instead of adding another UUID. Signaled SDP session IDs derive from other fingerprint bytes; long candidate foundation labels are renamed bijectively to short labels, preserving candidate groups, priorities, addresses, ports, and all routes. The QR codec exactly restores the published key, including these signaled identities.

`F5:` offers signal one actual IPv4 UDP relay candidate whose local allocation is identified as TLS by `getStats()`. The full native local candidate list remains intact. `F5+` replies use that reduced offer as context; replies may also select their own verified TLS relay, otherwise they retain their complete candidate list. If stats or a matching allocation are unavailable, use the full F3 format. This reduces route redundancy and requires working TURN; it must be covered by a test forcing relay on both peers and verifying the selected candidate type. Candidate-free offers failed relay pairing because they did not supply the remote address needed for TURN permissions. Do not reintroduce them. Do not wait exclusively for completed host gathering to display a QR: Chromium may keep gathering indefinitely; the existing three-second snapshot remains a fallback.

`F6:` is a fixed data-channel SDP template for verified IPv4 relay endpoints with derived credentials, MID 0, SCTP port 5000, and standard active/actpass roles. Unknown negotiated attributes use F5. Its binary payload is 43 bytes: flags (answer and message-size choice), full 32-byte SHA-256 fingerprint, IPv4 address, uint16 relay port, uint32 candidate priority. Answers append four bytes binding the room identity (47 bytes). Base45 produces 68/74 characters; both fit QR version 3 at L correction (29×29 modules). The template preserves fingerprint, credentials, endpoint, priority, SCTP port and max-message-size; it reconstructs otherwise unnecessary SDP metadata and a single foundation label. This is a transport-preserving template rather than exact SDP round trip. Native-credential and full-description fallbacks remain covered. F5 contextual decoding must accept both the previous full relay template and F6 reconstruction.

Guest replies become available after a relay candidate, an established ICE path, or completed gathering, and update with subsequent candidates while waiting for confirmation. Waiting exclusively for the final gathering event can stall Firefox-host/Chromium-guest pairing. Keep mixed-browser tests in both directions, plus forced rejection of credential overrides.

`tests/sharingQr.spec.ts` checks exact round trips, legacy decoding, malformed codes, Unicode, and QR module counts against the previous format. The QR collaboration test in `tests/share.spec.ts` feeds generated images into a canvas camera and uses separate browser contexts, preventing shared localStorage or BroadcastChannel from helping the handshake. It verifies edits travel both ways after the two scans. The fake camera must repaint continuously so WebKit can finish video startup; replace the mediaDevices getter with a consistent virtual device object, and bring the scanning page to the front.


### Focus & Selection (`focus.ts`, `selection.ts`)

- `focusId` - currently focused node (FlowId or BoxId or null)
- `selectedFlowId` - currently active flow tab
- `lastFocusIds` - map of FlowId to last-focused BoxId (for tab switching)
- `selectionAnchorId` + `selectedBoxIds` - shift-click range selection within a flow

### Settings (`settings.ts`)

A `Settings` class with typed setting definitions (toggle, radio, slider, color). Persisted to `localStorage`. Includes debate style selection, color theme, font, spacing, and many UI toggles. Has a `subscribe()` method for reactive callbacks. Fun mode randomizes all slider/toggle/radio values continuously.

### Debate Styles (`debateStyle.ts`)

Defines round structures for 11 debate formats: Policy, Public Forum, Lincoln Douglas, Congress, World Schools, Big Questions, NOF SPAR, Parli, Classic, British Parliamentary, IPPF. Each style defines `flows` (with column names and invert flag), `timerSpeeches` (speech durations), and optional `prepTime`. Some styles have `alternativeFlows` selectable via settings (e.g. LD has classical vs TOC circuit substyle).

### Auto-Save (`autoSave.ts`)

Saves to `localStorage` with a 5-second debounce. Stores up to 20 flows. Each save is keyed by a `flow:UUID` string. Tracks `SavedNodesDatas` (metadata: created, modified, flow names). Also handles loading saved flows and downloading as JSON.

### File I/O (`file.ts`)

- JSON export/import (versioned save format with upgrade path from v0)
- XLSX export (one worksheet per flow, color-coded by aff/neg)
- Settings JSON import/export
- Drag-and-drop file upload on the app page

### Keyboard Shortcuts (`key.ts`)

A `createKeyDownHandler()` utility that maps modifier+key combos to handlers. Supports `commandControl` (cmd on mac, ctrl on windows), shift fallthrough, repeat prevention, and requirement guards.

### Timer (`timer.ts`, `Timers.svelte`, `SpeechTimer.svelte`, `PacingTimer.svelte`)

Timer state types for running/paused. `Timers` component manages per-flow speech timers based on the selected debate style. `PacingTimer` auto-distributes remaining speech time across remaining speakers.

### Popups (`popup.ts`)

A simple popup/modal system - `openPopup(component, title, props)` renders a component in an overlay.

### Telemetry (`telemetry.ts`)

Cookieless PostHog integration with 5 tiers (0-4): None, Errors, Usage, All (includes flow text content), Extra. Setting changes are batched into a single `settings_changed` event, flushed when the settings popup closes. All tracking is skipped during fun mode. `trackFlowDataUpload` recursively collects box text content for the "All" tier. The telemetry tier is a radio setting visible to users.

### Service Worker (`static/sw.js`)

Network-first for navigation requests (with cache fallback), cache-first for same-origin assets, network-only for cross-origin (PostHog). Cache version is bumped in `CACHE_NAME` to force updates on release. Skipped in dev mode (`!dev` guard in `+layout.svelte`).

### Version Management (`version.ts`)

Single source of truth: `CURRENT_VERSION` constant (currently `'1.2.2'`). Imported by `telemetry.ts` for PostHog registration. `package.json` version and `sw.js` `CACHE_NAME` must be updated manually on release. `isChangelogVersionCurrent` store compares localStorage against `CURRENT_VERSION` to show update notifications.

## Key Component Files

| Component | Purpose |
|-----------|---------|
| `Flow.svelte` | Renders a flow's grid of boxes |
| `Box.svelte` | Single argument cell (contenteditable, nested children) |
| `BoxControl.svelte` | Toolbar above the flow (undo/redo, add/delete, format buttons) |
| `Title.svelte` | Flow title input + delete button |
| `Tab.svelte` | Sidebar tab for a flow |
| `AddTab.svelte` | Button to add new flow tabs |
| `Timers.svelte` | Timer panel in sidebar |
| `Prelude.svelte` | Landing page when no flows exist |
| `Settings.svelte` | Settings popup |
| `Share.svelte` | WebRTC sharing UI |
| `Shortcuts.svelte` | Keyboard shortcuts reference |
| `SideDoc.svelte` | Notes sidebar panel |
| `SortableList.svelte` | Drag-to-reorder list (used for tab ordering) |
| `Flower.svelte` | Spinning circle-with-arrow animation (matches favicon) |
| `PacingScene.svelte` | Animated pacing timer demo for landing page |
| `FakeTimer.svelte` | Presentational timer display for scene components |
| `FakeBox.svelte` | Presentational debate cell for scene components |

## CSS Variables

All theming uses CSS custom properties defined in `global.css`. Key variables: `--background`, `--background-indent`, `--background-active`, `--text`, `--accent`, `--accent-secondary`, `--color`, `--color-fade`, `--border-radius`, `--padding`, `--gap`, `--column-width`, `--sidebar-width`, `--view-height`, `--main-height`.

Color themes are controlled by a `data-theme` attribute on `<html>` (light/dark/system/custom).

## Conventions

- Svelte stores follow the pattern: `_nodesMut` (writable, mutable), `nodes` (derived, read-only)
- `$nodes`, `$focusId`, etc. are module-level variables updated via `.subscribe()` (Svelte auto-subscription not used in `.ts` files)
- The `decorate()` pattern wraps action creators to handle pending action resolution, execution, and history recording
- Branded types prevent mixing up FlowId/BoxId/NodeId at compile time
- All mutations flow through `applyActionBundle` -> `applyAction` which returns inverse actions for undo
