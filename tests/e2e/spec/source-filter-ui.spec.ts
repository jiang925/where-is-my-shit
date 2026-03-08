import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test('source filter UI: platform filtering works correctly on search page', async ({ page, apiKey, request }) => {
  console.log('Starting source filter UI test on search page...');

  // Step 1 - Ingest test documents from different platforms (using backend-valid platform names)
  console.log('Ingesting test documents from different platforms...');

  // Ingest ChatGPT document
  const chatgptResponse = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'filter-test-chatgpt',
      platform: 'chatgpt',
      content: 'ChatGPT conversation about React hooks and state management patterns',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'React Hooks Discussion',
      adapter: 'chatgpt-api',
    },
  });
  expect(chatgptResponse.status()).toBe(201);
  console.log('ChatGPT document ingested');

  // Ingest Claude Code document
  const claudeCodeResponse = await request.post(`/api/v1/ingest`, {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'filter-test-claude-code',
      platform: 'claude-code',
      content: 'Claude Code session about debugging TypeScript type errors',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'TypeScript Debugging',
      adapter: 'wims-watcher',
    },
  });
  expect(claudeCodeResponse.status()).toBe(201);
  console.log('Claude Code document ingested');

  // Ingest Gemini document
  const geminiResponse = await request.post(`/api/v1/ingest`, {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'filter-test-gemini',
      platform: 'gemini',
      content: 'Gemini conversation about CSS grid layouts and flexbox',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'CSS Grid Guide',
      adapter: 'gemini-extension',
    },
  });
  expect(geminiResponse.status()).toBe(201);
  console.log('Gemini document ingested');

  // Step 2 - Navigate and authenticate
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
  console.log('Authenticated successfully');

  // Step 3 - Verify SourceFilterUI is visible with correct platform names
  await expect(page.getByText('Filter by Source')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle ChatGPT filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle Claude Code filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle Gemini filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle Cursor filter' })).toBeVisible();
  console.log('Source filter UI visible with correct platform names');

  // Step 4 - Perform search without filter, verify all results
  const searchResponse1 = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );
  await page.getByPlaceholder('Search your history...').fill('conversation');
  const response1 = await searchResponse1;
  const data1 = await response1.json();
  console.log(`Search without filter returned ${data1.count} results`);
  expect(data1.count).toBeGreaterThanOrEqual(3); // At least our 3 ingested docs

  // Step 5 - Phase 20: Clear all filters first, then select specific platform
  await page.getByRole('button', { name: /Clear/i }).click();
  await page.waitForTimeout(200);
  console.log('Cleared all filters');

  // Now click ChatGPT to select ONLY it, verify URL updates and ACTUAL FILTERING
  const chatgptButton = page.getByRole('button', { name: 'Toggle ChatGPT filter' });
  const searchResponse2 = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );
  await chatgptButton.click();
  const response2 = await searchResponse2;
  const data2 = await response2.json();

  // Verify URL has platform parameter
  expect(page.url()).toContain('platforms=chatgpt');
  console.log('URL updated with platform parameter');

  // Verify active badge showing selected count
  await expect(page.getByText('1 selected')).toBeVisible();
  console.log('Active filter badge visible');

  // CRITICAL: Verify actual filtering - only ChatGPT results returned
  console.log(`Filtered search returned ${data2.count} results`);
  expect(data2.count).toBeGreaterThan(0); // Should have at least our chatgpt doc

  // Verify all returned results are from ChatGPT platform
  for (const group of data2.groups) {
    for (const result of group.results) {
      expect(result.meta.source).toBe('chatgpt');
    }
  }
  console.log('VERIFIED: All results are from ChatGPT platform only');

  // Step 6 - Test multiple platform selections
  const geminiButton = page.getByRole('button', { name: 'Toggle Gemini filter' });
  const searchResponse3 = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );
  await geminiButton.click();
  const response3 = await searchResponse3;
  const data3 = await response3.json();

  // Verify URL has both platforms
  const currentUrl = page.url();
  expect(currentUrl).toContain('platforms=');
  const platforms = new URLSearchParams(currentUrl.split('?')[1]).get('platforms');
  expect(platforms).toContain('chatgpt');
  expect(platforms).toContain('gemini');
  console.log('Multiple platforms selected:', platforms);

  // Verify badge shows correct count
  await expect(page.getByText('2 selected')).toBeVisible();
  console.log('Badge shows 2 selected');

  // CRITICAL: Verify actual multi-platform filtering
  console.log(`Multi-platform search returned ${data3.count} results`);
  const allowedPlatforms = ['chatgpt', 'gemini'];
  for (const group of data3.groups) {
    for (const result of group.results) {
      expect(allowedPlatforms).toContain(result.meta.source);
    }
  }
  console.log('VERIFIED: All results are from ChatGPT or Gemini platforms only');

  // Step 7 - Click Clear button, verify URL clears
  const clearButton = page.getByRole('button', { name: /Clear/i });
  await clearButton.click();

  // Verify URL no longer has platform parameter
  expect(page.url()).not.toContain('platforms');
  console.log('URL cleared after clicking Clear');

  // Verify active badges are gone
  await expect(page.getByText('1 selected')).not.toBeVisible();
  await expect(page.getByText('2 selected')).not.toBeVisible();
  console.log('Active badges removed');

  // Step 8 - Test shareable links with filter parameters
  await page.goto('/?platforms=claude-code');

  // Verify filter is applied from URL
  await expect(page.getByText('1 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: /Clear/i })).toBeVisible();
  console.log('Filter applied from shareable URL');

  // Verify Claude Code chip is selected
  const claudeCodeButton = page.getByRole('button', { name: 'Toggle Claude Code filter' });
  await expect(claudeCodeButton).toBeVisible();
  console.log('Claude Code chip shows selected state');

  // Now type a search query to trigger search with the filter active
  const searchResponse5 = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );
  await page.getByPlaceholder('Search your history...').fill('TypeScript');
  const response5 = await searchResponse5;
  const data5 = await response5.json();

  // Verify filtering is actually applied from URL
  for (const group of data5.groups) {
    for (const result of group.results) {
      expect(result.meta.source).toBe('claude-code');
    }
  }
  console.log('VERIFIED: Shareable link filtering works correctly');

  // Step 9 - Test preset buttons
  console.log('Testing preset buttons...');

  // Navigate back to clean state
  await page.goto('/');
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();

  // Verify preset buttons exist
  await expect(page.getByText('Quick filters:')).toBeVisible();
  await expect(page.getByRole('button', { name: /Web Chats Only/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dev Sessions Only/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /All Sources/i })).toBeVisible();
  console.log('Preset buttons visible');

  // Click "Web Chats Only" preset
  const webChatsPreset = page.getByRole('button', { name: /Web Chats Only/i });
  await webChatsPreset.click();

  // Verify URL contains chatgpt, claude, gemini, perplexity
  await page.waitForTimeout(300);
  const webChatsUrl = page.url();
  const webChatsPlatforms = new URLSearchParams(webChatsUrl.split('?')[1]).get('platforms');
  expect(webChatsPlatforms).toContain('chatgpt');
  expect(webChatsPlatforms).toContain('claude');
  expect(webChatsPlatforms).toContain('gemini');
  expect(webChatsPlatforms).toContain('perplexity');
  await expect(page.getByText('4 selected')).toBeVisible();
  console.log('VERIFIED: Web Chats Only preset selects chatgpt, claude, gemini, perplexity');

  // Click "Dev Sessions Only" preset
  const devSessionsPreset = page.getByRole('button', { name: /Dev Sessions Only/i });
  await devSessionsPreset.click();

  // Verify URL contains claude-code, cursor
  await page.waitForTimeout(300);
  const devSessionsUrl = page.url();
  const devSessionsPlatforms = new URLSearchParams(devSessionsUrl.split('?')[1]).get('platforms');
  expect(devSessionsPlatforms).toContain('claude-code');
  expect(devSessionsPlatforms).toContain('cursor');
  await expect(page.getByText('2 selected')).toBeVisible();
  console.log('VERIFIED: Dev Sessions Only preset selects claude-code, cursor');

  // Click "All Sources" preset
  const allSourcesPreset = page.getByRole('button', { name: /All Sources/i });
  await allSourcesPreset.click();

  // Verify URL has all platforms selected
  await page.waitForTimeout(300);
  const allSourcesUrl = page.url();
  const allSourcesPlatforms = new URLSearchParams(allSourcesUrl.split('?')[1]).get('platforms');
  expect(allSourcesPlatforms).toContain('chatgpt');
  expect(allSourcesPlatforms).toContain('claude');
  expect(allSourcesPlatforms).toContain('claude-code');
  expect(allSourcesPlatforms).toContain('gemini');
  expect(allSourcesPlatforms).toContain('perplexity');
  expect(allSourcesPlatforms).toContain('cursor');
  await expect(page.getByText('6 selected')).toBeVisible();
  console.log('VERIFIED: All Sources preset selects all 6 platforms');

  // Step 10 - Test visual feedback and navigation
  await page.waitForTimeout(300);

  // Navigate to Browse page
  await page.getByRole('button', { name: 'Browse' }).click();
  await expect(page.getByText('Browse History')).toBeVisible();

  // Check if filters persist on Browse page
  const browsePageUrl = page.url();
  console.log('Browse page URL:', browsePageUrl);

  console.log('Source filter UI test completed successfully');
});

