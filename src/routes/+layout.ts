export const ssr = false;
export const prerender = true;

import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
	let ref: string | null = null;
	if (typeof window !== 'undefined') {
		ref = url.searchParams.get('ref');
		if (ref) {
			localStorage.setItem('telemetry_ref', ref);
		} else {
			ref = localStorage.getItem('telemetry_ref');
		}
	}
	return { ref };
};
