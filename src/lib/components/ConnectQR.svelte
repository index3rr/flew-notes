<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import QRCode from './QRCode.svelte';
	import QRScanner from './QRScanner.svelte';
	import {
		giveHostGuestKey,
		type Guest,
		type GuestKey,
		type Host,
		type HostKey
	} from '$lib/models/sharingConnection';
	import { preferredTlsRelay, sharingLocalOffer } from '$lib/models/sharingIce';
	import { decodeSharingQr, encodeSharingQr } from '$lib/models/sharingQr';

	export let connection: Host | Guest | null;
	const dispatch = createEventDispatcher<{ join: HostKey }>();
	let scanning = false;
	let scanError: string | null = null;

	let preparedKey: HostKey | GuestKey | null = null;
	let preparation = 0;
	$: void prepareKey(connection);
	async function prepareKey(current: Host | Guest | null) {
		const generation = ++preparation;
		preparedKey = null;
		if (current?.tag == 'hostAwaitingGuestKey') {
			const fullKey = {
				...current.key,
				localOffer:
					current.pc.iceGatheringState == 'complete'
						? sharingLocalOffer(current.pc.localDescription)
						: current.key.localOffer
			};
			const ready = await preferredTlsRelay(fullKey, current.pc);
			if (generation == preparation) preparedKey = ready;
		} else if (current?.tag == 'guestAwaitingChannel') {
			const ready = current.hostKey.qrRelayOnly
				? await preferredTlsRelay(current.key, current.pc)
				: current.key;
			if (generation == preparation) preparedKey = ready;
		}
	}

	function receiveQr(value: string) {
		scanning = false;
		scanError = null;
		try {
			dispatch('join', decodeSharingQr(value, 'join') as HostKey);
		} catch (error) {
			scanError =
				error instanceof Error ? error.message : 'This is not a valid Flew Notes join QR code.';
		}
	}
	function receiveGuestQr(value: string) {
		scanning = false;
		scanError = null;
		try {
			let key: GuestKey | null = null;
			let failure: unknown;
			for (const reference of [
				preparedKey ? decodeSharingQr(encodeSharingQr(preparedKey, undefined, true), 'join') : null,
				preparedKey,
				connection?.tag == 'hostAwaitingGuestKey' ? connection.key : null
			]) {
				try {
					key = decodeSharingQr(value, 'confirm', reference ?? undefined) as GuestKey;
					break;
				} catch (error) {
					failure = error;
				}
			}
			if (key == null) throw failure;
			if (
				connection?.tag != 'hostAwaitingGuestKey' ||
				connection.key.broadcastId != key.broadcastId
			) {
				throw new Error('This confirm code belongs to a different room.');
			}
			giveHostGuestKey(key);
		} catch (error) {
			scanError =
				error instanceof Error
					? error.message
					: 'This is not a valid Flew Notes guest confirm QR code.';
		}
	}
</script>

<div class="top">
	{#if connection == null}
		<Button
			palette="accent-secondary"
			icon="redo"
			text="join room"
			toggled={scanning}
			on:click={() => {
				scanError = null;
				scanning = !scanning;
			}}
		/>
		{#if scanning}
			<QRScanner on:scan={(event) => receiveQr(event.detail)} />
		{/if}
		{#if scanError}
			<p class="error">{scanError}</p>
		{/if}
	{:else if connection.tag == 'hostCreatingKey'}
		<p>Creating room QR code…</p>
	{:else if connection.tag == 'hostAwaitingGuestKey' && preparedKey == null}
		<p>Creating room QR code…</p>
	{:else if connection.tag == 'hostAwaitingGuestKey' && preparedKey != null}
		<p>Have your guest scan this room QR code:</p>
		<QRCode value={encodeSharingQr(preparedKey, undefined, true)} />
		<Button
			icon="qr"
			text={scanning ? 'stop scanning' : 'scan guest QR code'}
			on:click={() => {
				scanError = null;
				scanning = !scanning;
			}}
		/>
		{#if scanning}
			<p>Ask your guest to show their confirm QR code.</p>
			<QRScanner on:scan={(event) => receiveGuestQr(event.detail)} />
		{/if}
		{#if scanError}
			<p class="error">{scanError}</p>
		{/if}
	{:else if connection.tag == 'guestAwaitingHostKey'}
		<p>Scan the host’s room QR code to join.</p>
	{:else if connection.tag == 'guestCreatingKey'}
		<p>Creating confirm QR code…</p>
	{:else if connection.tag == 'guestAwaitingChannel'}
		<p>Show this confirm QR code to the host:</p>
		<QRCode value={encodeSharingQr(preparedKey ?? connection.key, connection.hostKey)} />
	{/if}
</div>

<style>
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--padding);
		padding: 0 var(--padding);
	}
	p {
		margin: 0;
		text-align: center;
	}
	.error {
		color: var(--text-error);
	}
</style>
