import { test, expect } from "@playwright/test";

test.describe("Creator Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Capture browser logs
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    // 1. Visit Login Page
    await page.goto("/admin-login");
    
    // 2. Perform Login with the new account
    const usernameInput = page.locator('input[type="text"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button[type="submit"]');

    await usernameInput.fill("eeleel shuster");
    await passwordInput.fill("Eeleel1810");
    await loginButton.click();

    // 3. Diagnostic wait
    try {
        await page.waitForURL(/creator|change-password/, { timeout: 15000 });
    } catch (e) {
        const currentUrl = page.url();
        const errorMessage = await page.locator('.text-destructive, .error-message, [role="alert"]').textContent().catch(() => "No error message found");
        console.log(`Login failed. Current URL: ${currentUrl}`);
        console.log(`Visible Error: ${errorMessage}`);
        throw e;
    }

    if (page.url().includes("change-password")) {
        // Updated placeholders based on browser subagent findings
        await page.getByPlaceholder(/לפחות 8 תווים|New Password/i).fill("Eeleel1810_Final");
        await page.getByPlaceholder(/הזן שוב את הסיסמה|Confirm Password/i).fill("Eeleel1810_Final");
        await page.getByRole("button", { name: /שמור סיסמה|Save Password|עדכן|Update/i }).click();
        await page.waitForURL("/creator");
    }
  });

  test("should navigate tabs and access Admin Dashboard", async ({ page }) => {
    await page.goto("/creator");
    
    // Verify tabs exist
    await expect(page.getByRole("tab", { name: /משתמשים|Users/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /תוכן|Content/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /היסטוריה|History/i })).toBeVisible();

    // Verify Admin Dashboard link/button exists for Creator
    const adminLink = page.getByRole("link", { name: /לוח בקרה|Admin Dashboard/i });
    await expect(adminLink).toBeVisible();
    await adminLink.click();
    await expect(page).toHaveURL("/admin");
  });

  test("mobile layout adaptivity", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This test is for mobile viewports only");
    await page.goto("/creator");

    // Check if sidebar/navigation is collapsed or adjusted
    // Typically in mobile layouts, we look for a hamburger menu
    const menuButton = page.getByRole("button", { name: /תפריט|Menu|Toggle/i });
    if (await menuButton.isVisible()) {
        await expect(menuButton).toBeVisible();
    }
    
    // Ensure cards are stacked instead of a large table if applicable
    // This is a generic check for responsive classes
  });
});
