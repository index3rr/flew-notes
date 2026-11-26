<script lang="ts">
	import Timer from './Timer.svelte';
	import SpeechTimer from './SpeechTimer.svelte';
	import PacingTimer from './PacingTimer.svelte';
	import type { TimerState, SpeechTimerState } from '$lib/models/timer';
	import { currentSpeech as publishedSpeech, speechClock } from '$lib/models/timer';
	import { roundToolsVersion } from '$lib/models/collaboration';
	import { timer } from '$lib/models/transition';
	import { settings } from '$lib/models/settings';
	import { onDestroy } from 'svelte';
	import { debateStyles, debateStyleMap, type DebateStyle } from '$lib/models/debateStyle';
	import { nodes } from '$lib/models/store';
	import type { Nodes } from '$lib/models/node';

	let states: {
		prep?: TimerState;
		prepSecondary?: TimerState;
		speech: SpeechTimerState;
	};

	let showTimers = true;

	let debateStyleIndex = settings.data['debateStyle'].value as number;
	let debateStyle: DebateStyle = debateStyles[debateStyleMap[debateStyleIndex]];
	onDestroy(
		settings.subscribe(['debateStyle'], (key: string) => {
			let newDebateStyleIndex = settings.data[key].value as number;
			if (newDebateStyleIndex === debateStyleIndex) return;
			debateStyleIndex = newDebateStyleIndex;
			debateStyle = debateStyles[debateStyleMap[debateStyleIndex]];
			resetStates();
		})
	);

	let pacingEnabled = settings.data.pacingEnabled.value as boolean;
	onDestroy(
		settings.subscribe(['pacingEnabled'], (key: string) => {
			pacingEnabled = settings.data[key].value as boolean;
		})
	);

	function resetStates() {
		let newStates: typeof states = {
			speech: {
				resetTimeIndex: 0,
				time: debateStyle?.timerSpeeches[0].time,
				state: { name: 'paused' }
			}
		};
		if (debateStyle?.prepTime != null) {
			newStates.prep = {
				resetTime: debateStyle.prepTime,
				time: debateStyle.prepTime,
				state: { name: 'paused' }
			};
			newStates.prepSecondary = {
				resetTime: debateStyle.prepTime,
				time: debateStyle.prepTime,
				state: { name: 'paused' }
			};
		}
		states = newStates;
	}

	$: $roundToolsVersion, resetStates();

	let currentNodes: Nodes;
	onDestroy(nodes.subscribe((n) => (currentNodes = n)));

	$: currentSpeech = debateStyle.timerSpeeches[states.speech.resetTimeIndex];
	$: pacingPalette = currentSpeech?.secondary ? 'accent-secondary' : 'accent';
	$: if (currentSpeech) {
		speechClock.name = currentSpeech.name;
		speechClock.resetTime = currentSpeech.time;
		speechClock.time = states.speech.time;
		speechClock.running = states.speech.state.name === 'running';
	}
	// Publish only once the timer is in use; an untouched timer sitting on the first speech
	// says nothing about where the round is.
	$: timerInUse =
		states.speech.resetTimeIndex !== 0 ||
		states.speech.state.name === 'running' ||
		states.speech.time !== currentSpeech?.time;
	// Keyed by index too: policy has several speeches named CX.
	$: publishedKey = timerInUse && currentSpeech ? states.speech.resetTimeIndex : null;
	let lastPublishedKey: number | null = null;
	$: if (publishedKey !== lastPublishedKey) {
		lastPublishedKey = publishedKey;
		publishedSpeech.set(
			publishedKey !== null && currentSpeech
				? {
						name: currentSpeech.name,
						secondary: currentSpeech.secondary,
						upcoming: debateStyle.timerSpeeches
							.slice(states.speech.resetTimeIndex)
							.map((speech) => speech.name)
				  }
				: null
		);
	}
	onDestroy(() => publishedSpeech.set(null));
</script>

<div class="top">
	<!-- Keep outgoing timer bindings attached to their original state during transitions.
	     Toggling pacing only changes the pacing UI, not the speech/prep timer instances. -->
	{#each [states] as timerStates (timerStates)}
		{#if showTimers}
			<div class="timer" transition:timer>
				{#if timerStates.prep}
					<Timer
						resetTime={timerStates.prep.resetTime}
						label="primary prep timer"
						bind:time={timerStates.prep.time}
						bind:state={timerStates.prep.state}
						palette={'accent'}
					/>
				{/if}
				{#if timerStates.prepSecondary}
					<Timer
						resetTime={timerStates.prepSecondary.resetTime}
						label="secondary prep timer"
						bind:time={timerStates.prepSecondary.time}
						bind:state={timerStates.prepSecondary.state}
						palette={'accent-secondary'}
					/>
				{/if}
				<SpeechTimer
					speeches={debateStyle.timerSpeeches}
					bind:resetTimeIndex={timerStates.speech.resetTimeIndex}
					bind:time={timerStates.speech.time}
					bind:state={timerStates.speech.state}
				/>
				{#if pacingEnabled}
					<PacingTimer
						nodes={currentNodes}
						mainTimerTime={timerStates.speech.time}
						isRunning={timerStates.speech.state.name === 'running'}
						palette={pacingPalette}
					/>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	div.top {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.timer {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		width: 100%;
		height: auto;
	}
</style>
