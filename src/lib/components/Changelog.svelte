<script lang="ts">
	import { openPopup } from '$lib/models/popup';
	import { setLastChangelogVersion } from '$lib/models/version';
	import { onMount } from 'svelte';
	import Button from './Button.svelte';
	import Help from './Help.svelte';
	import Share from './Share.svelte';
	import Shortcut from './Shortcut.svelte';

	export let closePopup: () => void;

	onMount(() => setLastChangelogVersion());
</script>

<div class="top palette-plain">
	<div class="scroll">
		<section>
			<div class="above"><h2>v2.0.0</h2></div>
			<ul>
				<li>
					Telemetry choice in onboarding; batched usage counts, completed workflows and deduplicated
					errors replace per-box events and flow uploads. Fresh installs start with telemetry off.
				</li>
				<li>
					Permanent File menu with import, JSON/Excel export, settings export and linked-folder
					saves/copies. Removed the manual-save visibility setting.
				</li>
				<li>
					Disabled toolbar groups are removed; the star icon follows the Starred panel. Dedicated
					Tabs icon and tooltips that stay near their buttons and flip at screen edges.
				</li>

				<li>
					Tabs panel: page navigation, side colors, drag reordering, debate-format page templates,
					speaker-order switching, Ctrl/Cmd and Shift multiselection, and deleting selected pages
					with Undo.
				</li>
				<li>
					Timers panel: speech and prep clocks available independently of a document; collapsed
					clocks keep running.
				</li>
				<li>
					Notes panel: document-wide private notes, saved with the round; accepts full text dragged
					from Autoflow blocks and flow arguments.
				</li>
				<li>
					Coverage panel: unanswered arguments and opponent drops across every flow page, speech
					selection, timer following, jump to argument, add response, extend one or all drops, and
					separate show/hide settings for dropped and extended arguments.
				</li>
				<li>
					Starred arguments panel: star cells, browse them across pages, add attached notes, unstar,
					and reveal arguments inside folded branches. Rows match each cell’s speech-column color.
				</li>
				<li>
					SpeechDrop panel: room file list, automatic refresh, upload, download, delete with
					confirmation, room-code synchronization with partners, and file drags into Autoflow,
					Transcript and CardMirror.
				</li>
				<li>
					Autoflow panel: load local or SpeechDrop DOCX files, browse heading blocks and tags,
					preview and multiselect blocks, and import them using plus buttons or drag and drop.
				</li>
				<li>
					Flow library panel: browse browser saves or a linked folder, navigate folders, preview and
					multiselect saved pages, and import them into the current round.
				</li>
				<li>
					Transcript panel: local microphone or tab-audio transcription, selectable audio controls,
					speech-document comparison, continuous speech while recording, possible analytics
					separated for review, optional analytics-only recording view, add-to-flow by button or
					dragging into cells, export, and clear.
				</li>
				<li>
					Collaboration panel: partner message history, a message composer with inline argument
					links, system notifications with a test notification, and in-app notification fallback.
				</li>
				<li>
					CardMirror panel and desktop companion plugin: direct WebRTC pairing, manual connection
					keys and a confirmation link, current-document and speech-document transfers, source
					navigation, and DOCX opening with transfer progress.
				</li>
				<li>
					Panel placement: Off, Left, Right, Left collapsed, or Right collapsed for every panel;
					adjustable sidebar widths; one tray-opened panel per side.
				</li>
				<li>
					Round layouts in Settings includes Flowing, Prep, and Review presets. Save, rename, or
					delete your own layouts. Timers, transcript, and the SpeechDrop room reset when you open
					the next round.
				</li>
				<li>
					Collapsed panels stay mounted so timers, recordings and connections keep running. Hovering
					a tray icon while dragging opens that panel for the drop.
				</li>
				<li>
					One card surface per panel; shared headers, rows, fields and statuses; animated body entry
					and card resizing; themes, spacing and motion settings apply throughout.
				</li>
				<li>
					Standard panel menus: separate panel commands and shared options; step-by-step
					walkthroughs with maintainer-written instructions and shortcut badges; settings; show/hide
					name; and persistent move left/right, collapse, and hide controls.
				</li>
				<li>
					Optional menu-only panels reclaim the title row for content; menu changes persist without
					opening Settings.
				</li>
				<li>
					Fresh default layout: Tabs on the left, Timers collapsed on the left, and no right
					sidebar.
				</li>
				<li>
					Panel-specific Settings sections; old layouts and legacy side-notes preferences migrate to
					the panel settings.
				</li>
				<li>
					Document panels show compact creation placeholders when no document is open. Independent
					tools remain available before opening a round.
				</li>
				<li>
					An open document with no pages shows large page-creation choices instead of the saved-flow
					library; page deletion can be undone.
				</li>
				<li>
					DOCX imports recognize debate headings, tags, citations and complete evidence, infer
					speech columns, match blocks to existing page names, and create pages for new positions.
				</li>
				<li>
					Autoflow settings for including citations in visible tags and showing connected CardMirror
					heading controls.
				</li>
				<li>
					Imported library pages and Autoflow blocks replace the current empty page by default, with
					a setting to keep empty pages instead.
				</li>
				<li>
					Drag selected blocks or library pages into tabs, onto an empty cell to replace it, onto a
					populated cell to add responses, or between arguments to insert siblings.
				</li>
				<li>
					Selected arguments drag with their descendants; internal moves preserve IDs and are
					undoable. Selection previews keep the arguments’ relative positions.
				</li>
				<li>
					Ctrl/Cmd-click individual cells, Shift-click ranges, and select children across different
					parents without including their parents. Multi-cell formatting and connected selection
					corners.
				</li>
				<li>
					Optional click-to-select and click-again-to-edit cell mode; selected cells can be dragged
					from their text areas.
				</li>
				<li>Native text selection stays text selection when the pointer leaves a cell.</li>
				<li>
					Complete CardMirror evidence snapshots retain citations, formatting and source references
					through JSON saves, cell copy/paste and saved-page imports.
				</li>
				<li>
					Drag attached cards directly into CardMirror; paste a CardMirror card into an empty flow
					cell. CardMirror panel drop targets send to the current or speech document.
				</li>
				<li>
					Incoming CardMirror cards support line-by-line or single-cell insertion, response
					insertion, page choice, reveal-in-flow and jump-to-source.
				</li>
				<li>
					SpeechDrop-to-CardMirror opening is configurable; an optional setting adds the Flew Notes
					promo to uploaded DOCX files.
				</li>
				<li>
					Optional timer starts from custom phrases or the first transcript match with the speech
					document, with CX/prep exclusion enabled by default.
				</li>
				<li>
					Optional word-count-weighted pacing, fixed cell allocations such as :30, and automatic
					selection of the next speech when time expires.
				</li>
				<li>
					Whisper model selection with WebGPU/WASM fallback, pause-based audio segmentation, silence
					and repetition filtering, and document comparison in shorter spans.
				</li>
				<li>
					Speech models preload when selected and stay loaded between recordings and panel
					visibility changes; inference is serialized and stale recording results are ignored.
				</li>
				<li>
					Partner messages and SpeechDrop room codes use the existing peer connection and host
					relay; notes remain private.
				</li>
				<li>
					Dismissible first-run setup with live preferences and settings import asks about debate
					style, Timers, Notes, SpeechDrop, light/dark mode and whether to take the tutorial.
					Returning users keep their existing preferences.
				</li>
				<li>
					The How to use Flew tutorial starts in the main area, moves into a temporary panel once a
					flow page exists, and highlights relevant controls. Back stays visible and is disabled on
					the first step. Flow management covers closing and reopening saved flows.
				</li>
				<li>
					Updated Help menu, panel guides, onboarding screens, homepage feature cards in the
					original layout, and application icon.
				</li>
				<li>
					Shortcut labels match their handlers, including star, save copy and page creation
					shortcuts that avoid browser-reserved combinations.
				</li>
				<li>
					Fixed settings-import and randomization freezes, invalid setting values, storage failures
					during popup closing, and timer state changes during transitions.
				</li>
				<li>
					Fixed tooltip resizing and viewport overflow, Coverage response focus across pages,
					library action wrapping, overlapping cell indicators, and stale pending edits when
					switching starred notes.
				</li>
				<li>
					Expanded browser, model, persistence, collaboration, drag-and-drop and CardMirror
					regression coverage; fixed clean Netlify plugin builds.
				</li>
			</ul>
		</section>

		<section>
			<div class="above"><h2>v1.4.0</h2></div>
			the selection and grouped responses update
			<ul>
				<li>
					click and drag across cells to select them; dragging inside one cell still selects text
				</li>
				<li>
					select cards and press <Shortcut keys={['shift', 'return']} /> or use add response to answer
					them together, with a curved line connecting the group to its last response
				</li>
				<li>extemp db8 now has a preset</li>
				<li>qr collab improvements</li>
				<li>slightly better styling</li>
			</ul>
		</section>
		<section>
			<div class="above"><h2>v1.3.1</h2></div>
			the 'make collaboration less buggy' update
			<ul>
				<li>its better now</li>
				<li>look its bug fixes and stability improvements</li>
				<li>its not that interesting</li>
				<li>...</li>
				<li>..... prevents extinction...</li>
			</ul>
		</section>
		<section>
			<div class="above"><h2>v1.3.0</h2></div>
			the flow library update
			<ul>
				<li>
					on select browsers you can now link a folder to your 'flow library' (disablable in
					settings jsyk)
				</li>
				<li>with this, autosaves are saved to the real file you opened</li>
				<li>
					on unsupported browsers for this like firefox and safari you can mass import flows from a
					folder
				</li>
				<li>
					you can now name flows (and when you do the file name changes as well!!! no more
					flow(98).json)
				</li>
				<li>
					autosave is now waaay less likely to drop your changes, and its very clear what is being
					saved
				</li>
				<li>
					you can now edit how many local saves you can have stored in the browser before it starts
					deleting old ones
				</li>
			</ul>
		</section>
		<section>
			<div class="above"><h2>v1.2.2</h2></div>
			<ul>
				<li>live flow collaboration works again, cross browser and cross network!</li>
				<li>you can now start collaboration using a QR code</li>
				<li>
					collaboration menu will no longer let you try and fail to share your flows while offline
				</li>
				<li>prevents extinction</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.2.1</h2>
			</div>
			<ul>
				<li>Save button improvements</li>
				<li>Changed setting description</li>
				<li>The current focus will scroll into frame with padding</li>
				<li>Fun mode will no longer persist upon refreshing</li>
				<li>Offline usage improvements</li>
				<li>All shortcuts now documented</li>
				<li>Now 220% more GDPR compliant!</li>
				<li>Prevents extinction</li>
			</ul>
			<div class="above">
				<h2>v1.2.0</h2>
			</div>
			<ul>
				Pacing:
				<ul>
					<li>
						Pacing is a feature that can be enabled in settings which will look at all non blank
						cells in your flow for the currently focused column, and when you start the timer, show
						a secondary timer for the current focused cell. If you read that cell in the time it
						gives you and move to the next one by pushing the down arrow, you should finish the
						speech with exactly the amount of seconds in the 'Grace Period' setting remaining to
						recap arguments, etc.
					</li>
				</ul>
				<li>Added Cut/Copy/Paste. How did we live without it!</li>
				<li>Added selection, Shift + Click/Arrows to use</li>
				<li>Cell focus now wraps</li>
				<li>Added optionally dotted lines</li>
				<li>Added fun mode setting (EPILEPSY WARNING)</li>
				<li>
					Manual save button and shortcut (<Shortcut keys={['control', 's']} inline />)
				</li>
				<li>Prevents extinction</li>
				look at me mom, i can write normal patch notes!
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.8</h2>
			</div>
			<ul>
				<li>
					this is where the fork happend!!!!!!! everything before this is from
					<a href="https://github.com/Ashwagandhae/debate-flow">
						https://github.com/Ashwagandhae/debate-flow</a
					>
				</li>
				<li>
					basically, i found this legal loophole called gpl3 which allows me to take this code for
					myself and then add my github to it and stuff and then improve apon it and offer it for
					free for the purposes of public good, that ?dude? (no pronouns on the other ?guys? github
					this is why i have to take over) must be so pissed
				</li>
				<li>
					thought really hard about what i want to do and decided to move to netlify (if ya didnt
					know: vercel is tight with the big benny yahu)
				</li>
				<li>
					oh my god bruh i talk like im an idiot when im trying to write stupid stuff to
					procrastinate doing actual work :// i swear im a normal person.
				</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.7</h2>
			</div>
			<ul>
				<li>
					added quick response shortcut. Press <Shortcut
						keys={['shift', 'option', 'return']}
						inline
					/> while responding to one argument to create a response to the next argument.
				</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.6</h2>
			</div>
			<ul>
				<li>
					added quick extensions. Click <Button icon="arrowRightThroughCircle" inline /> or press <Shortcut
						keys={['commandControl', 'E']}
						inline
					/> while highlighting a cell to extend that cell to the next speech. Thanks to
					<a href="https://github.com/JadenTepper">JadenTepper</a> for implementing!
				</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.5</h2>
			</div>
			<ul>
				<li>
					added cell folding. click <Button icon="foldArrows" inline /> or press <Shortcut
						keys={['control', 'L']}
						inline
					/> to fold and unfold cells. Folding a cell hides any responses so you can minimize unimportant
					parts of the debate.
				</li>
				<li>
					added setting that makes pressing enter always create a new a cell instead of sometimes
					moving focus.
				</li>
				<li>fixed bug where notes doc would clear on tab switch.</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.4</h2>
			</div>
			<ul>
				<li>made settings headers clickable.</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.3</h2>
			</div>
			<ul>
				<li>added classic debate format.</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.2</h2>
			</div>
			<ul>
				<li>
					added text bolding. click <Button icon="letterB" inline /> or press <Shortcut
						keys={['commandControl', 'b']}
						inline
					/> to toggle bold.
				</li>
				<li>the formatting of selected cells now shows in the toolbar.</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.1</h2>
			</div>
			<ul>
				<li>when sharing, disallowed editing before initial sync.</li>
				<li>made uploading files and opening saved flows work through sharing.</li>
			</ul>
		</section>
		<section>
			<div class="above">
				<h2>v1.1.0</h2>
			</div>
			<ul>
				<li>
					added WebRTC-based sharing, click on <Button
						icon="people"
						on:click={() => {
							closePopup();
							openPopup(Share, 'Share');
						}}
						inline
					/> to try it out! You can now collaborate on your flows live with as many people as you want.
				</li>
				<li>
					removed sheet sharing. You can still access sheet sharing in the <a
						href="https://debate-flow-git-sheet-sharing-ashwagandhae.vercel.app/app/"
						>legacy version</a
					>, but please <Button
						text="let me know"
						icon="link"
						on:click={() => {
							closePopup();
							openPopup(Help, 'Help');
						}}
						inline
					/> why WebRTC sharing doesn't working for you.
				</li>
			</ul>
		</section>
	</div>
</div>

<style>
	.top {
		padding-top: calc(var(--button-size) + var(--padding) * 2);
		width: min(calc(100vw - var(--padding) * 2), 500px);
		height: min(calc(100vh - var(--padding) * 2), min-content);
		box-sizing: border-box;
		display: grid;
		grid-template-columns: 1fr;
		overflow: auto;
		background: var(--background);
	}

	.scroll {
		width: 100%;
		height: 20rem;
		overflow: auto;
	}
	section {
		width: 100%;
		padding: var(--padding-big);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		color: var(--text);
		background: var(--background);
	}

	ul {
		line-height: 1.6em;
		margin: 0;
		padding-left: var(--padding-big);
		text-align: left;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
</style>
