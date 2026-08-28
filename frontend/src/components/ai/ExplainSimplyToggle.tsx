import React, { useState } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';

export interface ExplainSimplyToggleProps {
  originalText: string;
  simplifiedText?: string;
}

export default function ExplainSimplyToggle({ originalText, simplifiedText }: ExplainSimplyToggleProps) {
  const [isSimplified, setIsSimplified] = useState(false);

  const plainLanguageFallback =
    simplifiedText ||
    "In simple terms: Revenue is growing quickly because big business customers are buying more. Marketing is working well, and we are spending less money to get each new customer.";

  return (
    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.375rem' }}>
        <button
          className={`btn ${isSimplified ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setIsSimplified(!isSimplified)}
          style={{ fontSize: '0.75rem', gap: '0.25rem', padding: '0.2rem 0.5rem' }}
          title="Toggle non-technical plain language view"
        >
          <Sparkles size={12} />
          {isSimplified ? 'Show Technical View' : 'Explain Simply'}
        </button>
      </div>

      <div
        style={{
          background: isSimplified ? 'var(--color-primary-subtle)' : 'transparent',
          borderLeft: isSimplified ? '3px solid var(--color-primary)' : 'none',
          padding: isSimplified ? '0.75rem 1rem' : '0',
          borderRadius: isSimplified ? 'var(--radius-md)' : '0',
          transition: 'all var(--transition-fast)',
        }}
      >
        <p style={{ fontSize: '0.875rem', color: isSimplified ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.6 }}>
          {isSimplified ? plainLanguageFallback : originalText}
        </p>
      </div>
    </div>
  );
}
