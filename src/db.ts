import {openDB} from "idb";
export const db = openDB("lasach-v1", 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
    if (!db.objectStoreNames.contains("originals")) db.createObjectStore("originals");
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    if (!db.objectStoreNames.contains("pdfDrafts")) db.createObjectStore("pdfDrafts", { keyPath: ["draftId", "page"] });
  },
});
