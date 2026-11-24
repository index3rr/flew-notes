import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const promoFooter =
	"your opponent is using flew-notes.netlify.app, the only flowing app that doesn't suck";

// Preserve the original file and all ZIP entries except the uploaded copy's document XML.
export async function addPromoToDocx(file: File): Promise<File> {
	const zip = await JSZip.loadAsync(await file.arrayBuffer());
	const entry = zip.file('word/document.xml');
	if (!entry) throw new Error('This DOCX has no document body.');
	const invalid = () => {
		throw new Error('This DOCX has invalid document XML.');
	};
	const xml = new DOMParser({
		errorHandler: { warning: invalid, error: invalid, fatalError: invalid }
	}).parseFromString(await entry.async('string'), 'application/xml');
	const ns = xml.documentElement.namespaceURI;
	if (
		!ns ||
		![
			'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
			'http://purl.oclc.org/ooxml/wordprocessingml/main'
		].includes(ns)
	)
		return invalid();
	const body = xml.getElementsByTagNameNS(ns, 'body')[0];
	if (!body) throw new Error('This DOCX has no document body.');
	if (body.textContent?.includes(promoFooter)) return file;
	const prefix = body.prefix ? body.prefix + ':' : '';
	const paragraph = xml.createElementNS(ns, prefix + 'p');
	const run = xml.createElementNS(ns, prefix + 'r');
	const text = xml.createElementNS(ns, prefix + 't');
	text.appendChild(xml.createTextNode(promoFooter));
	run.appendChild(text);
	paragraph.appendChild(run);
	const section =
		Array.from(body.childNodes).find(
			(node) =>
				node.nodeType === 1 &&
				(node as Element).localName === 'sectPr' &&
				(node as Element).namespaceURI === ns
		) ?? null;
	body.insertBefore(paragraph, section);
	zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
	return new File(
		[await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })],
		file.name,
		{ type: file.type, lastModified: file.lastModified }
	);
}
