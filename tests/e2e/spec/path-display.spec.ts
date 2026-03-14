import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test('path display: Claude Code conversations show file path instead of Open link', async ({ page, apiKey, request }) => {
  console.log('Starting path display test...');

  // Ingest Claude Code document with Unix path
  console.log('Ingesting Claude Code document with Unix path...');
  const unixPathResponse = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'path-test-claude-code-unix',
      platform: 'claude-code',
      content: 'Claude Code session about implementing React components for a project',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'React Components',
      adapter: 'wims-watcher',
      url: '/home/user/projects/my-awesome-react-app/src',
    },
  });
  expect(unixPathResponse.status()).toBe(201);
  console.log('Unix path document ingested');

  // Ingest Claude Code document with Windows path
  console.log('Ingesting Claude Code document with Windows path...');
  const windowsPathResponse = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'path-test-claude-code-win',
      platform: 'claude-code',
      content: 'Claude Code session about Python debugging with breakpoints',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Python Debugging',
      adapter: 'wims-watcher',
      url: 'C:\\Users\\developer\\Documents\\python-project\\src',
    },
  });
  expect(windowsPathResponse.status()).toBe(201);
  console.log('Windows path document ingested');

  // Ingest ChatGPT document with regular URL
  console.log('Ingesting ChatGPT document with regular URL...');
  const chatgptResponse = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'path-test-chatgpt',
      platform: 'chatgpt',
      content: 'ChatGPT conversation about implementing React components',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'React Help',
      adapter: 'chatgpt-api',
      url: 'https://chat.openai.com/c/abc123',
    },
  });
  expect(chatgptResponse.status()).toBe(201);
  console.log('ChatGPT document ingested');

  // Navigate to app and authenticate
  console.log('Navigating to app...');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
  console.log('Authenticated successfully');

  // Search for "React components" (matches both Claude Code and ChatGPT documents)
  console.log('Searching for "React components"...');
  await page.getByPlaceholder('Search your history...').fill('React components');
  await page.waitForResponse((response) => response.url().includes('/api/v1/search') && response.status() === 200);
  console.log('Search response received');

  // Wait for results to render
  await page.waitForTimeout(500);

  // Verify Claude Code results show "Copy Path" button
  console.log('Verifying Claude Code results show Copy Path button...');
  const copyPathButtons = page.locator('button:has-text("Copy Path")');
  await expect(copyPathButtons.first()).toBeVisible();
  console.log('Copy Path button found');

  // Verify ChatGPT result shows "Open" link
  console.log('Verifying ChatGPT result shows Open link...');
  const openLink = page.getByRole('link', { name: /Open/i }).first();
  await expect(openLink).toBeVisible();
  console.log('Open link found');

  // Verify Unix path text is visible
  console.log('Verifying Unix path text is visible...');
  const unixPathText = page.getByText('/home/user/projects', { exact: false }).first();
  await expect(unixPathText).toBeVisible();
  console.log('Unix path text visible');

  console.log('Path display test completed successfully');
});

test('path display: copy button shows Copied feedback', async ({ page, apiKey, request }) => {
  console.log('Starting copy feedback test...');

  // Ingest Claude Code document with path
  console.log('Ingesting Claude Code document...');
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'copy-test-claude-code',
      platform: 'claude-code',
      content: 'Claude Code session about testing copy functionality',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Copy Test',
      adapter: 'wims-watcher',
      url: '/home/user/test-project/src/components/TestComponent.tsx',
    },
  });
  expect(response.status()).toBe(201);
  console.log('Document ingested');

  // Navigate and authenticate
  console.log('Navigating to app...');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
  console.log('Authenticated successfully');

  // Search for the document
  console.log('Searching for document...');
  await page.getByPlaceholder('Search your history...').fill('copy functionality');
  await page.waitForResponse((response) => response.url().includes('/api/v1/search') && response.status() === 200);
  await page.waitForTimeout(500);

  // Grant clipboard permissions
  console.log('Granting clipboard permissions...');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // Click the Copy Path button
  console.log('Clicking Copy Path button...');
  const copyButton = page.locator('button:has-text("Copy Path")').first();
  await copyButton.click();

  // Verify "Copied!" text appears
  console.log('Verifying Copied! text appears...');
  await expect(page.getByText('Copied!')).toBeVisible();
  console.log('Copied! text visible');

  // Verify it disappears after ~2 seconds
  console.log('Waiting for Copied! text to disappear...');
  await expect(page.getByText('Copied!')).not.toBeVisible({ timeout: 3000 });
  console.log('Copied! text disappeared');

  // Verify "Copy Path" is visible again
  console.log('Verifying Copy Path button is back...');
  await expect(page.locator('button:has-text("Copy Path")').first()).toBeVisible();
  console.log('Copy Path button visible again');

  console.log('Copy feedback test completed successfully');
});

test('path display: long paths are truncated with ellipsis', async ({ page, apiKey, request }) => {
  console.log('Starting long path truncation test...');

  // Ingest Claude Code document with very long path
  console.log('Ingesting document with long path...');
  const longPath = '/home/user/very/deeply/nested/directory/structure/with/many/levels/of/nesting/project-name/src/components/features';
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'truncate-test-claude-code',
      platform: 'claude-code',
      content: 'Claude Code session with a very long path to test truncation',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Long Path Test',
      adapter: 'wims-watcher',
      url: longPath,
    },
  });
  expect(response.status()).toBe(201);
  console.log('Long path document ingested');

  // Navigate and authenticate
  console.log('Navigating to app...');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
  console.log('Authenticated successfully');

  // Search for the document
  console.log('Searching for document...');
  await page.getByPlaceholder('Search your history...').fill('long path');
  await page.waitForResponse((response) => response.url().includes('/api/v1/search') && response.status() === 200);
  await page.waitForTimeout(500);

  // Verify truncated path contains ellipsis
  console.log('Verifying path is truncated with ellipsis...');
  const codeElement = page.locator('code:has-text("...")').first();
  await expect(codeElement).toBeVisible();
  console.log('Ellipsis found in truncated path');

  // Verify the code element has title attribute with full path
  console.log('Verifying full path in title attribute...');
  const titleAttr = await codeElement.getAttribute('title');
  expect(titleAttr).toBe(longPath);
  console.log('Full path found in title attribute');

  console.log('Long path truncation test completed successfully');
});
