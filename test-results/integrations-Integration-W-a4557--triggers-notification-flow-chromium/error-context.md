# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integrations.spec.ts >> Integration Workflows >> Ticket Submission triggers notification flow
- Location: tests\integrations.spec.ts:4:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h2')
Expected pattern: /פנייה התקבלה|Success|תודה/i
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h2')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list [ref=e4]:
      - status [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e7]: שגיאה
          - generic [ref=e8]: אירעה שגיאה בשליחת הפנייה. נסה שוב.
        - button [ref=e9] [cursor=pointer]:
          - img [ref=e10]
  - region "Notifications alt+T"
  - generic [ref=e15]:
    - heading "פתיחת פנייה חדשה" [level=1] [ref=e16]
    - paragraph [ref=e17]: אנא מלאו את כל הפרטים כדי להבטיח טיפול מתאים
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: שם מלא *
        - generic [ref=e21]:
          - textbox "הזן שם מלא" [ref=e22]: ישראל ישראלי
          - img [ref=e23]
      - generic [ref=e26]:
        - generic [ref=e27]: מדור *
        - generic [ref=e28]:
          - combobox [ref=e29]:
            - option "בחר מדור" [disabled]
            - option "גיוס" [selected]
            - option "תו״מ"
            - option "בקרה"
            - option "ברה״ן"
            - option "רפואי"
            - option "פסיכוטכני"
            - option "פרט"
            - option "חרדים"
            - option "קהילה"
            - option "שלוחת חזון"
            - option "מל״ג / סמל״ג"
          - img
      - generic [ref=e30]:
        - generic [ref=e31]: מספר טלפון *
        - generic [ref=e32]:
          - textbox "050-0000000" [ref=e33]: "0501234567"
          - img
      - generic [ref=e34]:
        - generic [ref=e35]: תיאור הפנייה *
        - textbox "תאר את התקלה..." [ref=e37]: פניית בדיקה באמצעות מערכת אוטומטית.
      - paragraph [ref=e38]: המידע מוגן ולא יועבר לצד שלישי. משמש אך ורק לצורך טיפול בפנייה.
      - button "שולח..." [disabled]:
        - generic: שולח...
        - img
    - link "חזרה לדף הבית" [ref=e40] [cursor=pointer]:
      - /url: /
      - img
      - text: חזרה לדף הבית
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Integration Workflows", () => {
  4  |     test("Ticket Submission triggers notification flow", async ({ page }) => {
  5  |         // 1. Visit Open Ticket Page
  6  |         await page.goto("/open-ticket");
  7  | 
  8  |         // 2. Fill Ticket Details
  9  |         await page.locator('input[type="text"]').nth(0).fill("ישראל ישראלי");
  10 |         await page.locator('select').selectOption('גיוס');
  11 |         await page.locator('input[type="tel"]').fill("0501234567");
  12 |         await page.locator('textarea').fill("פניית בדיקה באמצעות מערכת אוטומטית.");
  13 | 
  14 |         // 3. Submit Ticket
  15 |         await page.locator('button[type="submit"]').click();
  16 | 
  17 |         // 4. Verify Success Message
  18 |         // Based on OpenTicket.tsx: text comes from msg_ticket_success_title
> 19 |         await expect(page.locator('h2')).toContainText(/פנייה התקבלה|Success|תודה/i);
     |                                          ^ Error: expect(locator).toContainText(expected) failed
  20 | 
  21 |         // 5. Check if Ticket number is displayed
  22 |         const ticketNumber = await page.locator('.font-mono-ticket').textContent();
  23 |         expect(ticketNumber).toMatch(/TK-[\d]+/);
  24 |         console.log(`Generated Ticket Number: ${ticketNumber}`);
  25 |     });
  26 | 
  27 |     test("Site Content Backup navigation", async ({ page }) => {
  28 |         // Same as in Creator tests, ensure Creator can initiate data jobs
  29 |         // 1. Visit Creator Panel (assuming login session if tests are ordered, but each test is isolated)
  30 |         // Login code skipped here for brevity or inherited via test.use
  31 |     });
  32 | });
  33 | 
```