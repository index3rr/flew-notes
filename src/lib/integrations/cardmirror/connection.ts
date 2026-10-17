import { record, string } from './protocol';

const prefix = 'FLEWCM1.';
const maxMessage = 2_000_000;
type Handler = (method: string, params: unknown) => unknown | Promise<unknown>;
export type ConnectionState = 'disconnected' | 'pairing' | 'connecting' | 'connected';
interface Signal {
	version: 1;
	session: string;
	description: RTCSessionDescriptionInit;
	iceServers: RTCIceServer[];
}

function encode(signal: Signal): string {
	const bytes = new TextEncoder().encode(JSON.stringify(signal));
	return prefix + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}
export function decode(key: string, role: RTCSdpType): Signal {
	const trimmed = key.trim();
	if (!trimmed.startsWith(prefix) || trimmed.length > 180_000)
		throw new Error('Invalid CardMirror connection key.');
	let value: unknown;
	try {
		value = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(
				Uint8Array.from(atob(trimmed.slice(prefix.length)), (c) => c.charCodeAt(0))
			)
		);
	} catch {
		throw new Error('Invalid CardMirror connection key.');
	}
	if (
		!record(value) ||
		value.version !== 1 ||
		!string(value.session, 100) ||
		!value.session ||
		!record(value.description) ||
		value.description.type !== role ||
		!string(value.description.sdp, 100_000) ||
		!value.description.sdp.startsWith('v=0') ||
		!Array.isArray(value.iceServers) ||
		value.iceServers.length > 20 ||
		!value.iceServers.every(
			(s) =>
				record(s) &&
				(typeof s.urls === 'string' || Array.isArray(s.urls)) &&
				(typeof s.urls === 'string' ? [s.urls] : s.urls).length <= 10 &&
				(typeof s.urls === 'string' ? [s.urls] : s.urls).every(
					(url: unknown) => string(url, 2000) && /^(stun|stuns|turn|turns):/i.test(url)
				) &&
				(s.username === undefined || string(s.username, 2000)) &&
				(s.credential === undefined || string(s.credential, 4000))
		)
	) {
		throw new Error('Incompatible CardMirror connection key.');
	}
	return value as unknown as Signal;
}

