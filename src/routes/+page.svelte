<script lang="ts">
	import Benefit from '$lib/components/Benefit.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import HeroDemo from '$lib/components/scenes/HeroDemo.svelte';
	import PacingScene from '$lib/components/scenes/PacingScene.svelte';
	import SpacingScene from '$lib/components/scenes/SpacingScene.svelte';
	import TabScene from '$lib/components/scenes/TabScene.svelte';
	import KeyboardScene from '$lib/components/scenes/KeyboardScene.svelte';
	import SettingsScene from '$lib/components/scenes/SettingsScene.svelte';
	import PanelsScene from '$lib/components/scenes/PanelsScene.svelte';
	import AutoflowScene from '$lib/components/scenes/AutoflowScene.svelte';
	import CoverageScene from '$lib/components/scenes/CoverageScene.svelte';
	import EvidenceScene from '$lib/components/scenes/EvidenceScene.svelte';
	import TranscriptScene from '$lib/components/scenes/TranscriptScene.svelte';
	import ConvertScene from '$lib/components/scenes/ConvertScene.svelte';
	import CollaborateScene from '$lib/components/scenes/CollaborateScene.svelte';
	import IHaveToGetWorkOnThisDoneOrItsGoingToLookLikeIJustMadeThisForkBecauseIDontLikeVercel from '$lib/components/scenes/IHaveToGetWorkOnThisDoneOrItsGoingToLookLikeIJustMadeThisForkBecauseIDontLikeVercel.svelte';

	import Flower from '$lib/components/scenes/Flower.svelte';

	// Hero copy. Empty strings are hidden.
	const tagline = "The only flowing app that doesnt suck.";
	const subtitle = '';
	const beginLabel = 'Flow';

	// Footer copy. Links without text are skipped, and empty notes are hidden.
	const footerLinks: { text: string; href: string }[] = [
		{ text: 'Source Code on Github', href: 'https://github.com/index3rr/flew-notes' },
		{ text: 'This project is a fork of Flower', href: 'https://github.com/Ashwagandhae/debate-flow' }
	];
	const footerNotes: string[] = ['', ''];

	let hover = false;
</script>

<svelte:head>
	<title>Flew Notes</title>
	<meta
		name="description"
		content="Customizable debate flowing with reusable evidence, DOCX Autoflow, local transcription, timers and partner collaboration. No account required."
	/>
</svelte:head>

