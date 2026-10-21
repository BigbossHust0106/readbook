import {navigate,openMenu,showTools,hideTools,readyPage} from './helpers';
import { test, expect } from '@playwright/test';
async function add(page: import('@playwright/test').Page, text: string) {
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Nội dung sách').fill(text);
  await page.getByRole('textbox', { name: 'Tên sách', exact: true }).fill('Sách đọc liền');
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await page.getByRole('button', { name: /Sách đọc liền/ }).click();
}
test('page character limit, continuous reading and position persist',async({page})=>{
 await page.goto('/');await add(page,'Chương 1\n\n'+('Một sách mở ra thế giới. '.repeat(100))+'\n\nChương 2\n\nNội dung chương sau.');await readyPage(page);await showTools(page);
 await page.getByLabel('Số ký tự mỗi trang').fill('500');await hideTools(page);await readyPage(page);await page.getByRole('button',{name:'Trang sau',exact:true}).click();await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');
 await page.reload();await readyPage(page);await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');await showTools(page);await expect(page.getByLabel('Số ký tự mỗi trang')).toHaveValue('500');await page.getByLabel('Chế độ đọc').selectOption('continuous');await hideTools(page);
 await page.locator('.reading-sentinel').scrollIntoViewIfNeeded();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toContainText('Nội dung chương sau.');
});
test('visible bilingual translation saves machine results and resumes remaining paragraphs', async ({ page }) => {
  await page.route('**/api/capabilities', route => route.fulfill({ json: { configured: true, provider: 'MyMemory', pairs: [{ source: 'vi', targets: ['en', 'zh'] }], reason: 'API có hạn mức' } }));
  const sent: string[] = [];
  await page.route('**/api/translate', route => { sent.push(route.request().postDataJSON().text); return route.fulfill({ json: { text: 'A book opens a new world.', provider: 'MyMemory' } }); });
  await page.goto('/'); await add(page, 'Một cuốn sách mở ra thế giới.\n\nĐọc sách mỗi ngày.');
  await showTools(page);await page.getByRole('button', { name: 'Dịch song ngữ', exact: true }).click();
  await page.getByRole('checkbox', { name: /Tôi đồng ý gửi/ }).check();
  await page.getByRole('button', { name: 'Dịch trang này', exact: true }).click();
  await expect(page.locator('.translated').first()).toContainText('A book opens a new world.');
  await expect(page.locator('.translation-panel')).toContainText('Đã lưu 2 đoạn dịch.');
  expect(sent).toHaveLength(2);
  await page.reload();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toBeVisible();
  await expect(page.locator('.translated').first()).toContainText('A book opens a new world.');
});
test('source import reviews metadata and then imports a same-source public text file', async ({ page }) => {
  await page.route('**/api/source/inspect', route => route.fulfill({ json: { title: 'Sách nguồn thử', author: 'Tác giả thử', links: [{ url: 'https://dtv-ebook.com.vn/files/sample.txt', label: 'TXT' }], external: [] } }));
  await page.route('**/api/source/download', route => route.fulfill({ body: 'Một cuốn sách từ nguồn được phép sử dụng.', headers: { 'X-Book-Filename': 'sample.txt', 'Content-Type': 'application/octet-stream' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByText('Tìm sách trên DTV-Ebook', { exact: true }).click();
  await page.getByText('Hoặc nhập từ liên kết tệp/trang sách', { exact: true }).click();
  await page.getByLabel('Liên kết trang sách').fill('https://dtv-ebook.com.vn/sample.html');
  await page.getByRole('button', { name: 'Tìm tệp sách', exact: true }).click();
  await expect(page.getByText('Sách nguồn thử', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Tôi có quyền tải và sử dụng tệp này.' }).check();
  await page.getByRole('button', { name: 'Nhập TXT', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tên sách', exact: true })).toHaveValue('Sách nguồn thử');
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await page.getByRole('button', { name: /Sách nguồn thử/ }).click();
  await expect(page.locator('.reading-paper:not(.viewport-measure)')).toContainText('Một cuốn sách từ nguồn');
});


test('DTV search remains usable when catalog access is blocked', async ({ page }) => {
  await page.route('**/api/source/catalog', route => route.fulfill({ status: 502, json: { error: 'DTV đang chặn tải danh mục tự động.' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByText('Tìm sách trên DTV-Ebook', { exact: true }).click();
  await page.getByLabel('Tìm đầu sách DTV').fill('Truyện dân gian');
  await expect(page.getByRole('link', { name: 'Tìm trên DTV', exact: true })).toHaveAttribute('href', /gsc.q=Truy/);
  await expect(page.getByRole('link', { name: 'Tìm bằng Google trong DTV' })).toHaveAttribute('href', /site%3Adtv-ebook.com.vn/);
  await page.getByRole('button', { name: 'Tải danh mục mới' }).click();
  await expect(page.getByText('DTV đang chặn tải danh mục tự động.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm trên DTV', exact: true })).toBeEnabled();
});
