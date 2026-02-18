import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { truncateMiddle } from '../utils/pathUtils';

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
