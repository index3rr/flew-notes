import {
	addGuestChannelHandler,
	addHostChannelHandler,
	type GuestMessage,
	type HostMessage
} from './sharingChannel';
import { openPopup } from './popup';
import Message from '$lib/components/Message.svelte';
import { connections } from './store';
import { trackSharingStarted } from './telemetry';
import { getIceServers } from './iceServers';
import { setSharingLocalDescription, sharingRoomId, sharingLocalOffer } from './sharingIce';

const MESSAGE_CHANNEL_NAME = 'messageChannel';

export class Channel<SendMessage, RecieveMessage> {
	#channel: RTCDataChannel;
	queuedMessages: SendMessage[];
	constructor(channel: RTCDataChannel) {
		this.#channel = channel;
		this.queuedMessages = [];
		this.onOpen(() => {
			for (const message of this.queuedMessages) {
				this.send(message);
			}
			this.queuedMessages = [];
		});
	}
	send(message: SendMessage) {
		const payload = JSON.stringify(message);
		if (this.#channel.readyState == 'open') {
			const channel = this.#channel;
			channel.send(payload);
		} else {
			this.queuedMessages.push(message);
		}
	}
	onOpen(fn: () => void) {
		if (this.#channel.readyState == 'open') {
			fn();
			return;
		}
		this.#channel.addEventListener('open', fn, { once: true });
	}
	onClose(fn: () => void) {
		this.#channel.addEventListener('close', fn);
	}
	onMessage(fn: (event: RecieveMessage) => void) {
		this.#channel.addEventListener('message', function (event: MessageEvent<string>) {
			fn(JSON.parse(event.data));
		});
	}
}

export type GuestKey = {
	qrRelayCandidate?: string;
	qrRelayOnly?: boolean;
	localOffer: string;
	broadcastId: string;
};

export type HostKey = {
	qrRelayCandidate?: string;
	qrRelayOnly?: boolean;
	localOffer: string;
	broadcastId: string;
};

export type GuestBroadcast = {
	tag: 'guestKey';
	key: GuestKey;
};

export type HostBroadcast =
	| {
			tag: 'guestKeyRecieved';
			broadcastId: string;
	  }
	| {
			tag: 'guestKeyMismatch';
			broadcastId: string;
	  };

export type Broadcast = GuestBroadcast | HostBroadcast;

export type HostCreatingKey = {
	tag: 'hostCreatingKey';
	pc: RTCPeerConnection;
	channel: Channel<HostMessage, GuestMessage>;
};
export type HostAwaitingGuestKey = {
	tag: 'hostAwaitingGuestKey';
	pc: RTCPeerConnection;
	key: HostKey;
	channel: Channel<HostMessage, GuestMessage>;
	broadcastChannel: BroadcastChannel;
};
export type HostConnected = {
	tag: 'hostConnected';
	pc: RTCPeerConnection;
	channel: Channel<HostMessage, GuestMessage>;
	name: string;
};
export type Host = HostCreatingKey | HostAwaitingGuestKey | HostConnected;

export type GuestAwaitingHostKey = {
	tag: 'guestAwaitingHostKey';
	pc: RTCPeerConnection;
};

export type GuestCreatingKey = {
	tag: 'guestCreatingKey';
	pc: RTCPeerConnection;
};

export type GuestAwaitingChannel = {
	tag: 'guestAwaitingChannel';
	pc: RTCPeerConnection;
	key: GuestKey;
	hostKey: HostKey;
};

export type GuestConnected = {
	tag: 'guestConnected';
	pc: RTCPeerConnection;
	channel: Channel<GuestMessage, HostMessage>;
	name: string | null;
	awaitingSync: boolean;
};

export type Guest = GuestAwaitingHostKey | GuestCreatingKey | GuestAwaitingChannel | GuestConnected;

export type ConnectionId = string & { readonly NodeId: unique symbol };
function newConnectionId(): ConnectionId {
	return crypto.randomUUID() as ConnectionId;
}

