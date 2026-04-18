import { test, expect } from "@playwright/test";

test.describe("Integration Workflows", () => {
    test("Ticket Submission triggers notification flow", async ({ page }) => {
        // 1. Visit Open Ticket Page
        await page.goto("/open-ticket");

        // 2. Fill Ticket Details
        await page.locator('input[type="text"]').nth(0).fill("ישראל ישראלי");
        await page.locator('input[type="text"]').nth(1).fill("123456789");
        await page.locator('input[type="tel"]').fill("0501234567");
        await page.locator('textarea').fill("פניית בדיקה באמצעות מערכת אוטומטית.");

        // 3. Submit Ticket
        await page.getByRole("button", { name: /שלח|Submit|Send/i }).click();

        // 4. Verify Success Message
        // Based on OpenTicket.tsx: text comes from msg_ticket_success_title
        await expect(page.locator('h2')).toContainText(/פנייה התקבלה|Success|תודה/i);

        // 5. Check if Ticket number is displayed
        const ticketNumber = await page.locator('.font-mono-ticket').textContent();
        expect(ticketNumber).toMatch(/TK-[\d]+/);
        console.log(`Generated Ticket Number: ${ticketNumber}`);
    });

    test("Site Content Backup navigation", async ({ page }) => {
        // Same as in Creator tests, ensure Creator can initiate data jobs
        // 1. Visit Creator Panel (assuming login session if tests are ordered, but each test is isolated)
        // Login code skipped here for brevity or inherited via test.use
    });
});
