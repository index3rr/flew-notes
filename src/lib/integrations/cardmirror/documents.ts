import { record, string } from './protocol';

export const maxDocumentBytes = 50 * 1024 * 1024;
export const documentChunkBytes = 48 * 1024;
export function encodeBytes(bytes: Uint8Array) {
	return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

// Documents are streamed in bounded RPC chunks, rather than turning a 50 MB
// DOCX into a giant JSON array or increasing the argument-message size limit.
export class DocumentReceiver {
	private transfer: { id: string; name: string; bytes: Uint8Array; offset: number } | null = null;
	private timeout: ReturnType<typeof setTimeout> | undefined;
	constructor(private open: ((name: string, bytes: Uint8Array) => Promise<void>) | null) {}
	clear() {
		clearTimeout(this.timeout);
		this.transfer = null;
	}
	private touch() {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(() => this.clear(), 30_000);
	}
	async handle(method: string, params: unknown): Promise<unknown> {
		if (method === 'integration.capabilities')
			return { documentOpen: this.open !== null, maxDocumentBytes };
		if (!this.open)
			throw new Error('Update the companion plugin in native CardMirror to open documents.');
		if (!record(params) || !string(params.id, 100) || !params.id)
			throw new Error('Invalid document transfer.');
		if (method === 'document.begin') {
			if (this.transfer) throw new Error('Another document is still being transferred.');
			if (
				!string(params.name, 255) ||
				!/\.docx$/i.test(params.name) ||
				/[\\/\p{Cc}]/u.test(params.name) ||
				!Number.isSafeInteger(params.size) ||
				(params.size as number) < 4 ||
				(params.size as number) > maxDocumentBytes
			)
				throw new Error('Choose a DOCX document up to 50 MB.');
			this.transfer = {
				id: params.id,
				name: params.name,
				bytes: new Uint8Array(params.size as number),
				offset: 0
			};
			this.touch();
			return { ok: true };
		}
		const transfer = this.transfer;
		if (!transfer || transfer.id !== params.id)
			throw new Error('Document transfer expired. Try opening the document again.');
		if (method === 'document.cancel') {
			this.clear();
			return { ok: true };
		}
		if (method === 'document.chunk') {
			if (params.offset !== transfer.offset || !string(params.data, 65536))
				throw new Error('Invalid document chunk.');
			let decoded: string;
			try {
				decoded = atob(params.data);
			} catch {
				throw new Error('Invalid document chunk.');
			}
			if (
				!decoded.length ||
				decoded.length > documentChunkBytes ||
				transfer.offset + decoded.length > transfer.bytes.length
			)
				throw new Error('Invalid document size.');
			for (let index = 0; index < decoded.length; index++)
				transfer.bytes[transfer.offset + index] = decoded.charCodeAt(index);
			transfer.offset += decoded.length;
			this.touch();
			return { received: transfer.offset };
		}
		if (method !== 'document.finish') throw new Error('Unsupported document command.');
		if (transfer.offset !== transfer.bytes.length)
			throw new Error('The document transfer is incomplete.');
		const b = transfer.bytes;
		if (
			!(b[0] === 0x50 && b[1] === 0x4b) &&
			!(b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0)
		) {
			this.clear();
			throw new Error('This file is not a Word document.');
		}
		this.clear();
		await this.open(transfer.name, b);
		return { queued: true };
	}
}