// Small ordered frames avoid browser-specific SCTP message-size limits. Both directions
// have bounded queues, assembly lifetimes and request deadlines, including jump replies.
export class Rpc {
	private pending = new Map<
		string,
		{
			resolve: (v: unknown) => void;
			reject: (e: Error) => void;
			timer: ReturnType<typeof setTimeout>;
		}
	>();
	private parts = new Map<
		string,
		{ texts: string[]; total: number; timer: ReturnType<typeof setTimeout> }
	>();
	private requests = new Map<string, Promise<unknown>>();
	private queue = Promise.resolve();
	private stopped = false;
	constructor(
		private channel: RTCDataChannel,
		private handler: Handler,
		private onClose: () => void
	) {
		channel.onmessage = (e) => {
			try {
				this.receive(e.data);
			} catch {
				this.close();
			}
		};
		channel.onclose = () => this.close();
		channel.onerror = () => this.close();
	}
	request(method: string, params: unknown): Promise<unknown> {
		if (this.stopped || this.channel.readyState !== 'open')
			return Promise.reject(new Error('Connect CardMirror to Flew first.'));
		if (this.pending.size >= 16)
			return Promise.reject(new Error('Wait for the previous send to finish.'));
		const id = crypto.randomUUID();
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error('CardMirror request timed out. Check the connection before retrying.'));
			}, 20_000);
			this.pending.set(id, { resolve, reject, timer });
			void this.send({ version: 1, id, method, params }).catch((error) => {
				clearTimeout(timer);
				this.pending.delete(id);
				reject(error);
			});
		});
	}
	private send(message: unknown): Promise<void> {
		const text = JSON.stringify(message);
		if (text.length > maxMessage)
			return Promise.reject(new Error('Selection is too large. Send fewer items.'));
		const job = this.queue.then(async () => {
			const id = crypto.randomUUID();
			const total = Math.ceil(text.length / 2048);
			const deadline = Date.now() + 15_000;
			for (let part = 0; part < total; part++) {
				while (this.channel.bufferedAmount > 256_000 && !this.stopped && Date.now() < deadline)
					await new Promise((r) => setTimeout(r, 25));
				if (this.stopped || this.channel.readyState !== 'open' || Date.now() >= deadline)
					throw new Error('Connection closed or stalled. Reconnect CardMirror.');
				this.channel.send(
					JSON.stringify({ id, part, total, text: text.slice(part * 2048, (part + 1) * 2048) })
				);
			}
		});
		this.queue = job.catch(() => undefined);
		return job;
	}
	private receive(raw: unknown) {
		if (!string(raw, 16_000)) throw new Error('Invalid frame');
		const frame: unknown = JSON.parse(raw);
		if (
			!record(frame) ||
			!string(frame.id, 100) ||
			!string(frame.text, 2048) ||
			!Number.isInteger(frame.part) ||
			!Number.isInteger(frame.total) ||
			(frame.total as number) < 1 ||
			(frame.total as number) > 1024
		)
			throw new Error('Invalid frame');
		let assembly = this.parts.get(frame.id);
		if (!assembly) {
			if (frame.part !== 0 || this.parts.size >= 8) throw new Error('Invalid assembly');
			const id = frame.id;
			assembly = {
				texts: [],
				total: frame.total as number,
				timer: setTimeout(() => {
					this.parts.delete(id);
					this.close();
				}, 15_000)
			};
			this.parts.set(id, assembly);
		}
		if (frame.part !== assembly.texts.length || frame.total !== assembly.total)
			throw new Error('Invalid order');
		assembly.texts.push(frame.text);
		if (assembly.texts.length !== assembly.total) return;
		clearTimeout(assembly.timer);
		this.parts.delete(frame.id);
		const text = assembly.texts.join('');
		if (text.length > maxMessage) throw new Error('Message too large');
		const message: unknown = JSON.parse(text);
		if (!record(message) || message.version !== 1 || !string(message.id, 100))
			throw new Error('Invalid message');
		const id = message.id;
		if (typeof message.method === 'string') {
			let result = this.requests.get(id);
			if (!result) {
				if (this.requests.size >= 32) this.requests.delete(this.requests.keys().next().value!);
				result = Promise.resolve().then(() =>
					this.handler(message.method as string, message.params)
				);
				this.requests.set(id, result);
			}
			void result
				.then(
					(value) => this.send({ version: 1, id, ok: true, value }),
					(error) =>
						this.send({
							version: 1,
							id,
							ok: false,
							error: error instanceof Error ? error.message : 'Request failed.'
						})
				)
				.catch(() => this.close());
		} else {
			const pending = this.pending.get(id);
			if (!pending) return;
			clearTimeout(pending.timer);
			this.pending.delete(id);
			if (message.ok === true) pending.resolve(message.value);
			else
				pending.reject(
					new Error(string(message.error, 1000) ? message.error : 'CardMirror request failed.')
				);
		}
	}
	close() {
		if (this.stopped) return;
		this.stopped = true;
		for (const p of this.pending.values()) {
			clearTimeout(p.timer);
			p.reject(new Error('CardMirror disconnected.'));
		}
		for (const p of this.parts.values()) clearTimeout(p.timer);
		this.pending.clear();
		this.parts.clear();
		this.requests.clear();
		this.channel.close();
		this.onClose();
	}
}

