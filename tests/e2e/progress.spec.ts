import { test, expect } from "@playwright/test";

test("review answer schedules the word and survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Sổ từ vựng/ }).click();
  await page.locator('input[type=file][accept=".csv"]').setInputFiles({
    name: "review.csv", mimeType: "text/csv",
    buffer: Buffer.from("term,meaning,language,note\nsách,book,vi,Một cuốn sách."),
  });
  await page.getByRole("button", { name: "Nhập dữ liệu đã ánh xạ" }).click();
  const panel = page.getByRole("region", { name: "Ôn từ vựng" });
  await panel.getByRole("button", { name: "Bắt đầu ôn" }).click();
  await expect(panel.getByText("book", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Hiện nghĩa" }).click();
  await expect(panel.getByText("book", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Đã nhớ · 1 ngày" }).click();
  await expect(panel).toContainText("Đã ôn hết lượt này");
  await page.reload();
  await page.getByRole("button", { name: /Sổ từ vựng/ }).click();
  await expect(panel).toContainText("0 từ đến lượt ôn");
});

test("Vietnamese self-hosted font is loaded, including offline production", async ({ page, context }) => {
  await page.goto("http://127.0.0.1:8787/");
  await page.evaluate(async () => {
    await document.fonts.load('400 24px "Noto Sans"', "Một cuốn sách. Nhiều cách khám phá.");
    await navigator.serviceWorker.ready;
  });
  await expect(page.locator("h1").first()).toHaveCSS("font-family", '"Noto Sans", sans-serif');
  expect(await page.evaluate(() => document.fonts.check('400 24px "Noto Sans"', "ắ ế ộ ữ"))).toBe(true);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.evaluate(async () => (await document.fonts.load('400 24px "Noto Sans"', "ế ộ")).length)).toBeGreaterThan(0);
});

test("PIN blocks parent exit and page reload; completed practice persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page.getByRole("textbox", { name: "Nội dung sách" }).fill("Một cuốn sách. Nhiều cách khám phá.");
  await page.getByRole("textbox", { name: "Tên sách", exact: true }).fill("Sách luyện đọc");
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await page.getByRole("button", { name: "Góc trẻ em", exact: true }).click();
  await page.getByLabel("Biệt danh").fill("An");
  await page.getByRole("button", { name: "Thêm hồ sơ" }).click();
  await page.getByRole("checkbox", { name: /Sách luyện đọc/ }).click();
  await expect(page.getByRole("checkbox", { name: /Sách luyện đọc/ })).toBeChecked();
  await page.getByLabel("PIN mới", { exact: true }).fill("1234");
  await page.getByLabel("Xác nhận PIN").fill("1234");
  await page.getByRole("button", { name: "Lưu PIN", exact: true }).click();
  await expect(page.getByText("Đã lưu PIN trên thiết bị này.")).toBeVisible();
  await page.getByRole("button", { name: "Mở góc đọc của An" }).click();
  await page.locator(".child-books").getByRole("button", { name: /Sách luyện đọc/ }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.getByRole("button", { name: "Hoàn thành buổi luyện" }).click();
  await expect(page.locator(".child-books")).toBeVisible();
  await page.getByText("Khu vực phụ huynh", { exact: true }).click();
  await page.getByLabel("PIN phụ huynh").fill("9999");
  await page.getByRole("button", { name: "Về quản lý hồ sơ" }).click();
  await expect(page.getByRole("alert")).toContainText("PIN chưa đúng");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Khu vực phụ huynh" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm sách", exact: true })).toHaveCount(0);
  await page.waitForTimeout(5100);
  await page.getByLabel("PIN phụ huynh").fill("1234");
  await page.getByRole("button", { name: "Về quản lý hồ sơ" }).click();
  await page.getByRole("button", { name: "Góc trẻ em", exact: true }).click();
  await page.getByRole("button", { name: "An · 6 tuổi" }).click();
  await expect(page.getByText(/Sách luyện đọc/).last()).toBeVisible();
  await expect(page.getByText(/2 câu ·/)).toBeVisible();
});
