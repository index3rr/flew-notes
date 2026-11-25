import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { docxEvidence } from '../src/lib/integrations/cardmirror/docx';
import { validEvidence } from '../src/lib/integrations/cardmirror/protocol';

test('DOCX cards retain citations, body text, bold, underlining and highlighting as portable evidence', async () => {
	const zip = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
	const original = await zip.file('word/document.xml')!.async('string');
	zip.file(
		'word/document.xml',
		original.replace(
			'Growth solves poverty</w:t></w:r></w:p>',
			`Growth solves poverty</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Cite"/></w:pPr><w:r><w:t>Author 2026</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/><w:u w:val="single"/><w:highlight w:val="yellow"/></w:rPr><w:t>Full evidence &amp; detail</w:t></w:r></w:p>`
		)
	);
	const cards = await docxEvidence(await zip.generateAsync({ type: 'arraybuffer' }));
	const evidence = cards.get('Growth solves poverty')![0].sources[0].evidence!;
	expect(validEvidence(evidence)).toBe(true);
	expect(evidence.node.content![1].type).toBe('cite_paragraph');
	expect(evidence.node.content![2].content![0]).toMatchObject({
		type: 'text',
		text: 'Full evidence & detail',
		marks: [
			{ type: 'bold' },
			{ type: 'underline_direct' },
			{ type: 'highlight', attrs: { color: 'yellow' } }
		]
	});
	expect(evidence.html).toContain('Full evidence &amp; detail');
	expect(cards.get('Jobs support families')![0].sources[0].evidence!.node.content).toHaveLength(1);
});
