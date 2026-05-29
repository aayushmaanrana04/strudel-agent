export interface SavedBeat {
	id: number;
	name: string;
	code: string;
	createdAt: number;
	updatedAt: number;
}

const DB_NAME = 'strudel-agent';
const STORE_NAME = 'beats';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
				store.createIndex('name', 'name', { unique: false });
				store.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveBeat(name: string, code: string): Promise<number> {
	const db = await openDB();
	const now = Date.now();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.add({ name, code, createdAt: now, updatedAt: now });
		req.onsuccess = () => resolve(req.result as number);
		req.onerror = () => reject(req.error);
	});
}

export async function updateBeat(id: number, name: string, code: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const getReq = store.get(id);
		getReq.onsuccess = () => {
			const beat = getReq.result;
			if (!beat) return reject(new Error('Beat not found'));
			beat.name = name;
			beat.code = code;
			beat.updatedAt = Date.now();
			const putReq = store.put(beat);
			putReq.onsuccess = () => resolve();
			putReq.onerror = () => reject(putReq.error);
		};
		getReq.onerror = () => reject(getReq.error);
	});
}

export async function getAllBeats(): Promise<SavedBeat[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('updatedAt');
		const req = index.getAll();
		req.onsuccess = () => resolve((req.result as SavedBeat[]).reverse());
		req.onerror = () => reject(req.error);
	});
}

export async function deleteBeat(id: number): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.delete(id);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}
