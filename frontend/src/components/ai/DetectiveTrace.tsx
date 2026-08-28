import React, { useState } from 'react';
import { Search, Terminal, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export interface TraceStep {
  step: number;
  hypothesis: string;
  tool_call: {
    name: string;
    args: Record<string, any>;
  };
  tool_result: Record<string, any>;
}

export interface DetectiveTraceProps {
  userQuestion: string;
  steps: TraceStep[];
  narrative: string;
}

export default function DetectiveTrace({ userQuestion, steps, narrative }: DetectiveTraceProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true });

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  return (
    <div className="card glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', marginBottom: '1rem' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={16} color="white" />
          </div>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>AI Detective Investigation</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ReAct Reasoning Trace ({steps.length} Tool Executions)</span>
          </div>
        </div>
        <span className="badge badge-primary"><Sparkles size={12} /> Bounded ReAct</span>
      </div>

      {/* Narrative Box */}
      <div style={{ background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <h4 style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <CheckCircle2 size={16} /> Root Cause Conclusion
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{narrative}</p>
      </div>

      {/* Timeline Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {steps.map((step) => {
          const isExpanded = expandedSteps[step.step];
          return (
            <div
              key={step.step}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Step Header */}
              <div
                onClick={() => toggleStep(step.step)}
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge badge-info" style={{ fontWeight: 600 }}>Step {step.step}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {step.hypothesis}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />}
              </div>

              {/* Step Content */}
              {isExpanded && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                  {/* Tool Call */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-accent)', fontWeight: 600, marginBottom: '0.375rem' }}>
                      <Terminal size={14} /> Tool Executed: <code style={{ color: 'var(--color-primary)' }}>{step.tool_call.name}()</code>
                    </div>
                    <pre style={{ background: 'var(--bg-base)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowX: 'auto' }}>
                      {JSON.stringify(step.tool_call.args, null, 2)}
                    </pre>
                  </div>

                  {/* Tool Result */}
                  <div>
                    <div style={{ color: 'var(--color-success)', fontWeight: 600, marginBottom: '0.375rem' }}>
                      Result Returned:
                    </div>
                    <pre style={{ background: 'var(--bg-base)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowX: 'auto' }}>
                      {JSON.stringify(step.tool_result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
