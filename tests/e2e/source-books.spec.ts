import {test,expect} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const bookUrl='https://dtv-ebook.com.vn/con-co-the-lam-duoc-ma_22257.html';
const drive='https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12';
async function open(page:import('@playwright/test').Page){await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByText('Tìm sách trên DTV-Ebook',{exact:true}).click();}
test('search results show source links and add a book to the library with one action',async({page})=>{
 await page.route('**/api/source/search',route=>route.fulfill({json:{books:[{title:'Sách thử - Tác giả thử',url:bookUrl}],nextStart:null}}));
 await page.route('**/api/source/inspect',route=>route.fulfill({json:{title:'Sách thử - Tác giả thử',author:'',links:[{url:drive,label:'TXT'}],external:[]}}));
 await page.route('**/api/source/download',route=>route.fulfill({body:'Nội dung sách được tải trực tiếp vào thư viện.',headers:{'X-Book-Filename':encodeURIComponent('Sách thử - Tác giả thử.txt')}}));
 await open(page);await page.getByLabel('Tìm đầu sách DTV').fill('Sách thử');await page.getByRole('button',{name:'Tìm sách',exact:true}).click();
 await expect(page.getByRole('link',{name:bookUrl,exact:true})).toHaveAttribute('href',bookUrl);
 const add=page.locator('.source-catalog').getByRole('button',{name:'Thêm vào thư viện',exact:true});await expect(add).toBeDisabled();
 await page.getByRole('checkbox',{name:'Tôi có quyền tải và sử dụng tệp này.'}).check();await add.click();
 await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:/Sách thử/}).click();
 await expect(page.locator('.reading-paper:not(.viewport-measure)')).toContainText('Nội dung sách được tải trực tiếp');
});
test('a result with multiple formats waits for a choice then imports only that file',async({page})=>{
 const downloads:string[]=[];
 await page.route('**/api/source/search',route=>route.fulfill({json:{books:[{title:'Chọn định dạng',url:bookUrl}],nextStart:null}}));
 await page.route('**/api/source/inspect',route=>route.fulfill({json:{title:'Chọn định dạng',author:'',links:[{url:drive,label:'TXT'},{url:'https://dtv-ebook.com.vn/book.pdf',label:'PDF'}],external:[]}}));
 await page.route('**/api/source/download',route=>{downloads.push(route.request().postDataJSON().url);return route.fulfill({body:'Đã chọn đúng định dạng văn bản.',headers:{'X-Book-Filename':'book.txt'}});});
 await open(page);await page.getByLabel('Tìm đầu sách DTV').fill('Chọn định dạng');await page.getByRole('button',{name:'Tìm sách',exact:true}).click();await page.getByRole('checkbox',{name:'Tôi có quyền tải và sử dụng tệp này.'}).check();await page.locator('.source-catalog').getByRole('button',{name:'Thêm vào thư viện',exact:true}).click();
 await expect(page.getByText('Chọn định dạng sách muốn thêm bên dưới.')).toBeVisible();expect(downloads).toEqual([]);
 await page.getByRole('button',{name:'Nhập TXT',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(downloads).toEqual([drive]);
});
test('a public Drive PDF is downloaded and handed to the PDF processing step with author metadata',async({page})=>{
 const pdf=await PDFDocument.create();const sheet=pdf.addPage();sheet.drawText('Public PDF import check',{font:await pdf.embedFont(StandardFonts.Helvetica),x:30,y:700});
 await page.route('**/api/source/inspect',route=>route.fulfill({json:{title:'Con Có Thể Làm Được Mà! - Maja Pitamic',author:'',links:[{url:drive,label:'PDF'}],external:[]}}));
 await page.route('**/api/source/download',route=>route.fulfill({body:Buffer.from(awaitablePdf),headers:{'X-Book-Filename':encodeURIComponent('Con Có Thể Làm Được Mà! - Maja Pitamic.pdf')}}));
 const awaitablePdf=await pdf.save();
 await open(page);await page.getByText('Hoặc nhập từ liên kết tệp/trang sách',{exact:true}).click();await page.getByLabel('Liên kết trang sách').fill(drive);await page.getByRole('button',{name:'Tìm tệp sách',exact:true}).click();await page.getByRole('checkbox',{name:'Tôi có quyền tải và sử dụng tệp này.'}).check();await page.getByRole('button',{name:'Nhập PDF',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Tên sách',exact:true})).toHaveValue('Con Có Thể Làm Được Mà!');await expect(page.getByRole('textbox',{name:'Tác giả',exact:true})).toHaveValue('Maja Pitamic');
 await expect(page.getByRole('button',{name:'Đọc PDF / OCR',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();
});
test('missing search configuration is explicit and direct Drive import remains available',async({page})=>{
 await page.route('**/api/source/search',route=>route.fulfill({status:503,json:{error:'Tìm kiếm toàn bộ kho DTV trong ứng dụng chưa được cấu hình.'}}));
 await open(page);await page.getByLabel('Tìm đầu sách DTV').fill('Harry Potter');await page.getByRole('button',{name:'Tìm sách',exact:true}).click();await expect(page.getByRole('alert')).toContainText('chưa được cấu hình');await expect(page.locator('.source-catalog li')).toHaveCount(0);
 await page.getByText('Hoặc nhập từ liên kết tệp/trang sách',{exact:true}).click();await expect(page.getByLabel('Liên kết trang sách')).toBeEnabled();
});
