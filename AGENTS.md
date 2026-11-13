# AGENTS.md

Guidance for agents working on Flew Notes. Read **Design System** before touching any UI. Every color, size, and duration in this app can be changed by the user at runtime, so a change can look fine in one theme and break in others.

## Project Overview

Flew Notes is a browser app for flowing (note-taking) in competitive debate. Debaters record arguments in a grid of speech columns. Responses sit to the right of the argument they answer. The app has no server and no accounts. Data lives in `localStorage`, an optional linked folder on disk, or JSON/XLSX files. Collaboration is peer-to-peer over WebRTC.

- Live: https://flew-notes.netlify.app/ (Netlify, `netlify.toml`, Node 24)
- Source: https://github.com/index3rr/flew-notes, a fork of [debate-flow](https://github.com/Ashwagandhae/debate-flow)
- Current release: `1.3.1`

### Terminology

- **Document**: one saved file. It holds every flow page, the notes sidebar text (`sideDocText`), a title, and a created date. State lives in `document.ts`; persistence lives in `autoSave.ts` and `flowLibrary.ts`.
- **Flow**: one page/tab inside a document, such as "aff" or "neg". The `Flow` node in code.
- **Box**: one cell (argument) in a flow.
- **Aff / neg**: the two debate sides. They map to the primary and secondary accent colors throughout the UI.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 4 (options API: `export let`, `$:`, stores; no runes). `$lib` = `src/lib`.
- **Language**: TypeScript, `strict`.
- **Build**: Vite 5, `@sveltejs/adapter-netlify`. `+layout.ts` sets `ssr = false`, `prerender = true`. Browser globals (`window`, `localStorage`) are safe at module top level.
- **Styling**: hand-written component-scoped CSS on CSS custom properties. No CSS framework, no preprocessor.
- **Font**: Merriweather Sans 300 and 700 (`@fontsource/merriweather-sans`).
- **State**: `svelte/store` writables/deriveds plus a `Settings` class.
- **Results**: `ts-results` (`Option`, `Some`, `None`) for node lookups.
- **Libraries**: anime.js (landing-page scenes only), exceljs (XLSX export), posthog-js (telemetry), pako (QR DEFLATE), qrcode and qr-scanner (QR sharing).
- **Unused dependencies**: `@urql/svelte` and `graphql` are in `package.json` but not imported anywhere. Don't build on them.
- **Testing**: Playwright E2E in Chromium, Firefox, and WebKit against `npm run build && npm run preview` (port 4173).
- **Lint/format**: ESLint + Prettier 2 with `prettier-plugin-svelte`.

## Commands

- `npm run dev`: dev server (the service worker is not registered in dev)
- `npm run build`: production build
- `npm run preview`: serve the build
- `npm run check`: `svelte-kit sync` + `svelte-check` (currently 0 errors, 0 warnings; keep it that way)
- `npm run lint`: Prettier check + ESLint
- `npm run format`: Prettier write (whole repo; see Code Style before running)
- `npm run test`: Playwright E2E

On NixOS, run everything through `nix-shell --run "…"`. Node and npm are not on the bare PATH. `shell.nix` provides Node 24, Playwright browsers, and the GStreamer plugins. It sets `GST_PLUGIN_SYSTEM_PATH_1_0`. Without `appsink`/`appsrc`, headless WebKit crashes when a canvas camera starts. Keep dependencies project-scoped in `shell.nix`; never use `nix-env`.

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
    app/+page.svelte            # The app: sidebar (title, tabs, timers), Title, BoxControl, Flow, SideDoc
  lib/
    models/                     # Logic and state (no markup)
    components/                 # Svelte UI
    components/scenes/          # anime.js demo scenes + Fake* presentational parts for the landing page
    svg/                        # Source art for icons (not imported; icons are inlined in Icon.svelte)
static/
  sw.js                         # Service worker
  manifest.json                 # PWA manifest
  favicon.png
