import { useState, useRef, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Monitor, Trash2, LogOut, Upload, FileJson, Check, AlertCircle, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { importWimsArchive, importChatGPT, importClaude, type ImportResponse } from '../lib/api';

type DetectedFormat = 'wims' | 'chatgpt' | 'claude' | 'unknown';

function detectFormat(data: unknown): DetectedFormat {
  if (Array.isArray(data)) {
    if (data[0]?.mapping) return 'chatgpt';
    if (data[0]?.chat_messages || data[0]?.uuid) return 'claude';
  }
  if (data && typeof data === 'object' && 'conversations' in data) return 'wims';
  return 'unknown';
}

const FORMAT_LABELS: Record<DetectedFormat, string> = {
  wims: 'WIMS Archive',
  chatgpt: 'ChatGPT Export',
  claude: 'Claude Export',
  unknown: 'Unknown Format',
};

interface SettingsPageProps {
  onLogout: () => void;
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { theme, setTheme } = useTheme();
  const [defaultView, setDefaultView] = useState(() =>
    localStorage.getItem('wims_view_mode') || 'card'
  );
  const [cleared, setCleared] = useState(false);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  const handleClearLocalData = () => {
    localStorage.removeItem('wims_bookmarks');
    localStorage.removeItem('wims_notes');
    localStorage.removeItem('wims_search_history');
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setDetectedFormat(null);
    setDetecting(false);
    setImporting(false);
    setUploadProgress(0);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = useCallback(async (file: File) => {
    resetImportState();
    setSelectedFile(file);

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.json') && !ext.endsWith('.zip')) {
      setImportError('Unsupported file type. Please upload a .json or .zip file.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setImportError('File too large. Maximum size is 500 MB.');
      return;
    }

    if (ext.endsWith('.zip')) {
      // For ZIP files, we can't detect format client-side easily.
      // Default to WIMS archive for zip.
      setDetectedFormat('wims');
      return;
    }

    // JSON file: read and detect format
    setDetecting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const format = detectFormat(data);
      setDetectedFormat(format);
      if (format === 'unknown') {
        setImportError('Could not detect the export format. Ensure this is a valid ChatGPT, Claude, or WIMS export file.');
      }
    } catch {
      setImportError('Failed to parse JSON file. Ensure the file is valid JSON.');
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleImport = async () => {
    if (!selectedFile || !detectedFormat || detectedFormat === 'unknown') return;

    setImporting(true);
    setUploadProgress(0);
    setImportError(null);
    setImportResult(null);

    try {
      let result: ImportResponse;
      const onProgress = (pct: number) => setUploadProgress(pct);

      switch (detectedFormat) {
        case 'wims':
          result = await importWimsArchive(selectedFile, onProgress);
          break;
        case 'chatgpt':
          result = await importChatGPT(selectedFile, onProgress);
          break;
        case 'claude':
          result = await importClaude(selectedFile, onProgress);
          break;
        default:
          throw new Error('Unknown format');
      }

      setImportResult(result);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Import failed'
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred during import.';
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center font-sans text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">Settings</h1>

        {/* Appearance */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Appearance</h2>
          <div className="flex items-center gap-2">
            {([
              { value: 'system', label: 'System', icon: Monitor },
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border",
                  theme === value
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Default View */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Default Search View</h2>
          <div className="flex items-center gap-2">
            {[
              { value: 'card', label: 'Card View' },
              { value: 'compact', label: 'Compact View' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setDefaultView(value);
                  localStorage.setItem('wims_view_mode', value);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border",
                  defaultView === value
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Data</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear local data</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Remove bookmarks, notes, and search history from this browser</p>
              </div>
              <button
                onClick={handleClearLocalData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {cleared ? 'Cleared!' : 'Clear'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium">Disconnect</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Remove API key and return to login</p>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        </section>

        {/* Import Data */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Import Data</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Upload a data export from ChatGPT, Claude, or a WIMS archive to import your conversations.
          </p>

          {/* Drop zone */}
          {!importResult && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !importing && fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500",
                importing && "pointer-events-none opacity-60"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Accepts .json and .zip files (max 500 MB)
              </p>
            </div>
          )}

          {/* Detecting spinner */}
          {detecting && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting file format...
            </div>
          )}

          {/* Selected file + detected format */}
          {selectedFile && detectedFormat && !importResult && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                {!importing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetImportState(); }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {detectedFormat !== 'unknown' && (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    Detected format: <span className="font-semibold">{FORMAT_LABELS[detectedFormat]}</span>
                  </span>
                </div>
              )}

              {/* Progress bar */}
              {importing && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress < 100
                      ? `Uploading... ${uploadProgress}%`
                      : 'Processing and generating embeddings...'}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        uploadProgress < 100
                          ? "bg-blue-500"
                          : "bg-blue-500 animate-pulse"
                      )}
                      style={{ width: `${uploadProgress < 100 ? uploadProgress : 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import button */}
              {!importing && detectedFormat !== 'unknown' && (
                <button
                  onClick={handleImport}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
              )}
            </div>
          )}

          {/* Success result */}
          {importResult && (
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800 dark:text-green-300">
                  <p className="font-semibold">Import complete</p>
                  <p className="mt-1">
                    Imported {importResult.conversations} conversation{importResult.conversations !== 1 ? 's' : ''},{' '}
                    {importResult.imported} message{importResult.imported !== 1 ? 's' : ''}
                    {importResult.skipped_duplicates > 0 && (
                      <> ({importResult.skipped_duplicates} duplicate{importResult.skipped_duplicates !== 1 ? 's' : ''} skipped)</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={resetImportState}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Import another file
              </button>
            </div>
          )}

          {/* Error */}
          {importError && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-300">
                <p className="font-semibold">Import failed</p>
                <p className="mt-1">{importError}</p>
              </div>
            </div>
          )}

          {/* Collapsible help */}
          <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
            <button
              onClick={() => setHelpExpanded(!helpExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              {helpExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              How to get your data exports
            </button>
            {helpExpanded && (
              <div className="mt-3 space-y-3 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">ChatGPT</p>
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>Go to <span className="font-mono text-gray-600 dark:text-gray-400">Settings &gt; Data controls &gt; Export data</span></li>
                    <li>Click <span className="font-semibold">Export</span> and wait for the email</li>
                    <li>Download the ZIP and extract <span className="font-mono">conversations.json</span></li>
                    <li>Upload that file here</li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Claude</p>
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>Go to <span className="font-mono text-gray-600 dark:text-gray-400">Settings &gt; Account &gt; Export Data</span></li>
                    <li>Click <span className="font-semibold">Export</span> and wait for the email</li>
                    <li>Download and extract the ZIP file</li>
                    <li>Upload the JSON file containing your conversations</li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">WIMS Archive</p>
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>Use the WIMS export feature or CLI: <span className="font-mono text-gray-600 dark:text-gray-400">wims export --format json</span></li>
                    <li>Upload the resulting JSON or ZIP file here</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Search Operators Help */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Search Operators</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">from:chatgpt</code>
              <span className="text-gray-600 dark:text-gray-400">Filter by platform</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">before:2026-03-01</code>
              <span className="text-gray-600 dark:text-gray-400">Messages before a date</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">after:2026-01-01</code>
              <span className="text-gray-600 dark:text-gray-400">Messages after a date</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">has:code</code>
              <span className="text-gray-600 dark:text-gray-400">Messages containing code blocks</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
