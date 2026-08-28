import { useState, useEffect } from 'react';
import { Database, Cloud, Cpu, FileText, FolderGit2, Clock, RefreshCw } from 'lucide-react';
import api from '../lib/api';

export default function UsagePage() {
  const [usageData, setUsageData] = useState<{
    datasets_uploaded: number;
    datasets_limit: number;
    storage_mb: number;
    storage_gb: number;
    storage_limit_gb: number;
    projects_count: number;
    ai_tokens: number;
    ai_tokens_limit: number;
    ai_tokens_reset_interval?: string;
    ai_tokens_reset_countdown?: string;
    reports_generated: number;
    reports_limit: number;
  }>({
    datasets_uploaded: 0,
    datasets_limit: 100,
    storage_mb: 0,
    storage_gb: 0,
    storage_limit_gb: 2,
    projects_count: 0,
    ai_tokens: 0,
    ai_tokens_limit: 200000,
    ai_tokens_reset_interval: 'Resets Weekly',
    ai_tokens_reset_countdown: '6d 9h remaining',
    reports_generated: 0,
    reports_limit: 50,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { data } = await api.get('/usage/summary');
        if (data) {
          setUsageData(data);
        }
      } catch (err) {
        console.error('Failed to load usage summary:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const quotas = [
    {
      metric: 'Datasets Uploaded',
      icon: Database,
      used: usageData.datasets_uploaded,
      limit: usageData.datasets_limit,
      displayUsed: usageData.datasets_uploaded,
      displayLimit: usageData.datasets_limit,
      unit: '',
      color: 'var(--chart-teal)',
    },
    {
      metric: 'Active Database Projects',
      icon: FolderGit2,
      used: usageData.projects_count,
      limit: 10,
      displayUsed: usageData.projects_count,
      displayLimit: 10,
      unit: '',
      color: 'var(--chart-blue)',
    },
    {
      metric: 'Storage Size Used',
      icon: Cloud,
      used: usageData.storage_mb,
      limit: usageData.storage_limit_gb * 1024,
      displayUsed: usageData.storage_mb > 1024 ? `${usageData.storage_gb} GB` : `${usageData.storage_mb} MB`,
      displayLimit: `${usageData.storage_limit_gb} GB`,
      unit: '',
      color: 'var(--color-primary)',
    },
    {
      metric: 'AI Tokens Consumption (200K Limit)',
      icon: Cpu,
      used: usageData.ai_tokens >= 1000 ? Math.round(usageData.ai_tokens / 1000) : usageData.ai_tokens,
      limit: Math.round(usageData.ai_tokens_limit / 1000),
      displayUsed: usageData.ai_tokens >= 1000 ? `${(usageData.ai_tokens / 1000).toFixed(1)}K` : `${usageData.ai_tokens}`,
      displayLimit: `${Math.round(usageData.ai_tokens_limit / 1000)}K Tokens`,
      unit: '',
      color: 'var(--chart-purple)',
      isWeeklyReset: true,
      resetInterval: usageData.ai_tokens_reset_interval || 'Resets Weekly',
      resetCountdown: usageData.ai_tokens_reset_countdown || '6d 9h remaining',
    },
    {
      metric: 'Reports Generated',
      icon: FileText,
      used: usageData.reports_generated,
      limit: usageData.reports_limit,
      displayUsed: usageData.reports_generated,
      displayLimit: usageData.reports_limit,
      unit: '',
      color: 'var(--chart-amber)',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Personal Usage &amp; Quotas</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Real-time individual storage, dataset uploads, generated reports, and weekly AI token consumption
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {quotas.map((q, i) => {
          const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0;
          return (
            <div
              key={q.metric}
              className="card"
              style={{ animationDelay: `${i * 60}ms`, animation: 'fadeIn 0.4s ease-out forwards', opacity: 0, position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-lg)',
                      background: `${q.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: q.color,
                    }}
                  >
                    <q.icon size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{q.metric}</h3>
                  </div>
                </div>

                {q.isWeeklyReset && (
                  <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <RefreshCw size={12} /> {q.resetInterval}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                  {isLoading ? '...' : q.displayUsed}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  / {q.displayLimit}
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(pct, 100)}%`,
                    background: q.color,
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: q.isWeeklyReset ? 'space-between' : 'flex-end', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {q.isWeeklyReset && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                    <Clock size={12} /> {q.resetCountdown}
                  </span>
                )}
                <span>{isLoading ? 'Loading...' : `${pct.toFixed(1)}% used`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
