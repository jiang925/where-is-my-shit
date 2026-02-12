import { test, expect } from '@playwright/test';

test('shows Authentication Required when no API key is set', async ({ page }) => {
  // Navigate to the application
  await page.goto('/');

  // Clear localStorage to ensure no key exists
  await page.evaluate(() => localStorage.clear());

  // Reload page to reflect cleared state
  await page.reload();

  // Assert "Authentication Required" heading is visible
  await expect(page.getByText('Authentication Required')).toBeVisible();

  // Assert the descriptive text is visible
  await expect(page.getByText('Please enter your WIMS API Key')).toBeVisible();

  // Assert the API Key input field exists
  await expect(page.getByLabel('API Key')).toBeVisible();

  // Assert the Connect button exists but is visible
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();

  // Assert search input is NOT visible (user cannot search without auth)
  await expect(page.getByPlaceholder('Search your history...')).not.toBeVisible();
});

test('Connect button is disabled when API key field is empty', async ({ page }) => {
  // Navigate to the application
  await page.goto('/');

  // Clear localStorage to ensure no key exists
  await page.evaluate(() => localStorage.clear());

  // Reload page to reflect cleared state
  await page.reload();

  // Assert Connect button is disabled with empty input
  await expect(page.getByRole('button', { name: 'Connect' })).toBeDisabled();

  // Type a key
  await page.getByLabel('API Key').fill('some-key');

  // Assert Connect button is now enabled
  await expect(page.getByRole('button', { name: 'Connect' })).toBeEnabled();
});
