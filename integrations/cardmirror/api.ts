import type { Kind } from '../../src/lib/integrations/cardmirror/protocol';

// Structural subset of CardMirror's public plugin API v1. No host internals.
export interface Api {
	extractSelection():
		| {
				ok: true;
				docId: string;
				docTitle: string;
				items: { kind: Kind; text: string; source: string }[];
		  }
		| { ok: false; error: string };
	jumpToSource(token: string): Promise<{ ok: true } | { ok: false; error: string }>;
	showToast(message: string): void;
	storage: { get(key: string): unknown; set(key: string, value: unknown): void };
	settings: { get(key: string): unknown };
}
export interface Definition {
	id: string;
	name: string;
	apiVersion: number;
	settings: {
		key: string;
		label: string;
		type: 'number' | 'select';
		default: number | string;
		options?: string[];
		description: string;
	}[];
	commands: {
		id: string;
		label: string;
		keywords: string[];
		defaultKey: string | null;
		run: (api: Api) => void | Promise<void>;
	}[];
}
declare global {
	interface Window {
		__registerCardMirrorPlugin?: (definition: Definition) => void;
		__flewCardMirrorDispose?: () => void;
	}
}
