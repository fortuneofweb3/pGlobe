'use client';

import { useState, useEffect } from 'react';

interface HistoricalDataPoint {
  timestamp: number;
  avgUptime: number;
  onlineCount: number;
  totalNodes: number;
}

interface HistoricalSummary {
  totalDataPoints: number;
  dateRange: { start: number; end: number };
  avgNodesOverTime: number;
  avgUptimeOverTime: number;
}

export default function HistoricalDataViewer() {
  const [summary, setSummary] = useState<HistoricalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/history?summary=true');
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <p className="text-slate-600 dark:text-slate-400">Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <button
          onClick={fetchSummary}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary || summary.totalDataPoints === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Historical Data
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          No historical data available yet. Data will be collected as the platform runs.
        </p>
      </div>
    );
  }

  const dateRange = summary.dateRange.end - summary.dateRange.start;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Historical Data
        </h3>
        <button
          onClick={fetchSummary}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Total Data Points</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.totalDataPoints.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Time Range</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatDuration(dateRange)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            {formatDate(summary.dateRange.start)} - {formatDate(summary.dateRange.end)}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Avg Nodes</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.avgNodesOverTime.toFixed(1)}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Avg Uptime</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.avgUptimeOverTime.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          📊 Historical data is stored persistently in <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">.data/history/</code>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
          Data is collected automatically every time nodes are fetched. Up to 30 days of history is retained.
        </p>
      </div>
    </div>
  );
}

