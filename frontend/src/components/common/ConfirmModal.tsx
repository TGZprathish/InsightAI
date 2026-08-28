import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Permanently Delete',
  cancelText = 'Cancel',
  isDeleting = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '1.5rem',
      }}
      onClick={onCancel}
    >
      <div
        className="glass animate-fade-in"
        style={{
          maxWidth: 460,
          width: '100%',
          borderRadius: 'var(--radius-2xl)',
          padding: '2rem',
          border: '1px solid var(--border-default)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-xl)',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Permanent Action Warning</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={isDeleting}>
            {cancelText}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderColor: '#ef4444',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
            }}
            id="confirm-delete-button"
          >
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
