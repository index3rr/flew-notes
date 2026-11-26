<script lang="ts">
	import { trackFeatureUsed } from '$lib/models/telemetry';
	import { loadSpeechModel, releaseSpeechModel, speechModelState } from '$lib/models/speechModel';
	const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
	import { panelDrop } from '$lib/models/panelDrop';

	import { fileMime, boxesMime, droppedDocument, documentText } from '$lib/models/panelDrag';
	import type { SerializedBox } from '$lib/models/node';
	import { afterUpdate, onDestroy, tick } from 'svelte';
	import Button from '../Button.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelField from './PanelField.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import {
		roundToolsVersion,
		speechDocument,
		speechDropCode,
		speechDetected,
		speechDocumentSource,
		transcribedPhrase
	} from '$lib/models/collaboration';
	import {
		cleanTranscript,
		deduplicateTranscript,
		compareSpeech,
		transcriptSpans,
		formatClock,
		Segmenter
	} from '$lib/models/transcript';
	import { speechClock, speechElapsed, currentSpeech } from '$lib/models/timer';
	import { downloadString } from '$lib/models/file';
	import { settings } from '$lib/models/settings';
	import { nodes, frozen } from '$lib/models/store';
	import { currentArgument, showArgument } from '$lib/models/argumentNavigation';
	import { selectedFlowId } from '$lib/models/focus';
	import { insertTextNear } from '$lib/models/nodeDecorateAction';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';

	type Entry = {
		id: number;
		text: string;
		outside: boolean;
		hasReference: boolean;
		speech: string;
		at: number;
	};
	type Source = 'microphone' | 'tab';

	let entries: Entry[] = [];
	let referenceInput: HTMLInputElement;
	function panelActions() {
		return [
			{
				label: 'Load speech document',
				disabled: active || loading || finishing,
				run: () => referenceInput.click()
			},
			{
				label: 'Paste speech text',
				disabled: active || loading || finishing,
				run: async () => {
					cancelDocument();
					const request = documentRequest;
					error = '';
					try {
						const text = await navigator.clipboard.readText();
						if (request !== documentRequest) return;
						speechDocument.set(text);
						speechDocumentSource.set(null);
					} catch {
						if (request === documentRequest) error = 'Could not read clipboard.';
					}
				}
			}
		];
	}
	let status = '';
	let error = '';
	let active = false;
	let loading = false;
	let finishing = false;
	let source: Source = 'microphone';
	$: modelLabel = $speechModelState.label;
	let worker: Worker | undefined;
	let context: AudioContext | undefined;
	let stream: MediaStream | undefined;
	let capture: AudioWorkletNode | undefined;
	let segmenter: Segmenter | undefined;
	let queue: { audio: Float32Array; speech: string; at: number }[] = [];
	let busy: { speech: string; at: number; requestId: string } | null = null;
	let resampling = 0;
	let generation = 0;
	let detected = false;

	onDestroy(
		speechDocument.subscribe(() => {
			detected = false;
		})
	);
	let previousSpeech = '';
	onDestroy(
		currentSpeech.subscribe((speech) => {
			const key = speech?.upcoming.join('|') ?? '';
			if (key !== previousSpeech) {
				detected = false;
				previousSpeech = key;
			}
		})
	);
	let started = 0;
	const maxQueue = 12;

	function stop() {
		generation++;
		active = false;
		loading = false;
		finishing = false;
		capture?.disconnect();
		capture?.port.close();
		stream?.getTracks().forEach((track) => track.stop());
		void context?.close();
		capture = undefined;
		context = undefined;
		stream = undefined;
		releaseSpeechModel(worker);
		worker = undefined;
		segmenter = undefined;
		queue = [];
		busy = null;
		resampling = 0;
	}

	// Label a piece of audio with the speech it belongs to and how far into that speech it began.
	function stamp(seconds: number) {
		if (speechClock.name)
			return { speech: speechClock.name, at: Math.max(0, speechElapsed() - seconds * 1000) };
		return { speech: '', at: Math.max(0, Date.now() - started - seconds * 1000) };
	}

	async function enqueue(audio: Float32Array, rate: number, token: number) {
		const label = stamp(audio.length / rate);
		resampling++;
		try {
			let samples = audio;
			if (rate !== 16000) {
				const resampler = new OfflineAudioContext(
					1,
					Math.ceil((audio.length * 16000) / rate),
					16000
				);
				const buffer = resampler.createBuffer(1, audio.length, rate);
				buffer.copyToChannel(audio, 0);
				const node = resampler.createBufferSource();
				node.buffer = buffer;
				node.connect(resampler.destination);
				node.start();
				samples = (await resampler.startRendering()).getChannelData(0).slice();
			}
			if (token !== generation) return;
			if (queue.length >= maxQueue) {
				queue.shift();
				status = 'Falling behind, so older audio was skipped. A faster model may keep up.';
			}
			queue = [...queue, { audio: samples, ...label }];
		} finally {
			if (token === generation) {
				resampling--;
				next();
			}
		}
	}

	function next() {
		if (finishing && !busy && !queue.length && !resampling) {
			finishing = false;
			status = '';
			releaseSpeechModel(worker);
			worker = undefined;
			return;
		}
		if (busy || !queue.length || !worker || loading) return;
		const [item, ...rest] = queue;
		queue = rest;
		busy = { speech: item.speech, at: item.at, requestId: crypto.randomUUID() };
		worker.postMessage({ audio: item.audio, requestId: busy.requestId }, [item.audio.buffer]);
	}

	function received(raw: string) {
		const text = deduplicateTranscript(
			entries
				.slice(-3)
				.map((entry) => entry.text)
				.join(' '),
			cleanTranscript(raw)
		);
		const label = busy;
		busy = null;
		if (text && label) {
			const comparison = compareSpeech(text, $speechDocument);
			const hasReference = Boolean($speechDocument.trim());
			const spans = transcriptSpans(text, $speechDocument).map((span, index) => ({
				...span,
				hasReference,
				speech: label.speech,
				at: label.at,
				id: entries.length + index
			}));
			transcribedPhrase.update((value) => ({ id: value.id + 1, text }));
			entries = [...entries, ...spans];
			if (comparison.matched && !detected) {
				detected = true;
				speechDetected.update((value) => value + 1);
			}
		}
		next();
	}

	async function captureStream(kind: Source): Promise<MediaStream> {
		if (kind === 'microphone')
			// Echo cancellation would erase an online opponent coming out of your own speakers,
			// and noise suppression smears consonants that Whisper needs.
			return navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: true
				}
			});
		const display = await navigator.mediaDevices.getDisplayMedia({
			video: true,
			audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
		});
		display.getVideoTracks().forEach((track) => track.stop());
		if (!display.getAudioTracks().length) {
			display.getTracks().forEach((track) => track.stop());
			throw new Error('No audio was shared. Choose a tab and turn on “Share tab audio”.');
		}
		return new MediaStream(display.getAudioTracks());
	}

	async function start(kind: Source) {
		cancelDocument();
		stop();
		const token = generation;
		source = kind;
		loading = true;
		detected = false;
		error = '';
		status = 'Loading the speech model…';
		try {
			const ready = await loadSpeechModel();
			if (token !== generation) return;
			worker = ready.worker;

			const acquired = await captureStream(kind);
			if (token !== generation) {
				acquired.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = acquired;
			stream.getAudioTracks()[0]?.addEventListener('ended', () => {
				if (token === generation && active) {
					status = kind === 'tab' ? 'Tab audio stopped.' : 'Microphone disconnected.';
					void finish();
				}
			});
			// Use the device's own rate; browsers refuse to connect a stream to a mismatched context.
			context = new AudioContext();
			await context.audioWorklet.addModule('/transcript-capture.js');
			if (token !== generation) return;
			const rate = context.sampleRate;
			segmenter = new Segmenter({ sampleRate: rate });
			capture = new AudioWorkletNode(context, 'transcript-capture');
			context.createMediaStreamSource(stream).connect(capture);
			// A silent output keeps the capture graph processing without playing audio back.
			const mute = context.createGain();
			mute.gain.value = 0;
			capture.connect(mute).connect(context.destination);
			started = Date.now();
			worker!.onmessage = (event) => {
				if (event.data.requestId !== busy?.requestId) return;
				if (event.data.error) {
					error = event.data.error;
					stop();
					return;
				}
				if ('text' in event.data) received(String(event.data.text ?? ''));
			};
			worker!.onerror = () => {
				error = 'Transcription failed. Try starting again.';
				stop();
			};
			capture.port.onmessage = (event) => {
				if (!active || !segmenter) return;
				for (const audio of segmenter.push(event.data)) void enqueue(audio, rate, token);
			};
			await context.resume();
			if (token !== generation) return;
			active = true;
			trackFeatureUsed('transcript', 'started');
			loading = false;
			status = '';
			next();
		} catch (cause) {
			if (token !== generation) return;
			stop();
			const message = errorMessage(cause);
			error =
				(cause as Error).name === 'NotAllowedError'
					? kind === 'tab'
						? 'Sharing was cancelled.'
						: 'Microphone access was blocked.'
					: message;
		}
	}

	async function finish() {
		if (active) trackFeatureUsed('transcript', 'completed');
		if (loading) {
			stop();
			return;
		}
		const rate = context?.sampleRate ?? 16000;
		const rest = segmenter?.flush();
		active = false;
		finishing = true;
		status = 'Finishing…';
		capture?.disconnect();
		capture?.port.close();
		stream?.getTracks().forEach((track) => track.stop());
		void context?.close();
		context = undefined;
		if (rest) await enqueue(rest, rate, generation);
		next();
	}

	function exportTranscript() {
		let speech: string | null = null;
		const lines: string[] = [];
		for (const entry of entries.filter(
			(entry) => !settings.data.transcriptExport.value || entry.outside
		)) {
			if (entry.speech !== speech) {
				speech = entry.speech;
				lines.push('', `# ${speech || 'Transcript'}`);
			}
			lines.push(
				`[${formatClock(entry.at)}] ${entry.outside ? '[Outside document] ' : ''}${entry.text}`
			);
		}
		downloadString(lines.join('\n').trim() + '\n', 'transcript.txt');
	}

	async function addToFlow(entry: Entry) {
		if ($frozen || !$selectedFlowId) return;
		resolvePendingAction($nodes);
		const id = insertTextNear($selectedFlowId, currentArgument()?.id ?? null, entry.text);
		await tick();
		if (id) showArgument(id);
	}
	function dragEntry(event: DragEvent, entry: Entry) {
		if (!event.dataTransfer || $frozen) return;
		const boxes: SerializedBox[] = [{ value: { content: entry.text }, children: [] }];
		event.dataTransfer.setData(boxesMime, JSON.stringify({ boxes }));
		event.dataTransfer.setData('text/plain', entry.text);
		event.dataTransfer.effectAllowed = 'copy';
		event.stopPropagation();
	}

	$: downloadProgress = $speechModelState.progress ?? null;
	let controls = Number(settings.data.transcriptSource.value);
	let analyticsOnly = Boolean(settings.data.transcriptAnalyticsOnly.value);
	onDestroy(
		settings.subscribe(['transcriptSource', 'transcriptAnalyticsOnly'], () => {
			controls = Number(settings.data.transcriptSource.value);
			analyticsOnly = Boolean(settings.data.transcriptAnalyticsOnly.value);
		})
	);
	let documentController: AbortController | null = null;
	let documentRequest = 0;
	const cancelDocument = () => {
		documentRequest++;
		documentController?.abort();
		documentController = null;
	};
	function resetTranscript() {
		stop();
		cancelDocument();
		entries = [];
		status = '';
		error = '';
	}
	$: $roundToolsVersion, resetTranscript();
	onDestroy(speechDropCode.subscribe(cancelDocument));
	onDestroy(cancelDocument);
	async function drop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (active || loading || finishing) return;
		cancelDocument();
		const request = documentRequest;
		const controller = new AbortController();
		documentController = controller;
		error = '';
		try {
			const file = await droppedDocument(event, controller.signal);
			if (!file) return;
			const text = await documentText(file.name, file.blob);
			if (request !== documentRequest || controller.signal.aborted) return;
			speechDocument.set(text);
			speechDocumentSource.set(
				file.source ? { name: file.name, room: file.source.room, index: file.source.index } : null
			);
		} catch (cause) {
			if (request === documentRequest && !controller.signal.aborted) error = errorMessage(cause);
		}
	}

	$: running = active || loading;
	$: visibleEntries = entries
		.filter(
			(entry) => entry.outside || !entry.hasReference || ((running || finishing) && !analyticsOnly)
		)
		.reduce((all: Entry[], entry) => {
			const last = all[all.length - 1];
			if (last && !last.outside && !entry.outside && last.speech === entry.speech)
				last.text += ' ' + entry.text;
			else all.push({ ...entry });
			return all;
		}, []);
	$: detail = loading
		? downloadProgress !== null
			? `downloading ${downloadProgress}%`
			: 'loading…'
		: active
		? `${source === 'tab' ? 'tab audio' : 'listening'}${modelLabel ? ` · ${modelLabel}` : ''}${
				queue.length > 1 ? ` · ${queue.length} behind` : ''
		  }`
		: null;

	// Keep the newest line in view unless the user has scrolled up to read.
	let list: HTMLDivElement;
	let pinnedToBottom = true;
	afterUpdate(() => {
		if (list && pinnedToBottom) list.scrollTop = list.scrollHeight;
	});
	onDestroy(
		settings.subscribe(['transcriptModel'], () => {
			if (active || loading || finishing) stop();
		})
	);
	onDestroy(stop);
