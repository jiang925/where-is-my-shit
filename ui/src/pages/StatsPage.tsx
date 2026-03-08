import { useState } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useStats, type StatsGranularity } from '../lib/api';
import { cn } from '../lib/utils';
import { Loader2, LogOut, MessageSquare, MessagesSquare } from 'lucide-react';

interface StatsPageProps {
  onLogout: () => void;
}

// Platform chart colors matching the existing WIMS palette
const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: '#15803d',
  claude: '#b45309',
  'claude-code': '#c2410c',
  gemini: '#1d4ed8',
  perplexity: '#0f766e',
  cursor: '#7e22ce',
};

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  'claude-code': 'Claude Code',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  cursor: 'Cursor',
};

const FALLBACK_COLOR = '#6b7280';

const GRANULARITY_OPTIONS: { value: StatsGranularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function formatDateLabel(dateStr: string, granularity: StatsGranularity): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (granularity === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  if (granularity === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StatsPage({ onLogout }: StatsPageProps) {
  const [granularity, setGranularity] = useState<StatsGranularity>('day');

  const { data, status, error } = useStats(granularity);

  // Transform platform data for bar chart
  const platformData = data
    ? Object.entries(data.conversations_by_platform)
        .map(([platform, count]) => ({
          platform,
          label: PLATFORM_LABELS[platform] || platform,
          count,
          color: PLATFORM_COLORS[platform] || FALLBACK_COLOR,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Transform activity data for area chart
  const activityData = data
    ? data.activity.map((entry) => ({
        ...entry,
        label: formatDateLabel(entry.date, granularity),
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800 flex-1">
              Statistics
            </h1>

            {/* Granularity Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGranularity(option.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer",
                    granularity === option.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Disconnect / Change API Key"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-4xl px-4 py-6 flex-1 flex flex-col">
        {/* Loading State */}
        {status === 'pending' && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 mt-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300 mb-4" />
            <p className="text-lg">Loading statistics...</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center p-8 text-red-500 bg-red-50 rounded-lg border border-red-100 mt-4">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && data && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <MessagesSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Conversations</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.total_conversations.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Messages</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.total_messages.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            {platformData.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Conversations by Platform
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={platformData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [Number(value).toLocaleString(), 'Conversations']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {platformData.map((entry) => (
                        <Cell key={entry.platform} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Activity Over Time */}
            {activityData.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Activity Over Time
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={activityData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [Number(value).toLocaleString(), 'Messages']}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#activityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