export class Connection {
	private pc: RTCPeerConnection | null = null;
	private rpc: Rpc | null = null;
	private session = '';
	private iceServers: RTCIceServer[] = [];
	private deadline: ReturnType<typeof setTimeout> | undefined;
	constructor(
		private handler: Handler,
		private changed: (state: ConnectionState, error?: string) => void
	) {}
	private setup(session: string, iceServers: RTCIceServer[]) {
		this.close();
		this.session = session;
		this.iceServers = iceServers;
		const pc = new RTCPeerConnection({ iceServers });
		this.pc = pc;
		this.changed('pairing');
		this.deadline = setTimeout(
			() => this.close('Pairing expired. Create a new connection key.'),
			120_000
		);
		pc.onconnectionstatechange = () => {
			if (this.pc !== pc) return;
			if (pc.connectionState === 'failed' || pc.connectionState === 'closed')
				this.close('CardMirror connection ended.');
		};
		pc.ondatachannel = (event) => this.attach(pc, event.channel);
		return pc;
	}
	private attach(pc: RTCPeerConnection, channel: RTCDataChannel) {
		if (channel.label !== 'flew-cardmirror-v1' || this.rpc) {
			channel.close();
			return;
		}
		channel.onclose = () => {
			if (this.pc === pc) this.close();
		};
		channel.onerror = () => {
			if (this.pc === pc) this.close('CardMirror connection failed.');
		};
		const opened = () => {
			if (this.pc !== pc) {
				channel.close();
				return;
			}
			clearTimeout(this.deadline);
			this.rpc = new Rpc(channel, this.handler, () => this.close());
			this.changed('connected');
		};
		if (channel.readyState === 'open') opened();
		else channel.onopen = opened;
	}
	private async localKey(pc: RTCPeerConnection): Promise<string> {
		await new Promise<void>((resolve) => {
			if (pc.iceGatheringState === 'complete') {
				resolve();
				return;
			}
			const done = () => {
				clearTimeout(timer);
				pc.removeEventListener('icegatheringstatechange', check);
				resolve();
			};
			const check = () => {
				if (pc.iceGatheringState === 'complete') done();
			};
			const timer = setTimeout(done, 3000);
			pc.addEventListener('icegatheringstatechange', check);
		});
		if (this.pc !== pc || !pc.localDescription) throw new Error('Pairing cancelled.');
		return encode({
			version: 1,
			session: this.session,
			description: pc.localDescription.toJSON(),
			iceServers: this.iceServers
		});
	}
	async offer(iceServers: RTCIceServer[]): Promise<string> {
		const pc = this.setup(crypto.randomUUID(), iceServers);
		this.attach(pc, pc.createDataChannel('flew-cardmirror-v1', { ordered: true }));
		try {
			await pc.setLocalDescription(await pc.createOffer());
			return await this.localKey(pc);
		} catch (error) {
			if (this.pc === pc) this.close();
			throw error;
		}
	}
	async answer(key: string): Promise<string> {
		const offer = decode(key, 'offer');
		const pc = this.setup(offer.session, offer.iceServers);
		try {
			await pc.setRemoteDescription(offer.description);
			await pc.setLocalDescription(await pc.createAnswer());
			this.changed('connecting');
			return await this.localKey(pc);
		} catch (error) {
			if (this.pc === pc) this.close();
			throw error;
		}
	}
	async confirm(key: string) {
		const answer = decode(key, 'answer');
		if (!this.pc || answer.session !== this.session)
			throw new Error('This reply belongs to a different connection.');
		const pc = this.pc;
		try {
			await pc.setRemoteDescription(answer.description);
			if (!this.rpc) this.changed('connecting');
		} catch (error) {
			if (this.pc === pc) this.close();
			throw error;
		}
	}
	request(method: string, params: unknown): Promise<unknown> {
		return (
			this.rpc?.request(method, params) ??
			Promise.reject(new Error('Connect CardMirror to Flew first.'))
		);
	}
	close(error?: string) {
		clearTimeout(this.deadline);
		const rpc = this.rpc,
			pc = this.pc;
		this.rpc = null;
		this.pc = null;
		if (pc) {
			pc.onconnectionstatechange = null;
			pc.close();
		}
		rpc?.close();
		this.session = '';
		this.iceServers = [];
		this.changed('disconnected', error);
	}
}
