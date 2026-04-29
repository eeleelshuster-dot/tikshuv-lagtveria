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
        await page.locator('button[type="submit"]').click();

        // System should throw localized errors inside the UI boundaries, not crashing backend
        const errors = page.locator('.text-destructive');
        await expect(errors).not.toHaveCount(0); // Native async validation wait
        
        // Try injecting massive string to phone
        const hugeString = "A".repeat(10000);
        await page.locator('input[type="tel"]').fill(hugeString);
        await page.locator('input[type="tel"]').blur();

        // Phone field complains
        await expect(page.locator('.text-destructive').filter({ hasText: /מספר טלפון לא תקין/ })).toBeVisible();
    });
});
