<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '../Button.svelte';
	import { speechDocument, speechDetected, speechDocumentSource } from '$lib/models/collaboration';
	import { compareSpeech } from '$lib/models/transcript';
	import { downloadString } from '$lib/models/file';
	let entries: { text: string; outside: boolean; seconds: number; tag: string }[] = [];
	let status = '';
	let active = false;
	let loading = false;
	let worker: Worker | undefined;
	let context: AudioContext | undefined;
	let stream: MediaStream | undefined;
	let capture: AudioWorkletNode | undefined;
	let frames: Float32Array[] = [];
	let samples = 0;
	let busy = false;
	let started = 0;
	let segmentSeconds = 0;
	let queue: { audio: Float32Array; seconds: number }[] = [];
	let generation = 0;
	let detected = false;
	let finishing = false;
	let resampling = 0;
	function stop() {
		generation++;
		active = false;
		loading = false;
		capture?.disconnect();
		stream?.getTracks().forEach((track) => track.stop());
		void context?.close();
		capture = undefined;
		context = undefined;
		stream = undefined;
		worker?.terminate();
		worker = undefined;
		frames = [];
		samples = 0;
		queue = [];
		busy = false;
		finishing = false;
		resampling = 0;
	}
	async function enqueueFrames(rate: number, token: number) {
		if (!samples) return;
		resampling++;
		try {
			const audio = new Float32Array(samples);
			let offset = 0;
			for (const frame of frames) {
				audio.set(frame, offset);
				offset += frame.length;
			}
			frames = [];
			samples = 0;
			const seconds = (Date.now() - started) / 1000 - audio.length / rate;
			let energy = 0;
			for (const sample of audio) energy += sample * sample;
			if (energy / audio.length < 0.00002) return;
			if (queue.length >= 6) {
				status =
					'Transcription could not keep up. Recording stopped; existing transcript is preserved.';
				stop();
				return;
			}
			const resampler = new OfflineAudioContext(1, Math.ceil((audio.length * 16000) / rate), 16000);
			const buffer = resampler.createBuffer(1, audio.length, rate);
			buffer.copyToChannel(audio, 0);
			const source = resampler.createBufferSource();
			source.buffer = buffer;
			source.connect(resampler.destination);
			source.start();
			const output = await resampler.startRendering();
			if (token !== generation) return;
			queue.push({ audio: output.getChannelData(0).slice(), seconds });
			next();
		} finally {
			if (token === generation) {
				resampling--;
				next();
			}
		}
	}
	async function finish() {
		if (loading) {
			stop();
			status = 'Stopped';
			return;
		}
		active = false;
		finishing = true;
		status = 'Finishing local transcription…';
		capture?.disconnect();
		capture?.port.close();
		stream?.getTracks().forEach((track) => track.stop());
		const rate = context?.sampleRate ?? 16000;
		void context?.close();
		context = undefined;
		await enqueueFrames(rate, generation);
		next();
	}
	function next() {
		if (finishing && !busy && !queue.length && !resampling) {
			finishing = false;
			status = 'Stopped';
			worker?.terminate();
			worker = undefined;
		}

		if (busy || !queue.length || !worker) return;
		const item = queue.shift()!;
		busy = true;
		segmentSeconds = item.seconds;
		worker.postMessage({ audio: item.audio }, [item.audio.buffer]);
	}
	async function start() {
		stop();
		const token = generation;
		loading = true;
		detected = false;
		status = 'Loading local speech model (first use downloads model files)…';
		try {
			worker = new Worker(new URL('../../models/transcript.worker.ts', import.meta.url), {
				type: 'module'
			});
			await new Promise<void>((resolve, reject) => {
				worker!.onerror = () => reject(new Error('Could not load the local speech model.'));
				worker!.onmessage = (event) =>
					event.data.error ? reject(new Error(event.data.error)) : resolve();
				worker!.postMessage({});
			});
			if (token !== generation) return;
			const acquiredStream = await navigator.mediaDevices.getUserMedia({
				audio: { channelCount: 1, echoCancellation: true }
			});
			if (token !== generation) {
				acquiredStream.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = acquiredStream;
			context = new AudioContext({ sampleRate: 16000 });
			await context.audioWorklet.addModule('/transcript-capture.js');
			if (token !== generation) return;
			capture = new AudioWorkletNode(context, 'transcript-capture');
			context.createMediaStreamSource(stream).connect(capture);
			// A silent output keeps the capture graph processing without microphone playback.
			const mute = context.createGain();
			mute.gain.value = 0;
			capture.connect(mute).connect(context.destination);
			started = Date.now();
			worker!.onmessage = (event) => {
				if (event.data.error) {
					status = event.data.error;
					stop();
					return;
				}
				const text = String(event.data.text ?? '').trim();
				if (text) {
					const comparison = compareSpeech(text, $speechDocument);
					entries = [
						...entries,
						{ text, outside: comparison.outside, seconds: segmentSeconds, tag: '' }
					];
					if (comparison.matched && !detected) {
						detected = true;
						speechDetected.update((value) => value + 1);
					}
				}
				busy = false;
				next();
			};
			worker!.onerror = () => {
				status = 'Local transcription failed. Try starting again.';
				stop();
			};
			capture.port.onmessage = async (event) => {
				if (!active || !context) return;
				frames.push(event.data);
				samples += event.data.length;
				if (samples < context.sampleRate * 5) return;
				await enqueueFrames(context.sampleRate, token);
			};
			await context.resume();
			if (token !== generation) return;
			active = true;
			loading = false;
			status = 'Listening locally…';
		} catch (error) {
			if (token !== generation) return;
			stop();
			status = (error as Error).message;
		}
	}
	onDestroy(stop);
</script>

<div class="transcript">
	<p>
		Local transcription. Model files download on first use; microphone audio stays on this device.
	</p>
	<Button
		icon={active || loading ? 'pause' : 'play'}
		text={finishing ? 'Finishing…' : active || loading ? 'Stop' : 'Start transcription'}
		disabled={finishing}
		on:click={() => (active || loading ? finish() : start())}
	/>
	<p role="status">{status}</p>
	<label
		>Opponent speech document<textarea
			aria-label="Opponent speech document"
			bind:value={$speechDocument}
			placeholder="Paste text or choose a SpeechDrop document"
		/></label
	>
	{#if $speechDocumentSource}<p class="comparison-source">
			Comparing with {$speechDocumentSource.name}
		</p>{/if}
	<p>“Outside document” marks phrases to review; transcription and matching can be inaccurate.</p>
	<Button
		icon="download"
		text="Export transcript"
		disabled={!entries.length}
		on:click={() =>
			downloadString(
				entries
					.map(
						(entry) =>
							`[${Math.max(0, entry.seconds).toFixed(0)}s] ${
								entry.outside ? '[Outside document] ' : ''
							}${entry.tag ? `[${entry.tag}] ` : ''}${entry.text}`
					)
					.join('\n'),
				'transcript.txt'
			)}
	/>
	<div class="entries">
		{#each entries as entry}
			<div class="entry">
				<small
					>{Math.max(0, entry.seconds).toFixed(0)}s {entry.outside
						? ' · Outside document'
						: ''}</small
				>
				<p>{entry.text}</p>
				<input aria-label="Transcript tag" placeholder="Tag" bind:value={entry.tag} />
			</div>
		{/each}
	</div>
</div>

<style>
	.comparison-source {
		color: var(--text-weak);
		font-size: 0.85em;
	}
	.transcript {
		overflow-y: auto;
	}
	/* Keep content at its natural height so a short panel scrolls instead of overlapping. */
	.transcript > :global(*) {
		flex-shrink: 0;
	}
	.transcript,
	label {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		min-height: 0;
	}
	p {
		margin: 0;
	}
	small {
		color: var(--text-weak);
	}
	textarea,
	input {
		font: inherit;
		color: var(--text);
		background: var(--background-indent);
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		padding: var(--padding);
		min-width: 0;
		transition: background var(--transition-speed);
	}
	textarea:focus,
	input:focus {
		background: var(--background-active);
	}
	textarea::placeholder,
	input::placeholder {
		color: var(--text-weak);
	}
	textarea {
		min-height: 5em;
		resize: vertical;
	}
	.entries {
		overflow: auto;
	}
	.entry {
		padding: var(--padding) 0;
	}
</style>