export type ConnectionHolder<Connection> = {
	[key: ConnectionId]: Connection;
};
export type Connections =
	| {
			tag: 'empty';
	  }
	| {
			tag: 'host';
			building: ConnectionId | null;
			holder: ConnectionHolder<Host>;
	  }
	| {
			tag: 'guest';
			building: boolean;
			connection: Guest;
	  };

function generateGuestName(holder: ConnectionHolder<Host>) {
	const names = new Set<string>();
	for (const id of Object.keys(holder)) {
		const connection = holder[<ConnectionId>id];
		if (connection.tag == 'hostConnected' && connection.name) {
			names.add(connection.name);
		}
	}
	let i = 1;
	let name = 'guest ' + i;
	while (names.has(name)) {
		name = 'guest ' + i;
		i++;
	}
	return name;
}

export function initHost() {
	connections.update(function (oldConnections) {
		if (oldConnections.tag != 'empty') return oldConnections;
		trackSharingStarted(true);
		return {
			tag: 'host',
			building: null,
			holder: {}
		};
	});
}
export function addHostConnection(): ConnectionId {
	const id = newConnectionId();
	connections.update(function (oldConnections) {
		if (oldConnections.tag != 'host') return oldConnections;

		const conf = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
		const pc = new RTCPeerConnection(conf);
		const channel = new Channel<HostMessage, GuestMessage>(
			pc.createDataChannel(MESSAGE_CHANNEL_NAME)
		);
		addHostChannelHandler(channel, id);
		oldConnections.holder[id] = { tag: 'hostCreatingKey', pc, channel };

		let broadcastId = '';

		const broadcastChannel = new BroadcastChannel('guestKeySend');
		broadcastChannel.addEventListener('message', (event) => {
			const message: Broadcast = event.data;

			connections.update(function (connections) {
				if (connections.tag != 'host') return connections;
				const connection = connections.holder[id];
				if (connection.tag == 'hostAwaitingGuestKey' && message.tag == 'guestKey') {
					let response: Broadcast;
					if (connection.key.broadcastId == message.key.broadcastId) {
						giveHostGuestKey(message.key);
						response = {
							tag: 'guestKeyRecieved',
							broadcastId: message.key.broadcastId
						};
					} else {
						response = {
							tag: 'guestKeyMismatch',
							broadcastId: message.key.broadcastId
						};
					}
					broadcastChannel.postMessage(response);
				}
				return connections;
			});
		});

		pc.addEventListener('icecandidate', function (e) {
			const cand = e.candidate;
			if (!cand) {
				connections.update(function (connections) {
					if (connections.tag != 'host') return connections;
					const connection = connections.holder[id];
					if (connection.tag != 'hostCreatingKey') return connections;
					connections.holder[id] = {
						tag: 'hostAwaitingGuestKey',
						pc: connection.pc,
						channel: connection.channel,
						key: {
							localOffer: sharingLocalOffer(pc.localDescription),
							broadcastId: sharingRoomId(pc.localDescription!.sdp)
						},
						broadcastChannel
					};
					return connections;
				});
			}
		});
		getIceServers()
			.then((iceServers) => {
				pc.setConfiguration({ iceServers });
				return pc.createOffer();
			})
			.then((des) => {
				setSharingLocalDescription(pc, des)
					.then(() => {
						broadcastId = sharingRoomId(pc.localDescription!.sdp);
						setTimeout(function () {
							if (pc.iceGatheringState != 'complete') {
								connections.update(function (connections) {
									if (connections.tag != 'host') return connections;
									const connection = connections.holder[id];
									if (connection.tag != 'hostCreatingKey') return connections;
									connections.holder[id] = {
										tag: 'hostAwaitingGuestKey',
										pc: connection.pc,
										channel: connection.channel,
										key: {
											localOffer: sharingLocalOffer(pc.localDescription),
											broadcastId
										},
										broadcastChannel
									};
									return connections;
								});
							}
						}, 3000);
					})
					.catch(errHandler);
			})
			.catch(errHandler);
		return { ...oldConnections, building: id };
	});
	return id;
}