<main>
	<article>
		<section class="title">
			<div class="words">
				<h1><em>Flew</em> Notes</h1>
				{#if tagline}<p>{tagline}</p>{/if}
				{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
			</div>
			<a href="./app" class="flowerholder">
				<Flower {hover} />
				<button
					on:mouseenter={() => (hover = true)}
					on:mouseover={() => (hover = true)}
					on:focus={() => (hover = true)}
					on:mouseleave={() => (hover = false)}
					on:mouseout={() => (hover = false)}
					on:blur={() => (hover = false)}
					class="tryit">{beginLabel}</button
				>
			</a>
		</section>
		<section class="demo">
			<HeroDemo />
		</section>
		<div class="why">
			<Icon name="arrowDown" size="3rem" />
		</div>
		<section class="group">
			<h2>Flow faster</h2>
			<div class="benefits">
				<Benefit
					title="Perfect Pacing"
					detail="Budget speech time across arguments, optionally weighted by word count. Type :30 in a cell to reserve thirty seconds."
					component={PacingScene}
					still={2000}
				/>
				<Benefit
					title="Super Spacing"
					detail="Stop guessing how many responses your opponent will make—arguments will automatically move out of the way."
					component={SpacingScene}
					still={1500}
				/>
				<Benefit
					title="Optimal Organization"
					detail="Organize and rearrange your flow sheets quickly with color-coded and renamable tabs."
					component={TabScene}
					still={2600}
				/>
				<Benefit
					title="Minimal Mousing"
					detail="Use the arrow keys and keyboard shortcuts to edit your flow, and leave your mouse alone."
					component={KeyboardScene}
					still={0}
				/>
				<Benefit
					title="Precise Personalization"
					detail="Change the color theme, font, accent colors, spacing, and more to customize your flow."
					component={SettingsScene}
					still={3000}
				/>
			</div>
		</section>
		<section class="group">
			<h2>Prep and evidence</h2>
			<div class="grid">
				<Benefit
					compact
					title="Personal Panels"
					detail="Put timers, notes, coverage and more on either side of your flow, or tuck them away until you need them."
					component={PanelsScene}
					still={3600}
				/>
				<Benefit
					compact
					title="Automatic Autoflow"
					detail="Open a speech doc, or grab one from SpeechDrop, and drag its tags straight onto your flow."
					component={AutoflowScene}
					still={2600}
				/>
				<Benefit
					compact
					title="Complete Coverage"
					detail="See every argument you haven't answered yet, and respond to it with one click."
					component={CoverageScene}
					still={3000}
				/>
				<Benefit
					compact
					title="Endless Evidence"
					detail="Keep full cards attached to your tags, and reuse pages from your flow library in later rounds."
					component={EvidenceScene}
					still={2400}
				/>
				<Benefit
					compact
					title="Total Transcription"
					detail="Transcribe the round on your own device, and spot what they said that wasn't in their speech doc."
					component={TranscriptScene}
					still={4500}
				/>
				<Benefit
					compact
					title="Fabulous Files"
					detail="Convert your flow to an Excel file with the click of a button, or save it as a JSON file to edit later."
					component={ConvertScene}
					still={2200}
				/>
			</div>
		</section>
		<section class="group">
			<h2>With your partner</h2>
			<div class="benefits">
				<Benefit
					title="Simple Sharing"
					detail="Flow the same round with as many people as you want, in real time, and send your partner links to exact arguments. No sign-in required."
					component={CollaborateScene}
					still={3800}
				/>
			</div>
		</section>
		<div class="benefits">
			<Benefit
				title="Woke Wins"
				detail="No more netenyahu."
				component={IHaveToGetWorkOnThisDoneOrItsGoingToLookLikeIJustMadeThisForkBecauseIDontLikeVercel}
				still={3000}
			/>
		</div>
		<a href="./app" class="tryagain">
			<span class="tryit">
				{beginLabel}<Icon name="arrowRight" size="4rem" />
			</span>
		</a>
		<footer class="footer">
			<nav>
				{#each footerLinks.filter((link) => link.text) as link}
					<a href={link.href} target="_blank" rel="noreferrer">{link.text}</a>
				{/each}
			</nav>
			{#each footerNotes.filter((note) => note) as note}
				<p>{note}</p>
			{/each}
		</footer>
	</article>
</main>

<style>
	:global(body) {
		width: 100vw;
		height: 100vh;
		margin: 0;
		padding: 0;
		overflow-y: scroll;
		overflow-x: clip;
	}
	main {
		display: flex;
		flex-direction: column;
		align-items: center;

		height: auto;
		box-sizing: border-box;
		position: relative;
		overflow-x: hidden;
	}
	article {
		display: flex;
		flex-direction: column;

		width: 80vw;
		height: auto;
		padding: var(--padding);
		box-sizing: border-box;
		padding: 10rem 0 0 0;
		gap: var(--padding);
	}

	section.title {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 3rem;
		width: 100%;
		height: 30rem;
		border-radius: var(--border-radius);
		box-sizing: border-box;
	}
	div.why {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: auto;
		padding: 4rem 0;
		color: var(--text-weak);
	}

	div.words {
		z-index: 1000;
		width: 100%;
		height: auto;
		font-size: 2rem;

		/* padding: 0 3rem; */
	}
	.words p {
		margin: 0;
		line-height: 3.5rem;
	}
	.words h1 {
		padding-bottom: 2rem;
	}

	h1 {
		font-size: 5rem;
		font-weight: var(--font-weight-bold);
	}

	a {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	.flowerholder {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: auto;
	}
	.tryit {
		font-size: 3rem;
		font-weight: var(--font-weight-bold);
		padding: 3rem;

		color: inherit;
		display: flex;
		flex-direction: row;
		align-items: center;
		border: none;
		border-radius: calc(var(--border-radius));
		background: transparent;
		gap: 1rem;
	}

	.words .subtitle {
		padding-top: 1rem;
		font-size: 1.25rem;
		line-height: 2;
		color: var(--text-weak);
	}
	section.demo {
		width: 100%;
		padding-top: 3rem;
	}

	section.group {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		width: 100%;
	}
	.group + .group {
		padding-top: 5rem;
	}
	.group h2 {
		padding: 0 0 2rem 0;
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		color: var(--text-weak);
		text-align: center;
	}
	.benefits {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: var(--padding);
		height: auto;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: var(--padding);
	}
	.group + .benefits {
		padding-top: 5rem;
	}
	a.tryagain {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		margin-top: 5rem;

		width: 100%;
		height: auto;
		border-radius: var(--border-radius);
		box-sizing: border-box;
		background: var(--background);
		transition: background var(--transition-speed) ease-in-out;
	}
	.tryagain .tryit {
		height: 100%;
		padding: 3rem;
	}
	.tryagain:hover {
		background: var(--background-accent-active);
	}
	footer.footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 8rem 1rem 3rem 1rem;
		width: 100%;
		box-sizing: border-box;
		color: var(--text-weak);
		text-align: center;
	}
	.footer nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem 2rem;
	}
	.footer nav a {
		color: var(--text);
	}
	.footer nav a:hover {
		color: var(--text-accent);
	}
	.footer p {
		margin: 0;
		max-width: 40rem;
		line-height: 1.8;
	}
	@media (prefers-reduced-motion: reduce) {
		.flowerholder :global(.top) {
			animation: none;
		}
	}
	@media (max-width: 700px) {
		h1 {
			font-size: 3rem;
		}
		.words {
			display: flex;
			flex-direction: column;
			align-items: center;
		}
		.words p {
			font-size: 1.5rem;
		}
		.words .subtitle {
			font-size: 1.1rem;
			text-align: center;
		}

		.tryit {
			font-size: 2rem;
		}
		article {
			width: calc(100vw - 2rem);
		}
		section.demo {
			padding-top: 6rem;
		}
		section.title {
			flex-direction: column;
			padding: 1rem;
			gap: 3rem;
		}

		a.tryagain {
			flex-direction: column;
			padding: 1rem;
			gap: 3rem;
		}
		.tryagain .tryit {
			padding: 1rem;
		}
	}
</style>
