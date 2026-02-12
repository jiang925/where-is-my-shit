import { test as base } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestMessage {
  conversation_id: string;
  message: string;
  role: string;
  timestamp: number;
  embedding?: number[];
}

interface DatabaseFixtures {
  testDbPath: string;
  testMessages: TestMessage[];
}

export const test = base.extend<DatabaseFixtures>({
  // Create isolated database per worker (avoids LanceDB lock conflicts)
  testDbPath: [async ({}, use) => {
    const dbPath = process.env.TEST_DB_PATH || './data/test-db.lance';
    const pathDir = path.dirname(dbPath);

    // Ensure data directory exists
    await fs.mkdir(pathDir, { recursive: true });

    await use(dbPath);

    // Teardown: Cleanup test database file
    try {
      await fs.unlink(dbPath);
      console.log(`Cleaned up test database: ${dbPath}`);
    } catch (err) {
      // File might not exist, that's okay
      if ((err as any).code !== 'ENOENT') {
        console.warn(`Failed to cleanup test database: ${err}`);
      }
    }
  }, { scope: 'worker' }],

  // Provide test message data to tests
  testMessages: async ({}, use) => {
    const messages: TestMessage[] = [
      {
        conversation_id: 'test-conv-1',
        message: 'Test message about finding API documentation',
        role: 'user',
        timestamp: Date.now() - 86400000, // 1 day ago
      },
      {
        conversation_id: 'test-conv-1',
        message: 'Found the API documentation at /docs endpoint',
        role: 'assistant',
        timestamp: Date.now() - 86300000, // 1 day ago + 1 minute
      },
      {
        conversation_id: 'test-conv-2',
        message: 'How do I search conversations?',
        role: 'user',
        timestamp: Date.now() - 3600000, // 1 hour ago
      },
      {
        conversation_id: 'test-conv-2',
        message: 'Use the search endpoint: POST /api/v1/search',
        role: 'assistant',
        timestamp: Date.now() - 3540000, // 1 hour ago + 1 minute
      },
    ];

    await use(messages);

    // Teardown: If any data was actually created in DB, it should be deleted via API
    // Implementation depends on whether tests actually ingest data
  },
});
