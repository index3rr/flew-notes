export function words(text: string): string[] {
	return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}
// Compare short phrases rather than isolated common words. This is a review aid.
export function compareSpeech(
	text: string,
	document: string
): { matched: boolean; outside: boolean } {
	const tokens = words(text);
	const doc = ` ${words(document).join(' ')} `;
	if (tokens.length < 3 || !document.trim()) return { matched: false, outside: false };
	let matches = 0;
	for (let i = 0; i <= tokens.length - 3; i++) {
		if (doc.includes(` ${tokens.slice(i, i + 3).join(' ')} `)) matches++;
	}
	const ratio = matches / (tokens.length - 2);
	return { matched: ratio >= 0.35, outside: ratio < 0.35 };
}
