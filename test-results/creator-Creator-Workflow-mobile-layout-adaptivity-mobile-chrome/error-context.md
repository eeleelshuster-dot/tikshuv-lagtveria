# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: creator.spec.ts >> Creator Workflow >> mobile layout adaptivity
- Location: tests\creator.spec.ts:56:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - img [ref=e7]
    - heading "כניסת מנהל" [level=1] [ref=e10]
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: שם משתמש
        - textbox "שם משתמש" [ref=e14]: eeleel shuster
      - generic [ref=e15]:
        - generic [ref=e16]: סיסמה
        - generic [ref=e17]:
          - textbox "סיסמה" [ref=e18]: Eeleel1810
          - button [ref=e19] [cursor=pointer]:
            - img [ref=e20]
      - generic [ref=e23]:
        - checkbox "זכור אותי" [ref=e24]
        - generic [ref=e25] [cursor=pointer]: זכור אותי
      - paragraph [ref=e27]: שם משתמש או סיסמה שגויים
      - button "כניסה" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: כניסה
        - img
    - link "חזרה לדף הבית" [ref=e31] [cursor=pointer]:
      - /url: /
      - img
      - text: חזרה לדף הבית
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Creator Workflow", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Capture browser logs
  6  |     page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
  7  |     page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));
  8  | 
  9  |     // 1. Visit Login Page
  10 |     await page.goto("/admin-login");
  11 |     
  12 |     // 2. Perform Login with the new account
  13 |     const usernameInput = page.locator('input[type="text"]');
  14 |     const passwordInput = page.locator('input[type="password"]');
  15 |     const loginButton = page.locator('button[type="submit"]');
  16 | 
  17 |     await usernameInput.fill("eeleel shuster");
  18 |     await passwordInput.fill("Eeleel1810");
  19 |     await loginButton.click();
  20 | 
  21 |     // 3. Diagnostic wait
  22 |     try {
> 23 |         await page.waitForURL(/creator|change-password/, { timeout: 15000 });
     |                    ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  24 |     } catch (e) {
  25 |         const currentUrl = page.url();
  26 |         const errorMessage = await page.locator('.text-destructive, .error-message, [role="alert"]').textContent().catch(() => "No error message found");
  27 |         console.log(`Login failed. Current URL: ${currentUrl}`);
  28 |         console.log(`Visible Error: ${errorMessage}`);
  29 |         throw e;
  30 |     }
  31 | 
  32 |     if (page.url().includes("change-password")) {
  33 |         // Updated placeholders based on browser subagent findings
  34 |         await page.getByPlaceholder(/לפחות 8 תווים|New Password/i).fill("Eeleel1810_Final");
  35 |         await page.getByPlaceholder(/הזן שוב את הסיסמה|Confirm Password/i).fill("Eeleel1810_Final");
  36 |         await page.getByRole("button", { name: /שמור סיסמה|Save Password|עדכן|Update/i }).click();
  37 |         await page.waitForURL("/creator");
  38 |     }
  39 |   });
  40 | 
  41 |   test("should navigate tabs and access Admin Dashboard", async ({ page }) => {
  42 |     await page.goto("/creator");
  43 |     
  44 |     // Verify tabs exist
  45 |     await expect(page.getByRole("tab", { name: /משתמשים|Users/i })).toBeVisible();
  46 |     await expect(page.getByRole("tab", { name: /תוכן|Content/i })).toBeVisible();
  47 |     await expect(page.getByRole("tab", { name: /היסטוריה|History/i })).toBeVisible();
  48 | 
  49 |     // Verify Admin Dashboard link/button exists for Creator
  50 |     const adminLink = page.getByRole("link", { name: /לוח בקרה|Admin Dashboard/i });
  51 |     await expect(adminLink).toBeVisible();
  52 |     await adminLink.click();
  53 |     await expect(page).toHaveURL("/admin");
  54 |   });
  55 | 
  56 |   test("mobile layout adaptivity", async ({ page, isMobile }) => {
  57 |     test.skip(!isMobile, "This test is for mobile viewports only");
  58 |     await page.goto("/creator");
  59 | 
  60 |     // Check if sidebar/navigation is collapsed or adjusted
  61 |     // Typically in mobile layouts, we look for a hamburger menu
  62 |     const menuButton = page.getByRole("button", { name: /תפריט|Menu|Toggle/i });
  63 |     if (await menuButton.isVisible()) {
  64 |         await expect(menuButton).toBeVisible();
  65 |     }
  66 |     
  67 |     // Ensure cards are stacked instead of a large table if applicable
  68 |     // This is a generic check for responsive classes
  69 |   });
  70 | });
  71 | 
```