import React, { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { waMessages, waAI } from '../../services/whatsappApi'
import DashboardLayout from '../../layouts/DashboardLayout'
import './whatsapp.css'

export default function WaLogs() {
  const [logs, setLogs]   = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [tab, setTab]     = useState('messages')   // 'messages' | 'ai'
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'messages') {
      const res = await waMessages.logs({ page, limit: 50 }).catch(() => ({ logs: [], total: 0 }))
      setLogs(res.logs || [])
      setTotal(res.total || 0)
    } else {
      const res = await waAI.getLogs({ page, limit: 50 }).catch(() => ({ logs: [], total: 0 }))
      setLogs(res.logs || [])
      setTotal(res.total || 0)
    }
    setLoading(false)
  }, [tab, page])

  useEffect(() => { setPage(1) }, [tab])
  useEffect(() => { load() }, [load])

  return (
    <DashboardLayout>
      <div className="wa-page">
      <div className="wa-page-header">
        <h1 className="wa-page-title"><Activity size={24} className="wa-icon" /> Logs</h1>
        <button className="wa-btn wa-btn-secondary" onClick={load}><RefreshCw size={16} /></button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
        {[{ id: 'messages', label: '📤 Message Logs' }, { id: 'ai', label: '🤖 AI Logs' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
            color: tab === t.id ? '#25d366' : '#6b7280',
            borderBottom: tab === t.id ? '2px solid #25d366' : '2px solid transparent',
            transition: 'all 0.2s'
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="wa-empty"><div className="wa-spinner" /><p>Loading…</p></div>
      ) : logs.length === 0 ? (
        <div className="wa-empty"><div className="wa-empty-icon">📋</div><p>No logs yet</p></div>
      ) : tab === 'messages' ? (
        <div className="wa-card">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr><th>Time</th><th>Direction</th><th>Source</th><th>Status</th><th>AI</th><th>Preview</th></tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`wa-badge wa-badge-${l.direction === 'INBOUND' ? 'blue' : 'green'}`}>{l.direction}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{l.message_source}</td>
                    <td>
                      <span className={`wa-badge wa-badge-${l.status === 'SENT' ? 'green' : l.status === 'FAILED' ? 'red' : 'yellow'}`}>{l.status}</span>
                    </td>
                    <td>{l.is_ai_generated ? <span className="wa-badge wa-badge-purple">AI</span> : '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: '#9ca3af', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.message_body?.slice(0, 80) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="wa-card">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr><th>Time</th><th>Model</th><th>Tokens</th><th>Sent</th><th>Escalation</th><th>Rejection</th><th>Latency</th></tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{l.model}</td>
                    <td style={{ fontSize: '0.82rem' }}>{l.total_tokens}</td>
                    <td>{l.was_sent ? <span className="wa-badge wa-badge-green">Sent</span> : <span className="wa-badge wa-badge-red">Blocked</span>}</td>
                    <td>{l.escalation_detected ? <span className="wa-badge wa-badge-yellow">Yes</span> : '—'}</td>
                    <td style={{ fontSize: '0.72rem', color: '#ef4444' }}>{l.rejection_reason || '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{l.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#6b7280' }}>
        <span>{total} total records</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ padding: '4px 8px', color: 'var(--text-primary, #f3f4f6)' }}>Page {page}</span>
          <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={logs.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>
      </div>
    </DashboardLayout>
  )
}
