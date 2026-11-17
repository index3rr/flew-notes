// Keep packets below 16 KiB even for non-ASCII JSON. Large documents must not
// depend on the browser's negotiated SCTP message-size limit or send buffer.
const CHUNK_CHARACTERS = 4000;
const HIGH_WATER = 64 * 1024;
const LOW_WATER = 16 * 1024;
const CHUNK_FORMAT = 'flew-json-chunk-v1';
type Chunk = {
	format: typeof CHUNK_FORMAT;
	id: number;
	index: number;
	count: number;
	text: string;
};

export class Channel<SendMessage, ReceiveMessage> {
	#channel: RTCDataChannel;
	#queue: string[] = [];
	#offset = 0;
	#messageId = 0;
	#receiving: { id: number; count: number; parts: string[] } | null = null;
	#listeners: ((message: ReceiveMessage) => void)[] = [];

	constructor(channel: RTCDataChannel) {
		this.#channel = channel;
		channel.bufferedAmountLowThreshold = LOW_WATER;
		channel.addEventListener('open', () => this.#flush());
		channel.addEventListener('bufferedamountlow', () => this.#flush());
		channel.addEventListener('close', () => {
			this.#queue = [];
			this.#offset = 0;
			this.#receiving = null;
		});
		channel.addEventListener('message', (event: MessageEvent<string>) => {
			const packet = JSON.parse(event.data);
			if (packet?.format !== CHUNK_FORMAT) {
				this.#deliver(packet);
				return;
			}
			const chunk = packet as Chunk;
			if (
				!Number.isSafeInteger(chunk.id) ||
				!Number.isSafeInteger(chunk.count) ||
				!Number.isSafeInteger(chunk.index) ||
				chunk.count < 1 ||
				chunk.index < 0 ||
				chunk.index >= chunk.count ||
				typeof chunk.text !== 'string' ||
				chunk.text.length > CHUNK_CHARACTERS
			)
				throw new Error('Invalid collaboration message fragment');
			if (chunk.index === 0) {
				if (this.#receiving) throw new Error('Incomplete collaboration message');
				this.#receiving = { id: chunk.id, count: chunk.count, parts: [] };
			}
			const receiving = this.#receiving;
			if (
				!receiving ||
				receiving.id !== chunk.id ||
				receiving.count !== chunk.count ||
				receiving.parts.length !== chunk.index
			)
				throw new Error('Out-of-order collaboration message fragment');
			receiving.parts.push(chunk.text);
			if (receiving.parts.length === receiving.count) {
				this.#receiving = null;
				this.#deliver(JSON.parse(receiving.parts.join('')));
			}
		});
	}

	#deliver(message: ReceiveMessage) {
		for (const listener of this.#listeners) listener(message);
	}

	send(message: SendMessage) {
		if (this.#channel.readyState === 'closed' || this.#channel.readyState === 'closing') return;
		// Serialize now: a document may change before a connecting channel opens.
		const payload = JSON.stringify(message);
		if (payload.length <= CHUNK_CHARACTERS) this.#queue.push(payload);
		else {
			const id = ++this.#messageId;
			const count = Math.ceil(payload.length / CHUNK_CHARACTERS);
			for (let index = 0; index < count; index++) {
				const chunk: Chunk = {
					format: CHUNK_FORMAT,
					id,
					index,
					count,
					text: payload.slice(index * CHUNK_CHARACTERS, (index + 1) * CHUNK_CHARACTERS)
				};
				this.#queue.push(JSON.stringify(chunk));
			}
		}
		this.#flush();
	}

	#flush() {
		if (this.#channel.readyState !== 'open') return;
		while (this.#offset < this.#queue.length && this.#channel.bufferedAmount < HIGH_WATER) {
			this.#channel.send(this.#queue[this.#offset]);
			this.#offset++;
		}
		if (this.#offset === this.#queue.length) {
			this.#queue = [];
			this.#offset = 0;
		}
	}

	onOpen(fn: () => void) {
		if (this.#channel.readyState === 'open') fn();
		else this.#channel.addEventListener('open', fn, { once: true });
	}
	onClose(fn: () => void) {
		this.#channel.addEventListener('close', fn);
	}
	onMessage(fn: (message: ReceiveMessage) => void) {
		this.#listeners.push(fn);
	}
}
