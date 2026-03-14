import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

async function authenticate(page: any, apiKey: string, path: string = '/') {
  await page.goto('/');
  await page.evaluate((key: string) => localStorage.setItem('wims_api_key', key), apiKey);
  await page.goto(path);
}

test.describe('Settings Page', () => {

  test('settings page is accessible', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/settings');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
  });

  test('theme selector shows current theme', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/settings');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Verify all three theme selector buttons are visible
    const systemButton = page.locator('button:has-text("System")');
    const lightButton = page.locator('button:has-text("Light")');
    const darkButton = page.locator('button:has-text("Dark")');

    await expect(systemButton).toBeVisible();
    await expect(lightButton).toBeVisible();
    await expect(darkButton).toBeVisible();

    // Click "Dark" and verify localStorage is updated
    await darkButton.click();

    const storedTheme = await page.evaluate(() => localStorage.getItem('wims_theme'));
    expect(storedTheme).toBe('dark');
  });

  test('view mode selector works', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/settings');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Verify view mode buttons are visible
    const cardButton = page.locator('button:has-text("Card View")');
    const compactButton = page.locator('button:has-text("Compact View")');

    await expect(cardButton).toBeVisible();
    await expect(compactButton).toBeVisible();

    // Click "Compact View" and verify localStorage is updated
    await compactButton.click();

    const storedViewMode = await page.evaluate(() => localStorage.getItem('wims_view_mode'));
    expect(storedViewMode).toBe('compact');
  });

  test('clear local data works', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/settings');

    // Set some localStorage items before clearing
    await page.evaluate(() => {
      localStorage.setItem('wims_bookmarks', JSON.stringify(['bookmark1']));
      localStorage.setItem('wims_notes', JSON.stringify({ note1: 'test' }));
      localStorage.setItem('wims_search_history', JSON.stringify(['query1']));
    });

    // Verify the items were set
    const bookmarksBefore = await page.evaluate(() => localStorage.getItem('wims_bookmarks'));
    expect(bookmarksBefore).not.toBeNull();

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click the "Clear" button
    const clearButton = page.locator('button:has-text("Clear")');
    await clearButton.click();

    // Verify the localStorage items were cleared
    const bookmarksAfter = await page.evaluate(() => localStorage.getItem('wims_bookmarks'));
    const notesAfter = await page.evaluate(() => localStorage.getItem('wims_notes'));
    const historyAfter = await page.evaluate(() => localStorage.getItem('wims_search_history'));

    expect(bookmarksAfter).toBeNull();
    expect(notesAfter).toBeNull();
    expect(historyAfter).toBeNull();
  });

  test('settings nav button visible in header', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/');

    // Wait for the search page to load
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Look for the Settings navigation button by aria-label
    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await expect(settingsButton).toBeVisible();

    // Click the Settings button and verify navigation to /settings
    await settingsButton.click();

    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
  });

});
