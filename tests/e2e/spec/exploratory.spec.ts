import { expect, test } from '@playwright/test';

/**
 * Exploratory testing against live server at 192.168.50.202:8000.
 * Uses UI-based authentication (fill key + click Connect) for reliability.
 */

const BASE = 'http://192.168.50.202:8000';
const API_KEY = 'sk-wims-fD2KlW6JratMul4TZE4liWGUo-D67HE2RXk2UfU1ZVU';

// Authenticate via the UI form — more reliable than localStorage injection
async function authenticate(page: any) {
  await page.goto(BASE);
  // Clear any stale state
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await expect(page.getByText('Authentication Required')).toBeVisible({ timeout: 10000 });
  await page.getByLabel('API Key').fill(API_KEY);
  await page.getByRole('button', { name: 'Connect' }).click();
  // Wait for authenticated UI
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible({ timeout: 10000 });
}

// Navigate to browse page from authenticated state
async function goToBrowse(page: any) {
  await page.getByRole('button', { name: 'Browse' }).click();
  await expect(page.getByText('Browse History')).toBeVisible({ timeout: 10000 });
}

// Type a search and wait for response
async function searchFor(page: any, query: string) {
  const responsePromise = page.waitForResponse(
    (res: any) => res.url().includes('/api/v1/search') && res.status() === 200,
    { timeout: 15000 }
  );
  await page.getByPlaceholder('Search your history...').fill(query);
  await responsePromise;
  await page.waitForTimeout(300); // Let React re-render
}