tests/                          # Playwright specs (+ tests/helpers/)
test-files/                     # Fixtures
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
- **Box**: `{ tag: 'box', content, flowId, placeholder?, empty?, crossed?, bold?, isExtension? }`. Top-level boxes are level `1`. A box at level `n` sits in column `n - 1`. Children are responses in the next column.
- **Extensions** (`isExtension: true`) are blank filler cells for an argument that skips a speech. They always sit at index 0 of their parent. `addNewExtension` creates the extension plus a child box. The UI shows an `arrowRightThroughCircle` icon; XLSX export writes `→ Extended →`.
- **Empty** boxes (`empty: true`) are invisible spacers created by `addNewEmpty` to start an argument in a later column.

IDs are branded strings: `NodeId`, `FlowId`, `BoxId` (all `crypto.randomUUID()` via `newNodeId`/`newFlowId`/`newBoxId`), `RootId = 'root'`, `AnyId`. Don't cast between them casually; the brands exist to catch FlowId/BoxId mix-ups.

`store.ts` holds `_nodesMut` (writable, mutate only via the action system) and `nodes` (derived, read-only), plus `connections`, `pendingAction`, `frozen`, `sideDocText`, and small UI stores.

## Key Systems

### Actions (`nodeAction.ts`, `nodeDecorateAction.ts`)

