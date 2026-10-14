<script lang="ts">
	import Button from './Button.svelte';
	import {
		initGuestConnection,
		disconnect,
		initHost,
		addHostConnection,
		cancelBuilding,
		type Guest,
		type Host,
		type ConnectionId,
		parseJoinLink,
		type HostKey,
		giveGuestHostKey,
		requestSync
	} from '$lib/models/sharingConnection';
	import ConnectManual from './ConnectManual.svelte';
	import ConnectLink from './ConnectLink.svelte';
	import ConnectQR from './ConnectQR.svelte';
	import ConnectStatus from './ConnectStatus.svelte';
	import { openPopup } from '$lib/models/popup';
	import Changelog from './Changelog.svelte';
	import Help from './Help.svelte';
	import { onMount } from 'svelte';
	import { connections } from '$lib/models/store';
	import { hasTurnServerConfigured } from '$lib/models/iceServers';

	export let closePopup = () => {};

	let connectionMode: 'manual' | 'link' | 'qr' = 'link';

	let buildingConnection: Host | Guest | null = null;
	$: {
		if ($connections.tag == 'guest' && $connections.building) {
			buildingConnection = $connections.connection;
		} else if ($connections.tag == 'host' && $connections.building != null) {
			buildingConnection = $connections.holder[$connections.building];
		} else {
			buildingConnection = null;
		}
	}

	function asConnectionIds(ids: string[]): ConnectionId[] {
		return ids as ConnectionId[];
	}

	let joinLinkHostKey: null | HostKey = null;
	onMount(function () {
		joinLinkHostKey = parseJoinLink();
	});
</script>

