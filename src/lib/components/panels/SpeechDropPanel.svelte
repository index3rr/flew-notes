<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { speechDropCode, speechDocument, speechDocumentSource } from '$lib/models/collaboration';
	import { shareSpeechDropCode } from '$lib/models/sharingChannel';
	import { cardMirror, cardMirrorDocuments, openCardMirrorDocument } from '$lib/models/cardMirror';
	import { settings } from '$lib/models/settings';
	import Button from '$lib/components/Button.svelte';

	type SpeechDropFile = { index: number; name: string; ctime?: number };
	type RoomIndex = { files: SpeechDropFile[]; error?: string };

	const fallbackRefreshIntervalMs = 10 * 60 * 1000;
	const connectDebounceMs = 500;
	let roomCode = $speechDropCode;
	const unsubscribeCode = speechDropCode.subscribe((code) => {
		if (code !== roomCode) {
			roomCode = code;
			editRoomCode();
		}
	});
	onDestroy(unsubscribeCode);
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
	let roomController: AbortController | null = null;
	let refreshController: AbortController | null = null;
	let pushRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
	let fileBusy: number | null = null;
	let fileController: AbortController | null = null;
	let cached: { room: string; index: number; name: string; ctime?: number; blob: Blob } | null =
		null;
	let status = '';
	let autoOpen = settings.data.cardMirrorOpenSpeechDrop.value as boolean;
	onDestroy(
		settings.subscribe(['cardMirrorOpenSpeechDrop'], () => {
			autoOpen = settings.data.cardMirrorOpenSpeechDrop.value as boolean;
		})
	);

	async function refreshRoom(code: string, currentRequest: number) {
		if (currentRequest !== requestNumber || code !== loadedRoomCode) return;
		refreshController?.abort();
		const controller = new AbortController();
		refreshController = controller;
		try {
			const response = await fetch(`/api/speechdrop/${encodeURIComponent(code)}`, {
				signal: controller.signal
			});
			const result = (await response.json()) as RoomIndex;
			if (!response.ok) throw new Error(result.error || 'Could not load this SpeechDrop room.');
			if (controller.signal.aborted || currentRequest !== requestNumber || code !== loadedRoomCode)
				return;
			if (
				cached &&
				!result.files.some(
					(file) =>
						file.index === cached?.index && file.name === cached.name && file.ctime === cached.ctime
				)
			)
				cached = null;
			files = result.files;
			error = '';
		} catch (cause) {
			if (
				!controller.signal.aborted &&
				currentRequest === requestNumber &&
				code === loadedRoomCode
			) {
				error = 'Could not refresh the room. Retrying…';
			}
		}
	}

	function stopRoomConnections() {
		roomController?.abort();
		refreshController?.abort();
		clearTimeout(pushRefreshTimeout);
		pushRefreshTimeout = undefined;
		clearTimeout(fallbackRefreshTimeout);
		clearTimeout(reconnectTimeout);
		fallbackRefreshTimeout = undefined;
		reconnectTimeout = undefined;
		if (activeSocket) {
			activeSocket.onclose = null;
			activeSocket.onmessage = null;
			activeSocket.onerror = null;
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
			reconnectTimeout = setTimeout(
				() => connectRoomSocket(code, currentRequest),
				reconnectDelayMs
			);
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
					if (!pushRefreshTimeout)
						pushRefreshTimeout = setTimeout(() => {
							pushRefreshTimeout = undefined;
							void refreshRoom(code, currentRequest);
						}, 150);
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
		const controller = new AbortController();
		roomController = controller;
		loadedRoomCode = '';
		files = [];
		error = '';
		loading = true;
		try {
			const response = await fetch(`/api/speechdrop/${encodeURIComponent(code)}`, {
				signal: controller.signal
			});
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
		fileController?.abort();
		fileController = null;
		cached = null;
		fileBusy = null;
		status = '';
		if ($speechDocumentSource) speechDocument.set('');
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

	async function documentAction(file: SpeechDropFile, action: 'download' | 'compare' | 'open') {
		if (fileBusy !== null) return;
		const request = requestNumber,
			room = loadedRoomCode;
		let downloaded = false;
		const controller = new AbortController();
		fileController = controller;
		fileBusy = file.index;
		error = '';
		status = '';
		const current = () =>
			request === requestNumber && room === loadedRoomCode && !controller.signal.aborted;
		try {
			let blob: Blob;
			if (
				cached?.room === room &&
				cached.index === file.index &&
				cached.name === file.name &&
				cached.ctime === file.ctime
			)
				blob = cached.blob;
			else {
				const response = await fetch(`/api/speechdrop/${encodeURIComponent(room)}/${file.index}`, {
					signal: controller.signal
				});
				if (!response.ok) throw new Error('Could not load speech document.');
				if (Number(response.headers.get('content-length')) > 50 * 1024 * 1024)
					throw new Error('This document exceeds the 50 MB limit.');
				blob = await response.blob();
				if (blob.size > 50 * 1024 * 1024) throw new Error('This document exceeds the 50 MB limit.');
				if (!current()) return;
				cached = { room, index: file.index, name: file.name, ctime: file.ctime, blob };
			}
			if (!current()) return;
			if (action === 'compare') {
				let text: string;
				if (/\.docx$/i.test(file.name)) {
					const { extractRawText } = await import('mammoth/mammoth.browser');
					text = (await extractRawText({ arrayBuffer: await blob.arrayBuffer() })).value;
				} else if (/\.txt$/i.test(file.name)) text = await blob.text();
				else throw new Error('Use a DOCX or TXT speech document for comparison.');
				if (current()) {
					speechDocument.set(text);
					speechDocumentSource.set({ name: file.name, room, index: file.index });
					status = `Comparing transcript with ${file.name}.`;
				}
				return;
			}
			if (action === 'download') {
				const url = URL.createObjectURL(blob),
					link = document.createElement('a');
				link.href = url;
				link.download = file.name;
				document.body.append(link);
				link.click();
				link.remove();
				downloaded = true;
				setTimeout(() => URL.revokeObjectURL(url), 30_000);
				status = `Downloaded ${file.name}.`;
			}
			if (
				action === 'open' ||
				(autoOpen &&
					/\.docx$/i.test(file.name) &&
					$cardMirror.state === 'connected' &&
					$cardMirrorDocuments.supported)
			) {
				await openCardMirrorDocument(file.name, blob, controller.signal);
				if (current()) status = `Sent ${file.name} to CardMirror in a new window.`;
			}
		} catch (cause) {
			if (current())
				error = (cause as Error).message + (downloaded ? ' Your download is still available.' : '');
		} finally {
			if (request === requestNumber) {
				fileBusy = null;
				fileController = null;
			}
		}
	}

	onMount(() => {
		if (roomCode.trim()) editRoomCode();
	});
	onDestroy(() => {
		requestNumber++;
		clearTimeout(connectTimeout);
		fileController?.abort();
		stopRoomConnections();
	});
</script>

<div class="speechdrop-panel">
	<div class="room-entry">
		<input
			aria-label="SpeechDrop room code"
			placeholder="SpeechDrop Code"
			bind:value={roomCode}
			on:input={() => {
				shareSpeechDropCode(roomCode);
				editRoomCode();
			}}
		/>
	</div>
	{#if loading}
		<p class="status">Connecting…</p>
	{:else if error}
		<p class="status error" role="status">{error}</p>
	{/if}
	{#if $cardMirror.state === 'connected' && $cardMirrorDocuments.supported}
		<label class="auto-open"
			><input
				type="checkbox"
				checked={autoOpen}
				on:change={(e) => settings.setValue('cardMirrorOpenSpeechDrop', e.currentTarget.checked)}
			/> Open DOCX downloads in CardMirror</label
		>
	{/if}
	{#if status}<p class="status" role="status">{status}</p>{/if}
	{#if $cardMirrorDocuments.sending}<p class="status" role="status">
			Sending {$cardMirrorDocuments.sending}: {$cardMirrorDocuments.progress}%
		</p>{/if}
	{#if files.length > 0}
		<ul class="file-list">
			{#each files as file}
				<li>
					<Button
						icon="download"
						text={file.name}
						tooltip="download this file from the room"
						on:click={() => documentAction(file, 'download')}
						disabled={fileBusy !== null}
					/>

					<div class="file-actions">
						<Button
							icon="file"
							text="Use for transcript"
							toggled={$speechDocumentSource?.room === loadedRoomCode &&
								$speechDocumentSource.index === file.index}
							disabled={fileBusy !== null}
							on:click={() => documentAction(file, 'compare')}
						/>
						{#if /\.docx$/i.test(file.name) && $cardMirror.state === 'connected' && $cardMirrorDocuments.supported}<Button
								icon="arrowRight"
								text="Open in CardMirror"
								disabled={fileBusy !== null || !!$cardMirrorDocuments.sending}
								on:click={() => documentAction(file, 'open')}
							/>{/if}
					</div>
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
	.file-actions {
		display: flex;
		flex-wrap: wrap;
	}
	.auto-open {
		display: flex;
		align-items: flex-start;
		gap: var(--padding-small);
		color: var(--text-weak);
	}
	.file-list li {
		width: 100%;
		min-width: 0;
	}
	.file-list :global(.element) {
		width: auto;
		min-width: 0;
		max-width: 100%;
	}
	.file-list :global(button.top) {
		max-width: 100%;
		box-sizing: border-box;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		white-space: normal;
		overflow-wrap: anywhere;
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
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		background: var(--background-indent);
		color: var(--text);
		font: inherit;
		transition: background var(--transition-speed);
	}
	.room-entry input:focus {
		background: var(--background-active);
	}
	.room-entry input::placeholder {
		color: var(--text-weak);
	}
	.auto-open input {
		accent-color: var(--color-accent);
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
