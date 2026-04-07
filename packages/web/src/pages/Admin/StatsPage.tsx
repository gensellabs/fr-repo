import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface Stats {
  totalIncidents: number;
  totalPatients: number;
  topCallTypes: Array<{ callType: string; count: number }>;
  monthlyIncidents: Array<{ month: string; count: number }>;
}

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getStats()
      .then((data) => setStats(data as Stats))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>Loading...</p>;
  if (!stats) return null;

  const maxMonthly = Math.max(...stats.monthlyIncidents.map((m) => m.count), 1);

  return (
    <div>
      <h2 style={pageTitle}>Statistics</h2>

      <div style={kpiRow}>
        <div style={kpi}>
          <span style={kpiNum}>{stats.totalIncidents}</span>
          <span style={kpiLabel}>Total Incidents</span>
        </div>
        <div style={kpi}>
          <span style={kpiNum}>{stats.totalPatients}</span>
          <span style={kpiLabel}>Total Patients</span>
        </div>
        <div style={kpi}>
          <span style={kpiNum}>
            {stats.totalIncidents > 0 ? (stats.totalPatients / stats.totalIncidents).toFixed(1) : '0'}
          </span>
          <span style={kpiLabel}>Avg Patients / Incident</span>
        </div>
      </div>

      <div style={twoCol}>
        <div style={card}>
          <h3 style={cardTitle}>Monthly Incidents (Last 12 months)</h3>
          {stats.monthlyIncidents.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No data yet.</p>
          ) : (
            <div style={barChart}>
              {stats.monthlyIncidents.map((m) => (
                <div key={m.month} style={barItem}>
                  <div style={{ ...bar, height: `${(m.count / maxMonthly) * 120}px` }} title={`${m.count}`} />
                  <span style={barLabel}>{m.month.slice(5)}</span>
                  <span style={barCount}>{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Top Call Types</h3>
          {stats.topCallTypes.map((ct, i) => (
            <div key={i} style={callTypeRow}>
              <span style={{ ...rank, backgroundColor: i < 3 ? '#fef2f2' : '#f3f4f6', color: i < 3 ? '#dc2626' : '#6b7280' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{ct.callType}</span>
              <span style={callCount}>{ct.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const pageTitle: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginBottom: 20 };
const kpiRow: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 20 };
const kpi: React.CSSProperties = { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', textAlign: 'center' };
const kpiNum: React.CSSProperties = { display: 'block', fontSize: 36, fontWeight: 800, color: '#dc2626' };
const kpiLabel: React.CSSProperties = { fontSize: 13, color: '#6b7280' };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const card: React.CSSProperties = { backgroundColor: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 16 };
const barChart: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '8px 0' };
const barItem: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 };
const bar: React.CSSProperties = { width: '100%', backgroundColor: '#dc2626', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s' };
const barLabel: React.CSSProperties = { fontSize: 10, color: '#9ca3af' };
const barCount: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374151' };
const callTypeRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' };
const rank: React.CSSProperties = { width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, lineHeight: '28px', textAlign: 'center' };
const callCount: React.CSSProperties = { fontWeight: 700, color: '#374151', fontSize: 14 };
