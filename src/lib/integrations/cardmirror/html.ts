// Stored HTML is only ever pasted through CardMirror's schema parser, never rendered
// in Flew. Keep formatting while excluding editor controls and active HTML content.
export function safeCardHtml(html: string): string {
	const template = document.createElement('template');
	template.innerHTML = html;
	template.content
		.querySelectorAll(
			'script,style,iframe,object,embed,link,meta,input,button,[contenteditable="false"]'
		)
		.forEach((node) => node.remove());
	const tags = new Set([
		'DIV',
		'P',
		'H4',
		'SPAN',
		'STRONG',
		'B',
		'EM',
		'I',
		'U',
		'S',
		'STRIKE',
		'MARK',
		'SUB',
		'SUP',
		'BR',
		'A',
		'TABLE',
		'TBODY',
		'THEAD',
		'TR',
		'TD',
		'TH',
		'COLGROUP',
		'COL'
	]);
	const attributes = new Set([
		'class',
		'style',
		'href',
		'colspan',
		'rowspan',
		'data-colwidth',
		'data-num-role',
		'data-highlight',
		'data-num-restart'
	]);
	const styles = new Set([
		'font-weight',
		'font-style',
		'text-decoration',
		'text-decoration-line',
		'background-color',
		'color',
		'font-size',
		'font-family',
		'vertical-align',
		'margin-left',
		'text-indent',
		'text-align'
	]);
	for (const element of [...template.content.querySelectorAll('*')]) {
		if (!tags.has(element.tagName)) {
			element.replaceWith(...element.childNodes);
			continue;
		}
		for (const attribute of [...element.attributes]) {
			if (
				!attributes.has(attribute.name) ||
				(attribute.name === 'href' && !/^(https?:|mailto:)/i.test(attribute.value))
			)
				element.removeAttribute(attribute.name);
		}
		if (element instanceof HTMLElement) {
			for (const property of [...element.style]) {
				if (
					!styles.has(property) ||
					/url\s*\(|expression\s*\(|[\\<>]/i.test(element.style.getPropertyValue(property))
				)
					element.style.removeProperty(property);
			}
		}
	}
	return template.innerHTML;
}
