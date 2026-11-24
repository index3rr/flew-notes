import { test, expect } from '@playwright/test';
import { exportItems } from '../src/lib/integrations/cardmirror/evidence';
import {
	layout,
	parsePayload,
	validEvidence,
	validProvenance,
	type EvidenceSnapshot
} from '../src/lib/integrations/cardmirror/protocol';
import type { SerializedBox } from '../src/lib/models/node';

const snapshot = (id: string): EvidenceSnapshot => ({
	version: 1,
	id,
	node: {
		type: 'card',
		content: [
			{ type: 'tag', content: [{ type: 'text', text: id }] },
			{ type: 'cite_paragraph', content: [{ type: 'text', text: 'Author 2026' }] },
			{
				type: 'card_body',
				content: [
					{
						type: 'text',
						text: 'Complete evidence body',
						marks: [{ type: 'strong' }, { type: 'underline' }]
					}
				]
			}
		]
	},
	html: `<div class="pmd-card"><h4 class="pmd-tag">${id}</h4><p class="pmd-cite-para">Author 2026</p><p class="pmd-card-body"><strong><u>Complete evidence body</u></strong></p></div>`
});
const linked = (id: string): SerializedBox => ({
	value: {
		content: id,
		cardMirror: {
			kind: 'tag',
			sources: [
				{ key: id, token: id, documentTitle: 'Evidence', excerpt: id, evidence: snapshot(id) }
			]
		}
	},
	children: []
});

test('two saved cards and an analytic export in order with complete evidence and no duplicate citation cards', () => {
	const first = linked('Costs are low');
	first.value.cardMirror!.sources.push({ ...first.value.cardMirror!.sources[0], kind: 'cite' });
	const second = linked('Single payer does not solve');
	const analytic: SerializedBox = {
		value: { content: 'Their evidence is out of date' },
		children: []
	};
	const saved = JSON.parse(JSON.stringify([first, second, analytic]));
	const exported = exportItems(saved);
	expect(exported.map((item) => item.text)).toEqual([
		'Costs are low',
		'Single payer does not solve',
		'Their evidence is out of date'
	]);
	expect(exported[0].evidence).toEqual([snapshot('Costs are low')]);
	expect(exported[1].evidence![0].node.content![2].content![0].marks).toEqual([
		{ type: 'strong' },
		{ type: 'underline' }
	]);
	expect(exported[2].evidence).toBeUndefined();
	expect(exportItems([{ value: { content: '', empty: true }, children: [first] }])).toHaveLength(1);
});

test('snapshot validation preserves legacy sources, rejects malformed attachments and imports full cards', () => {
	expect(validEvidence(snapshot('Costs'))).toBe(true);
	expect(validEvidence({ ...snapshot('Costs'), node: { type: 'doc' } })).toBe(false);
	expect(validEvidence({ ...snapshot('Costs'), node: { type: 'card', content: [null] } })).toBe(
		false
	);
	const cell = linked('Costs').value.cardMirror!;
	expect(validProvenance(cell)).toBe(true);
	const legacy = structuredClone(cell);
	delete legacy.sources[0].evidence;
	expect(validProvenance(legacy)).toBe(true);
	expect(
		validProvenance({ ...cell, sources: [{ ...cell.sources[0], evidence: { version: 2 } }] })
	).toBe(false);
	const payload = {
		mode: 'column',
		docTitle: 'Costs',
		space: 0,
		items: [
			{ kind: 'tag', text: 'Costs', key: 'costs', source: 'opaque', evidence: snapshot('Costs') }
		]
	};
	expect(layout(parsePayload(payload))[0].cardMirror!.sources[0].evidence).toEqual(
		snapshot('Costs')
	);
	expect(() =>
		parsePayload({ ...payload, items: [{ ...payload.items[0], evidence: { version: 2 } }] })
	).toThrow();
});
