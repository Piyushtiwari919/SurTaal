import { test, expect } from "@playwright/test";

test.describe("SurTaal Pocket Harmonium E2E Verification", () => {
  test("fits 320px mobile viewport without page-wide horizontal overflow and plays notes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("http://localhost:5173");

    await expect(page.getByRole("heading", { name: "SurTaal" })).toBeVisible();

    const overflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(overflow).toBe(false);

    // Press a harmonium key and verify live Swara feedback updates
    const firstKey = page.locator('[data-midi="60"]');
    await firstKey.dispatchEvent("pointerdown", { pointerId: 1 });
    await expect(page.locator(".live-swara-pill")).toContainText("Note: C4");
    await firstKey.dispatchEvent("pointerup", { pointerId: 1 });
  });

  test("switches themes and records a melody in Song Studio", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:5173");

    const themeSelect = page.getByLabel("Select Visual Theme");
    await themeSelect.selectOption("midnight-riyaaz");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "midnight-riyaaz",
    );

    await page.getByRole("button", { name: "Song Studio" }).click();
    await page.getByRole("button", { name: /Record Melody/i }).click();
    await page.keyboard.down("a");
    await page.waitForTimeout(120);
    await page.keyboard.up("a");
    await page.getByRole("button", { name: /Stop Recording/i }).click();

    await expect(
      page.getByRole("table", { name: "Recorded Notes Editor" }),
    ).toBeVisible();
  });
});

test("renders all 29 harmonium keys visibly inside the viewport below 830px without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("http://localhost:5173");

  const overflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );
  });
  expect(overflow).toBe(false);

  // Verify first key (C3, midi 48), middle key (C4, midi 60), and last key (E5, midi 76) are all in viewport
  await expect(page.locator('[data-midi="48"]')).toBeInViewport();
  await expect(page.locator('[data-midi="60"]')).toBeInViewport();
  await expect(page.locator('[data-midi="76"]')).toBeInViewport();
});
