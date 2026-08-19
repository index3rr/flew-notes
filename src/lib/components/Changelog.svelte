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
						Pacing is a feature that can be enabled in settings which will look at all non blank cells in your flow for the currently focused column, and when you start the timer, show a secondary timer for the current focused cell. If you read that cell in the time it gives you and move to the next one by pushing the down arrow, you should finish the speech with exactly the amount of seconds in the 'Grace Period' setting remaining to recap arguments, etc.
					</li>
				</ul>
				<li>
					Added Cut/Copy/Paste. How did we live without it!
				</li>
				<li>
					Added selection, Shift + Click/Arrows to use
				</li>
				<li>
					Cell focus now wraps 
				</li>
				<li>
					Added optionally dotted lines
				</li>
				<li>
					Added fun mode setting (EPILEPSY WARNING)
				</li>
				<li>
					Manual save button and shortcut (<Shortcut
						keys={['control', 's']}
						inline
					/>)
				</li>
				<li>
					Prevents extinction
				</li>
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
					<a href="https://github.com/Ashwagandhae/debate-flow"> https://github.com/Ashwagandhae/debate-flow</a>
				</li>
				<li>
					basically, i found this legal loophole called gpl3 which allows me to take this code for myself and then add my github to it and stuff and then improve apon it and offer it for free for the purposes of public good, that ?dude? (no pronouns on the other ?guys? github this is why i have to take over) must be so pissed 
				</li>
				<li>
					thought really hard about what i want to do and decided to move to netlify (if ya didnt know: vercel is tight with the big benny yahu)
				</li>
				<li>
					oh my god bruh i talk like im an idiot when im trying to write stupid stuff to procrastinate doing actual work :// i swear im a normal person.
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
		color: var(--color-subtle);
		text-align: left;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
</style>
