import {navigate,openMenu,showTools,hideTools,readyPage} from './helpers';
import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';

async function textPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of ['PDF page one. The original text stays unchanged.', 'PDF page two. A separate page with readable text.']) {
    const page = pdf.addPage([600, 800]);
    page.drawText(text, { x: 40, y: 700, size: 16, font });
  }
  return Buffer.from(await pdf.save());
}

test('PDF text over the old 20 MB limit imports, can be corrected, and keeps the original', async ({ page }) => {
  await page.goto('http://127.0.0.1:8787/');
  const original = Buffer.concat([await textPdf(), Buffer.alloc(21 * 1024 * 1024, 32)]);
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'text-large.pdf', mimeType: 'application/pdf', buffer: original });
  await page.getByLabel('Ngôn ngữ nguyên bản').selectOption('en');
  await page.getByLabel('Cách đọc PDF').selectOption('off');
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByLabel('Văn bản PDF đã trích xuất')).toHaveValue(/PDF page one/);
  await page.getByLabel('Văn bản PDF đã trích xuất').fill('Corrected page one.');
  await page.getByLabel('Trang để kiểm tra').selectOption('1');
  await expect(page.getByLabel('Văn bản PDF đã trích xuất')).toHaveValue(/PDF page two/);
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /text-large/ }).click();
  await expect(page.locator('.paragraph-text').first()).toContainText('Corrected page one.');
  await showTools(page);await page.getByRole('button', { name: 'Đối chiếu PDF gốc' }).click();
  await expect(page.getByRole('dialog')).toContainText('PDF gốc · trang 1');
  await expect(page.getByRole('dialog').getByRole('img', { name: 'Trang PDF gốc 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await hideTools(page);await readyPage(page);await page.locator('.reading-paper:not(.viewport-measure)').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.paragraph-text').first()).toContainText('PDF page two');
  await page.reload();
  await expect(page.locator('.reading-paper:not(.viewport-measure)')).toBeVisible();
  await showTools(page);await page.getByRole('button', { name: 'Chỉnh thông tin sách' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải tệp gốc' }).click();
  const download = await downloaded;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).equals(original)).toBe(true);
});

test('scan OCR recognizes Vietnamese locally under production CSP and saves reviewed text', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://127.0.0.1:8787/');
  const external: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8787/')) external.push(new URL(request.url()).host); });
  const png = await page.evaluate(async () => {
    await document.fonts.load('400 48px "Noto Sans"', 'Một cuốn sách. Học tiếng Việt mỗi ngày.');
    const canvas = document.createElement('canvas'); canvas.width = 1300; canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '48px "Noto Sans"'; ctx.fillStyle = 'black';
    ctx.fillText('Một cuốn sách.', 70, 130); ctx.fillText('Học tiếng Việt mỗi ngày.', 70, 230);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(png, 'base64'));
  pdf.addPage([1300, 400]).drawImage(image, { x: 0, y: 0, width: 1300, height: 400 });
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'scan-viet.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  const text = page.getByLabel('Văn bản PDF đã trích xuất');
  await expect(text).toHaveValue(/cuốn sách/, { timeout: 100000 });
  await expect(text).toHaveValue(/tiếng Việt/);
  await text.fill('Một cuốn sách. Học tiếng Việt mỗi ngày.');
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /scan-viet/ }).click();
  await expect(page.locator('.paragraph-text').first()).toContainText('Một cuốn sách.');
  expect(external).toEqual([]);
});

test('PDF range and 50 MB limit give actionable errors; corrupt PDF can be replaced', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  const oversized = testInfo.outputPath('too-large.pdf');
  await writeFile(oversized, Buffer.alloc(50 * 1024 * 1024 + 1));
  await page.getByLabel('Tệp sách').setInputFiles(oversized);
  await expect(page.getByRole('alert')).toContainText('Tệp tối đa 50 MB');
  await expect(page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true })).toBeDisabled();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid PDF') });
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'good.pdf', mimeType: 'application/pdf', buffer: await textPdf() });
  await page.getByText('Tùy chọn khoảng trang (mặc định toàn bộ tệp)').click();
  await page.getByLabel('Từ trang').fill('3');
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('PDF có 2 trang');
  await page.getByLabel('Từ trang').fill('2');
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByLabel('Văn bản PDF đã trích xuất')).toHaveValue(/PDF page two/);
});

test('cancelling model download stops import and the same dialog can retry', async ({ page }) => {
  await page.goto('/');
  let requested!: () => void;
  const modelRequest = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/ocr/*.traineddata.gz', async route => {
    requested();
    // Deliberately hold the model so the test exercises cancellation during download.
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    await route.abort().catch(() => {});
  });
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]);
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'cancel.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await modelRequest;
  await page.getByRole('button', { name: 'Hủy xử lý', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã hủy');
  await expect(page.getByRole('button', { name: 'Nhập & lưu sách', exact: true })).toBeDisabled();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'retry.pdf', mimeType: 'application/pdf', buffer: await textPdf() });
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByLabel('Văn bản PDF đã trích xuất')).toHaveValue(/PDF page one/);
});

test('imports all 205 pages in one PDF and resumes a completed draft after closing the dialog', async ({ page }) => {
  test.setTimeout(90000);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 205; i++) pdf.addPage([500, 700]).drawText(`This is complete page ${i}. Read the entire document.`, { x: 30, y: 600, size: 14, font });
  const buffer = Buffer.from(await pdf.save());
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'whole-205.pdf', mimeType: 'application/pdf', buffer });
  await page.getByLabel('Cách đọc PDF').selectOption('off');
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByLabel('Trang để kiểm tra').locator('option')).toHaveCount(205, { timeout: 60000 });
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Tệp sách').setInputFiles({ name: 'whole-205.pdf', mimeType: 'application/pdf', buffer });
  await page.getByLabel('Cách đọc PDF').selectOption('off');
  await page.getByRole('button', { name: 'Đọc PDF / OCR', exact: true }).click();
  await expect(page.getByLabel('Trang để kiểm tra').locator('option')).toHaveCount(205);
  await page.getByLabel('Trang để kiểm tra').selectOption('204');
  await expect(page.getByLabel('Văn bản PDF đã trích xuất')).toHaveValue(/complete page 205/);
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await page.getByRole('button', { name: /whole-205/ }).click();
  await expect(page.getByLabel('Chương', { exact: true }).locator('option')).toHaveCount(205);
});
