import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  // Load .env.test file
  const envPath = path.join(__dirname, '../../.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
        console.log(`Loaded env var: ${key}`);
      }
    });
    console.log('Loaded .env.test configuration');
  } else {
    console.warn('.env.test not found, tests may fail or use wrong config');
  }

  // Validate required environment variables
  const required = ['TEST_API_KEY', 'TEST_DB_PATH'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars from .env.test: ${missing.join(', ')}`);
  }
}

export default globalSetup;