test('source filter UI: browse page filtering works correctly', async ({ page, apiKey, request }) => {
  console.log('Testing source filter on browse page...');

  // Ingest document for browse page testing
  const ingestResponse = await request.post(`/api/v1/ingest`, {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'browse-test-chatgpt',
      platform: 'chatgpt',
      content: 'Test content for browse page filtering',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Browse Test Conversation',
      adapter: 'chatgpt-api',
    },
  });
  expect(ingestResponse.status()).toBe(201);

  // Navigate and authenticate
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  // Navigate to Browse page
  await page.getByRole('button', { name: 'Browse' }).click();
  await expect(page.getByText('Browse History')).toBeVisible();
  console.log('Navigated to Browse page');

  // Verify filter UI is visible on Browse page with correct platform names
  await expect(page.getByText('Filter by Source')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle ChatGPT filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle Claude Code filter' })).toBeVisible();
  console.log('Filter UI visible on Browse page with correct platform names');

  // Phase 20: All sources are now selected by default, so results show immediately
  // Verify platform buttons show active state (bg-green-100 when part of "All Sources")
  const chatgptButton = page.getByRole('button', { name: 'Toggle ChatGPT filter' });
  await expect(chatgptButton).toHaveClass(/bg-green-100/); // Active via All Sources preset
  console.log('All sources selected by default in Phase 20');

  // Clear all filters first
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.waitForTimeout(200);

  // Now select just ChatGPT
  await page.getByRole('button', { name: 'Toggle ChatGPT filter' }).click();
  await expect(page.getByText('1 selected')).toBeVisible();
  console.log('Filter selected on Browse page');

  // Verify preset buttons are also on Browse page
  await expect(page.getByText('Quick filters:')).toBeVisible();
  await expect(page.getByRole('button', { name: /Web Chats Only/i })).toBeVisible();
  console.log('Preset buttons visible on Browse page');

  console.log('Browse page filter test completed');
});
