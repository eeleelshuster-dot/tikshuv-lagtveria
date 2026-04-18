# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: adversarial.spec.ts >> Adversarial Bounds Validations >> Form validation rejects massive inputs and empty submits
- Location: tests\adversarial.spec.ts:17:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /שלח|Submit|Send/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - heading "פתיחת פנייה חדשה" [level=1] [ref=e5]
    - paragraph [ref=e6]: אנא מלאו את כל הפרטים כדי להבטיח טיפול מתאים
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: שם מלא *
        - textbox "הזן שם מלא" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: תעודת זהות *
        - textbox "הזן תעודת זהות" [ref=e15]
      - generic [ref=e16]:
        - generic [ref=e17]: מספר טלפון *
        - textbox "050-0000000" [ref=e19]
      - generic [ref=e20]:
        - generic [ref=e21]: תיאור הפנייה *
        - textbox "תאר את התקלה..." [ref=e23]
      - generic [ref=e24]:
        - generic [ref=e25]: צירוף תמונה/קובץ
        - button "Choose File" [ref=e26]
      - button "שליחת פנייה" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: שליחת פנייה
        - img
    - link "חזרה לדף הבית" [ref=e30] [cursor=pointer]:
      - /url: /
      - img
      - text: חזרה לדף הבית
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Adversarial Bounds Validations", () => {
  4  |     test("Unauthorized Access to Admin route heavily defended", async ({ page }) => {
  5  |         // Direct navigation attempt
  6  |         await page.goto("/admin");
  7  |         
  8  |         // Assert hard redirect to login due to missing roles/session
  9  |         await expect(page).toHaveURL(/\/admin-login/);
  10 |     });
  11 | 
  12 |     test("Unauthorized Access to Creator route heavily defended", async ({ page }) => {
  13 |         await page.goto("/creator");
  14 |         await expect(page).toHaveURL(/\/(admin-login|$)/);
  15 |     });
  16 | 
  17 |     test("Form validation rejects massive inputs and empty submits", async ({ page }) => {
  18 |         await page.goto("/open-ticket");
  19 |         
  20 |         // Push form raw
> 21 |         await page.getByRole("button", { name: /שלח|Submit|Send/i }).click();
     |                                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  22 | 
  23 |         // System should throw localized errors inside the UI boundaries, not crashing backend
  24 |         const errors = page.locator('.text-destructive');
  25 |         const count = await errors.count();
  26 |         expect(count).toBeGreaterThan(0); // Multiple required field errors pop
  27 |         
  28 |         // Try injecting massive string to ID
  29 |         const hugeString = "A".repeat(10000);
  30 |         await page.locator('input[type="text"]').nth(1).fill(hugeString);
  31 |         await page.locator('input[type="text"]').nth(1).blur();
  32 | 
  33 |         // ID field complains due to regex \d{5,9} limitation
  34 |         await expect(page.locator('.text-destructive').filter({ hasText: /5-9/ })).toBeVisible();
  35 |     });
  36 | });
  37 | 
```