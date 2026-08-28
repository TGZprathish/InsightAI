import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Eye, Sliders, Database, Table, FileCheck, Download, History, Trash2 } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import DataPreviewTable, { ColumnSchema } from '../components/datasets/DataPreviewTable';
import CleaningRulePanel, { CleaningRule } from '../components/cleaning/CleaningRulePanel';
import api from '../lib/api';
import { formatISTDate } from '../lib/dateUtils';

export interface DatasetItem {
  id: string;
  name: string;
  source_type: string;
  version: number;
  stage: string;
  rows: number | null;
  size: string;
  created_at: string;
  status: string;
  created_by?: string;
}

export default function DatasetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'preview' | 'cleaning'>('list');
  const [showUpload, setShowUpload] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetItem | null>(null);
  const [isDeletingDs, setIsDeletingDs] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<{
    datasetId: string;
    versionNumber: number;
    stage: string;
    datasetName: string;
  } | null>(null);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);

  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowUpload(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);
  const [dragOver, setDragOver] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [previewColumns, setPreviewColumns] = useState<ColumnSchema[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTotalRows, setPreviewTotalRows] = useState<number | null>(null);
  const [isApplyingCleaning, setIsApplyingCleaning] = useState(false);
  const [activeVersionNum, setActiveVersionNum] = useState<number | null>(null);
  const [availableVersions, setAvailableVersions] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [filterProjectId, setFilterProjectId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = async (projId?: string) => {
    try {
      const targetP = projId ?? filterProjectId;
      const url = targetP && targetP !== 'ALL' ? `/datasets?project_id=${targetP}` : '/datasets';
      const { data } = await api.get(url);
      if (data.items) {
        const items: DatasetItem[] = data.items.map((d: any) => ({
          id: d.id,
          name: d.name,
          source_type: d.source_type || 'csv',
          version: d.latest_version?.version_number || 1,
          stage: d.latest_version?.stage || 'raw',
          rows: d.latest_version?.row_count || null,
          size: d.latest_version?.byte_size ? `${Math.round(d.latest_version.byte_size / 1024)} KB` : '12 KB',
          created_at: formatISTDate(d.created_at || new Date()),
          status: d.latest_version?.stage === 'cleaned' ? 'cleaned' : 'profiled',
          created_by: d.created_by,
        }));
        setDatasets(items);
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  const fetchProjectsList = async () => {
    try {
      const { data } = await api.get('/projects');
      if (data && data.items && data.items.length > 0) {
        setProjectsList(data.items);
        if (!selectedProjectId) {
          setSelectedProjectId(data.items[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects list:', err);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchProjectsList();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUpload(false);
        setDatasetToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showUpload) {
      fetchProjectsList();
    }
  }, [showUpload]);

  const fetchDatasetVersions = async (datasetId: string) => {
    try {
      const { data } = await api.get(`/datasets/${datasetId}/versions`);
      if (data.items) {
        setAvailableVersions(data.items);
      }
    } catch {
      setAvailableVersions([]);
    }
  };

  const handlePreviewDataset = async (ds: DatasetItem, versionNum?: number) => {
    const verToFetch = versionNum ?? ds.version;
    setSelectedDataset({
      ...ds,
      version: verToFetch,
    });
    setActiveVersionNum(verToFetch);
    setActiveTab('preview');
    setIsLoadingPreview(true);
    setPreviewError(null);
    fetchDatasetVersions(ds.id);
    try {
      const url = verToFetch ? `/datasets/${ds.id}/preview?version_number=${verToFetch}` : `/datasets/${ds.id}/preview`;
      const { data } = await api.get(url);
      if (data) {
        setPreviewColumns(data.columns || []);
        setPreviewRows(data.rows || []);
        setPreviewTotalRows(data.total_rows ?? data.rows?.length ?? 0);
      }
    } catch (err: any) {
      console.error('Data preview fetch error:', err);
      setPreviewError(err.response?.data?.detail || err.message || 'Failed to load dataset preview');
      setPreviewColumns([]);
      setPreviewRows([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadDataset = async (ds: DatasetItem, versionNum?: number) => {
    try {
      const ver = versionNum ?? ds.version;
      const urlParam = versionNum ? `?version_number=${versionNum}` : '';
      const response = await api.get(`/datasets/${ds.id}/download${urlParam}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = ds.name.toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `${safeName}_v${ver}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Download error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const statusBadge = (status: string, version: number = 1) => {
    if (status === 'cleaned') return <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle size={12} /> v{version} Cleaned</span>;
    if (status === 'profiled') return <span className="badge badge-success"><CheckCircle size={12} /> Profiled</span>;
    if (status === 'processing') return <span className="badge badge-warning animate-pulse-soft"><AlertCircle size={12} /> Processing</span>;
    return <span className="badge badge-info">{status}</span>;
  };

  const typeIcon = (type: string) => {
    const colors: Record<string, string> = { csv: 'var(--chart-teal)', xlsx: 'var(--chart-purple)', json: 'var(--chart-blue)' };
    return (
      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${colors[type] || 'var(--chart-amber)'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors[type] || 'var(--chart-amber)' }}>
        <FileSpreadsheet size={18} />
      </div>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!newDatasetName) {
        setNewDatasetName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleConfirmDeleteDataset = async () => {
    if (!datasetToDelete) return;
    setIsDeletingDs(true);

    try {
      await api.delete(`/datasets/${datasetToDelete.id}`);
      setDatasets((prev) => prev.filter((d) => d.id !== datasetToDelete.id));
      if (selectedDataset?.id === datasetToDelete.id) {
        setSelectedDataset(null);
        setActiveTab('list');
      }
      setDatasetToDelete(null);
    } catch (err: any) {
      alert('Failed to delete dataset: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsDeletingDs(false);
    }
  };

  const handleConfirmDeleteVersion = async () => {
    if (!versionToDelete || !selectedDataset) return;
    setIsDeletingVersion(true);

    try {
      const { data } = await api.delete(`/datasets/${versionToDelete.datasetId}/versions/${versionToDelete.versionNumber}`);
      await fetchDatasets();
      const remainingVers = data.remaining_versions || [];
      setAvailableVersions(remainingVers);

      const nextVer = data.active_version_number || (remainingVers.length > 0 ? remainingVers[0].version_number : 1);
      const activeVerObj = remainingVers.find((v: any) => v.version_number === nextVer) || remainingVers[0];

      const updatedDs: DatasetItem = {
        ...selectedDataset,
        version: nextVer,
        stage: activeVerObj?.stage || 'raw',
        rows: activeVerObj?.row_count ?? selectedDataset.rows,
      };
      setSelectedDataset(updatedDs);
      handlePreviewDataset(updatedDs, nextVer);
      setVersionToDelete(null);
    } catch (err: any) {
      alert('Failed to delete version: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsDeletingVersion(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!newDatasetName.trim() || !selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', newDatasetName.trim());
    if (selectedProjectId) {
      formData.append('project_id', selectedProjectId);
    }

    try {
      const { data } = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const ds = data.dataset;
      const ver = data.version;
      const createdItem: DatasetItem = {
        id: ds.id,
        name: ds.name,
        source_type: ds.source_type,
        version: ver?.version_number || 1,
        stage: ver?.stage || 'raw',
        rows: ver?.row_count || null,
        size: ver?.byte_size ? `${(ver.byte_size / 1024).toFixed(1)} KB` : '12 KB',
        created_at: formatISTDate(ds.created_at || new Date()),
        status: 'profiled',
        created_by: ds.created_by,
      };

      setDatasets([createdItem, ...datasets]);
      handlePreviewDataset(createdItem);
      setNewDatasetName('');
      setSelectedFile(null);
      setShowUpload(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Upload failed. Please check file format and backend connection.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Datasets</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>Upload, inspect schemas, and clean your data files</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)} id="upload-dataset-btn">
          <Upload size={18} /> Upload Dataset
        </button>
      </div>

      {datasets.length > 0 ? (
        <>
          {/* View Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
            <button className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('list')}>
              <Database size={16} /> All Datasets ({datasets.length})
            </button>
            {selectedDataset && (
              <>
                <button className={`btn ${activeTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('preview')}>
                  <Table size={16} /> Data Preview ({selectedDataset.name})
                </button>
                <button className={`btn ${activeTab === 'cleaning' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('cleaning')}>
                  <Sliders size={16} /> Cleaning Studio
                </button>
              </>
            )}
          </div>

          {activeTab === 'list' && (
            <div>
              {/* Project Workspace Filter & Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Project:
                    </span>
                    <select
                      className="input"
                      value={filterProjectId}
                      onChange={(e) => {
                        setFilterProjectId(e.target.value);
                        fetchDatasets(e.target.value);
                      }}
                      style={{ padding: '0.35rem 0.625rem', fontSize: '0.8125rem', maxWidth: 220 }}
                      id="filter-project-select"
                    >
                      <option value="ALL">🌐 All Projects</option>
                      {projectsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          📂 {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stage Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {['ALL', 'raw', 'cleaned', 'profiled'].map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        className={`btn btn-sm ${stageFilter === stage ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStageFilter(stage)}
                        style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', textTransform: 'capitalize', borderRadius: 'var(--radius-full)' }}
                      >
                        {stage === 'ALL' ? 'All Stages' : stage}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword Search */}
                <div style={{ position: 'relative', width: 260 }}>
                  <input
                    className="input"
                    placeholder="Search datasets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem 0.35rem 1.875rem' }}
                    id="search-datasets"
                  />
                  <Database size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  {searchTerm && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSearchTerm('')}
                      style={{ position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)', padding: '0.2rem' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Table or Empty Filter Message */}
              {(() => {
                const filteredDatasets = datasets.filter((ds) => {
                  const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesStage = stageFilter === 'ALL' || ds.stage === stageFilter || ds.status === stageFilter;
                  return matchesSearch && matchesStage;
                });

                if (filteredDatasets.length === 0) {
                  return (
                    <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                      <Database size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Matching Datasets</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        No datasets matched your search "{searchTerm}" or filter criteria.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setSearchTerm(''); setStageFilter('ALL'); }}
                        style={{ marginTop: '1rem' }}
                      >
                        Reset Filter
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Dataset</th>
                          <th>Type</th>
                          <th>Version</th>
                          <th>Rows</th>
                          <th>Size</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDatasets.map((ds, i) => (
                          <tr key={ds.id} style={{ animation: `fadeIn 0.4s ease-out ${i * 60}ms forwards`, opacity: 0 }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {typeIcon(ds.source_type)}
                                <div>
                                  <div style={{ fontWeight: 600 }}>{ds.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>v{ds.version} · {ds.stage}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="badge badge-primary">{ds.source_type.toUpperCase()}</span></td>
                            <td>v{ds.version}</td>
                            <td>{ds.rows ? ds.rows.toLocaleString() : '—'}</td>
                            <td>{ds.size}</td>
                            <td>{statusBadge(ds.status, ds.version)}</td>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>{ds.created_at}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Preview Rows"
                            onClick={() => handlePreviewDataset(ds)}
                          >
                            <Eye size={15} /> Preview
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Open Cleaning Studio"
                            onClick={() => { setSelectedDataset(ds); setActiveTab('cleaning'); }}
                          >
                            <Sliders size={15} /> Clean
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Download Dataset File"
                            onClick={() => handleDownloadDataset(ds)}
                            id={`download-btn-${ds.id}`}
                          >
                            <Download size={15} /> Download
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Permanently Delete Dataset"
                            onClick={() => setDatasetToDelete(ds)}
                            style={{ color: 'var(--color-error)' }}
                            id={`delete-btn-${ds.id}`}
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'preview' && selectedDataset && (
            <div>
              {/* Version History Lineage Banner & Version Selector */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1rem 1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={18} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      Dataset Versions ({availableVersions.length || 1}):
                    </span>
                  </div>

                  {/* Selectable & Deletable Version Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {availableVersions.length > 0 ? (
                      availableVersions.map((ver) => {
                        const isCurrent = (activeVersionNum ?? selectedDataset.version) === ver.version_number;
                        const isOnlyVersion = availableVersions.length <= 1;

                        return (
                          <div
                            key={ver.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: isCurrent ? 'var(--color-primary-subtle)' : 'var(--bg-surface)',
                              border: `1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-lg)',
                              padding: '0.2rem 0.35rem 0.2rem 0.625rem',
                              gap: '0.375rem',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handlePreviewDataset(selectedDataset, ver.version_number)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.2rem 0.25rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)',
                                fontWeight: isCurrent ? 700 : 500,
                                fontSize: '0.8125rem',
                              }}
                              title={`Click to preview Version ${ver.version_number} (${ver.stage})`}
                              id={`select-version-${ver.version_number}-btn`}
                            >
                              <span>v{ver.version_number}</span>
                              <span
                                className={`badge ${ver.stage === 'cleaned' ? 'badge-success' : 'badge-primary'}`}
                                style={{ fontSize: '0.625rem', padding: '0.1rem 0.35rem', textTransform: 'capitalize' }}
                              >
                                {ver.stage}
                              </span>
                              {ver.row_count && (
                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                                  ({ver.row_count.toLocaleString()} rows)
                                </span>
                              )}
                              {isCurrent && (
                                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                  • Active
                                </span>
                              )}
                            </button>

                            {/* Delete Version Button */}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isOnlyVersion) {
                                  alert('Cannot delete the only remaining version. You can delete the entire dataset instead.');
                                  return;
                                }
                                setVersionToDelete({
                                  datasetId: selectedDataset.id,
                                  versionNumber: ver.version_number,
                                  stage: ver.stage,
                                  datasetName: selectedDataset.name,
                                });
                              }}
                              disabled={isOnlyVersion}
                              style={{
                                padding: '0.2rem 0.3rem',
                                color: isOnlyVersion ? 'var(--text-tertiary)' : 'var(--color-error)',
                                opacity: isOnlyVersion ? 0.35 : 0.8,
                                cursor: isOnlyVersion ? 'not-allowed' : 'pointer',
                                borderRadius: 'var(--radius-sm)',
                              }}
                              title={
                                isOnlyVersion
                                  ? 'Cannot delete the only version of a dataset'
                                  : `Delete Version v${ver.version_number}`
                              }
                              id={`delete-version-${ver.version_number}-btn`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <span className="badge badge-primary">
                        v{selectedDataset.version} ({selectedDataset.stage})
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Entire Dataset Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDatasetToDelete(selectedDataset)}
                    style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: '0.8125rem' }}
                    id="delete-entire-dataset-btn"
                  >
                    <Trash2 size={15} /> Delete Entire Dataset
                  </button>
                </div>
              </div>

              {previewError && (
                <div
                  className="card animate-fade-in"
                  style={{
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} style={{ color: 'var(--color-error)' }} />
                    <div>
                      <h4 style={{ fontWeight: 600, color: 'var(--color-error)', fontSize: '0.9375rem' }}>Failed to Load Preview</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.2rem' }}>{previewError}</p>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handlePreviewDataset(selectedDataset, activeVersionNum || selectedDataset.version)}
                  >
                    Retry Preview
                  </button>
                </div>
              )}

              <DataPreviewTable
                columns={previewColumns}
                rows={previewRows}
                totalRows={previewTotalRows ?? selectedDataset.rows ?? previewRows.length ?? 0}
                isLoading={isLoadingPreview}
                onCleanData={() => {
                  setActiveTab('cleaning');
                }}
                onDownload={() => handleDownloadDataset(selectedDataset, activeVersionNum || selectedDataset.version)}
              />
            </div>
          )}

          {activeTab === 'cleaning' && selectedDataset && (
            <CleaningRulePanel
              datasetName={selectedDataset.name}
              currentVersion={selectedDataset.version || 1}
              onApply={async (approvedToolIds) => {
                if (!selectedDataset) return;
                setIsApplyingCleaning(true);
                try {
                  const rulesPayload = approvedToolIds.map((id) => ({ type: id }));
                  const { data } = await api.post(`/datasets/${selectedDataset.id}/clean`, { rules: rulesPayload });
                  alert(data.message || `Cleaned dataset saved successfully as Version ${data.version_number || 2}!`);
                  await fetchDatasets();
                  const updatedItem: DatasetItem = {
                    ...selectedDataset,
                    version: data.version_number || 2,
                    stage: 'cleaned',
                    status: 'cleaned',
                    rows: data.cleaned_row_count || selectedDataset.rows,
                  };
                  setSelectedDataset(updatedItem);
                  handlePreviewDataset(updatedItem, data.version_number);
                  setActiveTab('preview');
                } catch (err: any) {
                  alert('Cleaning error: ' + (err.response?.data?.detail || err.message));
                } finally {
                  setIsApplyingCleaning(false);
                }
              }}
              isApplying={isApplyingCleaning}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={Database}
          title="No Datasets Uploaded Yet"
          description="Upload your CSV, Excel, or JSON data files to automatically infer schema types, detect PII, run profiling, and generate insights."
          actionLabel="Upload First Dataset"
          onAction={() => setShowUpload(true)}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowUpload(false)}>
          <div className="glass animate-fade-in" style={{ maxWidth: 520, width: '100%', borderRadius: 'var(--radius-2xl)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload Dataset</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>

            {/* Target Project Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                📁 Select Target Database Project Workspace:
              </label>
              <select
                className="input"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                id="select-target-project"
                style={{ cursor: 'pointer', fontWeight: 500 }}
              >
                {projectsList.length > 0 ? (
                  projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      📂 {p.name}
                    </option>
                  ))
                ) : (
                  <option value="">Loading Projects...</option>
                )}
              </select>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  setSelectedFile(file);
                  if (!newDatasetName) setNewDatasetName(file.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-xl)',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                background: dragOver ? 'var(--color-primary-subtle)' : 'transparent',
                marginBottom: '1.5rem',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-input"
              />
              {selectedFile ? (
                <div>
                  <FileCheck size={36} style={{ color: 'var(--color-success)', marginBottom: '0.75rem' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedFile.name}</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{(selectedFile.size / 1024).toFixed(1)} KB selected</p>
                </div>
              ) : (
                <div>
                  <Upload size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} />
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Drop files here or click to browse</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>CSV, XLSX, JSON — up to 200MB</p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Dataset Name</label>
              <input
                className="input"
                placeholder="e.g. Q4 Sales Report"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                id="dataset-name"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button
                className="btn btn-primary glow-primary"
                onClick={handleUploadSubmit}
                disabled={!newDatasetName.trim() || !selectedFile || isUploading}
                id="upload-submit"
              >
                {isUploading ? 'Uploading & Processing...' : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Whole Dataset Modal */}
      <ConfirmModal
        isOpen={!!datasetToDelete}
        title="Delete Dataset Permanently?"
        message={`Are you sure you want to permanently delete dataset "${datasetToDelete?.name}"? All version history files and table schemas will be permanently erased from the database. This action cannot be undone.`}
        confirmText="Permanently Delete Dataset"
        cancelText="Cancel"
        isDeleting={isDeletingDs}
        onConfirm={handleConfirmDeleteDataset}
        onCancel={() => setDatasetToDelete(null)}
      />

      {/* Confirm Delete Specific Version Modal */}
      <ConfirmModal
        isOpen={!!versionToDelete}
        title={`Delete Version v${versionToDelete?.versionNumber}?`}
        message={`Are you sure you want to permanently delete Version ${versionToDelete?.versionNumber} (${versionToDelete?.stage}) of dataset "${versionToDelete?.datasetName}"? The storage file and associated data schemas for this specific version will be permanently removed.`}
        confirmText={`Delete Version v${versionToDelete?.versionNumber}`}
        cancelText="Cancel"
        isDeleting={isDeletingVersion}
        onConfirm={handleConfirmDeleteVersion}
        onCancel={() => setVersionToDelete(null)}
      />
    </div>
  );
}
