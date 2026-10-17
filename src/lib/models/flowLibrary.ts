import { get, writable } from 'svelte/store';
import { loadNodes } from './file';
import { documentFilename, documentTitleFromFilename } from './document';
import { importLocalFlows, type SavedNodesData } from './autoSave';
import type { Nodes } from './node';

// Picker/permission extensions are not included in TypeScript's DOM definitions.
export interface DirectoryHandle extends FileSystemDirectoryHandle {
	values(): AsyncIterableIterator<DirectoryHandle | FileSystemFileHandle>;
	queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
	requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
	getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
}
type PickerWindow = Window & {
	showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<DirectoryHandle>;
	showSaveFilePicker?: (options: {
		startIn: FileSystemDirectoryHandle;
		suggestedName: string;
		types: { description: string; accept: Record<string, string[]> }[];
	}) => Promise<FileSystemFileHandle>;
};
export const directFolderAccess =
	typeof (window as PickerWindow).showDirectoryPicker === 'function';
export const library = writable({
	name: '',
	path: [] as string[],
	folders: [] as string[],
	files: [] as string[],
	fileDates: {} as Record<string, string>,
	fileInfos: {} as Record<string, SavedNodesData>,
	connected: false,
	needsPermission: false,
	imported: false,
	warning: ''
});
let root: DirectoryHandle | null = null;
let currentDirectory: DirectoryHandle | null = null;
let imported: Record<string, string> | null = null;
let importedName = '';
let importedId = '';
export type FileTarget = {
	directory: DirectoryHandle | null;
	path: string[];
	name: string;
	raw: string | null;
	handle?: FileSystemFileHandle;
	outside?: boolean;
	filenameTitle?: string;
};
export const hasDiskFile = writable(false);
let target: FileTarget | null = null;
let queue = Promise.resolve();
let revision = 0;

