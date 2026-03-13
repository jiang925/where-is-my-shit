import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { truncateMiddle } from '../utils/pathUtils';
import { openTerminal } from '../lib/api';

interface CopyablePathProps {
  path: string;
}

/**
 * Displays a file path with copy-to-clipboard and open-in-terminal functionality.
 * Shows truncated path with middle ellipsis for long paths.
 * Provides visual "Copied!" feedback for 2 seconds after copying.
 */
export function CopyablePath({ path }: CopyablePathProps) {
  const [copied, setCopied] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'opened' | 'error'>('idle');

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

  const handleOpenTerminal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await openTerminal(path);
      setTerminalStatus('opened');
      setTimeout(() => setTerminalStatus('idle'), 2000);
    } catch {
      setTerminalStatus('error');
      setTimeout(() => setTerminalStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code
        className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded truncate"
        title={path}
      >
        {truncateMiddle(path)}
      </code>

      <button
        onClick={handleOpenTerminal}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
          terminalStatus === 'opened'
            ? 'text-green-600 bg-green-50'
            : terminalStatus === 'error'
              ? 'text-red-600 bg-red-50'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
        }`}
        aria-label="Open in terminal"
        title="Open in Terminal"
      >
        {terminalStatus === 'opened' ? (
          <>
            <Check className="h-3 w-3" />
            Opened!
          </>
        ) : terminalStatus === 'error' ? (
          <>
            <Terminal className="h-3 w-3" />
            Failed
          </>
        ) : (
          <>
            <Terminal className="h-3 w-3" />
            Terminal
          </>
        )}
      </button>

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
