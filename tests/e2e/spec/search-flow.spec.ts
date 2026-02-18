import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test('user can authenticate, search, and see results', async ({ page, apiKey, request, baseURL }) => {
  // Step 1 - Ingest test documents via API (setup)
  console.log('Ingesting test documents...');

  // Ingest first document
  const ingestResponse1 = await request.post(`${baseURL}/api/v1/ingest`, {
    headers: {
      'X-API-Key': apiKey,
    },
    data: {
      conversation_id: 'integ-test-conv-1',
      platform: 'chatgpt',
      content: 'Setting up Kubernetes cluster with Docker containers for microservice deployment',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Kubernetes Setup Guide',
    },
  });
  expect(ingestResponse1.status()).toBe(201);
  console.log('First document ingested successfully');

  // Ingest second document
  const ingestResponse2 = await request.post(`${baseURL}/api/v1/ingest`, {
    headers: {
      'X-API-Key': apiKey,
    },
    data: {
      conversation_id: 'integ-test-conv-2',
      platform: 'claude',
      content: 'Debugging Python FastAPI application with structured logging and error handling',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'FastAPI Debugging Notes',
    },
  });
  expect(ingestResponse2.status()).toBe(201);
  console.log('Second document ingested successfully');

  // Step 2 - Navigate and authenticate
  console.log('Navigating to application...');
  await page.goto('/');

  // Clear localStorage to ensure clean state
  await page.evaluate(() => localStorage.clear());
  console.log('Cleared localStorage');

  // Assert "Authentication Required" heading is visible
  await expect(page.getByText('Authentication Required')).toBeVisible();
  console.log('Auth prompt displayed');

  // Fill API key
  await page.getByLabel('API Key').fill(apiKey);
  console.log('Filled API key');

  // Click Connect
  await page.getByRole('button', { name: 'Connect' }).click();
  console.log('Clicked Connect button');

  // Step 3 - Verify search interface appears
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
  console.log('Search interface appeared');

  // The "Authentication Required" text should NOT be visible anymore
  await expect(page.getByText('Authentication Required')).not.toBeVisible();
  console.log('Auth prompt hidden after authentication');

  // Step 4 - Perform search and verify results
  console.log('Performing search...');

  // Set up response promise BEFORE typing (SearchBar has 300ms debounce)
  const searchResponse = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );

  // Fill search input (will auto-trigger search after debounce)
  await page.getByPlaceholder('Search your history...').fill('Kubernetes Docker');
  console.log('Typed search query');

  // Await the search response
  const response = await searchResponse;
  console.log('Search response received');

  // Parse response body and validate structure
  const data = await response.json();
  expect(data.groups).toBeDefined();
  expect(data.count).toBeGreaterThan(0);
  console.log(`Search returned ${data.count} results`);

  // Wait for result content to appear in UI
  await expect(page.getByText('Kubernetes').first()).toBeVisible({ timeout: 10000 });
  console.log('Search results displayed in UI');

  // Step 5 - Validate result card content
  // Assert that result card shows the ingested content (partial match is fine)
  await expect(page.locator('text=Kubernetes').first()).toBeVisible();
  await expect(page.locator('text=Docker').first()).toBeVisible();
  console.log('Result card content validated');

  // Assert platform metadata is displayed if visible in card
  const platformText = page.locator('text=chatgpt, text=claude').first();
  if (await platformText.count() > 0) {
    await expect(platformText).toBeVisible();
    console.log('Platform metadata displayed');
  }
});
