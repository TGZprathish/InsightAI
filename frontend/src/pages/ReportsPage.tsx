import { useState, useEffect, useRef } from 'react';
import { FileText, Upload, X, FileCheck, CheckCircle2, AlertTriangle, Sparkles, Download, Database, BarChart2, PieChart, Shield, Activity, GitBranch, TrendingUp, Zap, Cpu, ChevronDown, ChevronUp, Target, Clock, Gauge } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import api from '../lib/api';
import { formatISTDate, formatISTDateTime } from '../lib/dateUtils';

// Icon mapping for predictive recommendation categories
const RECOMMENDATION_ICONS: Record<string, any> = {
  'shield': Shield,
  'database': Database,
  'activity': Activity,
  'git-branch': GitBranch,
  'pie-chart': PieChart,
  'trending-up': TrendingUp,
  'zap': Zap,
  'cpu': Cpu,
};

const PRIORITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'CRITICAL' },
  high: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'HIGH' },
  medium: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'MEDIUM' },
  low: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'LOW' },
};


/* ── Predictive Recommendations Section Component ────────────── */
/* ── Predictive Recommendations Section Component ────────────── */
function PredictiveRecommendationsSection({
  recommendations,
  datasetName,
  isLoading,
}: {
  recommendations: any[];
  datasetName?: string;
  isLoading?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Reset expanded state when recommendations change
  useEffect(() => {
    setExpandedIds(new Set());
  }, [datasetName]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-elevated)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
      id="predictive-recommendations-section"
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
              flexShrink: 0,
            }}
          >
            <Target size={22} style={{ color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
              Predictive Analysis & Future Forecasts
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.125rem', wordBreak: 'break-word' }}>
              {datasetName
                ? `Dynamic Python statistical projections & regression forecasts for "${datasetName}"`
                : 'Statistical trend analysis, value projections, and correlation-based forecasts'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {datasetName && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={datasetName}
            >
              📊 {datasetName}
            </span>
          )}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-full)',
              flexShrink: 0,
            }}
          >
            {recommendations.length} Forecast{recommendations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Sparkles className="animate-spin" size={24} style={{ color: 'var(--color-primary)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            Crunching Python regression models & linear projections for {datasetName || 'dataset'}...
          </p>
        </div>
      ) : recommendations.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          No statistical predictions available for this dataset.
        </div>
      ) : (
        /* Recommendation Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%' }}>
          {recommendations.map((rec: any) => {
            const isExpanded = expandedIds.has(rec.id);
            const priority = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
            const IconComponent = RECOMMENDATION_ICONS[rec.icon] || Target;

            return (
              <div
                key={rec.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-xl)',
                  border: `1px solid ${isExpanded ? priority.color + '40' : 'var(--border-subtle)'}`,
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isExpanded ? `0 4px 20px ${priority.color}15` : 'none',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
                id={`pred-rec-${rec.id}`}
              >
                {/* Card Header — always visible */}
                <div
                  onClick={() => toggleExpand(rec.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.875rem',
                    transition: 'background 0.2s ease',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0, flex: 1 }}>
                    {/* Category Icon */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-lg)',
                        background: priority.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={20} style={{ color: priority.color }} />
                    </div>

                    {/* Title + Priority Badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem', wordBreak: 'break-word' }}>
                          {rec.category}
                        </span>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            background: priority.bg,
                            color: priority.color,
                            border: `1px solid ${priority.color}30`,
                            flexShrink: 0,
                          }}
                        >
                          {priority.label}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-tertiary)',
                          marginTop: '0.1875rem',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                        }}
                      >
                        {rec.summary}
                      </p>
                    </div>
                  </div>

                  {/* Impact Score + Expand Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                    {/* Impact Badge */}
                    <div style={{ textAlign: 'center', minWidth: 52 }}>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: priority.color }}>
                        +{rec.predicted_impact_pct}%
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        Impact
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} style={{ color: 'var(--text-tertiary)' }} />
                    ) : (
                      <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '0 1.25rem 1.25rem 1.25rem',
                      animation: 'fadeSlideDown 0.3s ease',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Meta Row: Impact Bar + Confidence + Timeline */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
                        gap: '1rem',
                        marginBottom: '1.25rem',
                        padding: '0.875rem 1rem',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Predicted Impact */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                          <Gauge size={14} style={{ color: priority.color }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Predicted Impact
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-full)',
                            overflow: 'hidden',
                            marginTop: '0.25rem',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, rec.predicted_impact_pct * 3)}%`,
                              background: `linear-gradient(90deg, ${priority.color}, ${priority.color}cc)`,
                              borderRadius: 'var(--radius-full)',
                              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: priority.color, fontWeight: 600, marginTop: '0.25rem' }}>
                          +{rec.predicted_impact_pct}% projected
                        </div>
                      </div>

                      {/* Confidence Level */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                          <Target size={14} style={{ color: 'var(--color-accent)' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Confidence Level
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                          {['low', 'medium', 'high'].map((level) => (
                            <div
                              key={level}
                              style={{
                                flex: 1,
                                height: 8,
                                borderRadius: 'var(--radius-full)',
                                background:
                                  (['high'].includes(rec.confidence) && level !== 'high') ||
                                  (['high', 'medium'].includes(rec.confidence) && level === 'low')
                                    ? 'var(--color-accent)'
                                    : rec.confidence === level
                                    ? 'var(--color-accent)'
                                    : 'var(--bg-hover)',
                                opacity:
                                  rec.confidence === 'high'
                                    ? 1
                                    : rec.confidence === 'medium' && level !== 'high'
                                    ? 1
                                    : rec.confidence === 'low' && level === 'low'
                                    ? 1
                                    : 0.3,
                                transition: 'opacity 0.3s ease',
                              }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-accent)',
                            fontWeight: 600,
                            marginTop: '0.25rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          {rec.confidence} confidence
                        </div>
                      </div>

                      {/* Timeline */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                          <Clock size={14} style={{ color: 'var(--color-info)' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Forecast Window
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: 'var(--color-info)',
                            fontWeight: 500,
                            marginTop: '0.25rem',
                            wordBreak: 'break-word',
                          }}
                        >
                          {rec.timeline}
                        </div>
                      </div>
                    </div>

                    {/* Actionable Steps */}
                    <div>
                      <h4
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                        Statistical Evidence &amp; Forecast Insights
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(rec.steps || []).map((step: string, si: number) => {
                          const isPrediction = step.toLowerCase().startsWith('predicted outcome');
                          return (
                            <div
                              key={si}
                              style={{
                                display: 'flex',
                                gap: '0.625rem',
                                alignItems: 'flex-start',
                                padding: '0.625rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                background: isPrediction ? 'var(--color-primary-subtle)' : 'transparent',
                                border: isPrediction ? '1px solid var(--color-primary)30' : '1px solid transparent',
                                transition: 'background 0.2s ease',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                              onMouseEnter={(e) => {
                                if (!isPrediction) e.currentTarget.style.background = 'var(--bg-elevated)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isPrediction) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 'var(--radius-full)',
                                  background: isPrediction
                                    ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))'
                                    : priority.bg,
                                  color: isPrediction ? '#fff' : priority.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  marginTop: '0.0625rem',
                                }}
                              >
                                {isPrediction ? '★' : si + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.8125rem',
                                  lineHeight: 1.5,
                                  color: isPrediction ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                                  fontWeight: isPrediction ? 600 : 400,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere',
                                  flex: 1,
                                }}
                              >
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);
  const [availableVersions, setAvailableVersions] = useState<any[]>([]);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      if (data && data.items && data.items.length > 0) {
        setProjectsList(data.items);
        setSelectedProjectId(data.items[0].id);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchUploadedDatasets = async (targetDsId?: string) => {
    try {
      const { data } = await api.get('/datasets');
      if (data && data.items && data.items.length > 0) {
        setDatasetsList(data.items);
        const activeId = targetDsId || selectedDatasetId || data.items[0].id;
        setSelectedDatasetId(activeId);
        await generateReportForDataset(activeId, undefined, data.items);
      } else {
        setDatasetsList([]);
        setGeneratedReport(null);
      }
    } catch (err) {
      console.error('Error fetching datasets list:', err);
    }
  };

  const generateReportForDataset = async (dsId: string, versionNumber?: number, currentList?: any[]) => {
    if (!dsId) return;
    setIsLoadingReport(true);
    try {
      const list = currentList || datasetsList;
      const matched = list.find((d: any) => d.id === dsId) || list[0];

      // 1. Fetch available versions for this dataset
      let vers: any[] = [];
      try {
        const versRes = await api.get(`/datasets/${dsId}/versions`);
        vers = versRes.data.items || [];
        setAvailableVersions(vers);
      } catch (e) {
        console.error('Error loading dataset versions:', e);
      }

      const activeVer = versionNumber ?? (vers.length > 0 ? vers[0].version_number : (matched?.version || matched?.latest_version?.version_number || 1));
      setSelectedVersionNum(activeVer);

      // 2. Call Python Pandas backend analysis report endpoint with selected version
      const reportRes = await api.get(`/datasets/${dsId}/report?version=${activeVer}`);
      const reportData = reportRes.data;

      const activeVerObj = vers.find((v) => v.version_number === activeVer);
      const stageName = reportData.stage || activeVerObj?.stage || (matched?.stage || 'raw');

      setGeneratedReport({
        id: dsId,
        datasetName: reportData.dataset_name || matched?.name || 'Dataset',
        version: activeVer,
        stage: stageName,
        title: `${reportData.dataset_name || matched?.name || 'Dataset'} - Full Python Analytical Report`,
        date: formatISTDate(reportData.created_at || new Date()),
        totalRows: reportData.total_rows,
        columnsCount: reportData.total_columns,
        nullCells: reportData.null_cells,
        completenessPct: reportData.completeness_pct,
        duplicateRows: reportData.duplicate_rows,
        qualityScore: reportData.quality_score,
        outlierTotal: reportData.outlier_total,
        numericalColumnsCount: reportData.numerical_columns_count,
        categoricalColumnsCount: reportData.categorical_columns_count,
        executiveSummary: reportData.executive_summary,
        keyFindings: reportData.key_findings || [],
        recommendations: reportData.recommendations || [],
        featureInsights: reportData.feature_insights || [],
        predictiveRecommendations: reportData.predictive_recommendations || [],
      });
    } catch (err) {
      console.error('Failed to generate Python dataset report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedDatasetId) return;
    setIsExportingPdf(true);

    try {
      const verQuery = selectedVersionNum ? `?version=${selectedVersionNum}` : '';
      const response = await api.get(`/datasets/${selectedDatasetId}/export-pdf${verQuery}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (generatedReport?.title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${cleanName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export Python PDF report: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUploadedDatasets();
  }, []);

  const handleDatasetSelectChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    generateReportForDataset(dsId);
  };

  const handleVersionChange = (verNum: number) => {
    if (selectedDatasetId) {
      generateReportForDataset(selectedDatasetId, verNum);
    }
  };

  const handleUploadAndGenerateReport = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', reportName.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''));
      if (selectedProjectId) {
        formData.append('project_id', selectedProjectId);
      }

      const { data } = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newDsId = data.dataset.id;
      setShowUpload(false);
      setSelectedFile(null);
      setReportName('');
      await fetchUploadedDatasets(newDsId);
    } catch (err: any) {
      alert('Report upload error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
          width: '100%',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
            Python Full Dataset Insights &amp; Reports
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem', wordBreak: 'break-word' }}>
            Empirical Python (pandas/numpy/scipy) data auditing, statistical regressions, and predictive forecasts
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowUpload(true)}
          id="generate-report-btn"
          style={{ flexShrink: 0 }}
        >
          <Upload size={18} /> Upload Data &amp; Generate Report
        </button>
      </div>

      {/* Persistent Dataset & Version Selector Bar */}
      {datasetsList.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
                Dataset:
              </span>
            </div>
            <select
              className="input"
              value={selectedDatasetId}
              onChange={(e) => handleDatasetSelectChange(e.target.value)}
              style={{ cursor: 'pointer', fontWeight: 500, maxWidth: 320 }}
              id="reports-dataset-selector"
            >
              {datasetsList.map((ds) => {
                const verNum = ds.version || ds.latest_version?.version_number || 1;
                const stageName = ds.stage || ds.latest_version?.stage || 'raw';
                return (
                  <option key={ds.id} value={ds.id}>
                    📑 {ds.name} (v{verNum} · {stageName === 'cleaned' ? 'Cleaned' : 'Raw'})
                  </option>
                );
              })}
            </select>
            {isLoadingReport && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                <Sparkles className="animate-spin" size={14} /> Analyzing...
              </span>
            )}
          </div>

          {/* Version Pills Switcher */}
          {availableVersions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Versions:</span>
              {availableVersions.map((v) => {
                const isActive = selectedVersionNum === v.version_number;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleVersionChange(v.version_number)}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.625rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                    id={`reports-ver-${v.version_number}-btn`}
                  >
                    <span>v{v.version_number}</span>
                    <span className={`badge ${v.stage === 'cleaned' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.625rem', padding: '0.05rem 0.3rem' }}>
                      {v.stage}
                    </span>
                    {isActive && <span style={{ fontSize: '0.625rem', fontWeight: 700 }}>• Active</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {generatedReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
          {/* Top Banner */}
          <div className="card" style={{ background: 'var(--bg-elevated)', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <Sparkles size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 700, wordBreak: 'break-word', margin: 0 }}>
                      {generatedReport.title}
                    </h2>
                    <span className="badge badge-primary">v{generatedReport.version}</span>
                    <span className={`badge ${generatedReport.stage === 'cleaned' ? 'badge-success' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                      {generatedReport.stage}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Full Python Audit on {generatedReport.date}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                id="export-python-pdf-btn"
                style={{ flexShrink: 0 }}
              >
                <Download size={16} /> {isExportingPdf ? 'Compiling Python PDF...' : 'Export Python PDF Report'}
              </button>
            </div>
            <p
              style={{
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                wordBreak: 'break-word',
              }}
            >
              {isLoadingReport
                ? `Python pandas & scipy engine analyzing "${generatedReport.datasetName}"...`
                : generatedReport.executiveSummary}
            </p>
          </div>

          {/* Empirical Python Metrics Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
              gap: '1rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div className="card" style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Total Analyzed Rows</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', wordBreak: 'break-all' }}>
                {generatedReport.totalRows?.toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Total Attributes</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', wordBreak: 'break-all' }}>
                {generatedReport.columnsCount} ({generatedReport.numericalColumnsCount} Num / {generatedReport.categoricalColumnsCount} Cat)
              </div>
            </div>
            <div className="card" style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Cell Completeness</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--color-primary)' }}>
                {generatedReport.completenessPct}%
              </div>
            </div>
            <div className="card" style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Data Quality Score</span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  marginTop: '0.25rem',
                  color: generatedReport.qualityScore >= 90 ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              >
                {generatedReport.qualityScore}%
              </div>
            </div>
            <div className="card" style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Detected Outliers</span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  marginTop: '0.25rem',
                  color: generatedReport.outlierTotal > 0 ? 'var(--color-warning)' : 'var(--text-primary)',
                  wordBreak: 'break-all',
                }}
              >
                {generatedReport.outlierTotal?.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Visual Statistical Graphs & Distribution Charts Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '1.25rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Graph 1: Feature Averages Horizontal Bar Chart */}
            <div className="card" style={{ minWidth: 0, boxSizing: 'border-box' }}>
              <h4
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  wordBreak: 'break-word',
                }}
              >
                <BarChart2 size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Primary Numerical Feature Distribution Averages
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {generatedReport.featureInsights
                  .filter((fi: any) => fi.type === 'numerical')
                  .slice(0, 5)
                  .map((fi: any) => {
                    const numList = generatedReport.featureInsights.filter((f: any) => f.type === 'numerical');
                    const maxMean = Math.max(...numList.map((f: any) => Math.abs(f.mean)), 1);
                    const barWidth = Math.min(100, Math.max(8, (Math.abs(fi.mean) / maxMean) * 100));

                    return (
                      <div key={fi.feature}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8125rem',
                            marginBottom: '0.25rem',
                            gap: '0.5rem',
                          }}
                        >
                          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fi.feature}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--color-primary)', flexShrink: 0 }}>
                            Mean: {fi.mean}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-full)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${barWidth}%`,
                              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                              borderRadius: 'var(--radius-full)',
                              transition: 'width 0.8s ease-out',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Graph 2: Data Quality & Completeness Visual Donut Chart */}
            <div className="card" style={{ minWidth: 0, boxSizing: 'border-box' }}>
              <h4
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  wordBreak: 'break-word',
                }}
              >
                <PieChart size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} /> Data Quality &amp; Completeness Chart
              </h4>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* SVG Donut Ring */}
                <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                  <svg width="120" height="120" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--bg-elevated)"
                      strokeWidth="3.8"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--color-success)"
                      strokeWidth="3.8"
                      strokeDasharray={`${generatedReport.completenessPct}, 100`}
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-success)' }}>
                      {generatedReport.completenessPct}%
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Valid</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
                    <span>
                      Valid Cells: <b>{generatedReport.validCells?.toLocaleString()}</b>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-error)', flexShrink: 0 }} />
                    <span>
                      Missing Cells: <b>{generatedReport.nullCells?.toLocaleString()}</b>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0 }} />
                    <span>
                      Duplicates: <b>{generatedReport.duplicateRows?.toLocaleString()}</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Findings */}
          <div className="card" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                wordBreak: 'break-word',
              }}
            >
              <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} /> Key Statistical Findings (Python Pandas Engine)
            </h3>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', lineHeight: 1.5 }}>
              {generatedReport.keyFindings.map((finding: string, idx: number) => (
                <li key={idx} style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {finding}
                </li>
              ))}
            </ul>
          </div>

          {/* Strategic Recommendations */}
          <div className="card" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                wordBreak: 'break-word',
              }}
            >
              <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} /> Data-Driven Strategic Actions
            </h3>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', lineHeight: 1.5 }}>
              {generatedReport.recommendations.map((rec: string, idx: number) => (
                <li key={idx} style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Predictive Recommendations & Future Strategy (Dynamic per selected dataset) ── */}
          <PredictiveRecommendationsSection
            key={generatedReport.id}
            datasetName={generatedReport.datasetName}
            recommendations={generatedReport.predictiveRecommendations || []}
            isLoading={isLoadingReport}
          />

          {/* Feature Breakdown Table */}
          {generatedReport.featureInsights.length > 0 && (
            <div className="card" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  wordBreak: 'break-word',
                }}
              >
                <BarChart2 size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Full Feature Statistical Metrics
              </h3>
              <div
                className="table-container"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <table className="table" style={{ width: '100%', minWidth: 540 }}>
                  <thead>
                    <tr>
                      <th>Feature Name</th>
                      <th>Type</th>
                      <th>Statistical Summary / Dominance</th>
                      <th>Min / Max</th>
                      <th>IQR Outliers Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.featureInsights.map((fi: any) => (
                      <tr key={fi.feature}>
                        <td style={{ fontWeight: 600, wordBreak: 'break-word' }}>{fi.feature}</td>
                        <td>
                          <span className={`badge ${fi.type === 'numerical' ? 'badge-info' : 'badge-primary'}`}>
                            {fi.type}
                          </span>
                        </td>
                        <td style={{ wordBreak: 'break-word' }}>
                          {fi.type === 'numerical' ? (
                            <span>Mean: {fi.mean} (Std: {fi.std})</span>
                          ) : (
                            <span>Top: "{fi.top_category}" ({fi.dominance_pct}% concentration)</span>
                          )}
                        </td>
                        <td style={{ wordBreak: 'break-word' }}>
                          {fi.type === 'numerical' ? `${fi.min} / ${fi.max}` : `${fi.unique_count} Unique Values`}
                        </td>
                        <td>
                          {fi.type === 'numerical' ? (
                            <span style={{ color: fi.outliers_count > 0 ? 'var(--color-warning)' : 'inherit', fontWeight: fi.outliers_count > 0 ? 600 : 400 }}>
                              {fi.outliers_count}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Datasets Uploaded Yet"
          description="Upload a CSV or Excel dataset directly to trigger full Python pandas dataset auditing, statistical correlations, and exportable reports."
          actionLabel="Upload First Dataset"
          onAction={() => setShowUpload(true)}
        />
      )}

      {/* Dedicated Upload Modal for Reports */}
      {showUpload && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onClick={() => setShowUpload(false)}
        >
          <div
            className="glass animate-fade-in"
            style={{
              maxWidth: 520,
              width: '100%',
              borderRadius: 'var(--radius-2xl)',
              padding: '2rem',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload Dataset for Python AI Report</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Target Project Dropdown */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                📁 Select Target Database Project Workspace:
              </label>
              <select
                className="input"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{ cursor: 'pointer', fontWeight: 500 }}
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    📂 {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1.25rem',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setSelectedFile(f);
                    setReportName(f.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                style={{ display: 'none' }}
              />
              {selectedFile ? (
                <div>
                  <FileCheck size={36} style={{ color: 'var(--color-success)', marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 600 }}>{selectedFile.name}</p>
                </div>
              ) : (
                <div>
                  <Upload size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 500 }}>Click to browse or drop dataset file</p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Report Document Name
              </label>
              <input
                className="input"
                placeholder="e.g. Full Dataset Python Report"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUploadAndGenerateReport}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Uploading & Analyzing with Python...' : 'Upload & Generate Python Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
