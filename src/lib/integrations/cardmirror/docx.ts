import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type { CardNode, Provenance } from './protocol';

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const elements = (node: Element, name: string) => Array.from(node.getElementsByTagNameNS(ns, name));
const val = (node: Element | undefined) => node?.getAttributeNS(ns, 'val') ?? '';
const normalized = (text: string) => text.replace(/\s+/g, ' ').trim();
const escape = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function html(node: CardNode): string {
	if (node.type === 'text') {
		let text = escape(node.text ?? '');
		for (const mark of node.marks ?? []) {
			const tag = (
				{ bold: 'strong', italic: 'em', underline_direct: 'u', strikethrough: 's' } as Record<
					string,
					string
				>
			)[mark.type];
			if (mark.type === 'link' && /^(https?:|mailto:)/i.test(String(mark.attrs?.href ?? '')))
				text = `<a href="${escape(String(mark.attrs?.href))}">${text}</a>`;
			else if (tag) text = `<${tag}>${text}</${tag}>`;
			else if (mark.type === 'highlight')
				text = `<span class="pmd-highlight" data-highlight="${escape(
					String(mark.attrs?.color ?? 'yellow')
				)}">${text}</span>`;
			else if (['underline_mark', 'cite_mark', 'emphasis_mark'].includes(mark.type))
				text = `<span class="pmd-${mark.type.replace('_mark', '')}">${text}</span>`;
		}
		return text;
	}
	if (node.type === 'hard_break') return '<br>';
	const [tag, cls] = (
		{
			card: ['div', 'pmd-card'],
			analytic_unit: ['div', 'pmd-analytic-unit'],
			tag: ['h4', 'pmd-tag'],
			analytic: ['p', 'pmd-analytic'],
			cite_paragraph: ['p', 'pmd-cite-para'],
			undertag: ['p', 'pmd-undertag'],
			card_body: ['p', 'pmd-card-body']
		} as Record<string, string[]>
	)[node.type] ?? ['p', 'pmd-card-body'];
	return `<${tag} class="${cls}">${(node.content ?? []).map(html).join('')}</${tag}>`;
}

