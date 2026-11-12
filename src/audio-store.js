const DATABASE_NAME = "svi-mali-audio-v1";
const STORE_NAME = "audio-files";

export async function saveAudioFile(file, mimeType = file.type) {
  const record = {
    id: createId(),
    blob: file,
    fileName: file.name,
    mimeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(record));
  return {
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
  };
}

export function getAudioFile(id) {
  return withStore("readonly", (store) => store.get(id));
}

export function deleteAudioFile(id) {
  return withStore("readwrite", (store) => store.delete(id));
}

export function clearAudioFiles() {
  return withStore("readwrite", (store) => store.clear());
}

function withStore(mode, action) {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("Le stockage audio local n’est pas disponible dans ce navigateur."));
  }
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("Échec du stockage du fichier audio."));
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error("Le stockage audio a été interrompu."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Le stockage audio a échoué."));
  }));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d’ouvrir la bibliothèque audio locale."));
  });
}

function createId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("La création sécurisée d’identifiants n’est pas prise en charge par ce navigateur.");
  }
  return globalThis.crypto.randomUUID();
}
