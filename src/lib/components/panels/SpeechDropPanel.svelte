<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { speechDropCode, speechDocument, speechDocumentSource } from '$lib/models/collaboration';
	import { shareSpeechDropCode } from '$lib/models/sharingChannel';
	import { cardMirror, cardMirrorDocuments, openCardMirrorDocument } from '$lib/models/cardMirror';
	import { settings } from '$lib/models/settings';
	import Button from '$lib/components/Button.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelField from './PanelField.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import DocImport from '../DocImport.svelte';
	import { openPopup } from '$lib/models/popup';
	import { nodes } from '$lib/models/store';

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

	async function documentAction(
		file: SpeechDropFile,
		action: 'download' | 'compare' | 'open' | 'flow'
	) {
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
			if (action === 'flow') {
				if (!/\.docx$/i.test(file.name))
					throw new Error('Only DOCX speech documents can be flowed.');
				openPopup(DocImport, 'Flow speech document', { name: file.name, blob });
				return;
			}
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
	let localFile: HTMLInputElement;
	function flowLocalFile() {
		const file = localFile.files?.[0];
		localFile.value = '';
		if (file) openPopup(DocImport, 'Flow speech document', { name: file.name, blob: file });
	}
	$: flowOpen = $nodes.root.children.length > 0;
	$: canOpenInCardMirror = $cardMirror.state === 'connected' && $cardMirrorDocuments.supported;
</script>

<section class="speechdrop-panel" aria-label="SpeechDrop">
	<PanelHeader name="SpeechDrop" detail={files.length ? String(files.length) : null}>
		<Button
			icon="upload"
			ariaLabel="Flow a DOCX from this device"
			tooltip="flow tags from a DOCX on this device"
			disabled={!flowOpen}
			disabledReason="Open a flow first"
			on:click={() => localFile.click()}
		/>
	</PanelHeader>
	<input
		bind:this={localFile}
		type="file"
		accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		hidden
		on:change={flowLocalFile}
	/>
	<PanelField
		ariaLabel="SpeechDrop room code"
		placeholder="room code"
		spellcheck={false}
		bind:value={roomCode}
		on:input={() => {
			shareSpeechDropCode(roomCode);
			editRoomCode();
		}}
	/>
	{#if loading}
		<PanelStatus>Connecting…</PanelStatus>
	{:else if error}
		<PanelStatus error>{error}</PanelStatus>
	{/if}
	{#if canOpenInCardMirror}
		<label class="auto-open"
			><input
				type="checkbox"
				checked={autoOpen}
				on:change={(e) => settings.setValue('cardMirrorOpenSpeechDrop', e.currentTarget.checked)}
			/>open DOCX downloads in CardMirror</label
		>
	{/if}
	{#if status}<PanelStatus>{status}</PanelStatus>{/if}
	{#if $cardMirrorDocuments.sending}<PanelStatus>
			Sending {$cardMirrorDocuments.sending}: {$cardMirrorDocuments.progress}%
		</PanelStatus>{/if}
	{#if files.length > 0}
		<ul class="file-list">
			{#each files as file (file.index)}
				{@const docx = /\.docx$/i.test(file.name)}
				<li>
					<PanelRow
						ariaLabel={file.name}
						title="download"
						disabled={fileBusy !== null}
						selected={fileBusy === file.index}
						on:click={() => documentAction(file, 'download')}
					>
						{file.name}
						<svelte:fragment slot="actions">
							{#if docx}<Button
									icon="checklist"
									ariaLabel="Flow tags"
									tooltip="flow this document's tags"
									disabled={fileBusy !== null || !flowOpen}
									disabledReason={flowOpen ? 'busy' : 'Open a flow first'}
									on:click={() => documentAction(file, 'flow')}
								/>{/if}
							<Button
								icon="mic"
								ariaLabel="Use for transcript"
								tooltip="compare the transcript with this document"
								toggled={$speechDocumentSource?.room === loadedRoomCode &&
									$speechDocumentSource.index === file.index}
								disabled={fileBusy !== null}
								on:click={() => documentAction(file, 'compare')}
							/>
							{#if docx && canOpenInCardMirror}<Button
									icon="arrowRight"
									ariaLabel="Open in CardMirror"
									tooltip="open in CardMirror"
									disabled={fileBusy !== null || !!$cardMirrorDocuments.sending}
									on:click={() => documentAction(file, 'open')}
								/>{/if}
						</svelte:fragment>
					</PanelRow>
				</li>
			{/each}
		</ul>
	{:else if loadedRoomCode && !error}
		<PanelStatus>This room has no files.</PanelStatus>
	{/if}
</section>

<style>
	.speechdrop-panel {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.auto-open {
		display: flex;
		align-items: center;
		gap: var(--padding);
		padding: 0 var(--padding);
		color: var(--text-weak);
		font-size: 0.85em;
	}
	.auto-open input {
		accent-color: var(--color-accent);
		margin: 0;
	}
	.file-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
	}
</style>
