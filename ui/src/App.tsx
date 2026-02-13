import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { BrowsePage } from './pages/BrowsePage';
import { Search, Loader2, BookOpen } from 'lucide-react';
import { cn } from './lib/utils';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ApiKeyPrompt({ onSave }: { onSave: () => void }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      localStorage.setItem('wims_api_key', key.trim());
      onSave();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Authentication Required</h2>
          <p className="text-gray-500 text-center mt-2">
            Please enter your WIMS API Key to continue. You can find this in your server logs or <code>~/.wims/server.json</code>.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="sk-wims-..."
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}

// Navigation header
function NavHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const isSearch = location.pathname === '/';

  return (
    <nav className="flex items-center justify-center gap-2 mb-6">
      <button
        onClick={() => navigate('/')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
          isSearch
            ? "bg-blue-600 text-white shadow-md"
            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
        )}
      >
        <Search className="h-4 w-4" />
        Search
      </button>
      <button
        onClick={() => navigate('/browse')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
          !isSearch
            ? "bg-blue-600 text-white shadow-md"
            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
        )}
      >
        <BookOpen className="h-4 w-4" />
        Browse
      </button>
    </nav>
  );
}

function AuthenticatedApp() {
  const handleLogout = () => {
    localStorage.removeItem('wims_api_key');
    window.location.href = '/';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-4">
        <NavHeader />
      </div>
      <Routes>
        <Route path="/" element={<SearchPage onLogout={handleLogout} />} />
        <Route path="/browse" element={<BrowsePage onLogout={handleLogout} />} />
      </Routes>
    </div>
  );
}

function App() {
  const [hasKey, setHasKey] = useState(() => !!localStorage.getItem('wims_api_key'));

  return (
    <QueryClientProvider client={queryClient}>
      {hasKey ? (
        <AuthenticatedApp />
      ) : (
        <ApiKeyPrompt onSave={() => setHasKey(true)} />
      )}
    </QueryClientProvider>
  );
}

export default App;