<div class="top palette-plain" class:qrMode={connectionMode == 'qr'}>
	{#if $connections.tag == 'empty'}
		<div class="start">
			<div class="explain">
				<p>
					Flew Notes allows sharing through <a href="https://en.wikipedia.org/wiki/WebRTC">WebRTC</a
					>. You can either
					<span class="usePalette palette-accent">host</span>
					a room to share your current flow, or edit someone else's flow as a
					<span class="usePalette palette-accent-secondary">guest</span>.
				</p>
				<p>
					If you encounter any issues with sharing, first update your browser, then <Button
						text="contact me"
						icon="link"
						on:click={() => {
							closePopup();
							openPopup(Help, 'Help');
						}}
						target="_blank"
						inline
					/>. Looking for sheet sharing? See the
					<Button
						icon="delta"
						text="changelog"
						on:click={() => {
							closePopup();
							openPopup(Changelog, 'Changelog');
						}}
						target="_blank"
						inline
					/> for more info.
				</p>
				{#if !hasTurnServerConfigured()}
					<p class="turnWarning">
						Cross-network sharing may be broken at the moment, please <Button
						icon="delta"
						text="Contact me!"
						on:click={() => {
							closePopup();
							openPopup(Help, 'Contact');
						}}
						target="_blank"
						inline
					/>
					</p>
				{/if}
			</div>
			<div class="hostGuestButtons">
				<div class="buttons">
					<Button
						palette="accent"
						icon="add"
						text="host new room"
						on:click={() => {
							initHost();
						}}
					/>
					{#if connectionMode == 'manual'}
						<Button
							palette="accent-secondary"
							icon="redo"
							text="join room"
							on:click={() => {
								initGuestConnection();
							}}
						/>
					{:else if connectionMode == 'link' && joinLinkHostKey != null}
						<Button
							palette="accent-secondary"
							icon="redo"
							text="join room from join link"
							on:click={() => {
								if (joinLinkHostKey == null) return;
								initGuestConnection();
								giveGuestHostKey(joinLinkHostKey);
							}}
						/>
					{/if}
				</div>
				{#if connectionMode == 'qr'}
					<ConnectQR
						connection={null}
						on:join={(event) => {
							initGuestConnection();
							giveGuestHostKey(event.detail);
						}}
					/>
				{/if}
			</div>
		</div>
	{:else if $connections.tag == 'host' || $connections.tag == 'guest'}
		{#if buildingConnection == null}
			{#if $connections.tag == 'host'}
				{#if Object.keys($connections.holder).length > 0}
					<div class="statuses">
						{#each asConnectionIds(Object.keys($connections.holder)) as id}
							<ConnectStatus
								connection={$connections.holder[id]}
								close={() => {
									if ($connections.tag != 'host') return;
									$connections.holder[id].pc.close();
									delete $connections.holder[id];
									$connections = $connections;
								}}
							/>
						{/each}
					</div>
				{/if}
				<Button
					palette="accent"
					icon="add"
					text="add guest"
					on:click={() => {
						addHostConnection();
					}}
				/>
			{:else if $connections.tag == 'guest'}
				<ConnectStatus connection={$connections.connection} />
				<Button
					palette="accent-secondary"
					icon="download"
					text="sync"
					tooltip="use if flows get out of sync"
					disabled={$connections.connection.tag == 'guestConnected'
						? $connections.connection.awaitingSync
							? true
							: false
						: true}
					disabledReason={$connections.connection.tag == 'guestConnected'
						? $connections.connection.awaitingSync
							? 'awaiting sync'
							: undefined
						: 'not connected'}
					on:click={() => {
						requestSync();
					}}
				/>
			{/if}
		{:else if connectionMode == 'manual'}
			<ConnectManual connection={buildingConnection} />
		{:else if connectionMode == 'qr'}
			<ConnectQR connection={buildingConnection} />
		{:else}
			<ConnectLink connection={buildingConnection} />
		{/if}
	{/if}
	<div class="controls">
		<div class="connectionModes" aria-label="Connection method">
			<Button
				icon="link"
				text="link connect"
				toggled={connectionMode == 'link'}
				tooltip="connect by sharing links"
				on:click={() => (connectionMode = 'link')}
			/>
			<Button
				icon="qr"
				text="QR code"
				toggled={connectionMode == 'qr'}
				tooltip="connect by scanning QR codes"
				on:click={() => (connectionMode = 'qr')}
			/>
			<Button
				icon="angleBrackets"
				text="manual connect"
				toggled={connectionMode == 'manual'}
				tooltip="connect by copying and pasting keys"
				on:click={() => (connectionMode = 'manual')}
			/>
		</div>
		{#if $connections.tag != 'empty'}
			{#if buildingConnection == null}
				<Button
					text={$connections.tag == 'host'
						? Object.keys($connections.holder).length == 0
							? 'cancel'
							: 'disconnect all'
						: 'disconnect'}
					icon="delete"
					on:click={() => {
						disconnect();
					}}
				/>
			{:else}
				<Button
					text={'cancel'}
					icon="delete"
					on:click={() => {
						cancelBuilding();
					}}
				/>
			{/if}
		{/if}
	</div>
</div>

<style>
	.top {
		width: min(calc(100vw - var(--padding) * 2), 600px);
		height: min(calc(100vh - var(--padding) * 2), min-content);
		padding: calc(var(--button-size) + var(--padding) * 2) 0 0 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--padding);
	}
	.top.qrMode {
		width: min(calc(100vw - var(--padding) * 2), 840px);
	}
	.turnWarning {
		color: var(--text-weak);
	}

	.hostGuestButtons {
		display: flex;
		flex-direction: row;
		gap: var(--padding);
		width: 100%;
		justify-content: center;
	}
	.start {
		display: flex;
		flex-direction: column;
		padding: 0 var(--padding) 0 var(--padding);
	}

	span.usePalette {
		color: var(--this-text);
	}

	p {
		line-height: 1.5em;
	}

	.controls {
		padding: 0 var(--padding) var(--padding) var(--padding);
		box-sizing: border-box;
		width: 100%;
		display: flex;
		flex-direction: row;
		gap: var(--padding);
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.connectionModes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--padding-small);
	}

	.buttons {
		display: flex;
		flex-direction: row;
		gap: var(--padding);
		justify-content: center;
	}

	.statuses {
		display: flex;
		flex-direction: row;
		gap: var(--padding);
		flex-wrap: wrap;
		justify-content: center;
		padding: 0 var(--padding);
	}
</style>
