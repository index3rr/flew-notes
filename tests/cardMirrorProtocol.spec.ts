import { test, expect } from '@playwright/test';
import {
	DocumentReceiver,
	encodeBytes,
	maxDocumentBytes
} from '../src/lib/integrations/cardmirror/documents';
import { Rpc } from '../src/lib/integrations/cardmirror/connection';

test('document transfer rejects oversized, overlapping and incomplete files without opening them', async () => {
	const opened: { name: string; bytes: number[] }[] = [];
	const receiver = new DocumentReceiver(async (name, bytes) => {
		opened.push({ name, bytes: [...bytes] });
	});
	await expect(
		receiver.handle('document.begin', {
			id: 'large',
			name: 'large.docx',
			size: maxDocumentBytes + 1
		})
	).rejects.toThrow('50 MB');
	await receiver.handle('document.begin', { id: 'one', name: '1NC.docx', size: 6 });
	await expect(
		receiver.handle('document.begin', { id: 'two', name: '2AC.docx', size: 6 })
	).rejects.toThrow('Another document');
	await expect(receiver.handle('document.finish', { id: 'one' })).rejects.toThrow('incomplete');
	await expect(
		receiver.handle('document.chunk', { id: 'one', offset: 4, data: 'UEs=' })
	).rejects.toThrow('Invalid document chunk');
	await receiver.handle('document.chunk', {
		id: 'one',
		offset: 0,
		data: encodeBytes(new Uint8Array([0x50, 0x4b, 3]))
	});
	await receiver.handle('document.chunk', {
		id: 'one',
		offset: 3,
		data: encodeBytes(new Uint8Array([4, 5, 6]))
	});
	await receiver.handle('document.finish', { id: 'one' });
	expect(opened).toEqual([{ name: '1NC.docx', bytes: [0x50, 0x4b, 3, 4, 5, 6] }]);
	await receiver.handle('document.begin', { id: 'cancel', name: 'copy.docx', size: 6 });
	await receiver.handle('document.cancel', { id: 'cancel' });
	await expect(receiver.handle('document.finish', { id: 'cancel' })).rejects.toThrow('expired');
	receiver.clear();
});

test('RPC frames Unicode documents, returns handler errors and rejects pending work on disconnect', async () => {
	class Channel {
		readyState = 'open';
		bufferedAmount = 0;
		onmessage: ((event: { data: string }) => void) | null = null;
		onclose: (() => void) | null = null;
		peer: Channel | null = null;
		frames: string[] = [];
		send(data: string) {
			this.frames.push(data);
			queueMicrotask(() => this.peer?.onmessage?.({ data }));
		}
		close() {
			if (this.readyState === 'closed') return;
			this.readyState = 'closed';
			this.onclose?.();
		}
	}
	const left = new Channel(),
		right = new Channel();
	left.peer = right;
	right.peer = left;
	const a = new Rpc(
		left as unknown as RTCDataChannel,
		() => {
			throw new Error('unsupported');
		},
		() => undefined
	);
	const b = new Rpc(
		right as unknown as RTCDataChannel,
		(method, params) => {
			if (method === 'fail') throw new Error('Source document is closed');
			return params;
		},
		() => undefined
	);
	try {
		const text = '政策🌱'.repeat(20_000);
		expect(await a.request('echo', text)).toBe(text);
		expect(left.frames.length).toBeGreaterThan(10);
		expect(left.frames.every((frame) => frame.length < 16_000)).toBe(true);
		await expect(a.request('fail', {})).rejects.toThrow('Source document is closed');
		const pending = a.request('echo', 'pending');
		a.close();
		await expect(pending).rejects.toThrow('disconnected');
	} finally {
		a.close();
		b.close();
	}
});
