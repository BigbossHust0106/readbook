import { test, expect } from '@playwright/test';
async function add(page: import('@playwright/test').Page, text: string) {
  await page.getByRole('button', { name: 'Thêm sách', exact: true }).click();
  await page.getByLabel('Nội dung sách').fill(text);
  await page.getByRole('textbox', { name: 'Tên sách', exact: true }).fill('Sách đọc liền');
  await page.getByRole('button', { name: 'Nhập & lưu sách', exact: true }).click();
  await page.getByRole('button', { name: /Sách đọc liền/ }).click();
}
test('page slider, fixed controls, continuous chapters and reading position persist', async ({ page }) => {
  await page.goto('/');
  const paragraph = 'Một cuốn sách mở ra thế giới. '.repeat(50);
  await add(page, `Chương 1\n\n${paragraph}\n\nChương 2\n\nNội dung chương hai hiện ra khi cuộn.\n\nChương 3\n\nNội dung chương ba nối tiếp.`);
  const slider = page.getByRole('slider', { name: 'Số ký tự mỗi trang' });
  await slider.focus(); await slider.press('Home');
  await expect(page.locator('.reader-page-status')).toContainText('Trang 1/');
  const initial = await page.locator('.paragraph-text').first().innerText();
  await page.locator('.reading-paper').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');
  await page.locator('.paragraph').first().hover();
  await page.getByRole('button', { name: 'Lưu vị trí đoạn 1', exact: true }).click();
  await page.reload();await expect(page.locator('.reading-paper')).toBeVisible();
  await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');
  expect(await slider.inputValue()).toBe('500');
  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.locator('.reader-page-status');
  let box = await bar.boundingBox(); expect(box!.y + box!.height).toBeGreaterThan(810);
  await page.getByLabel('Chế độ đọc').selectOption('continuous');
  await expect(page.locator('.reading-paper')).toContainText('Nội dung chương hai hiện ra khi cuộn.');
  await page.locator('.reading-sentinel').scrollIntoViewIfNeeded();
  await expect(page.locator('.reading-paper')).toContainText('Nội dung chương ba nối tiếp.');
  box = await bar.boundingBox(); expect(box!.y + box!.height).toBeGreaterThan(810);
  await page.getByRole('button',{name:'Hiện công cụ',exact:true}).click();
  await page.getByLabel('Chế độ đọc').selectOption('paged');
  await slider.focus(); await slider.press('End');
  await expect(page.locator('.reader-page-status')).toContainText('Trang 1/');
  expect((await page.locator('.paragraph-text').first().innerText()).length).toBeGreaterThan(initial.length);
});
test('visible bilingual translation saves machine results and resumes remaining paragraphs', async ({ page }) => {
  await page.route('**/api/capabilities', route => route.fulfill({ json: { configured: true, provider: 'MyMemory', pairs: [{ source: 'vi', targets: ['en', 'zh'] }], reason: 'API có hạn mức' } }));
  const sent: string[] = [];
  await page.route('**/api/translate', route => { sent.push(route.request().postDataJSON().text); return route.fulfill({ json: { text: 'A book opens a new world.', provider: 'MyMemory' } }); });
  await page.goto('/'); await add(page, 'Một cuốn sách mở ra thế giới.\n\nĐọc sách mỗi ngày.');
  await page.getByRole('button', { name: 'Dịch song ngữ', exact: true }).click();
  await page.getByRole('checkbox', { name: /Tôi đồng ý gửi/ }).check();
  await page.getByRole('button', { name: 'Dịch trang này', exact: true }).click();
  await expect(page.locator('.translated').first()).toContainText('A book opens a new world.');
  await expect(page.locator('.translation-panel')).toContainText('Đã lưu 2 đoạn dịch.');
  expect(sent).toHaveLength(2);
  await page.reload();await expect(page.locator('.reading-paper')).toBeVisible();
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
  await expect(page.locator('.reading-paper')).toContainText('Một cuốn sách từ nguồn');
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
