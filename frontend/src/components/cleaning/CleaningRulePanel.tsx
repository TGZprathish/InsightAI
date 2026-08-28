import React, { useState } from 'react';
import { Sparkles, Check, X, Play, Shield, Sliders, Eraser, CopyCheck, FileDiff, Sparkle } from 'lucide-react';

export type CleaningRule = any;

export interface CleaningToolOption {
  id: string;
  category: 'text' | 'dedup' | 'missing' | 'rows' | 'pii' | 'outliers';
  title: string;
  description: string;
  columns?: string;
  defaultEnabled: boolean;
  affectedEstimate: number;
}

export interface CleaningRulePanelProps {
  datasetName?: string;
  currentVersion?: number;
  suggestedRules?: any[];
  onApply: (approvedRuleTypes: string[]) => void;
  isApplying?: boolean;
}

const CLEANING_TOOLS: CleaningToolOption[] = [
  {
    id: 'trim_whitespace',
    category: 'text',
    title: 'Trim Whitespace & Text Normalization',
    description: 'Strips leading, trailing, and redundant internal space characters from text columns.',
    columns: 'Text / Categorical Columns',
    defaultEnabled: true,
    affectedEstimate: 12,
  },
  {
    id: 'deduplicate',
    category: 'dedup',
    title: 'Deduplicate Exact & Key Match Rows',
    description: 'Detects and removes identical duplicate record rows across columns.',
    columns: 'All Columns / Unique Identifiers',
    defaultEnabled: true,
    affectedEstimate: 5,
  },
  {
    id: 'impute_nulls',
    category: 'missing',
    title: 'Impute Missing Numeric & String Values',
    description: 'Fills null numeric cells with column median and empty text fields with default strings.',
    columns: 'Numeric & String Fields',
    defaultEnabled: true,
    affectedEstimate: 8,
  },
  {
    id: 'drop_empty_rows',
    category: 'rows',
    title: 'Remove Completely Empty Rows',
    description: 'Drops rows where all or majority of data fields are empty or null.',
    columns: 'Entire Record Row',
    defaultEnabled: true,
    affectedEstimate: 3,
  },
  {
    id: 'mask_pii_fields',
    category: 'pii',
    title: 'PII Anonymization & Data Masking',
    description: 'Masks sensitive email addresses and phone numbers for privacy compliance.',
    columns: 'Email & Phone Fields',
    defaultEnabled: false,
    affectedEstimate: 15,
  },
  {
    id: 'clip_outliers',
    category: 'outliers',
    title: 'Outlier Trimming & IQR Filtering',
    description: 'Clips extreme numerical values outside 1.5x Interquartile Range (IQR) bounds.',
    columns: 'Numerical Columns',
    defaultEnabled: false,
    affectedEstimate: 4,
  },
];

export default function CleaningRulePanel({
  datasetName = 'Dataset',
  currentVersion = 1,
  onApply,
  isApplying,
}: CleaningRulePanelProps) {
  const [enabledTools, setEnabledTools] = useState<string[]>(
    CLEANING_TOOLS.filter((t) => t.defaultEnabled).map((t) => t.id)
  );

  const toggleTool = (toolId: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const nextVersion = currentVersion + 1;
  const targetFileName = `${datasetName.toLowerCase().replace(/\s+/g, '_')}_v${nextVersion}_cleaned.csv`;

  const totalAffected = CLEANING_TOOLS.filter((t) => enabledTools.includes(t.id)).reduce(
    (acc, t) => acc + t.affectedEstimate,
    0
  );

  const getCategoryBadge = (cat: CleaningToolOption['category']) => {
    switch (cat) {
      case 'text':
        return <span className="badge badge-primary"><Eraser size={12} /> Text Cleanup</span>;
      case 'dedup':
        return <span className="badge badge-purple"><CopyCheck size={12} /> Deduplication</span>;
      case 'missing':
        return <span className="badge badge-info"><Sliders size={12} /> Imputation</span>;
      case 'rows':
        return <span className="badge badge-warning"><FileDiff size={12} /> Row Removal</span>;
      case 'pii':
        return <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><Shield size={12} /> Privacy Masking</span>;
      default:
        return <span className="badge badge-success"><Sparkle size={12} /> Statistics</span>;
    }
  };

  return (
    <div className="card glass animate-fade-in" style={{ padding: '1.75rem', borderRadius: 'var(--radius-2xl)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Sparkles size={22} style={{ color: 'var(--color-primary)' }} /> Data Cleaning Studio
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Select automated cleaning tools to transform raw data and generate a versioned dataset artifact.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="badge badge-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
            Target Output: Version {nextVersion} (Cleaned)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {targetFileName}
          </div>
        </div>
      </div>

      {/* Cleaning Tools List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
        {CLEANING_TOOLS.map((tool) => {
          const isSelected = enabledTools.includes(tool.id);
          return (
            <div
              key={tool.id}
              onClick={() => toggleTool(tool.id)}
              style={{
                background: isSelected ? 'var(--bg-card)' : 'var(--bg-elevated)',
                border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-xl)',
                padding: '1.125rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.15)' : 'none',
              }}
            >
              <div style={{ flex: 1, paddingRight: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                  {getCategoryBadge(tool.category)}
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    {tool.title}
                  </span>
                  {tool.columns && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                      Target: {tool.columns}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {tool.description}
                </p>
              </div>

              <button
                type="button"
                className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTool(tool.id);
                }}
                style={{ borderRadius: 'var(--radius-md)', minWidth: 100 }}
              >
                {isSelected ? <Check size={14} /> : <X size={14} />}
                {isSelected ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Controls & Version Save Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Selected Tools: <strong style={{ color: 'var(--text-primary)' }}>{enabledTools.length}</strong> active | Estimated Impact: <strong style={{ color: 'var(--color-primary)' }}>~{totalAffected} rows transformed</strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
            Original raw dataset v{currentVersion} will be preserved in lineage history.
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg glow-primary"
          disabled={enabledTools.length === 0 || isApplying}
          onClick={() => onApply(enabledTools)}
          id="apply-cleaning-btn"
          style={{ fontWeight: 600, padding: '0.75rem 1.75rem' }}
        >
          <Play size={18} />
          {isApplying ? `Cleaning & Saving Version ${nextVersion}...` : `Clean & Save as Version ${nextVersion}`}
        </button>
      </div>
    </div>
  );
}
