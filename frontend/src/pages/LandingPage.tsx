import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Database, Brain, FileText, Search, BarChart3, ShieldCheck, CheckCircle2, ChevronRight, Play } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="bg-mesh" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header
        className="glass"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-primary)',
            }}
          >
            <Sparkles size={22} color="white" />
          </div>
          <span className="gradient-text" style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            InsightAI
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Features
          </a>
          <a href="#capabilities" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Capabilities
          </a>
          <a href="#security" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Security
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={() => navigate('/projects')}>
              Go to Workspace <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.875rem' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
                Get Started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '5rem 2rem 4rem', textAlign: 'center', maxWidth: 1000, margin: '0 auto' }}>
        <div
          className="badge badge-primary animate-fade-in"
          style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Sparkles size={14} /> Next-Gen Autonomous Data Analytics Platform
        </div>

        <h1
          className="animate-fade-in"
          style={{
            fontSize: '3.5rem',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
          }}
        >
          Transform Raw Data into Decisions with <span className="gradient-text">AI Intelligence</span>
        </h1>

        <p
          className="animate-fade-in"
          style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 760,
            margin: '0 auto 2.5rem',
          }}
        >
          Automate profiling, data cleaning, statistical modeling, machine learning predictions, and AI-driven executive reports in seconds — grounded in your actual metrics.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '4rem' }}>
          <button className="btn btn-primary btn-lg glow-primary" onClick={() => navigate(isAuthenticated ? '/projects' : '/register')}>
            {isAuthenticated ? 'Open Dashboard' : 'Start Free Trial'} <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/chat')}>
            <Play size={18} /> Try Detective Mode Demo
          </button>
        </div>

        {/* Hero Interactive Preview Box */}
        <div className="card glass animate-fade-in" style={{ padding: '2rem', borderRadius: 'var(--radius-2xl)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>InsightAI Intelligence Workspace — Live Demo</span>
            </div>
            <span className="badge badge-success"><CheckCircle2 size={12} /> System Status: Operational</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Analyzed Revenue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>$2.4M</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>+15.2% QoQ Trend</div>
            </div>
            <div className="kpi-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completeness Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-accent)' }}>94.2%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>12,450 records processed</div>
            </div>
            <div className="kpi-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ML Model Accuracy</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--chart-blue)' }}>92.4%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Random Forest Estimator</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" style={{ padding: '4rem 2rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Built for Modern Analytics Teams
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Everything you need from automated ETL to agentic root-cause investigation.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '1.25rem' }}>
              <Database size={22} />
            </div>
            <h3 style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Automated ETL & Profiling</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Instant column type inference, regex PII detection (email, phone, SSN), completeness scores, and automated rule-based cleaning.
            </p>
          </div>

          <div className="card">
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', marginBottom: '1.25rem' }}>
              <Search size={22} />
            </div>
            <h3 style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>AI Detective Mode</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Bounded ReAct tool execution loop investigates root causes behind metrics drops and anomalies with observable reasoning traces.
            </p>
          </div>

          <div className="card">
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chart-blue)', marginBottom: '1.25rem' }}>
              <Brain size={22} />
            </div>
            <h3 style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Scikit-Learn ML Pipelines</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Train regression, classification, and clustering models. Evaluate R², RMSE, Accuracy, F1 scores, and export serialized model artifacts.
            </p>
          </div>

          <div className="card">
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chart-amber)', marginBottom: '1.25rem' }}>
              <FileText size={22} />
            </div>
            <h3 style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Structured AI Reports & Export</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Auto-generate executive summaries, key trends, and actionable recommendations. Export to PDF, DOCX, and PPTX instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
        <p>© {new Date().getFullYear()} InsightAI Systems. All rights reserved.</p>
      </footer>
    </div>
  );
}