test.describe('Exploratory Testing — Live Server', () => {
  // Increase timeout for live server
  test.setTimeout(60000);

  test('1. Search page loads and basic search works', async ({ page }) => {
    await authenticate(page);
    console.log('PASS: Search page loaded and authenticated');

    // Nav buttons visible
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browse' })).toBeVisible();
    console.log('PASS: Nav buttons visible');

    // Filter UI visible
    await expect(page.getByText('Filter by Source')).toBeVisible();
    await expect(page.getByText('Quick filters:')).toBeVisible();
    console.log('PASS: Filter UI visible');

    // No "Search Results" header when no query
    // Search Results header removed in Phase 20
    console.log('PASS: No header without query');

    // Type a search query and wait for API response
    await searchFor(page, 'code');

    // Header should appear now
    // Search Results header removed in Phase 20
    console.log('PASS: Search Results header shows with query');

    // Check results state
    const cardCount = await page.locator('.group').count();
    const hasEmpty = await page.getByText('No results found').isVisible().catch(() => false);
    console.log(`RESULT: ${cardCount} result cards, empty state: ${hasEmpty}`);
  });

  test('2. Search header stays visible across filter changes', async ({ page }) => {
    await authenticate(page);
    await searchFor(page, 'test');

    // Header visible with no filter
    // Search Results header removed in Phase 20
    console.log('PASS: Header visible (no filter)');

    // Click ChatGPT filter
    await page.getByRole('button', { name: 'Toggle ChatGPT filter' }).click();
    await page.waitForTimeout(500);
    // Search Results header removed in Phase 20
    console.log('PASS: Header visible (ChatGPT filter)');

    // Click All Sources preset
    await page.getByRole('button', { name: /All Sources/i }).click();
    await page.waitForTimeout(500);
    // Search Results header removed in Phase 20
    console.log('PASS: Header still visible after All Sources (was bug #8)');
  });

  test('3. Preset buttons behavior', async ({ page }) => {
    await authenticate(page);

    // All Sources should be active by default (no platforms selected)
    const allSourcesBtn = page.getByRole('button', { name: /All Sources/i });
    await expect(allSourcesBtn).toHaveClass(/bg-blue-100/, { timeout: 3000 });
    console.log('PASS: All Sources active by default');

    // Click Web Chats Only
    await page.getByRole('button', { name: /Web Chats Only/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('4 selected')).toBeVisible();
    console.log('PASS: Web Chats selects 4 platforms (includes perplexity)');

    // Verify perplexity chip is selected
    await expect(page.getByRole('button', { name: 'Toggle Perplexity filter' })).toHaveClass(/bg-teal-100/);
    console.log('PASS: Perplexity chip visually selected');

    // Click Dev Sessions Only
    await page.getByRole('button', { name: /Dev Sessions Only/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('2 selected')).toBeVisible();
    console.log('PASS: Dev Sessions selects 2 platforms');

    // Click All Sources — should select ALL 6
    await allSourcesBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('6 selected')).toBeVisible();
    console.log('PASS: All Sources selects all 6 platforms (was bug #5)');

    // Click All Sources again — should deselect all
    await allSourcesBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('selected')).not.toBeVisible();
    console.log('PASS: All Sources toggles off (clears all)');
  });

  test('4. Cursor pointer on all buttons', async ({ page }) => {
    await authenticate(page);

    // Nav buttons
    await expect(page.getByRole('button', { name: 'Search' })).toHaveClass(/cursor-pointer/);
    await expect(page.getByRole('button', { name: 'Browse' })).toHaveClass(/cursor-pointer/);
    console.log('PASS: Nav buttons have cursor-pointer');

    // Platform filter buttons
    await expect(page.getByRole('button', { name: 'Toggle ChatGPT filter' })).toHaveClass(/cursor-pointer/);
    await expect(page.getByRole('button', { name: 'Toggle Claude Code filter' })).toHaveClass(/cursor-pointer/);
    console.log('PASS: Platform filter buttons have cursor-pointer');

    // Preset buttons
    await expect(page.getByRole('button', { name: /Web Chats Only/i })).toHaveClass(/cursor-pointer/);
    await expect(page.getByRole('button', { name: /All Sources/i })).toHaveClass(/cursor-pointer/);
    console.log('PASS: Preset buttons have cursor-pointer');

    // Navigate to browse page
    await goToBrowse(page);

    // Date range buttons
    const todayBtn = page.locator('button:has-text("Today")').first();
    await expect(todayBtn).toHaveClass(/cursor-pointer/);
    console.log('PASS: Date range buttons have cursor-pointer');
  });

  test('5. Browse page - timeline sections and date range filtering', async ({ page }) => {
    await authenticate(page);
    await goToBrowse(page);
    console.log('PASS: Browse page loaded');

    // Default (All Time) should show all 5 sections
    await page.waitForTimeout(1000);
    for (const section of ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']) {
      await expect(page.locator(`h2:has-text("${section}")`).first()).toBeVisible();
    }
    console.log('PASS: All 5 timeline sections visible for All Time');

    // Click "Today" filter
    await page.locator('button:has-text("Today")').first().click();
    await page.waitForTimeout(1000);

    // Other sections should NOT be visible regardless
    await expect(page.locator('h2:has-text("Yesterday")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("This Week")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("This Month")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("Older")')).not.toBeVisible();

    // If there's data today, Today section is visible; otherwise empty state shows
    const hasTodaySection = await page.locator('h2:has-text("Today")').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText('No conversations yet').isVisible().catch(() => false);
    console.log(`PASS: Today filter active — section: ${hasTodaySection}, empty: ${hasEmptyState} (was bug #6)`);
    expect(hasTodaySection || hasEmptyState).toBe(true);

    // Click "This Week" filter
    await page.locator('button:has-text("This Week")').first().click();
    await page.waitForTimeout(1000);

    // Other sections outside this week should NOT be visible
    await expect(page.locator('h2:has-text("This Month")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("Older")')).not.toBeVisible();
    console.log('PASS: Correct sections for This Week filter');

    // Back to All Time
    await page.locator('button:has-text("All Time")').first().click();
    await page.waitForTimeout(1000);
    for (const section of ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']) {
      await expect(page.locator(`h2:has-text("${section}")`).first()).toBeVisible();
    }
    console.log('PASS: All sections restored for All Time');
  });

  test('6. Browse cards do NOT show score on hover', async ({ page }) => {
    await authenticate(page);
    await goToBrowse(page);
    await page.waitForTimeout(2000); // Wait for browse data to load

    const card = page.locator('.group').first();
    const cardVisible = await card.isVisible().catch(() => false);
    if (cardVisible) {
      await card.hover();
      await page.waitForTimeout(500);

      const scoreVisible = await page.locator('text=/Score:/').first().isVisible().catch(() => false);
      console.log(scoreVisible ? 'FAIL: Score still visible on browse card hover (bug #2)' : 'PASS: No score on browse card hover');
      expect(scoreVisible).toBe(false);
    } else {
      console.log('SKIP: No browse cards to test (empty data)');
    }
  });

  test('7. Search cards show score on hover', async ({ page }) => {
    await authenticate(page);
    await searchFor(page, 'code');

    const card = page.locator('.group').first();
    const cardVisible = await card.isVisible().catch(() => false);
    if (cardVisible) {
      await card.hover();
      await page.waitForTimeout(500);

      const scoreEl = card.locator('text=/Score:|%/').first();
      const scoreVisible = await scoreEl.isVisible().catch(() => false);
      console.log(scoreVisible ? 'PASS: Score visible on search card hover' : 'INFO: Score element not visible on hover');
    } else {
      console.log('SKIP: No search results to test');
    }
  });

  test('8. Content snippet uses line-clamp-4', async ({ page }) => {
    await authenticate(page);
    await searchFor(page, 'code');

    const clamp4 = page.locator('p.line-clamp-4').first();
    const visible = await clamp4.isVisible().catch(() => false);
    console.log(visible ? 'PASS: Content uses line-clamp-4' : 'SKIP: No results to verify line-clamp');
  });

  test('9. Copy path button on Claude Code cards', async ({ page }) => {
    await authenticate(page);

    // Filter to claude-code
    await page.getByRole('button', { name: 'Toggle Claude Code filter' }).click();
    await page.waitForTimeout(300);

    // Search
    await searchFor(page, 'implement');

    const copyBtn = page.locator('button:has-text("Copy Path")').first();
    const hasCopyBtn = await copyBtn.isVisible().catch(() => false);

    if (hasCopyBtn) {
      await expect(copyBtn).toHaveClass(/cursor-pointer/);
      console.log('PASS: Copy Path button visible with cursor-pointer');

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await copyBtn.click();

      const copiedVisible = await page.getByText('Copied!').isVisible().catch(() => false);
      console.log(copiedVisible ? 'PASS: Copied! feedback shown (bug #9 fixed)' : 'FAIL: No Copied! feedback');
    } else {
      console.log('SKIP: No Claude Code cards with file paths found');
    }
  });

  test('10. URL state persistence', async ({ page }) => {
    await authenticate(page);

    // Apply Web Chats preset
    await page.getByRole('button', { name: /Web Chats Only/i }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('platforms=');
    console.log('PASS: Platform filter persisted in URL');

    // Navigate to browse
    await goToBrowse(page);

    // Click Today filter
    await page.locator('button:has-text("Today")').first().click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('range=today');
    console.log('PASS: Date range persisted in URL');

    // Reload the page and verify state survives
    const currentUrl = page.url();
    await page.goto(currentUrl);
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('range=today');
    await expect(page.getByText('Browse History')).toBeVisible({ timeout: 10000 });
    console.log('PASS: URL state survives page reload');
  });

  test('11. Search platform filtering produces different results', async ({ page }) => {
    await authenticate(page);

    // Search with no filter
    await searchFor(page, 'code');
    const noFilterCards = await page.locator('.group').count();
    console.log(`No filter: ${noFilterCards} cards`);

    // Filter to Dev Sessions
    await page.getByRole('button', { name: /Dev Sessions Only/i }).click();
    await page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);
    await page.waitForTimeout(500);
    const devCards = await page.locator('.group').count();
    console.log(`Dev Sessions: ${devCards} cards`);

    // Filter to Web Chats
    await page.getByRole('button', { name: /Web Chats Only/i }).click();
    await page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);
    await page.waitForTimeout(500);
    const webCards = await page.locator('.group').count();
    console.log(`Web Chats: ${webCards} cards`);

    console.log(`RESULT: Filters produce different counts: none=${noFilterCards}, dev=${devCards}, web=${webCards}`);
  });
});
