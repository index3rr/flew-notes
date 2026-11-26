# Release blocker

- CardMirror companion installation: replace manual .js file loading with a GitHub repository users can install by URL. The current loading workflow is not ready to ship.

# 2.0.0 — Features added since main

- Round layouts in Settings starts with Flowing, Prep, and Review presets. Save, rename, update, and delete named layouts with their own panel positions, sidebar widths, panel names and toolbar groups.
- Opening the next round resets the timers, Transcript, and SpeechDrop room. Closing and reopening the same browser save keeps its tools available for review.
- Drops preserve existing responses on blank cells. Typing a Transcript reference supersedes pending imports, and loading the next reference preserves earlier transcript classifications.
- Switching popups keeps one set of controls on screen. Delayed actions close only their own popup.
- Shorten the path into a shared round for first-time guests, and show an error for incomplete collaboration links.

- Telemetry onboarding choice, off by default for fresh users; anonymous workflow events, minute-level editing/tool summaries, deduplicated errors, strict property filtering, and no flow uploads/replay. Existing preferences migrate without collecting extra data.
- File menu is always available, with JSON, Excel, linked-folder save/copy, settings export, and flow/settings import. Removed the manual-save visibility setting.
- Disabled toolbar groups disappear entirely; hiding all groups removes the toolbar surface. The star icon appears only when the Starred panel is enabled, including collapsed positions.
- Dedicated Tabs icon, and tooltips anchored correctly inside transformed columns with viewport-edge flipping.

- Tabs panel: page navigation, side colors, drag reordering, debate-format page templates, speaker-order switching, Ctrl/Cmd and Shift multiselection, and deleting selected pages with Undo.
- Timers panel: speech and prep clocks available independently of a document; collapsed clocks keep running.
- Notes panel: document-wide private notes, saved with the round; accepts full text dragged from Autoflow blocks and flow arguments.
- Coverage panel: unanswered arguments and opponent drops across every flow page, speech selection, timer following, jump to argument, add response, extend one or all drops, and separate show/hide settings for dropped and extended arguments.
- Starred arguments panel: star cells, browse them across pages, add attached notes, unstar, and reveal arguments inside folded branches. Rows match each cell’s speech-column color.
- SpeechDrop panel: room file list, automatic refresh, upload, download, delete with confirmation, room-code synchronization with partners, and file drags into Autoflow, Transcript and CardMirror.
- Autoflow panel: load local or SpeechDrop DOCX files, browse heading blocks and tags, preview and multiselect blocks, and import them using plus buttons or drag and drop.
- Flow library panel: browse browser saves or a linked folder, navigate folders, preview and multiselect saved pages, and import them into the current round.
- Transcript panel: local microphone or tab-audio transcription, selectable audio controls, speech-document comparison, continuous speech while recording, possible analytics separated for review, optional analytics-only recording view, add-to-flow by button or dragging into cells, export, and clear.
- Collaboration panel: partner message history, a message composer with inline argument links, system notifications with a test notification, and in-app notification fallback.
- CardMirror panel and desktop companion plugin: direct WebRTC pairing, manual connection keys and a confirmation link, current-document and speech-document transfers, source navigation, and DOCX opening with transfer progress.
- Panel placement: Off, Left, Right, Left collapsed, or Right collapsed for every panel; adjustable sidebar widths; one tray-opened panel per side.
- Collapsed panels stay mounted so timers, recordings and connections keep running. Hovering a tray icon while dragging opens that panel for the drop.
- One card surface per panel; shared headers, rows, fields and statuses; animated body entry and card resizing; themes, spacing and motion settings apply throughout.
- Standard panel menus: panel commands, step-by-step walkthrough, settings, show/hide name, move left/right, collapse, and hide.
- Optional menu-only panels reclaim the title row for content; menu changes persist without opening Settings.
- Fresh default layout: Tabs on the left, Timers collapsed on the left, and no right sidebar.
- Panel-specific Settings sections; old layouts and legacy side-notes preferences migrate to the panel settings.
- Document panels show compact creation placeholders when no document is open. Independent tools remain available before opening a round.
- An open document with no pages shows large page-creation choices instead of the saved-flow library; page deletion can be undone.
- DOCX imports recognize debate headings, tags, citations and complete evidence, infer speech columns, match blocks to existing page names, and create pages for new positions.
- Autoflow settings for including citations in visible tags and showing connected CardMirror heading controls.
- Imported library pages and Autoflow blocks replace the current empty page by default, with a setting to keep empty pages instead.
- Drag selected blocks or library pages into tabs, onto an empty cell to replace it, onto a populated cell to add responses, or between arguments to insert siblings.
- Selected arguments drag with their descendants; internal moves preserve IDs and are undoable. Selection previews keep the arguments’ relative positions.
- Ctrl/Cmd-click individual cells, Shift-click ranges, and select children across different parents without including their parents. Multi-cell formatting and connected selection corners.
- Optional click-to-select and click-again-to-edit cell mode; selected cells can be dragged from their text areas.
- Native text selection stays text selection when the pointer leaves a cell.
- Complete CardMirror evidence snapshots retain citations, formatting and source references through JSON saves, cell copy/paste and saved-page imports.
- Drag attached cards directly into CardMirror; paste a CardMirror card into an empty flow cell. CardMirror panel drop targets send to the current or speech document.
- Incoming CardMirror cards support line-by-line or single-cell insertion, response insertion, page choice, reveal-in-flow and jump-to-source.
- SpeechDrop-to-CardMirror opening is configurable; an optional setting adds the Flew Notes promo to uploaded DOCX files.
- Optional timer starts from custom phrases or the first transcript match with the speech document, with CX/prep exclusion enabled by default.
- Optional word-count-weighted pacing, fixed cell allocations such as :30, and automatic selection of the next speech when time expires.
- Whisper model selection with WebGPU/WASM fallback, pause-based audio segmentation, silence and repetition filtering, and document comparison in shorter spans.
- Speech models preload when selected and stay loaded between recordings and panel visibility changes; inference is serialized and stale recording results are ignored.
- Partner messages and SpeechDrop room codes use the existing peer connection and host relay; notes remain private.
- Dismissible first-run setup with live preferences and settings import asks about debate style, Timers, Notes, SpeechDrop, light/dark mode and whether to take the tutorial. Returning users keep their existing preferences.
- The How to use Flew tutorial starts in the main area, moves into a temporary panel once a flow page exists, and highlights relevant controls. Back stays visible and is disabled on the first step. Flow management covers closing and reopening saved flows.
- Updated Help menu, panel guides, onboarding screens, homepage feature cards in the original layout, and application icon.
- Shortcut labels match their handlers, including star, save copy and page creation shortcuts that avoid browser-reserved combinations.
- Fixed settings-import and randomization freezes, invalid setting values, storage failures during popup closing, and timer state changes during transitions.
- Fixed tooltip resizing and viewport overflow, Coverage response focus across pages, library action wrapping, overlapping cell indicators, and stale pending edits when switching starred notes.
- Expanded browser, model, persistence, collaboration, drag-and-drop and CardMirror regression coverage; fixed clean Netlify plugin builds.

