import { describe, it, expect } from 'vitest';
import { isFilePath, truncateMiddle } from './pathUtils';

describe('isFilePath', () => {
  it('returns true for Unix absolute paths', () => {
    expect(isFilePath('/Users/test/file.txt')).toBe(true);
    expect(isFilePath('/home/user/docs')).toBe(true);
  });

  it('returns true for Windows absolute paths', () => {
    expect(isFilePath('C:\\Users\\test\\file.txt')).toBe(true);
    expect(isFilePath('D:\\Projects\\code')).toBe(true);
  });

  it('returns false for HTTP/HTTPS URLs', () => {
    expect(isFilePath('https://example.com/page')).toBe(false);
    expect(isFilePath('http://localhost:3000')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isFilePath('')).toBe(false);
  });

  it('returns true for relative-looking strings without protocol', () => {
    expect(isFilePath('some/path/file.txt')).toBe(true);
  });
});

describe('truncateMiddle', () => {
  it('returns original string if within maxLength', () => {
    expect(truncateMiddle('/short/path.txt')).toBe('/short/path.txt');
  });

  it('truncates long paths with middle ellipsis', () => {
    const longPath = '/Users/developer/projects/my-very-important-project/src/components/SomeComponent.tsx';
    const truncated = truncateMiddle(longPath, 40);
    expect(truncated.length).toBeLessThanOrEqual(40);
    expect(truncated).toContain('...');
    // Should keep beginning and end
    expect(truncated.startsWith('/Users')).toBe(true);
    expect(truncated.endsWith('.tsx')).toBe(true);
  });

  it('defaults to maxLength of 60', () => {
    const path65 = 'A'.repeat(65);
    const truncated = truncateMiddle(path65);
    expect(truncated.length).toBe(60);
    expect(truncated).toContain('...');
  });

  it('respects custom maxLength', () => {
    const path = 'A'.repeat(50);
    const truncated = truncateMiddle(path, 30);
    expect(truncated.length).toBe(30);
    expect(truncated).toContain('...');
  });
});
