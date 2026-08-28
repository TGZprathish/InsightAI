import React from 'react';
import { LucideIcon, Plus, Sparkles } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconColor?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconColor = 'var(--color-primary)',
}: EmptyStateProps) {
  return (
    <div
      className="card glass animate-fade-in"
      style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        borderRadius: 'var(--radius-2xl)',
        maxWidth: 540,
        margin: '2rem auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--radius-2xl)',
          background: `${iconColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          marginBottom: '1.25rem',
          boxShadow: `0 0 24px ${iconColor}20`,
        }}
      >
        <Icon size={32} />
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: actionLabel ? '1.75rem' : 0 }}>
        {description}
      </p>

      {actionLabel && onAction && (
        <button className="btn btn-primary glow-primary" onClick={onAction}>
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
