import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const book = "20000000-0000-4000-8000-000000000001";
async function as(uid: string) {
  await db.exec(
    `reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  // Supabase-managed auth/storage are minimal fixtures here. RLS runs in PostgreSQL itself.
  await db.exec(`create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610190001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await as(a);
  await db.query(
    "insert into public.books(id,title,language,content_hash,document) values($1,$2,$3,$4,$5)",
    [book, "Private", "vi", "hash", { id: book, language: "vi", chapters: [] }],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("RLS migration with two PostgreSQL roles/identities (not hosted Supabase)", () => {
  it("shows each user only their books and blocks cross-account mutation", async () => {
    await as(b);
    expect((await db.query("select * from public.books")).rows).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.books set title=$1 where id=$2 returning id",
          ["intrusion", book],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("delete from public.books where id=$1 returning id", [
          book,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.books(id,owner_id,title,language,content_hash,document) values($1,$2,$3,$4,$5,$6)",
        [
          "20000000-0000-4000-8000-000000000002",
          a,
          "x",
          "vi",
          "hash2",
          { id: "20000000-0000-4000-8000-000000000002", language: "vi" },
        ],
      ),
    ).rejects.toThrow(/row-level security/);
    await as(a);
    expect(
      (await db.query<{ title: string }>("select title from public.books"))
        .rows[0].title,
    ).toBe("Private");
  });
  it("blocks changing owner and supports owner edits with revision increment", async () => {
    await as(a);
    await expect(
      db.query("update public.books set owner_id=$1 where id=$2", [b, book]),
    ).rejects.toThrow(/row-level security/);
    const result = await db.query<{ revision: number }>(
      "update public.books set title=$1 where id=$2 and revision=1 returning revision",
      ["Edited", book],
    );
    expect(Number(result.rows[0].revision)).toBe(2);
    expect(
      (
        await db.query(
          "update public.books set title=$1 where id=$2 and revision=1 returning revision",
          ["Stale", book],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("isolates child profiles, vocabulary and events for select/insert/update/delete", async () => {
    for (const [index, table] of [
      "children",
      "vocabulary",
      "integration_events",
    ].entries()) {
      const oid = `30000000-0000-4000-8000-00000000000${index + 1}`;
      await as(a);
      if (table === "integration_events")
        await db.query(
          `insert into public.${table}(id,kind) values($1,'csv_import')`,
          [oid],
        );
      else
        await db.query(
          `insert into public.${table}(id,document) values($1,$2)`,
          [oid, { id: oid }],
        );
      await as(b);
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `update public.${table} set owner_id=$1 where id=$2 returning id`,
            [b, oid],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `delete from public.${table} where id=$1 returning id`,
            [oid],
          )
        ).rows,
      ).toHaveLength(0);
      const evil = "40000000-0000-4000-8000-000000000001";
      const sql =
        table === "integration_events"
          ? `insert into public.${table}(id,owner_id,kind) values($1,$2,'csv_import')`
          : `insert into public.${table}(id,owner_id,document) values($1,$2,'{"id":"${evil}"}')`;
      await expect(db.query(sql, [evil, a])).rejects.toThrow(
        /row-level security/,
      );
    }
  });
  it("forbids attaching a translation job to another user’s book", async () => {
    await as(b);
    await expect(
      db.query(
        "insert into public.translation_jobs(book_id,target_language) values($1,'en')",
        [book],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("keeps originals private and restricts every storage operation by owner folder", async () => {
    await as(a);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('originals',$1)",
      [`${a}/${book}/original`],
    );
    await as(b);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('originals',$1)",
        [`${a}/intrusion`],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (await db.query("update storage.objects set name='stolen' returning id"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("delete from storage.objects returning id")).rows,
    ).toHaveLength(0);
    await as(a);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query("delete from storage.objects returning id")).rows,
    ).toHaveLength(1);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows[0].public,
    ).toBe(false);
  });
});