- TODO: Rewrite this feature inventory in the release voice.
- TODO: Consider searchable/grouped settings; keep the long scrolling page for now.

# Upstream changelog and roadmap

The following is retained from main for reference.

# 1.4.0 changes

- click and drag across cells to select them, with scrolling at the edges (dragging inside one cell still selects text)
- qr codes fit short windows now, and the camera preview scrolls into view
- Extemp Debate preset (aff/neg flows, speech timers, no prep)
- select cards and press Shift+Enter / add response to answer them together

  - keeps the cards separate, with a curved line from the bottom card to the reply
  - Shift+Enter on a grouped card adds another response to the group; the separate right-side plus is hidden
  - saved in JSON, shared with peers, and undoable

- fixed missing theme colors, custom accent text colors, and popup title font weights

# 1.3.0 changes

## persistancy update

- chrome lets you set a folder for autosaving flows
- firefox import folder list
- flow titles
- autosave and saving now work frfrfr
- more tests....

# 1.2.2 changes

- fixed collaboration
- qr code based connecting to rooms (side note: insane absurdly small qr codes for what they are)
- sharing icon now shows when you are offline
- lots of tests added
- fix cross browser sharing (firefox-chrome, safari-firefox, etc.)
- fix cross network sharing

# 1.2.1 changes