let dbPromise: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
	if (!dbPromise)
		dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open('flew-flow-library', 1);
			request.onupgradeneeded = () => request.result.createObjectStore('library');
			request.onsuccess = () => {
				request.result.onversionchange = () => {
					request.result.close();
					dbPromise = null;
				};
				resolve(request.result);
			};
			request.onerror = () => {
				dbPromise = null;
				reject(request.error);
			};
		});
	return dbPromise;
}
async function remembered(value?: unknown, write = false): Promise<unknown> {
	const db = await database();
	return await new Promise((resolve, reject) => {
		const tx = db.transaction('library', write ? 'readwrite' : 'readonly');
		const request = write
			? tx.objectStore('library').put(value, 'folder')
			: tx.objectStore('library').get('folder');
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('Could not remember folder'));
	});
}
async function directory(path = get(library).path) {
	if (!root) throw new Error('Choose a folder first');
	let dir = root;
	for (const part of path) dir = await dir.getDirectoryHandle(part);
	return dir;
}
export async function restoreLibrary() {
	try {
		const saved = (await remembered()) as
			| { handle?: DirectoryHandle; files?: Record<string, string>; name?: string; id?: string }
			| undefined;
		if (saved?.handle) {
			root = saved.handle;
			const allowed = (await root.queryPermission({ mode: 'readwrite' })) === 'granted';
			library.update((s) => ({
				...s,
				name: root!.name,
				connected: allowed,
				needsPermission: !allowed
			}));
			if (allowed) await refreshLibrary();
		} else if (saved?.files) {
			if (!directFolderAccess) {
				importLocalFlows(Object.entries(saved.files).map(([name, raw]) => ({ name, raw })));
				await remembered({}, true);
				return;
			}
			imported = saved.files;
			importedName = saved.name ?? 'Imported folder';
			importedId = saved.id ?? '';
			library.update((s) => ({ ...s, name: importedName, imported: true, connected: true }));
			await refreshLibrary();
		}
	} catch {
		library.update((s) => ({
			...s,
			warning: 'Could not restore the library. Choose your folder again.'
		}));
	}
}
export async function chooseLibrary(beforeChange: () => Promise<unknown> = async () => undefined) {
	const picker = (window as PickerWindow).showDirectoryPicker;
	if (!picker) throw new Error('Use Import folder in this browser');
	let handle: DirectoryHandle;
	try {
		handle = await picker.call(window, { mode: 'readwrite' });
	} catch (error) {
		if ((error as DOMException).name === 'AbortError') return false;
		throw error;
	}
	// Request write access while the picker's user activation is still available.
	if (
		(await handle.queryPermission({ mode: 'readwrite' })) !== 'granted' &&
		(await handle.requestPermission({ mode: 'readwrite' })) !== 'granted'
	)
		throw new Error(
			'Folder write permission was not granted. Choose the folder again and allow changes.'
		);
	await beforeChange();
	root = handle;
	imported = null;
	target = null;
	hasDiskFile.set(false);
	library.set({
		name: handle.name,
		path: [],
		folders: [],
		files: [],
		fileDates: {},
		fileInfos: {},
		connected: true,
		needsPermission: false,
		imported: false,
		warning: ''
	});
	try {
		await remembered({ handle }, true);
	} catch {
		library.update((s) => ({
			...s,
			warning: 'Folder connected for this visit. This browser could not remember it.'
		}));
	}
	await refreshLibrary();
	return true;
}
export async function reconnectLibrary() {
	if (!root) return;
	if ((await root.requestPermission({ mode: 'readwrite' })) !== 'granted')
		throw new Error('Folder permission was not granted. Browser recovery saves still work.');
	library.update((s) => ({ ...s, connected: true, needsPermission: false }));
	await refreshLibrary();
}
export async function importLibrary(files: FileList) {
	if (!directFolderAccess) {
		const entries = await Promise.all(
			Array.from(files)
				.filter((file) => file.name.toLowerCase().endsWith('.json'))
				.map(async (file) => ({
					raw: await file.text(),
					name: file.name,
					modified: new Date(file.lastModified).toISOString()
				}))
		);
		const skipped = importLocalFlows(entries);
		library.update((s) => ({
			...s,
			warning: skipped ? `Skipped ${skipped} invalid JSON file(s).` : ''
		}));
		return;
	}
	const next: Record<string, string> = {};
	let name = 'Imported folder';
	let skipped = 0;
	for (const file of Array.from(files)) {
		const parts = (file.webkitRelativePath || file.name).split('/');
		if (parts.length > 1) name = parts.shift()!;
		if (!file.name.toLowerCase().endsWith('.json')) continue;
		try {
			const raw = await file.text();
			loadNodes(JSON.parse(raw), false);
			next[parts.join('/')] = raw;
		} catch {
			skipped++;
		}
	}
	const id = crypto.randomUUID();
	await remembered({ files: next, name, id }, true);
	root = null;
	currentDirectory = null;
	imported = next;
	importedName = name;
	importedId = id;
	target = null;
	hasDiskFile.set(false);
	library.set({
		name,
		path: [],
		folders: [],
		files: [],
		fileDates: {},
		fileInfos: {},
		connected: true,
		needsPermission: false,
		imported: true,
		warning: skipped ? `Skipped ${skipped} invalid JSON file(s).` : ''
	});
	await refreshLibrary();
	void navigator.storage?.persist?.().catch(() => false);
}
export async function refreshLibrary(path = get(library).path) {
	const currentRevision = ++revision;
	const folders: string[] = [];
	const files: string[] = [];
	let nextDirectory: DirectoryHandle | null = null;
	const fileDates: Record<string, string> = {};
	const fileInfos: Record<string, SavedNodesData> = {};
	function describe(name: string, raw: string, fallbackDate?: string) {
		const data = JSON.parse(raw);
		const nodes: Nodes = loadNodes(data, false);
		const created = data.created ?? fallbackDate ?? new Date().toISOString();
		const modified = fallbackDate ?? data.modified ?? created;
		fileDates[name] = modified;
		fileInfos[name] = {
			title: data.title || name.replace(/\.json$/i, ''),
			created,
			modified,
			flowInfos: nodes.root.children.map((id) => {
				const flow = nodes[id]!.value;
				return { content: flow.content, invert: flow.invert };
			})
		};
	}
	let skipped = 0;
	if (imported) {
		const prefix = path.length ? path.join('/') + '/' : '';
		for (const key of Object.keys(imported)) {
			if (!key.startsWith(prefix)) continue;
			const rest = key.slice(prefix.length).split('/');
			if (rest.length > 1) {
				if (!folders.includes(rest[0])) folders.push(rest[0]);
			} else {
				files.push(rest[0]);
				describe(rest[0], imported[key]);
			}
		}
	} else {
		const dir = await directory(path);
		nextDirectory = dir;
		for await (const entry of dir.values()) {
			if (entry.kind === 'directory') folders.push(entry.name);
			else if (entry.name.toLowerCase().endsWith('.json')) {
				try {
					const file = await entry.getFile();
					describe(entry.name, await file.text(), new Date(file.lastModified).toISOString());
					files.push(entry.name);
				} catch {
					skipped++;
				}
			}
		}
	}
	if (currentRevision === revision) {
		currentDirectory = nextDirectory;
		library.update((s) => ({
			...s,
			path,
			folders: folders.sort(),
			files: files.sort(
				(a, b) => Date.parse(fileDates[b]) - Date.parse(fileDates[a]) || a.localeCompare(b)
			),
			fileDates,
			fileInfos,
			warning: skipped ? `Skipped ${skipped} invalid JSON file(s).` : s.warning
		}));
	}
}
export async function readLibraryFile(name: string) {
	await syncImported();
	const path = [...get(library).path];
	const dir = imported ? null : await directory(path);
	const handle = dir ? await dir.getFileHandle(name) : undefined;
	const raw = imported
		? imported[[...path, name].join('/')]
		: await (await handle!.getFile()).text();
	if (raw == null) throw new Error('This file no longer exists. Refresh the library.');
	loadNodes(JSON.parse(raw), false);
	return {
		raw,
		target: {
			directory: dir,
			path,
			name,
			raw,
			handle,
			filenameTitle: JSON.parse(raw).title ?? ''
		} as FileTarget
	};
}
export function bindLibraryFile(file: FileTarget | null) {
	target = file;
	hasDiskFile.set(!!file?.name && !imported);
}
export function libraryTarget() {
	return target;
}
export function newLibraryTarget(): FileTarget | null {
	const state = get(library);
	if (!state.connected) return null;
	return {
		directory: imported ? null : currentDirectory ?? root,
		path: [...state.path],
		name: '',
		raw: null
	};
}
export function needsFileLocation() {
	return !!root && !imported && !target?.name;
}
// Invoke the native picker before awaiting any file work to preserve user activation.
export async function chooseNewLibraryFile(title: string): Promise<FileTarget> {
	const picker = (window as PickerWindow).showSaveFilePicker;
	if (!picker || !root) throw new Error('This browser cannot open a Save As dialog.');
	const handle = await picker.call(window, {
		startIn: target?.directory ?? currentDirectory ?? root,
		suggestedName: documentFilename(title),
		types: [
			{ description: 'Flew flow', accept: { 'application/json': ['.json'] } },
			{
				description: 'Excel (.XLSX)',
				accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
			}
		]
	});
	const relative = await root.resolve(handle);
	return {
		directory: relative ? await directory(relative.slice(0, -1)) : null,
		filenameTitle: documentTitleFromFilename(handle.name),
		path: relative?.slice(0, -1) ?? [],
		name: handle.name,
		raw: handle.name.toLowerCase().endsWith('.xlsx') ? null : await (await handle.getFile()).text(),
		handle,
		outside: relative === null
	};
}
async function readAt(file: FileTarget, name: string): Promise<string | null> {
	if (file.handle && name === file.name) return (await file.handle.getFile()).text();
	if (imported) return imported[[...file.path, name].join('/')] ?? null;
	try {
		return await (await (await file.directory!.getFileHandle(name)).getFile()).text();
	} catch (error) {
		if ((error as DOMException).name === 'NotFoundError') return null;
		throw error;
	}
}
async function syncImported() {
	if (!imported) return;
	const saved = (await remembered()) as { files?: Record<string, string>; id?: string } | undefined;
	if (!saved?.files || (saved.id ?? '') !== importedId)
		throw new Error(
			'The imported library changed in another tab. Reload before saving. Your browser recovery copy is safe.'
		);
	imported = saved.files;
}
export function saveLibraryFile(
	raw: string,
	title: string,
	file: FileTarget | null,
	renameFile = false
) {
	if (!file) {
		if (get(library).needsPermission)
			return Promise.reject(
				new Error(
					'Reconnect your folder to save changes to disk. A browser recovery copy was saved.'
				)
			);
		return Promise.resolve();
	}
	// New native files wait for the first explicit Save; background saves keep recovery copies.
	if (root && !imported && !file.name) return Promise.resolve();
	const operation = queue.then(async () => {
		await syncImported();
		if (root && (await root.queryPermission({ mode: 'readwrite' })) !== 'granted') {
			library.update((s) => ({ ...s, connected: false, needsPermission: true }));
		}
		if (!get(library).connected)
			throw new Error(
				'Reconnect your folder to save changes to disk. A browser recovery copy was saved.'
			);
		if (!imported && !file.outside && !file.directory) file.directory = await directory(file.path);
		if (file.raw !== null && (await readAt(file, file.name)) !== file.raw)
			throw new Error(
				'The file changed outside Flew. Open it again or duplicate your recovery copy to keep both versions.'
			);
		const rename = !file.outside && (imported || (renameFile && title !== file.filenameTitle));
		const extension = file.name.match(/\.json$/i)?.[0] ?? '.json';
		let name = rename ? documentFilename(title).replace(/\.json$/, extension) : file.name;
		// Preserve original filenames when an untitled legacy document is edited.
		if (!title.trim() && file.name && !file.filenameTitle?.trim()) name = file.name;
		if (name !== file.name) {
			const stem = name.slice(0, -5);
			let suffix = 2;
			while (name !== file.name && (await readAt(file, name)) !== null)
				name = `${stem} (${suffix++})${extension}`;
		}
		if (imported) {
			const next = { ...imported, [[...file.path, name].join('/')]: raw };
			if (file.name && file.name !== name) delete next[[...file.path, file.name].join('/')];
			await remembered({ files: next, name: importedName, id: importedId }, true);
			imported = next;
		} else {
			const handle =
				name === file.name && file.handle
					? file.handle
					: await file.directory!.getFileHandle(name, { create: true });
			if (name !== file.name && (await handle.getFile()).size !== 0)
				throw new Error('A file appeared at the new name. Try renaming again.');
			const stream = await handle.createWritable();
			try {
				await stream.write(raw);
				await stream.close();
			} catch (error) {
				await stream.abort().catch(() => undefined);
				throw error;
			}
			if (file.name && file.name !== name) {
				try {
					if (file.raw !== null && (await readAt(file, file.name)) !== file.raw)
						throw new Error('The original file changed during the rename.');
					await file.directory!.removeEntry(file.name);
				} catch {
					library.update((s) => ({
						...s,
						warning:
							'Saved under the new name, but the original file could not be removed. Both copies were kept.'
					}));
				}
			}
			file.handle = handle;
		}
		file.name = name;
		file.raw = raw;
		if (renameFile || imported) file.filenameTitle = title;
		try {
			await refreshLibrary();
		} catch {
			library.update((s) => ({
				...s,
				warning: 'Saved, but could not refresh the file list. Try Refresh.'
			}));
		}
	});
	queue = operation.catch(() => undefined);
	return operation;
}
export async function deleteLibraryFile(name: string) {
	await queue;
	await syncImported();
	const state = get(library);
	if (imported) {
		const next = { ...imported };
		delete next[[...state.path, name].join('/')];
		await remembered({ files: next, name: importedName, id: importedId }, true);
		imported = next;
	} else await (await directory()).removeEntry(name);
	if (target?.name === name && !target.outside && target.path.join('/') === state.path.join('/'))
		bindLibraryFile(null);
	await refreshLibrary();
}
export async function disconnectLibrary() {
	await queue;
	await remembered({}, true);
	root = null;
	currentDirectory = null;
	imported = null;
	target = null;
	hasDiskFile.set(false);
	revision++;
	library.set({
		name: '',
		path: [],
		folders: [],
		files: [],
		fileDates: {},
		fileInfos: {},
		connected: false,
		needsPermission: false,
		imported: false,
		warning: ''
	});
}
