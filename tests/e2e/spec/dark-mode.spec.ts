import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

// Helper: authenticate and navigate to a page
async function authenticate(page: any, apiKey: string, path: string = '/') {
  await page.goto('/');
  await page.evaluate((key: string) => localStorage.setItem('wims_api_key', key), apiKey);
  await page.goto(path);
}

test.describe('Dark Mode / Theme Toggle', () => {

  test('theme toggle button is visible and has aria-label', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // The toggle button should exist with aria-label="Toggle theme"
    const themeButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(themeButton).toBeVisible();
  });

  test('theme toggle cycles system -> light -> dark -> system', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });

    // Default theme is "system" — button title should say "System"
    await expect(themeButton).toHaveAttribute('title', 'Theme: System');

    // Click once: system -> light
    await themeButton.click();
    await expect(themeButton).toHaveAttribute('title', 'Theme: Light');

    // Verify localStorage was updated to "light"
    const storedAfterLight = await page.evaluate(() => localStorage.getItem('wims_theme'));
    expect(storedAfterLight).toBe('light');

    // In light mode, <html> should NOT have the "dark" class
    const htmlClassLight = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(htmlClassLight).toBe(false);

    // Click again: light -> dark
    await themeButton.click();
    await expect(themeButton).toHaveAttribute('title', 'Theme: Dark');

    // Verify localStorage was updated to "dark"
    const storedAfterDark = await page.evaluate(() => localStorage.getItem('wims_theme'));
    expect(storedAfterDark).toBe('dark');

    // In dark mode, <html> SHOULD have the "dark" class
    const htmlClassDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(htmlClassDark).toBe(true);

    // Click again: dark -> system
    await themeButton.click();
    await expect(themeButton).toHaveAttribute('title', 'Theme: System');

    // Verify localStorage was updated to "system"
    const storedAfterSystem = await page.evaluate(() => localStorage.getItem('wims_theme'));
    expect(storedAfterSystem).toBe('system');
  });

  test('dark class is applied to html element in dark mode', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });

    // Cycle to dark mode: system -> light -> dark
    await themeButton.click(); // light
    await themeButton.click(); // dark

    // Verify <html> has class="dark"
    const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkClass).toBe(true);

    // Verify the dark mode container class is present on the page
    const darkContainer = page.locator('.dark\\:bg-gray-900').first();
    await expect(darkContainer).toBeVisible();
  });

  test('theme persists after page reload', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });

    // Set theme to dark: system -> light -> dark
    await themeButton.click(); // light
    await themeButton.click(); // dark

    // Confirm dark mode is active
    await expect(themeButton).toHaveAttribute('title', 'Theme: Dark');
    const hasDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkBefore).toBe(true);

    // Reload the page
    await page.reload();
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // After reload, dark mode should still be active
    const hasDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkAfter).toBe(true);

    // Button title should still say "Dark"
    const reloadedButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(reloadedButton).toHaveAttribute('title', 'Theme: Dark');

    // localStorage should still have "dark"
    const stored = await page.evaluate(() => localStorage.getItem('wims_theme'));
    expect(stored).toBe('dark');
  });
});
