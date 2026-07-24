import { writable, type Writable } from 'svelte/store';

export type Version = `${number}.${number}.${number}`;

export const CURRENT_VERSION: Version = '1.2.0' as const;
// you MUST change package.json AND sw.js when you change version
// and make sure to add a changelog in Changelog.svelte (not md!)

export function getLastChangelogVersion(): Version {
	const version = localStorage.getItem('lastUsedVersion') ?? '1.0.0';
	return version as Version;
}

export const isChangelogVersionCurrent: Writable<boolean> = writable(
	getLastChangelogVersion() === CURRENT_VERSION
);

export function setLastChangelogVersion() {
	localStorage.setItem('lastUsedVersion', CURRENT_VERSION);
	isChangelogVersionCurrent.set(true);
}
