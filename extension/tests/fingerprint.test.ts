import { describe, it, expect } from 'vitest';
import { generateFingerprint } from '../src/lib/fingerprint';

describe('generateFingerprint', () => {
  it('generates a hex string', async () => {
    const fp = await generateFingerprint('conv1', 'user', 'Hello world');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output for same input', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', 'Hello world');
    const fp2 = await generateFingerprint('conv1', 'user', 'Hello world');
    expect(fp1).toBe(fp2);
  });

  it('produces different output for different content', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', 'Hello');
    const fp2 = await generateFingerprint('conv1', 'user', 'Goodbye');
    expect(fp1).not.toBe(fp2);
  });

  it('produces different output for different roles', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', 'Hello');
    const fp2 = await generateFingerprint('conv1', 'assistant', 'Hello');
    expect(fp1).not.toBe(fp2);
  });

  it('produces different output for different conversation IDs', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', 'Hello');
    const fp2 = await generateFingerprint('conv2', 'user', 'Hello');
    expect(fp1).not.toBe(fp2);
  });

  it('normalizes whitespace', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', 'Hello   world');
    const fp2 = await generateFingerprint('conv1', 'user', 'Hello world');
    expect(fp1).toBe(fp2);
  });

  it('trims leading/trailing whitespace', async () => {
    const fp1 = await generateFingerprint('conv1', 'user', '  Hello  ');
    const fp2 = await generateFingerprint('conv1', 'user', 'Hello');
    expect(fp1).toBe(fp2);
  });
});
