declare module 'mammoth/mammoth.browser' {
	export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
	// HTML is only parsed as text for document structure (speechDoc.ts); never render it.
	export function convertToHtml(
		input: { arrayBuffer: ArrayBuffer },
		options?: { styleMap?: string[]; includeDefaultStyleMap?: boolean }
	): Promise<{ value: string }>;
}
