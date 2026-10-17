import { get } from 'svelte/store';
import { speechDropCode, addPartnerNotice } from './collaboration';
import { isNodesWorthSaving, type Nodes } from './node';
import {
	applyActionBundleAndSyncUi,
	applyActionBundleBatchAndSyncUi,
	type ActionBundle
} from './nodeAction';
import { resolvePendingAction } from './nodePendingAction';
import { disconnect, type ConnectionId, type Connections } from './sharingConnection';
import { _nodesMut, connections, flowsChange, nodes } from './store';

let $connections: Connections;
connections.subscribe((connections) => {
	$connections = connections;
});

let $nodes: Nodes;
nodes.subscribe((nodes) => {
	$nodes = nodes;
});

export type ActionId = string & { readonly ActionId: unique symbol };

export type SendAction = {
	id: ActionId;
	actionBundle: ActionBundle;
};
type PartnerMessage = { tag: 'partnerMessage'; text: string } | { tag: 'speechDrop'; code: string };
export type HostMessage =
	| PartnerMessage
	| {
			tag: 'sync';
			nodes: Nodes;
			first: boolean;
	  }
	| {
			tag: 'action';
			action: SendAction;
	  }
	| {
			tag: 'actionRecieved';
			actionId: ActionId;
	  }
	| {
			tag: 'name';
			name: string;
	  };

export type GuestMessage =
	| PartnerMessage
	| {
			tag: 'requestSync';
	  }
	| {
			tag: 'action';
			action: SendAction;
	  };

export function sendPartnerMessage(text: string) {
	const cleaned = text.trim().slice(0, 2000);
	if (!cleaned || !broadcastPartner({ tag: 'partnerMessage', text: cleaned })) return false;
	addPartnerNotice(cleaned, false);
	return true;
}
function broadcastPartner(message: PartnerMessage, except?: ConnectionId) {
	let sent = false;
	if ($connections.tag === 'host') {
		for (const id of Object.keys($connections.holder) as ConnectionId[]) {
			if (id === except) continue;
			$connections.holder[id].channel.send(message);
			sent = true;
		}
	} else if ($connections.tag === 'guest' && $connections.connection.tag === 'guestConnected') {
		$connections.connection.channel.send(message);
		sent = true;
	}
	return sent;
}
export function shareSpeechDropCode(code: string) {
	speechDropCode.set(code);
	broadcastPartner({ tag: 'speechDrop', code });
}
function receivePartner(message: PartnerMessage) {
	if (message.tag === 'partnerMessage' && typeof message.text === 'string')
		addPartnerNotice(message.text.slice(0, 2000), true);
	if (message.tag === 'speechDrop' && typeof message.code === 'string')
		speechDropCode.set(message.code.slice(0, 100));
}

function newActionId(): ActionId {
	return crypto.randomUUID() as ActionId;
}

const prediction: {
	actionsAwaitingConfirmation: { [key: ActionId]: ActionBundle };
	predictedInverse: ActionBundle[];
	confirmed: ActionBundle[];
} = {
	actionsAwaitingConfirmation: {},
	predictedInverse: [],
	confirmed: []
};

export function sendActionBundle(actionBundle: ActionBundle, inverseActionBundle: ActionBundle) {
	if ($connections.tag === 'host') {
		const id = newActionId();
		const message: HostMessage = {
			tag: 'action',
			action: {
				id,
				actionBundle
			}
		};
		for (const connectionId of Object.keys($connections.holder)) {
			$connections.holder[<ConnectionId>connectionId].channel.send(message);
		}
	} else if ($connections.tag === 'guest' && $connections.connection.tag === 'guestConnected') {
		const id = newActionId();
		$connections.connection.channel.send({
			tag: 'action',
			action: {
				id,
				actionBundle
			}
		});
		prediction.actionsAwaitingConfirmation[id] = actionBundle;
		prediction.predictedInverse.push(inverseActionBundle);
	}
}

interface Channel<SendMessage, RecieveMessage> {
	send(message: SendMessage): void;
	onOpen(fn: () => void): void;
	onClose(fn: () => void): void;
	onMessage(fn: (event: RecieveMessage) => void): void;
}

export function addHostChannelHandler(
	channel: Channel<HostMessage, GuestMessage>,
	id: ConnectionId
) {
	channel.onOpen(() => {
		channel.send({ tag: 'speechDrop', code: get(speechDropCode) });
		channel.send({
			tag: 'sync',
			nodes: $nodes,
			first: true
		});
	});
	channel.onMessage((message) => {
		switch (message.tag) {
			case 'partnerMessage':
			case 'speechDrop':
				receivePartner(message);
				broadcastPartner(message, id);
				break;
			case 'requestSync':
				channel.send({
					tag: 'sync',
					nodes: $nodes,
					first: false
				});
				break;
			case 'action': {
				if ($connections.tag != 'host') return;

				resolvePendingAction($nodes);
				applyActionBundleAndSyncUi(message.action.actionBundle);

				for (const otherId of Object.keys($connections.holder)) {
					if (id == otherId) continue;
					$connections.holder[<ConnectionId>otherId].channel.send(message);
				}

				channel.send({
					tag: 'actionRecieved',
					actionId: message.action.id
				});
				break;
			}
		}
	});
}
export function addGuestChannelHandler(channel: Channel<GuestMessage, HostMessage>) {
	channel.onMessage((message) => {
		switch (message.tag) {
			case 'partnerMessage':
			case 'speechDrop':
				receivePartner(message);
				break;
			case 'sync':
				if (
					!message.first ||
					!isNodesWorthSaving($nodes) ||
					confirm("Are you sure you want to overwrite your work with the host's?")
				) {
					_nodesMut.set(message.nodes);
					flowsChange();
					connections.update(function (connections) {
						if (connections.tag == 'guest' && connections.connection.tag == 'guestConnected') {
							connections.connection.awaitingSync = false;
						}
						return connections;
					});
				} else {
					disconnect();
				}
				break;
			case 'name':
				connections.update(function (connections) {
					if (connections.tag == 'guest' && connections.connection.tag == 'guestConnected') {
						connections.connection.name = message.name;
					}
					return connections;
				});
				break;
			case 'action': {
				resolvePendingAction($nodes);
				prediction.confirmed.push(structuredClone(message.action.actionBundle));
				const actionInverse = applyActionBundleAndSyncUi(message.action.actionBundle);
				prediction.predictedInverse.push(actionInverse);
				break;
			}
			case 'actionRecieved': {
				prediction.confirmed.push(prediction.actionsAwaitingConfirmation[message.actionId]);
				delete prediction.actionsAwaitingConfirmation[message.actionId];
				// check if it's possible that all awaiting actions have been confirmed
				if (Object.keys(prediction.actionsAwaitingConfirmation).length != 0) return;
				// if there are no actions awaiting confirmation, resolve all pending actions, which might create new actions awaiting confirmation
				resolvePendingAction($nodes);
				// check all awaiting actions have been confirmed
				if (Object.keys(prediction.actionsAwaitingConfirmation).length != 0) return;

				// undo all predicted actions and do all confirmed actions
				applyActionBundleBatchAndSyncUi(
					$nodes,
					prediction.predictedInverse.toReversed().concat(prediction.confirmed)
				);

				// reset prediction
				prediction.predictedInverse = [];
				prediction.confirmed = [];

				break;
			}
		}
	});
}
