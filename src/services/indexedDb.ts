const DB_NAME = 'echowitness-local';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio';
const EVIDENCE_STORE = 'evidence';

export type LocalAudioRecord = {
  id: string;
  incidentId: string;
  mimeType: string;
  createdAt: string;
  blob: Blob;
};

export type LocalEvidenceRecord = {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
};

export type EvidenceMeta = Omit<LocalEvidenceRecord, 'blob'>;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EVIDENCE_STORE)) {
        db.createObjectStore(EVIDENCE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () =>
          reject(request.error ?? new Error(`IndexedDB ${storeName} operation failed`));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      }),
  );
}

export async function saveAudioRecording(
  incidentId: string,
  blob: Blob,
): Promise<string> {
  const id = `audio-${incidentId}`;
  const record: LocalAudioRecord = {
    id,
    incidentId,
    mimeType: blob.type || 'audio/webm',
    createdAt: new Date().toISOString(),
    blob,
  };
  await runTransaction(AUDIO_STORE, 'readwrite', (store) => store.put(record));
  return id;
}

export async function getAudioRecording(
  incidentId: string,
): Promise<LocalAudioRecord | null> {
  const id = `audio-${incidentId}`;
  const record = await runTransaction<LocalAudioRecord | undefined>(
    AUDIO_STORE,
    'readonly',
    (store) => store.get(id),
  );
  return record ?? null;
}

export async function downloadAudioRecording(incidentId: string): Promise<void> {
  const record = await getAudioRecording(incidentId);
  if (!record) {
    throw new Error('No local audio recording found for this incident.');
  }
  triggerDownload(record.blob, `echowitness-audio-${incidentId}.webm`);
}

export async function saveEvidenceFile(
  incidentId: string,
  file: File,
): Promise<EvidenceMeta> {
  const id = `evidence-${crypto.randomUUID()}`;
  const record: LocalEvidenceRecord = {
    id,
    incidentId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  await runTransaction(EVIDENCE_STORE, 'readwrite', (store) => store.put(record));
  return {
    id: record.id,
    incidentId: record.incidentId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
  };
}

export async function listEvidenceFiles(incidentId: string): Promise<EvidenceMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EVIDENCE_STORE, 'readonly');
    const store = transaction.objectStore(EVIDENCE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = (request.result as LocalEvidenceRecord[]).filter(
        (record) => record.incidentId === incidentId,
      );
      resolve(
        records
          .map(({ blob: _blob, ...meta }) => meta)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to list evidence files'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

export async function getEvidenceBlob(id: string): Promise<Blob | null> {
  const record = await runTransaction<LocalEvidenceRecord | undefined>(
    EVIDENCE_STORE,
    'readonly',
    (store) => store.get(id),
  );
  return record?.blob ?? null;
}

export async function deleteEvidenceFile(id: string): Promise<void> {
  await runTransaction(EVIDENCE_STORE, 'readwrite', (store) => store.delete(id));
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadEvidenceFile(id: string, fileName: string): Promise<void> {
  const blob = await getEvidenceBlob(id);
  if (!blob) {
    throw new Error('Evidence file not found in local storage.');
  }
  triggerDownload(blob, fileName);
}

export function createEvidenceRefId(localId: string): string {
  return `local:${localId}`;
}