</script>

<section
	class="transcript"
	use:panelDrop={{ types: [fileMime, 'Files'], disabled: active || loading || finishing }}
	aria-label="Transcript"
	on:dragover={(e) => {
		e.preventDefault();
		e.stopPropagation();
	}}
	on:drop={drop}
>
	<input
		bind:this={referenceInput}
		type="file"
		accept=".txt,.docx"
		hidden
		on:change={async () => {
			const file = referenceInput.files?.[0];
			if (file) {
				cancelDocument();
				const token = documentRequest;
				try {
					const text = await documentText(file.name, file);
					if (token === documentRequest) {
						speechDocument.set(text);
						speechDocumentSource.set(null);
					}
				} catch (cause) {
					if (token === documentRequest) error = errorMessage(cause);
				}
			}
			referenceInput.value = '';
		}}
	/>
	<PanelHeader name="Transcript" {detail} actions={panelActions} />
	<div class="panel-controls panel-leading">
		{#if running || finishing}
			<Button
				icon="pause"
				ariaLabel="Stop"
				tooltip="stop and finish transcribing what was heard"
				disabled={finishing}
				disabledReason="Finishing"
				on:click={finish}
			/>
		{:else}
			{#if controls !== 1}<Button
					icon="mic"
					ariaLabel="Start transcription"
					tooltip="transcribe the microphone on this device; audio never leaves it"
					on:click={() => start('microphone')}
				/>{/if}
			{#if controls !== 0}<Button
					icon="screen"
					ariaLabel="Transcribe tab audio"
					tooltip="transcribe a tab or window, for online rounds"
					on:click={() => start('tab')}
				/>{/if}
		{/if}
	</div>
	{#if !running && !finishing}<PanelField
			multiline
			rows={2}
			ariaLabel="Opponent speech document"
			placeholder="drop a speech document here, or paste its text"
			bind:value={$speechDocument}
			on:input={() => {
				cancelDocument();
				speechDocumentSource.set(null);
				error = '';
			}}
		/>{/if}
	{#if $speechDocumentSource}<PanelStatus>Comparing with {$speechDocumentSource.name}</PanelStatus
		>{/if}
	{#if error}<PanelStatus error>{error}</PanelStatus>{:else if status}<PanelStatus
			>{status}</PanelStatus
		>{/if}
	<div
		class="entries"
		class:customScrollbar={settings.data.customScrollbar.value}
		bind:this={list}
		on:scroll={() => (pinnedToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 8)}
		aria-live="polite"
	>
		{#each visibleEntries as entry, index (entry.id)}
			{#if entry.speech !== visibleEntries[index - 1]?.speech || index === 0}
				<p class="speech">{entry.speech || 'Transcript'}</p>
			{/if}
			<div
				class="entry"
				role="group"
				draggable={!$frozen}
				on:dragstart={(event) => dragEntry(event, entry)}
				class:outside={entry.outside}
				title={entry.outside ? 'Outside document' : undefined}
				aria-label={entry.outside ? 'Analytic' : undefined}
			>
				<p class="text">
					{entry.text}
				</p>
				<Button
					icon="addRight"
					ariaLabel="Add to flow"
					tooltip="put this line in the flow below the selected cell"
					disabled={$frozen || !$selectedFlowId}
					disabledReason="Open a flow page first"
					on:click={() => addToFlow(entry)}
				/>
			</div>
		{/each}
	</div>
	{#if entries.length}
		<div class="footer">
			<Button
				icon="download"
				ariaLabel="Export transcript"
				tooltip="export transcript"
				disabled={!entries.length}
				disabledReason="Nothing transcribed yet"
				on:click={exportTranscript}
			/>
			<Button
				icon="trash"
				ariaLabel="Clear transcript"
				tooltip="clear transcript"
				disabled={!entries.length || running || finishing}
				on:click={() => {
					if (confirm('Clear transcript?')) entries = [];
				}}
			/>
		</div>
	{/if}
</section>

<style>
	.panel-controls {
		display: flex;
		gap: var(--padding-small);
		padding-inline: var(--padding);
	}
	.transcript {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		flex: 1;
	}
	.entries {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}
	.speech {
		margin: 0;
		padding: var(--padding) var(--padding) 0;
		color: var(--text-weak);
		font-weight: var(--font-weight-bold);
		font-size: 0.85em;
	}
	.entry {
		display: flex;
		align-items: flex-start;
		border-radius: var(--border-radius);
		transition: background var(--transition-speed);
	}
	.entry.outside {
		background: var(--background-active);
		margin-block: var(--padding-small);
	}
	.entry:hover {
		background: var(--background-indent);
	}
	.entry :global(button.top) {
		opacity: 0;
		transition: opacity var(--transition-speed), background var(--transition-speed);
	}
	.entry:hover :global(button.top),
	.entry :global(button.top:focus-visible) {
		opacity: 1;
	}
	.text {
		flex: 1;
		min-width: 0;
		margin: 0;
		padding: var(--padding);
		line-height: 1.5em;
		overflow-wrap: anywhere;
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
	}
</style>