- manual save button now shows a checkmark and "saved!" tooltip when you save
- fixed description of shift + arrow setting to say "Shift + arrow selects cells"
- added a dedicated save icon for the manual save button
- fun mode setting is no longer saved
- service worker now only caches for offline use (network-first), and is skipped in dev mode
- randomize settings button no longer randomizes fun mode or telemetry
- enabling pacing now takes effect immediately without a refresh
- fixed focus going nowhere when deleting a box made with the plus button on a column header
- added a "suggest a feature" button in the help popup that links to the GitHub issues page
- documented the save, copy, and cut shortcuts in the shortcuts list
- telemetry now respects the Global Privacy Control browser signal
- focused box now stays a comfortable distance from the edges of the scroll area

# 1.2 changes

- telemetry
- Move to netlify
- Changed the lines a little
- Cell focus manipulation now wraps between flows
- Speech timer includes a Pacing timer, will tell you how much time you need to spend on each argument
  - Pacing will skip blank boxes and extensions
  - and if you mark how long an arg will take to say (for cards and such) the pacing will be adjusted around that
- Fun mode (EPILEPSY WARNING)
- Copy paste cut
- Selection that is real buggy
- manual saving button
- add saving notes doc
- nix shell stuff
- MAKE IT WORK OFFLINE, uses a service worker

# Planned

## long term goals (X..)

- flew share that can interop with tabroom share, email, maybe even usb
- flow disclosure is the new theory argument god bless
-

## Big features (.X. releases probably)

- Panels:
  - work being done on panels branch
- Theming engine:
  - Transparency
  - Image background
  - More default themes that are actually good
  - custom css
- CONNECTIONS: Control K, connect parts of flow together
  - xapp can be easily explained by clicking on it and going to that bit of the flow on a different page
  - i think you should be able to edit a link visually
  - make those links availible in notesdoc
- Tutorial that is good
  - explains timers
  - explains uuuh more stuff
- an editor to customize debate formats
- Transcript panel
  - local transcription
  - uses opposing speechdoc and catches things they say but not from doc, and tags n stuff (small story, at state i went against the winning team, only round in prelims i lost, they went for 5 minutes of santa in 2ar and it wasnt in their speechdoc ever. ugh.)
  - automatically start timer when opponent begins speaking from their doc
- Cardmirror integration
  - if we can make a communication system (web server running on cardmirror desktop? ugh i really wish it would work with just tabs though... and i dont want to fork cardmirror):
    - click on cards to go to them in the speech
    - when you want to read a card from your speechdoc and have pacing enabled it will automatically determine length based on cm settings about wpm n stuff
    - When writing a speech in flows if you @ (connect) a quick card it will add it to ur cardmirror speechdoc?
    - automatically put your latest speechdoc in the notes doc, invisified mode !
    - very big question though: neither program is keeping track of what speech the round is on really, sooo how do we coordinate stuff between them?
    - sync timers
  - cmir imports turn tags into preflows
  - there is a public api! wow!
  - they use a polyform license that is NOT compatible with gpl!!!!
  - i kind of want it so you can write analytics (or your partner or opponent does) in cmir and then some _local_ ai classification model that runs on your computer can figure out where those things need to go on the flow, the memory benifits of writing shit down only really matters once
- new collab features

  - mark box as OH GOD PLEASE COME UP WITH A RESPONSE IM GETTING THERE SOON AND IF I DONT HAVE ANYTHING TO SAY WE LOSE THIS ROUND
  - Give notification to other person
  - shared doc?
  - no more whispering ever is kind of the goal of this feature
  - names for guests in collab
  - view only guests (for opponents?) locked to only speeches that have already been given
  - im unsure how small of a feature this is, webrtc code based sharing? instead of copy paste? could be part of flew share
  - an easier way to do quick webrtc handshake is you scan a qr code on your phone, it brings up that same qr code on your phone which you can scan into another computer since it would be awkward doing it with just 2 computers pointing webcam at screen
  - is there a way to make the collab persistant if i disconnect and reconnect to wifi?

- history changes
  - make it so you can undo deleting a flow page
  - complete google docs style version history

## Small features/fixes (..X releases)

- evaluate if switching to the AGPL is possible, if so do it, do it (gpl kind of does not work for this project to ensure free-ness since its served over web)

TODO: replace the long Settings page with one selected category at a time.

TODO: investigate rendering a single half-megabyte argument; the large collaboration stress test currently stalls before pairing.

Fixed settings-related freezes: timer/pacing transitions, failed browser-storage writes when closing Settings, invalid animation durations, and corrupt or incompatible saved preferences. Fun mode keeps telemetry and transcription-model choices intact.