All tree mutations go through actions: `add`, `delete`, `update` (with optional changed `fields`), `move`, `replace` (whole-map swap, used for imports), and `identity` (returned when an action can't apply).

- `applyAction` mutates in place and returns the inverse. `applyActionBundle` returns the reversed inverse bundle.
- `doActionBundle(actions, owner)` applies the bundle, sends it to peers (`sharingChannel.sendActionBundle`), and records the inverse in history. It refuses with an alert while `frozen`.
- `syncUi` (`nodeSyncUi.ts`) publishes the new map. It also clears focus, selection, and the selected tab when they point at deleted nodes.
- `decorate()` in `nodeDecorateAction.ts` wraps creators. It resolves any pending action, then runs `doActionBundle`. Public mutators: `addNewBox`, `addNewExtension`, `addNewFlow`, `addNewEmpty`, `toggleBoxFormat`, `deleteBox`, `deleteFlow`, `moveFlow`, `replaceNodes`.

Never write to `_nodesMut` or mutate node objects directly from components. Add a decorated function instead, so undo, sharing, and autosave keep working.

### Pending actions (`nodePendingAction.ts`)

Typing creates a `PendingAction` holding a lazy builder instead of an action per keystroke. It resolves (into `doActionBundle`) before any other action, on focus change, and on undo/redo.

### History (`history.ts`)

`HistoryHolder` keeps one undo/redo stack per flow plus `'root'` for flow-level operations. Each entry stores the inverse bundle plus `beforeFocus`/`afterFocus`, so undo restores the cursor.

### Focus and selection (`focus.ts`, `selection.ts`, `fold.ts`)

`focusId` (focused FlowId/BoxId), `selectedFlowId` (active tab), `lastFocusIds` (per-flow last focus, for tab switching), `selectionAnchorId` + `selectedBoxIds` (shift range selection), `folded` (collapsed boxes).

### Settings (`settings.ts`)

`settings.data` is a dictionary of typed settings: `toggle`, `radio`, `slider`, `color`. Each has a `name`, `value`, `auto` (default), optional `info` and `visibilityCondition`. `settingsGroups` defines the sections of the Settings popup. A setting key can appear in several groups.

- `settings.subscribe(keys, cb)` calls `cb` immediately and on every change. It returns an unsubscribe; wrap it in `onDestroy(...)`. The key `'any'` fires on every change.
- Settings persist to `localStorage['settings']` (only non-default values) when the Settings popup closes. They can be exported and imported as JSON (`isSettings: true`).
- `randomize()` and fun mode skip `funMode`, `telemetry`, and `maxLocalSaves`. Fun mode is never saved. Don't make other settings unsafe to randomize.

### Debate styles (`debateStyle.ts`)

11 formats, in setting order: Policy, Public Forum, Lincoln Douglas, Congress, World Schools, Big Questions, NOF SPAR, Parli, Classic, British Parliamentary, IPPF. Each defines `flows` (`name`, `columns`, optional `columnsSwitch` for speaker order, `invert`, optional `starterBoxes`), `timerSpeeches`, optional `prepTime`, and optionally `alternativeFlows<N>` chosen by the setting named in `alternativeFlowSelectorSettingName` (LD: `LDSubstyle`, Classical vs TOC Circuit). The order of `debateStyleMap` must match the `debateStyle` radio options.

### Documents, autosave, and the flow library (`document.ts`, `autoSave.ts`, `flowLibrary.ts`)

- An edit marks the document dirty. Autosave runs after a **1 s** debounce (`maybeSaveNodes` → `saveNodes`), and writes are serialized.
- Browser saves: `localStorage['flow:<uuid>']` holds the JSON. `localStorage['savedFlows']` holds the `SavedNodesDatas` metadata (created, modified, title, flow names and sides). The oldest saves are trimmed past the `maxLocalSaves` setting (default 20, 0 = unlimited).
- Flow library: in Chromium (`showDirectoryPicker`), the user can link a folder. The handle is remembered in IndexedDB (`flew-flow-library`), and autosave writes to the real file. Other browsers can bulk-import a folder into browser saves instead.
- Opening, closing, and creating documents goes through `openDocument`/`closeDocument`/`createDocument`, which save first.

### File I/O (`file.ts`)

JSON save format `{ nodes, version: 1, sideDocText, title, created }`, with an upgrade path from v0 (`oldType.ts`). `loadNodes` validates the whole tree (levels, parents, flowIds, reachability) and throws on bad input. Also: XLSX export (one worksheet per flow, aff/neg colored), settings JSON export/import, and drag-and-drop upload on the app page.

### Keyboard (`key.ts`)

`createKeyDownHandler()` maps modifier+key combos to handlers with `require` guards, repeat prevention, and `preventDefault` control. `commandControl` means cmd on macOS and ctrl elsewhere. When adding a shortcut, document it in `Shortcuts.svelte`, and pass `shortcut` to the relevant `Button` so its tooltip shows it.

### Timers (`timer.ts`, `Timers.svelte`, `SpeechTimer.svelte`, `PacingTimer.svelte`, `Timer.svelte`, `Time.svelte`)

The sidebar shows a speech timer and prep timers for the current debate style. With `pacingEnabled`, `PacingTimer` spreads the remaining speech time across the remaining arguments in the current column. It skips blank boxes and extensions.

### Popups (`popup.ts`, `Popup.svelte`)

`openPopup(Component, title, props)` (or `openTopPopup` to jump the queue). Only the first popup renders. `+layout.svelte` draws the `--color-screen` overlay; Escape or a backdrop click closes it. The component receives a `closePopup` prop. See Design System for layout rules.

### Sharing (`sharingConnection.ts`, `sharingChannel.ts`, `sharingTransport.ts`, `sharingIce.ts`, `sharingQr.ts`, `iceServers.ts`)

Peer-to-peer collaboration over WebRTC DataChannels with no signaling server.

- **Roles**: the host creates an offer and shares a join link or QR. The guest answers with a confirm link or QR. The host manages multiple guests and relays actions between them. When join/confirm links open in the same browser, `+layout.svelte` passes keys between tabs over `BroadcastChannel`.
- **Protocol** (`sharingChannel.ts`): both sides first exchange `hello` with `PROTOCOL = 'flew-document-v2'`; mismatches are rejected. Host → guest: `sync`, `action`, `actionRecieved` (spelling is wire format; don't fix it), `name`, `metadata`. Guest → host: `requestSync`, `action`, `document`, `metadata`. Guests apply local actions optimistically and rebase unacknowledged ones on every host event, in host order. `frozen` is true while a guest awaits sync.
- **Transport** (`sharingTransport.ts`): `Channel` JSON-encodes messages, splits them into `flew-json-chunk-v1` chunks of 4000 characters, and applies send-buffer backpressure. Large documents must not depend on the negotiated SCTP message size.

QR codes carry offer and answer data without any signaling service. The rules below are wire-format invariants; treat them as frozen.

- **`F2:`** uses Base45 in QR alphanumeric mode, raw DEFLATE, and a shared static dictionary shipped with the app. Header bit 0 marks offer vs answer. The remaining bits select literal UTF-8 (0), binary fields (2), binary fields plus static phrase tokens (4), or separate structure/field streams (6). The encoder tries all four forms with default and fixed Huffman coding and emits the shortest.
- The dictionary, grammar examples, token order, and tag meanings are part of the `F2:` wire format. Freeze them once released. Future changes get a new format prefix, and the old decoder stays. Packing must be reversible and preserve every SDP character, candidate, and credential. IPv6 and base64 use binary encoding only when decoding reproduces the original spelling. Unknown attributes and noncanonical values stay literal. Legacy `FLEW1.` codes and join/confirm URLs still decode. The lossless formats keep every candidate. Never replace dynamic credentials with shared static values.
- **`F3:`** adds reconstructed ICE credentials (bit 3), omitted room identity (bit 4), a fingerprint-derived SDP session ID (bit 5), and packed priority preferences (bit 6; tags 250–254). **`F3+`** answers use the already-scanned host offer as an extra compression dictionary. A four-byte FNV tag rejects mismatched offers before decoding. The offer dictionary and its construction are versioned wire format too. No server state is used: the first QR supplies the context for the second.
- **`sharingIce.ts`** tries a 22-character ICE password and a four-character username fragment, derived from separate bytes of the fresh SHA-256 certificate fingerprint. If a browser rejects this local SDP override, it retries its original description, and QR encoding then includes the real native credentials. Derived ICE passwords can be computed from the public fingerprint; DTLS fingerprint checks and encryption stay enabled. This requires a fresh certificate per peer connection, so don't add certificate reuse without revisiting credential and room-identity generation. Room IDs reuse the ICE password. Signaled SDP session IDs derive from other fingerprint bytes. Long candidate foundation labels are renamed bijectively to short ones, preserving candidate groups, priorities, addresses, ports, and routes. The QR codec restores the published key exactly, including these signaled identities.
- **`F5:`** offers signal one real IPv4 UDP relay candidate whose local allocation `getStats()` identifies as TLS. The full native local candidate list stays intact. **`F5+`** replies use that reduced offer as context. A reply may also select its own verified TLS relay; otherwise it keeps its full candidate list. If stats or a matching allocation are unavailable, fall back to F3. F5 needs working TURN, and must stay covered by a test that forces relay on both peers and checks the selected candidate type. Candidate-free offers broke relay pairing because they lacked the remote address TURN permissions need; don't reintroduce them. Don't wait only for completed host gathering before showing a QR, because Chromium may gather indefinitely. The three-second snapshot remains the fallback.
- **`F6:`** is a fixed data-channel SDP template for verified IPv4 relay endpoints with derived credentials, MID 0, SCTP port 5000, and standard active/actpass roles. Unknown negotiated attributes fall back to F5. Its 43-byte binary payload holds: flags (answer, message-size choice), the full 32-byte SHA-256 fingerprint, the IPv4 address, a uint16 relay port, and a uint32 candidate priority. Answers append four bytes binding the room identity (47 bytes). In Base45 that is 68/74 characters; both fit QR version 3 at L correction (29×29 modules). The template preserves fingerprint, credentials, endpoint, priority, SCTP port, and max-message-size, and reconstructs the rest of the SDP metadata plus a single foundation label. It preserves the transport but does not round-trip the SDP exactly. Native-credential and full-description fallbacks stay covered. F5 contextual decoding must accept both the previous full relay template and F6 reconstruction.
- Guest replies become available after a relay candidate, an established ICE path, or completed gathering. They update with later candidates while waiting for confirmation. Waiting only for the final gathering event can stall Firefox-host/Chromium-guest pairing. Keep mixed-browser tests in both directions, plus a test that forces rejection of credential overrides.
- **Tests**: `tests/sharingQr.spec.ts` checks exact round trips, legacy decoding, malformed codes, Unicode, and QR module counts against the previous format. The QR collaboration test in `tests/share.spec.ts` feeds generated images into a canvas camera in separate browser contexts, so shared localStorage or BroadcastChannel can't help the handshake, and checks that edits travel both ways after the two scans. The fake camera must repaint continuously so WebKit can finish video startup. Replace the `mediaDevices` getter with a consistent virtual device object, and bring the scanning page to the front. `tests/collaboration.spec.ts`, `tests/iceCredentials.spec.ts`, and `tests/sharingTransport.spec.ts` cover sync, credentials, and chunking.

### Telemetry (`telemetry.ts`)

Cookieless PostHog (US host, `cookieless_mode: 'always'`, no autocapture or pageviews). Tiers set by the `telemetry` radio: 0 None, 1 Errors, 2 Usage (default), 3 + Your flows (box text via `trackFlowDataUpload`), 4 + Extra. Global Privacy Control forces tier 0. Setting changes are buffered and sent as one `settings_changed` event when the Settings popup closes. Nothing is tracked during fun mode. New events go through a `track*` helper gated on the correct tier; never send flow text below tier 3.

### Service worker (`static/sw.js`)

Precaches `/`, `/favicon.png`, `/manifest.json`. Navigations and same-origin assets are **network-first** with a cache fallback (the cache exists only for offline use). Cross-origin requests (PostHog, TURN) are network-only. Activation deletes every cache except `CACHE_NAME`. Registered only when `!dev`.

### Versioning and releases (`version.ts`)

`CURRENT_VERSION` (`'1.3.1'`) is the source of truth and is sent with telemetry. `isChangelogVersionCurrent` compares it with `localStorage['lastUsedVersion']` to show the update dot. Every release updates all of these together:

- `src/lib/models/version.ts`: `CURRENT_VERSION`
- `package.json`: `version`
- `package-lock.json`: the top-level `version` and `packages[""].version` only
- `static/sw.js`: `CACHE_NAME` = `flew-notes-v<release>`, with an optional `-r<n>` cache-revision suffix. Changing the worker bytes triggers its update lifecycle; skip this and PWA users keep stale assets.
- `src/lib/components/Changelog.svelte`: the in-app release notes users actually see. `changelog.md` is the maintainer's own log; updating it alone changes nothing in the app.

To refresh the cache within a release, bump only the revision suffix (`flew-notes-v1.3.1-r1` → `-r2`).

## Design System

Consistency and themeability come first in this project. Users can switch light, dark, and fully custom themes, pick both accent hues, and resize padding, gaps, radii, button size, line width, column/sidebar/notes widths, fonts, font size, weights, and animation speed. Fun mode randomizes all of these many times per second. Any hard-coded value breaks under at least one of these. The app's look is flat, borderless, rounded, low-contrast, and light-weight; new UI should be indistinguishable from existing UI.

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
| Sizing             | `--button-size` (icon and control unit), `--column-width`, `--sidebar-width`, `--side-doc-width`, `--title-height`, `--main-height`, `--view-height`                                                                                          |
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
- To make a new dimension user-adjustable, add a `slider` setting, a `cssVarIndex` entry (with unit), a default in `global.css`, and a `settingsGroups` entry (usually Spacing or Borders).
- Popup widths follow `width: min(calc(100vw - var(--padding) * 2), <N>px)` and `height: min(calc(100vh - var(--padding) * 2), …)`. Existing widths are 400 (Message), 500 (Help, Changelog), 600 (Share), 700 (Shortcuts), and 1100 (Settings).
- No borders (`border: none`), no outlines, and no drop shadows. Hierarchy comes from surface color and spacing. The only shadow is the inset ring in `TutorialHighlight`.
- Rounded corners everywhere: `--border-radius` for controls, panels, and popups; `--border-radius-small` for cells and anything nested inside a rounded surface.

**Typography**

- Inherit `--font-family` and `--font-size`. Size headings and emphasis relative to them (`em`/`rem`). Global `h1`/`h2` already set size, weight, and zero margin.
- Use only `font-weight: var(--font-weight)` or `var(--font-weight-bold)`. Never `bold` or a number; the user controls both weights.

**Motion**

- Every CSS transition uses `var(--transition-speed)`. Pressed or active states set `transition: none` so press feedback is instant (see `Button`, `Tab`).
- Svelte transitions go in `src/lib/models/transition.ts`. Read the duration from `settings.data.transitionSpeed.value` and return a zero-duration transition when it is 0 (see `boxIn`). Don't use `svelte/transition` presets with fixed durations in the app. Landing-page scenes (anime.js, `Benefit`) are the exception.

**Interaction states**

- Controls are transparent at rest. Hover uses `--this-background-indent`, active or selected uses `--this-background-active`, and disabled uses `--this-text-weak` with no hover background. Keyboard focus in the flow (`.focus`, `.childFocus`) uses the same indent/active backgrounds.
- Settings controls mark changed values: at default they use `palette-accent-secondary`, changed they use `palette-accent`, and off toggles use `palette-plain` (see `Toggle`, `Slider`, `Radio`).
- Hover-revealed affordances (column-header "+", box add buttons) fade in with `opacity` over `--transition-speed`.

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
- **Panels in the app grid** (`app/+page.svelte`) are `--background` surfaces with `--border-radius`, separated by `--gap`, and sized from `--main-height` / `--view-height` / `--title-height`.

### Known token bugs (don't copy these)

These references point at variables that don't exist. Fix them when you're working nearby, rather than imitating them:

- `Flow.svelte`: `--accent-text`, `--accent-secondary-text`
- `Tooltip.svelte`: `--box-shadow`
- `Help.svelte`, `Changelog.svelte`, `DownloadUpload.svelte`: `--color-subtle`
- `Benefit.svelte`: `--radius`
- `+layout.svelte`: `customTextAccentWeak` maps to `custom-background-weak` instead of `custom-text-accent-weak`, so `--text-accent-weak` is unset in the custom theme.
- `Popup.svelte`: `font-weight: bold` instead of `var(--font-weight-bold)`.

### Verifying UI changes

Run `npm run dev` and check the change:

- In light, dark, and custom themes (and system mode with the OS in both modes).
- On aff and neg flows (`invert` both ways), and at alternating box levels.
- With both accent hues changed, and in a custom theme with very different colors.
- With extreme padding, button size, border radius, font size, and font weights, and with transition duration 0.
- With "Randomize" in Settings, which stress-tests most of the above at once.

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
- `tests/persistancy.spec.ts`: autosave, browser saves, flow library, import/export.
- `tests/collaboration.spec.ts`, `tests/share.spec.ts` (+ `tests/helpers/collaboration.ts`): multi-peer sync and QR handshakes.
- `tests/sharingQr.spec.ts`, `tests/iceCredentials.spec.ts`, `tests/sharingTransport.spec.ts`: codec and transport units run in the browser.

Add or extend a spec whenever you change behavior in the models. Sharing, persistence, and the QR wire format must stay covered in all three browsers.

## Component Map

| Area          | Components                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell     | `app/+page.svelte`, `Title` (flow name + delete), `BoxControl` (toolbar: undo/redo, add, extension, format, save), `Tab`, `AddTab`, `SortableList` (drag-reorder tabs), `SideDoc` (notes), `DownloadUpload`     |
| Flow grid     | `Flow` (columns, headers, sets `invert`/`columnCount` context), `Header` (column name + hover "+"), `Box` (recursive cell, keyboard navigation), `Fold`                                                         |
| Start screen  | `Prelude` → `Tutorial`/`TutorialHighlight` or `SavedFlows` → `SavedFlow`, `FlowLibrary`, `FlowCard`; `FlowLibrarySetup`                                                                                         |
| Timers        | `Timers`, `SpeechTimer`, `PacingTimer`, `Timer`, `Time`                                                                                                                                                         |
| Popups        | `Popup`, `Message`, `Settings`/`Setting`, `Help`, `Shortcuts`/`Shortcut`, `Changelog`, `Share` → `ConnectLink`, `ConnectManual`, `ConnectQR` (`QRCode`, `QRScanner`), `ConnectStatus`, `CopyBox`; `CloseWindow` |
| Primitives    | `Button`, `ButtonBar`, `Icon`, `Tooltip`, `Text`, `Link`, `Toggle`, `Slider`, `Radio`, `ColorSelector`                                                                                                          |
| Landing (`/`) | `Benefit` + `scenes/*Scene.svelte` (anime.js), presentational `scenes/Fake*.svelte`, `scenes/Flower.svelte`                                                                                                     |
| Unused        | `NavTab`, `NavTabList`, `TextInput`                                                                                                                                                                             |
