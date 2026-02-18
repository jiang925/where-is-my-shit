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

  // Create test server config with TEST_API_KEY
  // The server reads from WIMS_CONFIG_FILE env var or ~/.wims/server.json
  const testConfigPath = path.join(__dirname, '../../data/test-server-config.json');
  const testConfigDir = path.dirname(testConfigPath);

  // Ensure directory exists
  if (!fs.existsSync(testConfigDir)) {
    fs.mkdirSync(testConfigDir, { recursive: true });
  }

  // Write test config with TEST_API_KEY
  const testConfig = {
    api_key: process.env.TEST_API_KEY,
    port: parseInt(process.env.TEST_PORT || '8000'),
    host: process.env.TEST_HOST || '127.0.0.1',
    PROJECT_NAME: 'WIMS Core',
    API_V1_STR: '/api/v1',
    LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
    DB_PATH: process.env.TEST_DB_PATH || 'data/test-db.lance',
    AUTH_DB_PATH: 'data/test-auth.db',
    CORS_ORIGINS: ['http://localhost', 'http://127.0.0.1'],
    EXTENSION_ID: '',
    // Use fastembed with bge-small-en-v1.5 for tests (much smaller model ~130MB vs 2.27GB)
    embedding: {
      provider: 'fastembed',
      model: 'BAAI/bge-small-en-v1.5',
      dimensions: 384,
    },
  };

  fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  console.log(`Created test server config at ${testConfigPath}`);

  // Set WIMS_CONFIG_FILE env var so the server uses our test config
  process.env.WIMS_CONFIG_FILE = testConfigPath;
  console.log(`Set WIMS_CONFIG_FILE=${testConfigPath}`);
}

export default globalSetup;
