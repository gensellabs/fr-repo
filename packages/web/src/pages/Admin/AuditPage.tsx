import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface AuditEntry {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');

  useEffect(() => {
    const params = tableFilter ? { table: tableFilter } : undefined;
    apiClient.getAuditLog(params)
      .then((data) => setEntries(data as AuditEntry[]))
      .finally(() => setLoading(false));
  }, [tableFilter]);

  const actionColor: Record<string, string> = { CREATE: '#16a34a', UPDATE: '#2563eb', DEACTIVATE: '#dc2626' };

  return (
    <div>
      <div style={toolbar}>
        <h2 style={pageTitle}>Audit Log</h2>
        <input style={filterInput} placeholder="Filter by table name..." value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} />
      </div>
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>Loading...</p>
      ) : (
        <table style={tbl}>
          <thead>
            <tr style={thead}>
              {['When', 'Table', 'Action', 'Record ID', 'Old Value', 'New Value', 'Changed By'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={tr}>
                <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
                  {new Date(e.changedAt).toLocaleString('en-ZA')}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{e.tableName}</td>
                <td style={td}>
                  <span style={{ fontWeight: 700, color: actionColor[e.action] ?? '#374151', fontSize: 13 }}>{e.action}</span>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>{e.recordId}</td>
                <td style={{ ...td, color: '#9ca3af', fontSize: 13 }}>{e.oldValue ?? '—'}</td>
                <td style={{ ...td, fontSize: 13 }}>{e.newValue ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600, fontSize: 13 }}>{e.changedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const toolbar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const pageTitle: React.CSSProperties = { fontSize: 22, fontWeight: 700 };
const filterInput: React.CSSProperties = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, width: 220 };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 14 };