export function initGuestConnection() {
	// set guest to awaiting host key
	const conf = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
	const pc = new RTCPeerConnection(conf);
	const connection: GuestAwaitingHostKey = {
		tag: 'guestAwaitingHostKey',
		pc
	};
	trackSharingStarted(false);
	connections.set({
		tag: 'guest',
		connection,
		building: true
	});
}

export function giveHostGuestKey(key: GuestKey) {
	connections.update(function (oldConnections) {
		if (oldConnections.tag != 'host') return oldConnections;
		const id = oldConnections.building;
		if (id == null) return oldConnections;
		const connection = oldConnections.holder[id];
		if (connection.tag != 'hostAwaitingGuestKey') return oldConnections;
		if (connection.key.broadcastId != key.broadcastId) return oldConnections;
		const _remoteOffer = new RTCSessionDescription(JSON.parse(key.localOffer));
		getIceServers()
			.then((iceServers) => {
				connection.pc.setConfiguration({ iceServers });
				return connection.pc.setRemoteDescription(_remoteOffer);
			})
			.then(function () {
				connections.update(function (oldConnections) {
					if (oldConnections.tag != 'host') return oldConnections;
					const connection = oldConnections.holder[id];
					if (connection.tag != 'hostAwaitingGuestKey') return oldConnections;
					connection.broadcastChannel.close();
					// make sure the broadcast id matches
					const name = generateGuestName(oldConnections.holder);
					oldConnections.holder[id] = {
						tag: 'hostConnected',
						pc: connection.pc,
						channel: connection.channel,
						name
					};

					connection.channel.onOpen(function () {
						connection.channel.send({
							tag: 'name',
							name
						});
					});

					addConnectionStateUpdater(connection.pc, name, function () {
						connections.update(function (connections) {
							if (connections.tag != 'host') return connections;
							delete connections.holder[id];
							return connections;
						});
					});

					return { ...oldConnections, building: null };
				});
			})
			.catch(errHandler);
		return oldConnections;
	});
}

export function addConnectionStateUpdater(
	pc: RTCPeerConnection,
	name: string,
	cleanup: (reason: 'failed' | 'closed') => void
) {
	pc.addEventListener('connectionstatechange', function () {
		// inform subscribers of the connection state
		connections.update((connections) => connections);
		if (pc.connectionState == 'failed' || pc.connectionState == 'closed') {
			openPopup(Message, 'Disconnected', {
				message: `Disconnected from ${name}`
			});
			cleanup(pc.connectionState);
		}
	});
}

