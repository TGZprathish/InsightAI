import { Plus, Search, FolderOpen, Calendar, FileText, Upload, Database, Eye, Download, X, Trash2, Edit3, Filter } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import api from '../lib/api';
import { formatISTDate } from '../lib/dateUtils';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  datasetsCount: number;
  reportsCount: number;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  source_type: string;
  version: number;
  stage: string;
  rows: number | null;
  size: string;
  created_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreatingProj, setIsCreatingProj] = useState(false);

  // Edit Project State
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [isDeletingProj, setIsDeletingProj] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      if (data && data.items && data.items.length > 0) {
        const items: ProjectItem[] = data.items.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || 'Analytics workspace',
          datasetsCount: 0,
          reportsCount: 0,
          created_at: formatISTDate(p.created_at || new Date()),
        }));
        setProjects(items);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setProjects([]);
    }
  };

  const fetchProjectFiles = async (projectId: string) => {
    setIsLoadingFiles(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/datasets`);
      if (data && data.items) {
        const files: ProjectFile[] = data.items.map((d: any) => ({
          id: d.id,
          name: d.name,
          source_type: d.source_type || 'csv',
          version: d.latest_version?.version_number || 1,
          stage: d.latest_version?.stage || 'raw',
          rows: d.latest_version?.row_count || null,
          size: d.latest_version?.byte_size ? `${Math.round(d.latest_version.byte_size / 1024)} KB` : '12 KB',
          created_at: formatISTDate(d.created_at || new Date()),
        }));
        setProjectFiles(files);
      } else {
        setProjectFiles([]);
      }
    } catch (err) {
      console.error('Failed to fetch project files:', err);
      setProjectFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreate(false);
        setEditingProject(null);
        setSelectedProject(null);
        setProjectToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenProject = (project: ProjectItem) => {
    setSelectedProject(project);
    fetchProjectFiles(project.id);
  };

  const handleStartEditProject = (project: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditName(project.name);
    setEditDesc(project.description);
  };

  const handleSaveEditProject = async () => {
    if (!editingProject || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      const { data } = await api.patch(`/projects/${editingProject.id}`, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? { ...p, name: data.name, description: data.description }
            : p
        )
      );
      if (selectedProject?.id === editingProject.id) {
        setSelectedProject((prev) => (prev ? { ...prev, name: data.name, description: data.description } : null));
      }
      setEditingProject(null);
    } catch (err: any) {
      alert('Error updating project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newName.trim() || isCreatingProj) return;
    setIsCreatingProj(true);
    try {
      const { data } = await api.post('/projects', {
        name: newName.trim(),
        description: newDesc.trim() || 'Analytics workspace',
      });
      const createdItem: ProjectItem = {
        id: data.id,
        name: data.name,
        description: data.description || 'Analytics workspace',
        datasetsCount: 0,
        reportsCount: 0,
        created_at: formatISTDate(data.created_at || new Date()),
      };
      setProjects([createdItem, ...projects]);
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    } catch (err: any) {
      alert('Error creating project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsCreatingProj(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeletingProj(true);

    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setProjects((prev) => prev.filter((proj) => proj.id !== projectToDelete.id));
      if (selectedProject?.id === projectToDelete.id) {
        setSelectedProject(null);
      }
      setProjectToDelete(null);
    } catch (err: any) {
      alert('Error deleting project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsDeletingProj(false);
    }
  };

  const handleFileUploadToProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProject) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('name', files[0].name.replace(/\.[^/.]+$/, ''));

      await api.post(`/projects/${selectedProject.id}/datasets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchProjectFiles(selectedProject.id);
      await fetchProjects();
    } catch (err: any) {
      alert('Upload error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadFile = async (file: ProjectFile) => {
    try {
      const response = await api.get(`/datasets/${file.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = file.name.toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `${safeName}_v${file.version}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Download error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const CATEGORIES = ['ALL', 'Analytics', 'Finance', 'Operations', 'Research'];

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    if (categoryFilter === 'ALL') return matchesSearch;
    return (
      matchesSearch &&
      (p.name.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        p.description.toLowerCase().includes(categoryFilter.toLowerCase()))
    );
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Database Projects</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            Persistent project workspaces stored in database organizing all uploaded files
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-project-btn">
          <Plus size={18} /> New Project
        </button>
      </div>

      {projects.length > 0 ? (
        <>
          {/* Search & Category Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', maxWidth: 360, width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                className="input"
                placeholder="Search database projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
                id="search-projects"
              />
              {search && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', padding: '0.2rem' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
              <Filter size={14} style={{ color: 'var(--text-tertiary)', marginRight: 2 }} />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCategoryFilter(cat)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)' }}
                >
                  {cat === 'ALL' ? 'All Projects' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Project Grid or No Search Results */}
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Matching Projects Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                No projects matched your search "{search}" or selected filter.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setCategoryFilter('ALL'); }}
                style={{ marginTop: '1rem' }}
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filtered.map((project, i) => (
                <div
                  key={project.id}
                  className="card"
                  onClick={() => handleOpenProject(project)}
                  style={{
                    cursor: 'pointer',
                    animationDelay: `${i * 80}ms`,
                    animation: 'fadeIn 0.4s ease-out forwards',
                    opacity: 0,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FolderOpen size={20} color="white" />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{project.name}</h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={(e) => handleStartEditProject(project, e)}
                        title="Edit Project Details"
                        id={`edit-project-btn-${project.id}`}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                        }}
                        title="Delete Project Workspace"
                        id={`delete-project-btn-${project.id}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                    {project.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    <span className="badge badge-primary">Stored in DB</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} /> {project.created_at}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No Projects Created Yet"
          description="Create your first database project to organize your datasets, automated profiling, ML models, and executive reports."
          actionLabel="Create First Project"
          onAction={() => setShowCreate(true)}
        />
      )}

      {/* Project Workspace Files Hub Drawer / Modal — Centered */}
      {selectedProject && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="glass animate-fade-in card"
            style={{
              maxWidth: 780,
              width: '100%',
              maxHeight: '85vh',
              borderRadius: 'var(--radius-2xl)',
              padding: '2rem',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FolderOpen size={20} style={{ color: 'var(--color-primary)' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{selectedProject.name}</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
                  {selectedProject.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--color-error)', fontWeight: 600 }}
                  onClick={() => setProjectToDelete(selectedProject)}
                  title="Delete Project Workspace"
                  id="delete-selected-project-btn"
                >
                  <Trash2 size={16} /> Delete Project
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedProject(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Upload File to Project Bar */}
            <div style={{
              background: 'var(--bg-elevated)', border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
            }}>
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>Organize Files in this Project</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                  Upload CSV or Excel files directly into this database project workspace.
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
              >
                <Upload size={16} /> {isUploading ? 'Uploading...' : 'Add File to Project'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileUploadToProject}
                style={{ display: 'none' }}
              />
            </div>

            {/* Files List */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.875rem' }}>Uploaded Files in Project:</h3>
            {isLoadingFiles ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading project files...</p>
            ) : projectFiles.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Version</th>
                      <th>Size</th>
                      <th>Uploaded Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectFiles.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                            {file.name}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${file.stage === 'cleaned' ? 'badge-success' : 'badge-primary'}`}>
                            v{file.version} ({file.stage})
                          </span>
                        </td>
                        <td>{file.size}</td>
                        <td>{file.created_at}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDownloadFile(file)}
                            title="Download File"
                          >
                            <Download size={15} /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No dataset files uploaded to this project yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }} onClick={() => setShowCreate(false)}>
          <div className="glass animate-fade-in" style={{ maxWidth: 480, width: '100%', borderRadius: 'var(--radius-2xl)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Create Database Project</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Project Name</label>
              <input
                className="input"
                placeholder="e.g. Q4 Revenue Analysis"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                id="new-project-name"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Description</label>
              <textarea
                className="input"
                rows={3}
                placeholder="What are you analyzing in this workspace?"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                id="new-project-desc"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateProject} disabled={!newName.trim() || isCreatingProj} id="create-project-submit">
                {isCreatingProj ? 'Saving...' : 'Save Project to DB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setEditingProject(null)}
        >
          <div
            className="glass animate-fade-in card"
            style={{
              maxWidth: 480,
              width: '100%',
              borderRadius: 'var(--radius-2xl)',
              padding: '2rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Edit Project Details</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingProject(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Project Name</label>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project Name"
                id="edit-project-name"
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Description</label>
              <textarea
                className="input"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Project Description"
                id="edit-project-desc"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingProject(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEditProject}
                disabled={!editName.trim() || isSavingEdit}
                id="save-edit-project-btn"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Theme Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Delete Project Workspace?"
        message={`Are you sure you want to delete project workspace "${projectToDelete?.name}"? All datasets, files, and schemas stored inside this project will be permanently erased from the database.`}
        confirmText="Permanently Delete Project"
        cancelText="Cancel"
        isDeleting={isDeletingProj}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
