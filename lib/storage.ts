const DB = "frame-by-frame-v2";
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. You can still download an analysis backup.",
        ),
      );
  });
}
async function transaction(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", mode);
    const req = action(tx.objectStore("workspace"));
    let value: any;
    req.onsuccess = () => {
      value = req.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "The browser could not save your analysis. Download a backup instead.",
        ),
      );
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("The storage operation was cancelled."));
    };
  });
}
export const saveWorkspace = (data: any) =>
  transaction("readwrite", (s) => s.put(data, "analysis"));
export const loadWorkspace = () =>
  transaction("readonly", (s) => s.get("analysis"));
export const clearWorkspace = () => transaction("readwrite", (s) => s.clear());
