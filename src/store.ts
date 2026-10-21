import { openDB } from "idb";
import { createClient } from "@supabase/supabase-js";
import { assertBook, type Book, type Word, type Child } from "./model";
const db = openDB("lasach-v1", 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
    if (!db.objectStoreNames.contains("originals")) db.createObjectStore("originals");
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    if (!db.objectStoreNames.contains("pdfDrafts")) db.createObjectStore("pdfDrafts", { keyPath: ["draftId", "page"] });
  },
});
export const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
const revisions = new Map<string, number>();
export async function userId() {
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) throw new Error("Vui lòng đăng nhập lại.");
  return data.user.id;
}
export async function listBooks(cloud: boolean): Promise<Book[]> {
  if (!cloud)
    return (await (await db).getAll("books")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  const { data, error } = await supabase!
    .from("books")
    .select("id,revision,document")
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const r of data) {
    assertBook(r.document);
    revisions.set(r.id, r.revision);
  }
  return data.map((r) => r.document as Book);
}
export async function saveBook(book: Book, cloud: boolean) {
  if (!cloud) {
    await (await db).put("books", book);
    return;
  }
  const uid = await userId();
  const values = {
    id: book.id,
    owner_id: uid,
    title: book.title,
    language: book.language,
    content_hash: book.hash,
    document: book,
  };
  const revision = revisions.get(book.id);
  const result =
    revision === undefined
      ? await supabase!.from("books").insert(values).select("revision").single()
      : await supabase!
          .from("books")
          .update(values)
          .eq("id", book.id)
          .eq("revision", revision)
          .select("revision")
          .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data)
    throw new Error(
      "Sách đã thay đổi trên thiết bị khác. Thay đổi mới chưa được lưu; hãy giữ nội dung vừa sửa và tải lại để đối chiếu.",
    );
  revisions.set(book.id, result.data.revision);
}
export async function saveOriginal(book: Book, file: Blob, cloud: boolean) {
  if (!cloud) {
    await (await db).put("originals", file, book.id);
    return;
  }
  const uid = await userId();
  const { error } = await supabase!.storage
    .from("originals")
    .upload(`${uid}/${book.id}/original`, file, {
      upsert: false,
      contentType: "application/octet-stream",
    });
  if (error) throw error;
}
export async function getOriginal(
  book: Book,
  cloud: boolean,
): Promise<Blob | undefined> {
  if (!cloud) return (await db).get("originals", book.id);
  const uid = await userId();
  const { data, error } = await supabase!.storage
    .from("originals")
    .download(`${uid}/${book.id}/original`);
  if (error) throw error;
  return data;
}
export async function deleteBook(book: Book, cloud: boolean) {
  if (!cloud) {
    const tx = (await db).transaction(["books", "originals"], "readwrite");
    await tx.objectStore("books").delete(book.id);
    await tx.objectStore("originals").delete(book.id);
    await tx.done;
    return;
  }
  const uid = await userId();
  const { error: storageError } = await supabase!.storage
    .from("originals")
    .remove([`${uid}/${book.id}/original`]);
  if (storageError) throw storageError;
  const { error } = await supabase!.from("books").delete().eq("id", book.id);
  if (error) throw error;
}
export async function getCollection<T>(
  name: "vocabulary" | "children",
  cloud: boolean,
): Promise<T[]> {
  if (!cloud) return (await (await db).get("settings", name)) || [];
  const { data, error } = await supabase!.from(name).select("document");
  if (error) throw error;
  return data.map((r) => r.document as T);
}
export async function saveCollection(
  name: "vocabulary" | "children",
  values: Word[] | Child[],
  cloud: boolean,
) {
  if (!cloud) {
    await (await db).put("settings", values, name);
    return;
  }
  const uid = await userId();
  // Upsert only: avoid non-atomic delete/reinsert which could lose data on connection failure.
  if (values.length) {
    const { error } = await supabase!
      .from(name)
      .upsert(values.map((v) => ({ id: v.id, owner_id: uid, document: v })));
    if (error) throw error;
  }
}
export async function deleteItem(
  name: "vocabulary" | "children",
  id: string,
  cloud: boolean,
) {
  if (cloud) {
    const { error } = await supabase!.from(name).delete().eq("id", id);
    if (error) throw error;
  } else {
    const values = await getCollection<{ id: string }>(name, false);
    await (
      await db
    ).put(
      "settings",
      values.filter((v) => v.id !== id),
      name,
    );
  }
}
export async function setSetting(key: string, value: unknown) {
  await (await db).put("settings", value, key);
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return (await (await db).get("settings", key)) ?? fallback;
}

export async function pdfDraftPages(draftId: string): Promise<import("./pdf").PdfTextPage[]> {
  return (await db).getAll("pdfDrafts", IDBKeyRange.bound([draftId, 0], [draftId, Infinity]));
}
export async function savePdfDraftPage(draftId: string, page: import("./pdf").PdfTextPage) {
  await (await db).put("pdfDrafts", { ...page, draftId });
}
export async function clearPdfDraft(draftId: string) {
  await (await db).delete("pdfDrafts", IDBKeyRange.bound([draftId, 0], [draftId, Infinity]));
}