export function giveGuestHostKey(key: HostKey) {
	connections.update(function (oldConnections) {
		if (oldConnections.tag != 'guest') return oldConnections;
		const connection = oldConnections.connection;
		if (connection.tag != 'guestAwaitingHostKey') return oldConnections;
		let pendingDataChannel: RTCDataChannel | null = null;
		let guestKeyReady = false;
		let dataChannelConnected = false;

		function connectGuestDataChannel() {
			if (!guestKeyReady || pendingDataChannel == null || dataChannelConnected) return;
			dataChannelConnected = true;
			const rtcChannel = pendingDataChannel;
			pendingDataChannel = null;
			connections.update(function (currentConnections) {
				if (
					currentConnections.tag != 'guest' ||
					currentConnections.connection.tag != 'guestAwaitingChannel'
				) {
					return currentConnections;
				}
				const connection = currentConnections.connection;
				const channel = new Channel<GuestMessage, HostMessage>(rtcChannel);
				addGuestChannelHandler(channel);
				addConnectionStateUpdater(connection.pc, 'host', function () {
					connections.update(function (connections) {
						if (connections.tag != 'guest') return connections;
						return { tag: 'empty' };
					});
				});
				return {
					...currentConnections,
					building: false,
					connection: {
						tag: 'guestConnected',
						pc: connection.pc,
						channel,
						name: null,
						awaitingSync: true
					}
				};
			});
		}

		function publishGuestKey() {
			if (connection.pc.localDescription == null) return;
			let published = false;
			connections.update(function (current) {
				if (
					current.tag != 'guest' ||
					current.connection.pc != connection.pc ||
					!['guestCreatingKey', 'guestAwaitingChannel'].includes(current.connection.tag)
				)
					return current;
				current.connection = {
					tag: 'guestAwaitingChannel',
					pc: connection.pc,
					hostKey: key,
					key: {
						localOffer: sharingLocalOffer(connection.pc.localDescription),
						broadcastId: key.broadcastId
					}
				};
				published = true;
				return current;
			});
			if (published) {
				guestKeyReady = true;
				connectGuestDataChannel();
			}
		}

		connection.pc.addEventListener('icecandidate', function (event) {
			// Gathering can stay pending even after a working relay/path exists.
			// Publish that usable answer, and keep all later candidates in the reply.
			if (!event.candidate || event.candidate.type == 'relay' || guestKeyReady) publishGuestKey();
		});
		connection.pc.addEventListener('iceconnectionstatechange', function () {
			if (['connected', 'completed'].includes(connection.pc.iceConnectionState)) publishGuestKey();
		});
		// create offer
		const _remoteOffer = new RTCSessionDescription(JSON.parse(key.localOffer));
		getIceServers()
			.then((iceServers) => {
				connection.pc.setConfiguration({ iceServers });
				return connection.pc.setRemoteDescription(_remoteOffer);
			})
			.then(function () {
				connection.pc
					.createAnswer()
					.then(function (description) {
						setSharingLocalDescription(connection.pc, description).catch(errHandler);
					})
					.catch(errHandler);
			})
			.catch(errHandler);
		// when channel is created, update connection
		connection.pc.ondatachannel = function (e) {
			if (e.channel.label != MESSAGE_CHANNEL_NAME) return;
			pendingDataChannel = e.channel;
			connectGuestDataChannel();
		};
		oldConnections.connection = {
			tag: 'guestCreatingKey',
			pc: connection.pc
		};
		return oldConnections;
	});
}

export function disconnect() {
	connections.update(function (connections) {
		if (connections.tag == 'empty') return connections;
		switch (connections.tag) {
			case 'host':
				for (const id of <ConnectionId[]>Object.keys(connections.holder)) {
					const connection = connections.holder[id];
					connection.pc.close();
				}
				break;
			case 'guest':
				connections.connection.pc.close();
				break;
		}
		return {
			tag: 'empty'
		};
	});
}

export function cancelBuilding() {
	connections.update(function (connections) {
		if (connections.tag == 'host' && connections.building != null) {
			connections.holder[connections.building].pc.close();
			delete connections.holder[connections.building];
		} else if (connections.tag == 'guest' && connections.building) {
			connections.connection.pc.close();
			connections = {
				tag: 'empty'
			};
		}
		return connections;
	});
}

function errHandler(err: unknown) {
	console.error(err);
	openPopup(Message, 'Could not connect', {
		message: err instanceof Error ? err.message : 'The WebRTC connection setup failed.',
		error: true
	});
	cancelBuilding();
}

function createLinkWithParam(param: string, value: string): string {
	const currentUrl = new URL(location.pathname, location.href);
	currentUrl.searchParams.set(param, value);
	return currentUrl.href;
}

function readLinkParam(param: string): string | null {
	const url = new URL(location.href);
	const value = url.searchParams.get(param);
	if (value) {
		return value;
	}
	return null;
}

export function createJoinLink(hostKey: HostKey): string {
	return createLinkWithParam('join', JSON.stringify(hostKey));
}

export function createConfirmLink(guestKey: GuestKey): string {
	return createLinkWithParam('confirm', JSON.stringify(guestKey));
}

export function parseJoinLink(): HostKey | null {
	const raw = readLinkParam('join');
	if (raw == null) return null;
	return JSON.parse(raw);
}

export function parseConfirmLink(): GuestKey | null {
	const raw = readLinkParam('confirm');
	if (raw == null) return null;
	return JSON.parse(raw);
}

export function requestSync() {
	connections.update(function (connections) {
		if (
			connections.tag == 'guest' &&
			connections.connection.tag == 'guestConnected' &&
			!connections.connection.awaitingSync
		) {
			connections.connection.channel.send({
				tag: 'requestSync'
			});
			connections.connection.awaitingSync = true;
		}
		return connections;
	});
}
