<script lang="ts">
	import QrScanner from 'qr-scanner';
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	const dispatch = createEventDispatcher<{ scan: string }>();
	let video: HTMLVideoElement;
	let scanner: QrScanner | null = null;
	let error: string | null = null;
	let cameraReady = false;

	function getScanRegion(video: HTMLVideoElement) {
		// Scan the whole camera frame. The library default crops to a centered 2/3
		// square, which can miss a code held near the edge of the preview.
		const width = video.videoWidth;
		const height = video.videoHeight;
		const scale = 800 / Math.max(width, height);
		return {
			x: 0,
			y: 0,
			width,
			height,
			downScaledWidth: Math.round(width * scale),
			downScaledHeight: Math.round(height * scale)
		};
	}

	onMount(() => {
		if (!window.isSecureContext) {
			error =
				'Camera scanning requires HTTPS. Open this app through a secure HTTPS address, then try again.';
			return;
		}
		scanner = new QrScanner(video, (result) => dispatch('scan', result.data), {
			returnDetailedScanResult: true,
			calculateScanRegion: getScanRegion,
			onDecodeError: (reason) => {
				if (reason !== QrScanner.NO_QR_CODE_FOUND) {
					error = reason instanceof Error ? reason.message : String(reason);
				}
			}
		});
		scanner.setInversionMode('both');
		void scanner
			.start()
			.then(() => {
				cameraReady = true;
			})
			.catch((reason: unknown) => {
				error =
					reason instanceof Error ? reason.message : String(reason || 'Could not start the camera');
			});
	});

	onDestroy(() => scanner?.destroy());
</script>

<div class="scanner">
	<!-- Live camera preview for scanning, with no audio or spoken content. -->
	<video bind:this={video} playsinline muted />
	{#if error}
		<p>Camera error: {error}</p>
	{:else if cameraReady}
		<p>Camera ready. Hold the QR code anywhere in the preview.</p>
	{:else}
		<p>Starting camera…</p>
	{/if}
</div>

<style>
	.scanner {
		width: min(100%, 24rem);
		overflow: hidden;
		border-radius: var(--border-radius);
		background: var(--background-indent);
	}
	video {
		display: block;
		width: 100%;
		max-height: 24rem;
		object-fit: cover;
	}
	p {
		margin: 0;
		padding: var(--padding);
		color: var(--text-error);
	}
</style>
