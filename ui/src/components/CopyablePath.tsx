import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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

  return path.slice(0, frontChars) + '...' + path.slice(-backChars);
}

interface CopyablePathProps {
  path: string;
}

/**
 * Displays a file path with copy-to-clipboard functionality.
 * Shows truncated path with middle ellipsis for long paths.
 * Provides visual "Copied!" feedback for 2 seconds after copying.
 */
export function CopyablePath({ path }: CopyablePathProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is not available
      try {
        const textArea = document.createElement('textarea');
        textArea.value = path;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Failed to copy path to clipboard:', fallbackError);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code
        className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded truncate"
        title={path}
      >
        {truncateMiddle(path)}
      </code>

      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
          copied
            ? 'text-green-600 bg-green-50'
            : 'bg-orange-50 hover:bg-orange-100 text-orange-700'
        }`}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy Path
          </>
        )}
      </button>
    </div>
  );
}
