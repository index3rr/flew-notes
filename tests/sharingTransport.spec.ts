import { test, expect } from '@playwright/test';
import { Channel } from '../src/lib/models/sharingTransport';

class DataChannel extends EventTarget {
	readyState: RTCDataChannelState = 'connecting';
	bufferedAmount = 0;
	bufferedAmountLowThreshold = 0;
	sent: string[] = [];
	send(data: string) {
		const bytes = new TextEncoder().encode(data).length;
		if (bytes > 16 * 1024) throw new Error('Packet exceeds transport limit');
		this.sent.push(data);
		this.bufferedAmount += bytes;
	}
	open() {
		this.readyState = 'open';
		this.dispatchEvent(new Event('open'));
	}
	close() {
		this.readyState = 'closed';
		this.dispatchEvent(new Event('close'));
	}
}

test('document transport preserves Unicode, order and queued snapshots under backpressure', ({
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'Transport logic only needs to run once.');
	const wire = new DataChannel();
	const remote = new DataChannel();
	const sender = new Channel<{ text: string }, never>(wire as unknown as RTCDataChannel);
	const receiver = new Channel<never, { text: string }>(remote as unknown as RTCDataChannel);
	const received: { text: string }[] = [];
	receiver.onMessage((message) => received.push(message));
	const original = { text: '📝漢字\\"\n'.repeat(50000) };
	const expected = { ...original };
	sender.send(original);
	original.text = 'Changed after queuing';
	sender.send({ text: 'Following message' });
	expect(wire.sent).toHaveLength(0);
	wire.open();
	expect(wire.bufferedAmount).toBeLessThan(80 * 1024);
	expect(wire.sent.length).toBeGreaterThan(1);
	expect(received).toHaveLength(0);
	let index = 0;
	for (let cycle = 0; cycle < 1000; cycle++) {
		const end = wire.sent.length;
		for (; index < end; index++)
			remote.dispatchEvent(new MessageEvent('message', { data: wire.sent[index] }));
		wire.bufferedAmount = 0;
		wire.dispatchEvent(new Event('bufferedamountlow'));
		if (wire.sent.length === end) break;
	}
	expect(received).toEqual([expected, { text: 'Following message' }]);
	const sent = wire.sent.length;
	wire.close();
	sender.send({ text: 'No messages after close' });
	expect(wire.sent).toHaveLength(sent);
});
