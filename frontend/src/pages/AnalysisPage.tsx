import { useState, useEffect, useRef } from 'react';
import { BarChart3, Upload, X, FileCheck, Database, Download } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import api from '../lib/api';
import { formatISTDateTime } from '../lib/dateUtils';

export default function AnalysisPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
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
        await computeAnalysisForDataset(activeId, undefined, data.items);
      } else {
        setDatasetsList([]);
        setAnalysisResults(null);
      }
    } catch (err) {
      console.error('Error fetching datasets list:', err);
    }
  };

  const computeAnalysisForDataset = async (dsId: string, versionNumber?: number, currentList?: any[]) => {
    if (!dsId) return;
    setIsLoadingAnalysis(true);
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

      // 2. Fetch preview for selected version
      const previewRes = await api.get(`/datasets/${dsId}/preview?version_number=${activeVer}`);
      const preview = previewRes.data || { columns: [], rows: [], total_rows: 0 };

      const activeVerObj = vers.find((v) => v.version_number === activeVer);
      const stageName = preview.stage || activeVerObj?.stage || (matched?.stage || 'raw');

      // Compute descriptive statistics across numeric columns
      const numericCols = (preview.columns || []).filter((c: any) => c.inferred_type === 'integer' || c.inferred_type === 'float');
      const statsList = numericCols.map((c: any) => {
        const vals = (preview.rows || [])
          .map((r: any) => parseFloat(r[c.name]))
          .filter((v: number) => !isNaN(v));

        if (vals.length === 0) {
          return { name: c.name, type: c.inferred_type, count: 0, mean: 'N/A', median: 'N/A', min: 'N/A', max: 'N/A', std: 'N/A' };
        }

        const count = vals.length;
        const sum = vals.reduce((a: number, b: number) => a + b, 0);
        const mean = sum / count;
        const sorted = [...vals].sort((a, b) => a - b);
        const median = sorted[Math.floor(count / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const variance = vals.reduce((acc: number, v: number) => acc + Math.pow(v - mean, 2), 0) / count;
        const std = Math.sqrt(variance);

        return {
          name: c.name,
          type: c.inferred_type,
          count,
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          min: min.toFixed(2),
          max: max.toFixed(2),
          std: std.toFixed(2),
        };
      });

      setAnalysisResults({
        datasetName: preview.dataset_name || matched?.name || 'Dataset',
        version: activeVer,
        stage: stageName,
        totalRows: preview.total_rows || preview.rows?.length || 0,
        columns: preview.columns || [],
        stats: statsList,
        created_at: formatISTDateTime(new Date()),
      });
    } catch (err) {
      console.error('Failed to compute analysis:', err);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUploadedDatasets();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUpload(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDatasetSelectChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    computeAnalysisForDataset(dsId);
  };

  const handleVersionChange = (verNum: number) => {
    if (selectedDatasetId) {
      computeAnalysisForDataset(selectedDatasetId, verNum);
    }
  };

  const handleExportReport = () => {
    if (!analysisResults) return;
    const jsonStr = JSON.stringify(analysisResults, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (analysisResults.datasetName || 'analysis').toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('download', `${safeName}_statistics_report.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleUploadAndRunAnalysis = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', analysisName.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''));
      if (selectedProjectId) {
        formData.append('project_id', selectedProjectId);
      }

      const { data } = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newDsId = data.dataset.id;
      setShowUpload(false);
      setSelectedFile(null);
      setAnalysisName('');
      await fetchUploadedDatasets(newDsId);
    } catch (err: any) {
      alert('Analysis creation upload error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Statistical Analysis</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            Descriptive statistics, feature distributions & correlation analysis across uploaded datasets
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {analysisResults && (
            <button
              className="btn btn-secondary"
              onClick={handleExportReport}
              title="Download Statistical Summary Report as JSON"
              id="export-analysis-report-btn"
            >
              <Download size={16} /> Export Report (JSON)
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowUpload(true)} id="new-analysis-btn">
            <Upload size={18} /> Upload Data & Run Analysis
          </button>
        </div>
      </div>

      {/* Persistent Dataset & Version Selector Bar */}
      {datasetsList.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Dataset:</span>
            </div>
            <select
              className="input"
              value={selectedDatasetId}
              onChange={(e) => handleDatasetSelectChange(e.target.value)}
              style={{ cursor: 'pointer', fontWeight: 500, maxWidth: 320 }}
              id="analysis-dataset-selector"
            >
              {datasetsList.map((ds) => {
                const verNum = ds.version || ds.latest_version?.version_number || 1;
                const stageName = ds.stage || ds.latest_version?.stage || 'raw';
                return (
                  <option key={ds.id} value={ds.id}>
                    📈 {ds.name} (v{verNum} · {stageName === 'cleaned' ? 'Cleaned' : 'Raw'})
                  </option>
                );
              })}
            </select>
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
                    id={`analysis-ver-${v.version_number}-btn`}
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

      {analysisResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Info */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Statistical Analysis: {analysisResults.datasetName}</h2>
                <span className="badge badge-primary">v{analysisResults.version}</span>
                <span className={`badge ${analysisResults.stage === 'cleaned' ? 'badge-success' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                  {analysisResults.stage}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Computed on {analysisResults.totalRows.toLocaleString()} rows and {analysisResults.columns.length} columns ({analysisResults.created_at})
              </p>
            </div>
            <span className="badge badge-success">{isLoadingAnalysis ? 'Computing...' : 'Analysis Complete'}</span>
          </div>

          {/* Descriptive Statistics Table */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} /> Numerical Descriptive Statistics
            </h3>
            {analysisResults.stats.length > 0 ? (
              <div className="table-container" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <table className="table" style={{ borderCollapse: 'collapse', width: '100%', margin: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Column Feature</th>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Type</th>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Valid Sample Count</th>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Mean (Average)</th>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Median</th>
                      <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem' }}>Minimum</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Maximum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResults.stats.map((s: any, idx: number) => (
                      <tr
                        key={s.column || s.name || idx}
                        style={{
                          borderBottom: idx === analysisResults.stats.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        }}
                      >
                        <td style={{ fontWeight: 600, borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>{s.column || s.name}</td>
                        <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}><span className="badge badge-info">{s.type}</span></td>
                        <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>{s.count.toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-primary)', borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>{s.mean}</td>
                        <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>{s.median}</td>
                        <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>{s.min}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{s.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Categorical features analyzed. No purely numerical columns found for mean/std computations.
              </p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No Datasets Uploaded Yet"
          description="Upload a CSV or Excel dataset directly to compute descriptive statistics, mean/std distributions, and feature correlations."
          actionLabel="Upload First Dataset"
          onAction={() => setShowUpload(true)}
        />
      )}

      {/* Dedicated Upload Modal for Analysis */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowUpload(false)}>
          <div className="glass animate-fade-in" style={{ maxWidth: 520, width: '100%', borderRadius: 'var(--radius-2xl)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload Dataset for Statistical Analysis</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}><X size={18} /></button>
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
                border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-xl)',
                padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1.25rem',
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
                    setAnalysisName(f.name.replace(/\.[^/.]+$/, ''));
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Analysis Workspace Name</label>
              <input
                className="input"
                placeholder="e.g. Q4 Statistical Analysis"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleUploadAndRunAnalysis}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Uploading & Computing Statistics...' : 'Upload & Run Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