// Read structured Word content as data. No imported HTML is rendered in Flew.
export async function docxEvidence(bytes: ArrayBuffer): Promise<Map<string, Provenance[]>> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('word/document.xml')?.async('string');
	if (!xml) throw new Error('This DOCX has no document content.');
	const parser = new DOMParser();
	const stylesXml = await zip.file('word/styles.xml')?.async('string');
	const styles = new Map<
		string,
		{ name: string; base: string; level: string; properties: Element }
	>();
	if (stylesXml)
		for (const style of Array.from(
			parser.parseFromString(stylesXml, 'application/xml').getElementsByTagNameNS(ns, 'style')
		)) {
			styles.set(style.getAttributeNS(ns, 'styleId') ?? '', {
				name: val(elements(style, 'name')[0]),
				base: val(elements(style, 'basedOn')[0]),
				level: val(elements(style, 'outlineLvl')[0]),
				properties: style
			});
		}
	function styleInfo(
		id: string,
		seen = new Set<string>()
	): { name: string; level: string; properties: Element[] } {
		const own = styles.get(id);
		if (!own || seen.has(id)) return { name: id, level: '', properties: [] };
		seen.add(id);
		const inherited = styleInfo(own.base, seen);
		return {
			name: own.name || inherited.name,
			level: own.level || inherited.level,
			properties: [...inherited.properties, own.properties]
		};
	}
	const links = new Map<string, string>();
	const rels = await zip.file('word/_rels/document.xml.rels')?.async('string');
	if (rels)
		for (const rel of Array.from(
			parser.parseFromString(rels, 'application/xml').documentElement.childNodes
		)) {
			if (rel.nodeType === 1) {
				const el = rel as Element;
				const target = el.getAttribute('Target') ?? '';
				if (/^(https?:|mailto:)/i.test(target)) links.set(el.getAttribute('Id') ?? '', target);
			}
		}
	const paragraphs = Array.from(
		parser.parseFromString(xml, 'application/xml').getElementsByTagNameNS(ns, 'p')
	);
	const namespace = 'docx:' + crypto.randomUUID();
	const result = new Map<string, Provenance[]>();
	let current: { title: string; node: CardNode; index: number } | null = null;
	function finish() {
		if (!current) return;
		const { title, node, index } = current;
		const evidence = { version: 1 as const, id: namespace + ':' + index, node, html: html(node) };
		const provenance: Provenance = {
			kind: node.type === 'card' ? 'tag' : 'analytic',
			sources: [
				{ key: evidence.id, token: '', documentTitle: 'Imported DOCX', excerpt: title, evidence }
			]
		};
		result.set(title, [...(result.get(title) ?? []), provenance]);
		current = null;
	}
	for (const [index, p] of paragraphs.entries()) {
		const style = styleInfo(val(elements(p, 'pStyle')[0]));
		const name = style.name.toLowerCase().replace(/[\s_-]/g, '');
		const level = val(elements(p, 'outlineLvl')[0]) || style.level;
		const title = normalized(
			elements(p, 't')
				.map((t) => t.textContent ?? '')
				.join('')
		);
		const analytic = /analytic/.test(name);
		const tag = /^(?:tag|heading4)$/.test(name) || level === '3';
		const boundary =
			tag ||
			analytic ||
			/^(?:pocket|hat|block|heading[123])$/.test(name) ||
			['0', '1', '2'].includes(level);
		if (boundary) finish();
		const content: CardNode[] = [];
		for (const run of elements(p, 'r')) {
			const runStyle = styleInfo(val(elements(run, 'rStyle')[0]));
			const properties = [...style.properties, ...runStyle.properties, run];
			const get = (key: string) => properties.flatMap((prop) => elements(prop, key)).at(-1);
			const enabled = (key: string) => {
				const prop = get(key);
				return !!prop && !['0', 'false', 'off', 'none'].includes(val(prop));
			};
			const marks: NonNullable<CardNode['marks']> = [];
			const hyperlink = run.parentNode as Element | null;
			const href =
				hyperlink?.localName === 'hyperlink'
					? links.get(
							hyperlink.getAttributeNS(
								'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
								'id'
							) ?? ''
					  )
					: null;
			if (href) marks.push({ type: 'link', attrs: { href } });
			if (enabled('b')) marks.push({ type: 'bold' });
			if (enabled('i')) marks.push({ type: 'italic' });
			const named = runStyle.name.toLowerCase();
			if (/emphasis/.test(named)) marks.push({ type: 'emphasis_mark' });
			else if (/underline/.test(named)) marks.push({ type: 'underline_mark' });
			else if (/cite/.test(named)) marks.push({ type: 'cite_mark' });
			else if (enabled('u')) marks.push({ type: 'underline_direct' });
			if (enabled('strike')) marks.push({ type: 'strikethrough' });
			if (get('highlight') && val(get('highlight')) !== 'none')
				marks.push({ type: 'highlight', attrs: { color: val(get('highlight')) } });
			for (const child of Array.from(run.childNodes)) {
				if (child.nodeType !== 1) continue;
				const element = child as Element;
				if (element.localName === 't' && element.textContent)
					content.push({
						type: 'text',
						text: element.textContent,
						...(marks.length ? { marks } : {})
					});
				else if (element.localName === 'br') content.push({ type: 'hard_break' });
				else if (element.localName === 'tab') content.push({ type: 'text', text: ' ' });
			}
		}
		if ((tag || analytic) && title)
			current = {
				title,
				index,
				node: {
					type: analytic ? 'analytic_unit' : 'card',
					content: [
						{ type: analytic ? 'analytic' : 'tag', attrs: { id: crypto.randomUUID() }, content }
					]
				}
			};
		else if (current && content.length)
			current.node.content!.push({
				type: /cite|citation/.test(name)
					? 'cite_paragraph'
					: /undertag/.test(name)
					? 'undertag'
					: 'card_body',
				content
			});
	}
	finish();
	return result;
}
