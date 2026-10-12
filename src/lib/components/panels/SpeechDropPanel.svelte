<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '$lib/components/Button.svelte';

	type SpeechDropFile = { index: number; name: string; ctime?: number };
	type RoomIndex = { files: SpeechDropFile[]; error?: string };

	const fallbackRefreshIntervalMs = 10 * 60 * 1000;
	const connectDebounceMs = 500;
	let roomCode = '';
	let loadedRoomCode = '';
	let files: SpeechDropFile[] = [];
	let error = '';
	let loading = false;
	let fallbackRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
	let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
	let connectTimeout: ReturnType<typeof setTimeout> | undefined;
	let activeSocket: WebSocket | undefined;
	let reconnectDelayMs = 1000;
	let requestNumber = 0;

	async function refreshRoom(code: string, currentRequest: number) {
		try {
			const response = await fetch(`/api/speechdrop/${encodeURIComponent(code)}`);
			const result = (await response.json()) as RoomIndex;
			if (!response.ok) throw new Error(result.error || 'Could not load this SpeechDrop room.');
			if (currentRequest !== requestNumber || code !== loadedRoomCode) return;
			files = result.files;
			error = '';
		} catch (cause) {
			if (currentRequest === requestNumber && code === loadedRoomCode) {
				error = 'Could not refresh the room. Retrying…';
			}
		}
	}

	function stopRoomConnections() {
		clearTimeout(fallbackRefreshTimeout);
		clearTimeout(reconnectTimeout);
		fallbackRefreshTimeout = undefined;
		reconnectTimeout = undefined;
		if (activeSocket) {
			activeSocket.onclose = null;
			activeSocket.close();
			activeSocket = undefined;
		}
	}

	function scheduleFallbackRefresh(code: string, currentRequest: number) {
		clearTimeout(fallbackRefreshTimeout);
		fallbackRefreshTimeout = setTimeout(async () => {
			await refreshRoom(code, currentRequest);
			if (currentRequest === requestNumber && code === loadedRoomCode) {
				scheduleFallbackRefresh(code, currentRequest);
			}
		}, fallbackRefreshIntervalMs);
	}

	function connectRoomSocket(code: string, currentRequest: number) {
		if (currentRequest !== requestNumber || code !== loadedRoomCode) return;
		const sessionId = crypto.randomUUID().replaceAll('-', '');
		let socket: WebSocket;
		try {
			// SpeechDrop's SockJS endpoint exposes its WebSocket transport at this URL.
			socket = new WebSocket(`wss://speechdrop.net/sock/000/${sessionId}/websocket`);
		} catch {
			reconnectTimeout = setTimeout(() => connectRoomSocket(code, currentRequest), reconnectDelayMs);
			reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
			return;
		}
		activeSocket = socket;

		socket.onmessage = (event) => {
			if (typeof event.data !== 'string') return;
			if (event.data === 'o') {
				reconnectDelayMs = 1000;
				// SockJS wraps the SpeechDrop event-bus registration in an array frame.
				const registration = JSON.stringify({
					type: 'register',
					address: `speechdrop.room.${code}`,
					headers: {}
				});
				socket.send(JSON.stringify([registration]));
				return;
			}
			if (!event.data.startsWith('a')) return;
			try {
				const messages = JSON.parse(event.data.slice(1)) as string[];
				if (messages.some((message) => JSON.parse(message).address === `speechdrop.room.${code}`)) {
					void refreshRoom(code, currentRequest);
				}
			} catch {
				// Ignore malformed SockJS frames and continue listening for room events.
			}
		};

		socket.onclose = () => {
			if (currentRequest !== requestNumber || code !== loadedRoomCode) return;
			activeSocket = undefined;
			reconnectTimeout = setTimeout(() => {
				connectRoomSocket(code, currentRequest);
			}, reconnectDelayMs);
			reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
		};
		socket.onerror = () => socket.close();
	}

	async function loadRoom() {
		const code = roomCode.trim();
		if (!code || loading) return;
		stopRoomConnections();
		const currentRequest = ++requestNumber;
		loadedRoomCode = '';
		files = [];
		error = '';
		loading = true;
		try {
			const response = await fetch(`/api/speechdrop/${encodeURIComponent(code)}`);
			const result = (await response.json()) as RoomIndex;
			if (!response.ok) throw new Error(result.error || 'Could not load this SpeechDrop room.');
			if (currentRequest !== requestNumber) return;
			files = result.files;
			loadedRoomCode = code;
			scheduleFallbackRefresh(code, currentRequest);
			connectRoomSocket(code, currentRequest);
		} catch (cause) {
			if (currentRequest === requestNumber) {
				error = cause instanceof Error ? cause.message : 'Could not connect to SpeechDrop.';
			}
		} finally {
			if (currentRequest === requestNumber) loading = false;
		}
	}

	function editRoomCode() {
		requestNumber++;
		stopRoomConnections();
		clearTimeout(connectTimeout);
		connectTimeout = undefined;
		loadedRoomCode = '';
		files = [];
		error = '';
		loading = false;
		if (roomCode.trim()) {
			connectTimeout = setTimeout(() => {
				connectTimeout = undefined;
				void loadRoom();
			}, connectDebounceMs);
		}
	}

	onDestroy(() => {
		clearTimeout(connectTimeout);
		stopRoomConnections();
	});
</script>

<div class="speechdrop-panel">
	<div class="room-entry">
		<input
			aria-label="SpeechDrop room code"
			placeholder="SpeechDrop Code"
			bind:value={roomCode}
			on:input={editRoomCode}
		/>
	</div>
	{#if loading}
		<p class="status">Connecting…</p>
	{:else if error}
		<p class="status error" role="status">{error}</p>
	{/if}
	{#if files.length > 0}
		<ul class="file-list">
			{#each files as file}
				<li>
					<Button
						icon="download"
						text={file.name}
						tooltip="download this file from the room"
						link={`/api/speechdrop/${encodeURIComponent(loadedRoomCode)}/${file.index}`}
					/>
				</li>
			{/each}
		</ul>
	{:else if loadedRoomCode && !error}
		<p class="status">This room has no files.</p>
	{/if}
</div>

<style>
	.speechdrop-panel {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.room-entry {
		display: flex;
		align-items: center;
		gap: var(--padding-small);
	}
	.room-entry input {
		min-width: 0;
		flex: 1;
		box-sizing: border-box;
		padding: var(--padding);
		border: 0;
		border-radius: var(--border-radius);
		background: var(--background-secondary);
		color: var(--text);
		font: inherit;
	}
	.room-entry input:focus {
		outline: 2px solid var(--color-fade);
	}
	.status {
		margin: 0;
		color: var(--text-weak);
		font-size: 0.85em;
	}
	.status.error {
		color: var(--text-error);
	}
	.file-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		overflow-y: auto;
		min-height: 0;
	}
</style>
