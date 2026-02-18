/**
 * Determines if a string is a file path rather than a URL.
 * Returns true for Windows absolute paths (C:\...) and Unix absolute paths (/...).
 * Returns false for URLs starting with http:// or https://.
 */
export function isFilePath(url: string): boolean {
  if (!url) return false;

  // URLs with protocol are not file paths
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }

  // Windows absolute paths: C:\, D:\, etc.
  if (/^[A-Za-z]:\\/.test(url)) {
    return true;
  }

  // Unix absolute paths: /home/..., /Users/..., etc.
  if (url.startsWith('/')) {
    return true;
  }

  // Anything else without :// is probably a path (no protocol = path)
  if (!url.includes('://')) {
    return true;
  }

  return false;
}

/**
 * Truncates a path in the middle with ellipsis for better readability.
 * Keeps more characters at the end (filename) than the beginning.
 *
 * @param path - The file path to truncate
 * @param maxLength - Maximum length before truncation (default: 60)
 * @returns Truncated path with middle ellipsis or original if short enough
 */
export function truncateMiddle(path: string, maxLength: number = 60): string {
  if (path.length <= maxLength) {
    return path;
  }

  // 60/40 split: more weight to the end (filename is more informative)
  const frontChars = Math.ceil((maxLength - 3) * 0.4);
  const backChars = Math.floor((maxLength - 3) * 0.6);

  const front = path.slice(0, frontChars);
  const back = path.slice(-backChars);

  return `${front}...${back}`;
}
