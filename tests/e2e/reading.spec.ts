import { test, expect, type Page } from "@playwright/test";
async function pasteBook(page: Page, title = "Sách kiểm thử", lang = "vi") {
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nội dung sách" })
    .fill(
      "Chương 1\n\nXin chào thế giới.\n\nĐoạn thứ hai giữ nguyên 42.\n\nChương 2\n\nMột ngày mới.",
    );
  await page
    .getByRole("textbox", { name: "Tên sách", exact: true })
    .fill(title);
  await page.getByLabel("Ngôn ngữ nguyên bản").selectOption(lang);
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("import, manual translation, locked edit, note, position, vocabulary and persistence", async ({
  page,
}) => {
  await pasteBook(page);
  await page.getByRole("button", { name: /Sách kiểm thử/ }).click();
  await expect(page.locator(".paragraph-text").first()).toContainText(
    "Xin chào thế giới.",
  );
  await page
    .getByRole("button", { name: "Sửa bản dịch và ghi chú đoạn 1" })
    .click();
  await page
    .getByRole("textbox", { name: "Bản dịch thủ công" })
    .fill("Hello world.");
  await page
    .getByRole("textbox", { name: "Ghi chú", exact: true })
    .fill("Ghi chú được lưu.");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.locator(".translated").first()).toContainText(
    "Hello world.",
  );
  await page
    .getByRole("button", { name: "Sửa bản dịch và ghi chú đoạn 1" })
    .click();
  await page
    .getByRole("button", { name: "Khóa bản dịch", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Bản dịch thủ công" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Lưu từ từ đoạn 1" }).click();
  await page.getByRole("textbox", { name: "Từ muốn lưu" }).fill("Xin chào");
  await page.getByRole("textbox", { name: "Nghĩa của từ" }).fill("Hello");
  await page.getByRole("button", { name: "Lưu từ", exact: true }).click();
  await page.getByRole("button", { name: "Lưu vị trí đoạn 2" }).click();
  await expect(page.locator(".paragraph").nth(1)).toHaveClass(/current/);
  await page.reload();
  await expect(page.locator(".reading-paper")).toBeVisible();
  await expect(page.locator(".translated").first()).toContainText(
    "Hello world.",
  );
  await expect(page.locator(".paragraph-note")).toContainText(
    "Ghi chú được lưu.",
  );
  await expect(page.locator(".paragraph").nth(1)).toHaveClass(/current/);
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await page.getByRole("button", { name: /Sổ từ vựng/ }).click();
  await expect(page.locator(".word-row")).toContainText("Xin chào");
  await expect(page.locator(".word-row")).toContainText("Sách kiểm thử");
});
test("duplicate import is rejected and HTML never executes", async ({
  page,
}) => {
  await pasteBook(page);
  await pasteBookDuplicate(page);
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page.getByLabel("Tệp sách", { exact: true }).setInputFiles({
    name: "safe.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<html><script>window.PWNED=1</script><article><h1>Sách HTML</h1><p>Hello <b>world</b>.</p><img src=x onerror="window.PWNED=1"></article></html>',
    ),
  });
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await page.getByRole("button", { name: /safe/ }).click();
  await expect(page.locator(".paragraphs")).toContainText("Hello world.");
  expect(await page.evaluate(() => "PWNED" in window)).toBe(false);
});
async function pasteBookDuplicate(page: Page) {
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nội dung sách" })
    .fill(
      "Chương 1\n\nXin chào thế giới.\n\nĐoạn thứ hai giữ nguyên 42.\n\nChương 2\n\nMột ngày mới.",
    );
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await expect(page.getByRole("alert")).toContainText("đã có");
}
test("child profile sees only approved books and no external lookup", async ({
  page,
}) => {
  await pasteBook(page, "Được duyệt");
  await page.getByRole("button", { name: "Thêm sách", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nội dung sách" })
    .fill("Riêng tư, không dành cho trẻ.");
  await page
    .getByRole("textbox", { name: "Tên sách", exact: true })
    .fill("Chưa duyệt");
  await page.getByRole("button", { name: "Nhập & lưu sách" }).click();
  await page.getByRole("button", { name: "Góc trẻ em", exact: true }).click();
  await page.getByLabel("Biệt danh").fill("An");
  await page.getByRole("button", { name: "Thêm hồ sơ" }).click();
  await page.getByRole("checkbox", { name: /Được duyệt/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Được duyệt/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Mở góc đọc của An" }).click();
  await expect(page.locator(".child-books")).toContainText("Được duyệt");
  await expect(page.locator(".child-books")).not.toContainText("Chưa duyệt");
  await page
    .locator(".child-books")
    .getByRole("button", { name: /Được duyệt/ })
    .click();
  await expect(page.locator(".practice-sentence")).toContainText(
    "Xin chào thế giới.",
  );
  await expect(page.getByRole("link", { name: /Hanzii/ })).toHaveCount(0);
});
test("quota failure preserves already translated paragraphs and resumes only missing paragraphs", async ({
  page,
}) => {
  await page.route("**/api/capabilities", (r) =>
    r.fulfill({
      json: {
        configured: true,
        provider: "LibreTranslate",
        pairs: [{ source: "vi", targets: ["en", "zh"] }],
      },
    }),
  );
  await page.reload();
  await pasteBook(page);
  await page.getByRole("button", { name: /Sách kiểm thử/ }).click();
  await page.getByText("Dịch & nghe", { exact: false }).first().click();
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).check();
  let requests: string[] = [];
  let quota = true;
  await page.route("**/api/translate", async (route) => {
    requests.push(route.request().postDataJSON().text);
    if (requests.length === 2 && quota)
      await route.fulfill({
        status: 429,
        json: { error: "Hết hạn mức thử nghiệm" },
      });
    else
      await route.fulfill({
        json: {
          text: "Bản dịch kiểm thử " + requests.length,
          provider: "Test fixture (không phải dịch thật)",
        },
      });
  });
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Dịch chương", exact: true }).click();
  await expect(
    page.getByText("Đã dừng, các đoạn dịch đã lưu được giữ nguyên."),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  await expect(page.locator(".translated").first()).toContainText(
    "Bản dịch kiểm thử 1",
  );
  quota = false;
  await page.getByRole("button", { name: "Dịch chương", exact: true }).click();
  await expect(page.getByText("Đã lưu 1 đoạn dịch.")).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(requests[0]).not.toBe(requests[2]);
});

test("recording starts only after explicit action, stays local, and can be deleted (synthetic microphone)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"], {
    origin: "http://127.0.0.1:5173",
  });
  await page.addInitScript(() => {
    Reflect.set(window, "micRequests", 0);
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      Reflect.set(
        window,
        "micRequests",
        Number(Reflect.get(window, "micRequests")) + 1,
      );
      return original(constraints);
    };
  });
  await page.reload();
  await pasteBook(page, "Bài luyện đọc");
  await page.getByRole("button", { name: "Góc trẻ em", exact: true }).click();
  await page.getByLabel("Biệt danh").fill("Bé An");
  await page.getByRole("button", { name: "Thêm hồ sơ" }).click();
  await page.getByRole("checkbox", { name: /Bài luyện đọc/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Bài luyện đọc/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Mở góc đọc của Bé An" }).click();
  await page
    .locator(".child-books")
    .getByRole("button", { name: /Bài luyện đọc/ })
    .click();
  await expect(page.locator(".sidebar")).toBeHidden();
  expect(await page.evaluate(() => Reflect.get(window, "micRequests"))).toBe(0);
  let posted = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posted++;
  });
  await page.getByRole("button", { name: "Thu âm đọc lại" }).click();
  await expect(
    page.getByRole("button", { name: "Kết thúc lượt đọc" }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "micRequests"))).toBe(1);
  await page.getByRole("button", { name: "Kết thúc lượt đọc" }).click();
  await expect(page.locator("audio")).toBeVisible();
  expect(await page.locator("audio").getAttribute("src")).toMatch(/^blob:/);
  expect(posted).toBe(0);
  await page.getByRole("button", { name: "Xóa bản thu" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});
