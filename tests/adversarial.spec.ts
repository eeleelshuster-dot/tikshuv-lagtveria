import { test, expect } from "@playwright/test";

test.describe("Adversarial Bounds Validations", () => {
    test("Unauthorized Access to Admin route heavily defended", async ({ page }) => {
        // Direct navigation attempt
        await page.goto("/admin");
        
        // Assert hard redirect to login due to missing roles/session
        await expect(page).toHaveURL(/\/admin-login/);
    });

    test("Unauthorized Access to Creator route heavily defended", async ({ page }) => {
        await page.goto("/creator");
        await expect(page).toHaveURL(/\/(admin-login|$)/);
    });

    test("Form validation rejects massive inputs and empty submits", async ({ page }) => {
        await page.goto("/open-ticket");
        
        // Push form raw
        await page.getByRole("button", { name: /שלח|Submit|Send/i }).click();

        // System should throw localized errors inside the UI boundaries, not crashing backend
        const errors = page.locator('.text-destructive');
        await expect(errors).not.toHaveCount(0); // Native async validation wait
        
        // Try injecting massive string to ID
        const hugeString = "A".repeat(10000);
        await page.locator('input[type="text"]').nth(1).fill(hugeString);
        await page.locator('input[type="text"]').nth(1).blur();

        // ID field complains due to regex \d{5,9} limitation
        await expect(page.locator('.text-destructive').filter({ hasText: /5-9/ })).toBeVisible();
    });
});
