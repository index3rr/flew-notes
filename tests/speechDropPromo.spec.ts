import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { addPromoToDocx, promoFooter } from '../src/lib/models/speechDropPromo';

test('DOCX promo preserves other entries, precedes section properties, and is idempotent', async () => {
	const zip = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
	const body = await zip.file('word/document.xml')!.async('string');
	zip.file(
		'word/document.xml',
		body.replace('</w:body>', '<w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:body>')
	);
	const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'speech.docx', {
		type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	});
	const stamped = await addPromoToDocx(file);
	expect(stamped.name).toBe(file.name);
	const result = await JSZip.loadAsync(await stamped.arrayBuffer());
	const xml = await result.file('word/document.xml')!.async('string');
	expect(xml.indexOf(promoFooter)).toBeGreaterThan(xml.indexOf('Access prevents disease'));
	expect(xml.indexOf(promoFooter)).toBeLessThan(xml.lastIndexOf('<w:sectPr>'));
	for (const name of Object.keys(zip.files).filter((name) => name !== 'word/document.xml'))
		expect(await result.file(name)?.async('string')).toBe(await zip.file(name)?.async('string'));
	expect(await addPromoToDocx(stamped)).toBe(stamped);
	const original = await JSZip.loadAsync(await file.arrayBuffer());
	expect(await original.file('word/document.xml')!.async('string')).not.toContain(promoFooter);
});
