import React, { useState, useMemo } from 'react';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  CheckSquare,
  Layers,
  Sparkles,
  Check,
  Download,
  Database,
  Table as TableIcon,
  RefreshCw,
} from 'lucide-react';

export interface ColumnSchema {
  name: string;
  ordinal_position: number;
  inferred_type: string;
  is_pii_suspect: boolean;
}

export interface DataPreviewTableProps {
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  totalRows: number;
  isLoading?: boolean;
  onCleanData?: (selectedRows: Record<string, any>[]) => void;
  onDownload?: () => void;
}

export default function DataPreviewTable({
  columns = [],
  rows = [],
  totalRows = 0,
  isLoading = false,
  onCleanData,
  onDownload,
}: DataPreviewTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [maskPii, setMaskPii] = useState(true);
  const pageSize = 10;

  const hasPiiColumns = useMemo(
    () => columns.some((col) => col.is_pii_suspect),
    [columns]
  );

  const typeIcon = (type: string) => {
    switch (type) {
      case 'integer':
      case 'float':
        return <Hash size={12} />;
      case 'datetime':
        return <Calendar size={12} />;
      case 'boolean':
        return <CheckSquare size={12} />;
      case 'categorical':
        return <Layers size={12} />;
      default:
        return <Type size={12} />;
    }
  };

  // Attach stable original indices
  const indexedRows = useMemo<(Record<string, any> & { __origIdx: number })[]>(() => {
    return rows.map((r, idx) => ({ ...r, __origIdx: idx }));
  }, [rows]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return indexedRows;
    const term = searchTerm.toLowerCase();
    return indexedRows.filter((row) =>
      columns.some((col) => {
        const val = row[col.name];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }, [indexedRows, searchTerm, columns]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortAsc ? -1 : 1;
      if (strA > strB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortCol, sortAsc]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(colName);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === sortedRows.length && sortedRows.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      const allIds = new Set(sortedRows.map((r) => r.__origIdx));
      setSelectedRowIds(allIds);
    }
  };

  const toggleSelectRow = (origIdx: number) => {
    const next = new Set(selectedRowIds);
    if (next.has(origIdx)) {
      next.delete(origIdx);
    } else {
      next.add(origIdx);
    }
    setSelectedRowIds(next);
  };

  const handleCleanTrigger = () => {
    const selected = rows.filter((_, idx) => selectedRowIds.has(idx));
    const targetRows = selected.length > 0 ? selected : rows;
    if (onCleanData) {
      onCleanData(targetRows);
    }
  };

  const isAllSelected = sortedRows.length > 0 && sortedRows.every((r) => selectedRowIds.has(r.__origIdx));

  // Render cell content
  const renderCellContent = (row: Record<string, any>, col: ColumnSchema) => {
    const val = row[col.name];

    if (val === null || val === undefined || val === '') {
      return <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.8125rem' }}>—</span>;
    }

    if (col.is_pii_suspect && maskPii) {
      return (
        <span
          className="badge badge-warning"
          style={{
            fontSize: '0.75rem',
            padding: '0.15rem 0.45rem',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
          title="PII Redacted for safety. Toggle 'Mask PII' to view raw values."
        >
          ••••••••
        </span>
      );
    }

    if (typeof val === 'boolean') {
      return (
        <span className={`badge ${val ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.75rem' }}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle)' }}>
      {/* Table Header / Toolbar */}
      <div
        style={{
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: 260 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              className="input"
              placeholder="Search preview rows..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem', padding: '0.4rem 0.75rem 0.4rem 2.25rem' }}
              id="preview-search-input"
            />
          </div>

          {/* Quick Metrics Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
              <TableIcon size={12} /> {columns.length} columns
            </span>
            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
              <Database size={12} /> {totalRows > 0 ? `${totalRows.toLocaleString()} rows` : `${rows.length} rows`}
            </span>
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* PII Toggle Button */}
          {hasPiiColumns && (
            <button
              type="button"
              className={`btn btn-sm ${maskPii ? 'btn-secondary' : 'btn-warning'}`}
              onClick={() => setMaskPii(!maskPii)}
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem' }}
              title={maskPii ? 'Click to reveal raw values for PII fields' : 'Click to mask PII values'}
              id="toggle-pii-mask-btn"
            >
              {maskPii ? (
                <>
                  <ShieldCheck size={14} style={{ color: 'var(--color-warning)' }} />
                  <span>PII Masked</span>
                  <Eye size={12} style={{ opacity: 0.7 }} />
                </>
              ) : (
                <>
                  <ShieldAlert size={14} />
                  <span>Raw PII Visible</span>
                  <EyeOff size={12} />
                </>
              )}
            </button>
          )}

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Showing {paginatedRows.length} of {rows.length} sampled
            {totalRows > rows.length ? ` (${totalRows.toLocaleString()} total)` : ''}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Loading Data Preview...</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Fetching sampled records and column schema details
          </p>
        </div>
      ) : columns.length === 0 || rows.length === 0 ? (
        /* Empty Preview State */
        <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <TableIcon size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>No Data Records in Preview</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {searchTerm ? `No rows matched your search "${searchTerm}".` : 'No preview records could be found for this dataset version.'}
          </p>
          {searchTerm && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm('')} style={{ marginTop: '0.75rem' }}>
              Clear Search
            </button>
          )}
        </div>
      ) : (
        /* Data Table */
        <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: 44, textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                    title="Select all rows"
                    id="select-all-preview-rows"
                  />
                </th>
                {columns.map((col) => {
                  const isSorted = sortCol === col.name;
                  return (
                    <th
                      key={col.name}
                      onClick={() => handleSort(col.name)}
                      style={{
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        borderBottom: '1px solid var(--border-subtle)',
                        padding: '0.625rem 0.875rem',
                      }}
                      title={`Sort by ${col.name}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ fontWeight: 600, color: isSorted ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                          {col.name}
                        </span>
                        <span
                          className="badge badge-primary"
                          style={{
                            padding: '0.1rem 0.4rem',
                            fontSize: '0.6875rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          {typeIcon(col.inferred_type)} {col.inferred_type}
                        </span>
                        {col.is_pii_suspect && (
                          <span
                            className="badge badge-warning"
                            title="PII Sensitive Column (e.g. Email, Phone, Personal ID)"
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.625rem' }}
                          >
                            <ShieldAlert size={10} /> PII
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', opacity: isSorted ? 1 : 0.4 }}>
                          {isSorted ? (
                            sortAsc ? <ArrowUp size={13} style={{ color: 'var(--color-primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <ArrowUpDown size={12} style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const origIdx = row.__origIdx;
                const isSelected = selectedRowIds.has(origIdx);
                return (
                  <tr
                    key={origIdx ?? idx}
                    style={{
                      background: isSelected ? 'var(--color-primary-subtle)' : undefined,
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <td style={{ textAlign: 'center', width: 44 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(origIdx)}
                        style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                      />
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '0.625rem 0.875rem',
                          fontSize: '0.8125rem',
                          maxWidth: '280px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {renderCellContent(row, col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Footer Bar */}
      <div
        style={{
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          {selectedRowIds.size > 0 && (
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Check size={12} /> {selectedRowIds.size} row{selectedRowIds.size > 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Pagination Controls */}
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              id="preview-prev-page-btn"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              id="preview-next-page-btn"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          {/* Download CSV Action Button */}
          {onDownload && (
            <button
              className="btn btn-secondary"
              onClick={onDownload}
              id="download-preview-csv-btn"
              style={{ fontWeight: 600, padding: '0.5rem 1.125rem' }}
            >
              <Download size={16} /> Download CSV
            </button>
          )}

          {/* Clean Data Action Button */}
          <button
            className="btn btn-primary glow-primary"
            onClick={handleCleanTrigger}
            id="clean-selected-data-btn"
            style={{ fontWeight: 600, padding: '0.5rem 1.25rem' }}
          >
            <Sparkles size={16} /> Clean Data {selectedRowIds.size > 0 ? `(${selectedRowIds.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
