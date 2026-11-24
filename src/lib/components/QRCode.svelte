<script lang="ts">
	import QRCode from 'qrcode';

	export let value: string;
	let image = '';
	let generation = 0;

	$: value, makeCode(value);

	async function makeCode(contents: string) {
		const currentGeneration = ++generation;
		try {
			const result = await QRCode.toDataURL(contents, {
				width: 768,
				margin: 4,
				errorCorrectionLevel: 'L'
			});
			if (currentGeneration == generation) image = result;
		} catch (error) {
			console.error('Could not create sharing QR code', error);
			if (currentGeneration == generation) image = '';
		}
	}
</script>

{#if image}
	<img src={image} alt="QR code for this sharing link" />
{/if}

<style>
	img {
		display: block;
		/* Leave room for the popup header, instructions and controls. */
		width: min(
			40rem,
			100%,
			max(
				calc(var(--button-size) * 2),
				calc(100dvh - var(--button-size) * 6 - var(--padding-big) * 6)
			)
		);
		height: auto;
		box-sizing: border-box;
		background: white;
		padding: var(--padding-small);
		border-radius: var(--border-radius);
	}
</style>
