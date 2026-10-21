import {navigate,openMenu,showTools,hideTools,readyPage} from './helpers';
import { test, expect } from "@playwright/test";
import JSZip from "jszip";
test("imports a real EPUB spine in order and downloads the identical original file", async ({
  page,
}) => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  zip.file(
    "OPS/book.opf",
    '<package><manifest><item id="two" href="two.xhtml"/><item id="one" href="one.xhtml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
  );
  zip.file(
    "OPS/one.xhtml",
    "<html><head><title>第一章</title></head><body><h1>第一章</h1><p>你好，世界！</p></body></html>",
  );
  zip.file(
    "OPS/two.xhtml",
    "<html><body><h1>第二章</h1><p>第二段。</p></body></html>",
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await page.goto("/");
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page.getByLabel("Tệp sách", { exact: true }).setInputFiles({
    name: "Chinese.epub",
    mimeType: "application/epub+zip",
    buffer,
  });
  await page.getByLabel("Ngôn ngữ nguyên bản").selectOption("zh");
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await page.getByRole("button", { name: /Chinese/ }).click();
  await expect(page.locator(".paragraphs")).toContainText("你好，世界！");
  await expect(page.locator(".paragraphs")).not.toContainText("第二段。");
  await showTools(page);await page.getByLabel("Chương", { exact: true }).selectOption("1");await hideTools(page);await readyPage(page);
  await expect(page.locator(".paragraphs")).toContainText("第二段。");
  await showTools(page);await page.getByRole("button", { name: "Chỉnh thông tin sách" }).click();
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải tệp gốc" }).click();
  const download = await wait;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  expect(Buffer.concat(chunks).equals(buffer)).toBe(true);
});
test("extracts actual DOCX text runs without executing markup", async ({
  page,
}) => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Xin </w:t></w:r><w:r><w:t>chào &amp; hello.</w:t></w:r></w:p><w:p><w:r><w:t>段落二。</w:t></w:r></w:p></w:body></w:document>',
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await page.goto("/");
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page.getByLabel("Tệp sách", { exact: true }).setInputFiles({
    name: "Document.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer,
  });
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await page.getByRole("button", { name: /Document/ }).click();
  await expect(page.locator(".paragraphs")).toContainText("Xin chào & hello.");
  await expect(page.locator(".paragraphs")).toContainText("段落二。");
});
test("previews and maps CSV with safe export and duplicate merging", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, /Sổ từ vựng/);
  await page.locator('input[type=file][accept=".csv"]').setInputFiles({
    name: "words.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "hanzi,nghia,lang,example\n你好,xin chào,zh,你好世界\n你好,xin chào,zh,你好世界\n你好,chào bạn,zh,你好朋友",
    ),
  });
  await page.getByLabel("Từ / chữ Hán").selectOption("hanzi");
  await page
    .getByLabel("Nghĩa tiếng Việt", { exact: true })
    .selectOption("nghia");
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("lang");
  await page.getByLabel("Ví dụ / ghi chú").selectOption("example");
  await page.getByRole("button", { name: "Nhập dữ liệu đã ánh xạ" }).click();
  await expect(page.locator(".word-row")).toHaveCount(2);
  await page.reload();
  await navigate(page, /Sổ từ vựng/);
  await expect(page.locator(".word-row")).toHaveCount(2);
});
test("production PWA reads local data after network loss and has no horizontal mobile overflow", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:8787");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nội dung sách" })
    .fill("Nội dung ngoại tuyến.");
  await page
    .getByRole("textbox", { name: "Tên sách", exact: true })
    .fill("Offline");
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Offline/ })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Offline/ }).click();
  await expect(page.locator(".paragraphs")).toContainText(
    "Nội dung ngoại tuyến.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await context.setOffline(false);
});

test("backup restores into a separate browser with original text and rejects malformed position", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nội dung sách" })
    .fill("Văn bản gốc cần sao lưu.");
  await page
    .getByRole("textbox", { name: "Tên sách", exact: true })
    .fill("Bản sao an toàn");
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Cài đặt & kết nối");
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sao lưu dữ liệu" }).click();
  const output = await wait;
  const stream = await output.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const buffer = Buffer.concat(chunks);
  const parsed = JSON.parse(buffer.toString());
  expect(Object.keys(parsed.originals)).toHaveLength(1);
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto("http://127.0.0.1:5173");
  await navigate(fresh, "Cài đặt & kết nối");
  await fresh
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer,
    });
  await expect(fresh.getByRole("status")).toContainText("Đã khôi phục");
  await navigate(fresh, "Thư viện của tôi");
  await fresh.getByRole("button", { name: /Bản sao an toàn/ }).click();
  await expect(fresh.locator(".paragraphs")).toContainText(
    "Văn bản gốc cần sao lưu.",
  );
  await navigate(fresh, 'Thư viện của tôi');
  await navigate(fresh, "Cài đặt & kết nối");
  parsed.books[0].position.chapter = -1;
  await fresh
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(parsed)),
    });
  await expect(fresh.getByRole("status")).toContainText(
    "Vị trí đọc không hợp lệ",
  );
  await other.close();
});
