import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Upload, X, FileCheck, BarChart2, TrendingUp, Users, Database } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import api from '../lib/api';
import { formatISTDate } from '../lib/dateUtils';

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState<any | null>(null);
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
        await loadDashboardForDataset(activeId, undefined, data.items);
      } else {
        setDatasetsList([]);
        setActiveDashboard(null);
      }
    } catch (err) {
      console.error('Error fetching datasets list:', err);
    }
  };

  const loadDashboardForDataset = async (dsId: string, versionNumber?: number, currentList?: any[]) => {
    if (!dsId) return;
    setIsLoadingDashboard(true);
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

      // Calculate empirical Data Quality Health percentage based on missing cells & row duplications
      let totalCells = 0;
      let validCells = 0;
      const rows = preview.rows || [];
      const columns = preview.columns || [];

      rows.forEach((r: any) => {
        columns.forEach((c: any) => {
          totalCells++;
          const val = r[c.name];
          if (val !== null && val !== undefined && val !== '' && val !== 'NaN' && val !== 'null' && val !== 'None') {
            validCells++;
          }
        });
      });

      let healthNum = totalCells > 0 ? (validCells / totalCells) * 100 : 100;
      if (rows.length > 1) {
        const rowStrings = rows.map((r: any) => JSON.stringify(r));
        const uniqueCount = new Set(rowStrings).size;
        const duplicateRatio = (rows.length - uniqueCount) / rows.length;
        healthNum = Math.max(0, healthNum - duplicateRatio * 30);
      }

      const qualityScore = healthNum.toFixed(1);
      let healthStatus = 'Excellent';
      let healthColor = 'var(--color-success)';

      if (healthNum < 75) {
        healthStatus = 'Needs Cleaning';
        healthColor = 'var(--color-error)';
      } else if (healthNum < 90) {
        healthStatus = 'Good';
        healthColor = 'var(--color-warning)';
      }

      setActiveDashboard({
        id: dsId,
        name: preview.dataset_name || matched?.name || 'Dataset Dashboard',
        version: activeVer,
        stage: stageName,
        rowsCount: preview.total_rows || preview.rows.length,
        columns: preview.columns || [],
        sampleRows: preview.rows || [],
        qualityScore,
        healthStatus,
        healthColor,
        validCells,
        totalCells,
        created_at: formatISTDate(activeVerObj?.created_at || matched?.created_at || new Date()),
      });
    } catch (err) {
      console.error('Failed to load dashboard preview:', err);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUploadedDatasets();
  }, []);

  const handleDatasetSelectChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    loadDashboardForDataset(dsId);
  };

  const handleVersionChange = (verNum: number) => {
    if (selectedDatasetId) {
      loadDashboardForDataset(selectedDatasetId, verNum);
    }
  };

  const handleUploadAndCreateDashboard = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', datasetName.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''));
      if (selectedProjectId) {
        formData.append('project_id', selectedProjectId);
      }

      const { data } = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newDsId = data.dataset.id;
      setShowUpload(false);
      setSelectedFile(null);
      setDatasetName('');
      await fetchUploadedDatasets(newDsId);
    } catch (err: any) {
      alert('Dashboard creation upload error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Analytics Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            Interactive KPI metrics & statistical data widgets across all uploaded datasets
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowUpload(true)} id="new-dashboard-btn">
          <Upload size={18} /> Upload Data & Create Dashboard
        </button>
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
              id="dashboard-dataset-selector"
            >
              {datasetsList.map((ds) => {
                const verNum = ds.version || ds.latest_version?.version_number || 1;
                const stageName = ds.stage || ds.latest_version?.stage || 'raw';
                return (
                  <option key={ds.id} value={ds.id}>
                    📊 {ds.name} (v{verNum} · {stageName === 'cleaned' ? 'Cleaned' : 'Raw'})
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
                    id={`dash-ver-${v.version_number}-btn`}
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

      {activeDashboard ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Info Banner */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{activeDashboard.name} Dashboard</h2>
                <span className="badge badge-primary">v{activeDashboard.version}</span>
                <span className={`badge ${activeDashboard.stage === 'cleaned' ? 'badge-success' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                  {activeDashboard.stage}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Generated on {activeDashboard.created_at}</p>
            </div>
            <span className="badge badge-success">Live Workspace Active</span>
          </div>

          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Total Row Records</span>
                <Users size={18} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {isLoadingDashboard ? '...' : activeDashboard.rowsCount.toLocaleString()}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Total Features / Columns</span>
                <BarChart2 size={18} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {isLoadingDashboard ? '...' : activeDashboard.columns.length}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Data Quality Health</span>
                <TrendingUp size={18} style={{ color: activeDashboard.healthColor || 'var(--color-success)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: activeDashboard.healthColor || 'var(--color-success)' }}>
                  {isLoadingDashboard ? '...' : `${activeDashboard.qualityScore || '100.0'}%`}
                </div>
                {activeDashboard.healthStatus && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: activeDashboard.healthColor }}>
                    ({activeDashboard.healthStatus})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Column Breakdown Cards */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Feature Schema Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {activeDashboard.columns.map((col: any) => (
                <div key={col.name} style={{ background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{col.name}</div>
                  <span className="badge badge-info">{col.inferred_type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={LayoutDashboard}
          title="No Datasets Uploaded Yet"
          description="Upload a CSV or Excel dataset directly to generate interactive KPI cards, statistical features, and metric widgets."
          actionLabel="Upload First Dataset"
          onAction={() => setShowUpload(true)}
        />
      )}

      {/* Dedicated Upload Modal for Dashboard */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowUpload(false)}>
          <div className="glass animate-fade-in" style={{ maxWidth: 520, width: '100%', borderRadius: 'var(--radius-2xl)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload Dataset for Dashboard</h2>
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
                    setDatasetName(f.name.replace(/\.[^/.]+$/, ''));
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Dashboard / Dataset Name</label>
              <input
                className="input"
                placeholder="e.g. Sales KPI Dashboard"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleUploadAndCreateDashboard}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Uploading & Creating Dashboard...' : 'Upload & Build Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
