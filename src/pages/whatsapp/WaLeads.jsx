import React, { useEffect, useState, useCallback } from 'react'
import { Users, Search, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { waLeads, waSessions } from '../../services/whatsappApi'
import DashboardLayout from '../../layouts/DashboardLayout'
import './whatsapp.css'

const STATUS_CONFIG = {
  WHATSAPP_AVAILABLE:     { cls: 'green',  label: '✓ Available' },
  WHATSAPP_NOT_AVAILABLE: { cls: 'gray',   label: '✗ Not Available' },
  CHECKING:               { cls: 'yellow', label: '⟳ Checking…' },
  CHECK_FAILED:           { cls: 'red',    label: '⚠ Check Failed' },
  INVALID_NUMBER:         { cls: 'red',    label: '✗ Invalid Number' },
  NOT_CHECKED:            { cls: 'gray',   label: '— Not Checked' },
}

function WaStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['NOT_CHECKED']
  return <span className={`wa-badge wa-badge-${cfg.cls}`}>{cfg.label}</span>
}

export default function WaLeads() {
  const [leads, setLeads]       = useState([])
  const [sessions, setSessions] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [sessionId, setSessionId] = useState('')
  const [selected, setSelected]   = useState(new Set())
  const [checking, setChecking]   = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [leadsRes, sessRes] = await Promise.all([
      waLeads.list({ page, limit: 50 }).catch(() => ({ leads: [], total: 0 })),
      waSessions.list().catch(() => ({ sessions: [] }))
    ])
    setLeads(leadsRes.leads || [])
    setTotal(leadsRes.total || 0)
    setSessions((sessRes.sessions || []).filter(s => s.status === 'CONNECTED'))
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  // Filtered view (client-side search)
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.company?.toLowerCase().includes(q)
  })

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(l => l.id)))
  }

  const handleCheckBulk = async () => {
    if (!sessionId) return alert('Please select a connected session first')
    if (selected.size === 0) return alert('Please select at least one lead')
    setChecking(true)
    try {
      await waLeads.checkBulk([...selected], sessionId)
      alert(`Queued ${selected.size} leads for WhatsApp check. Status will update automatically.`)
      setSelected(new Set())
      setTimeout(load, 5000)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  const stats = {
    available:    leads.filter(l => l.whatsapp_lead_status?.whatsapp_status === 'WHATSAPP_AVAILABLE').length,
    notAvailable: leads.filter(l => l.whatsapp_lead_status?.whatsapp_status === 'WHATSAPP_NOT_AVAILABLE').length,
    unchecked:    leads.filter(l => !l.whatsapp_lead_status?.whatsapp_status).length,
  }

  return (
    <DashboardLayout>
      <div className="wa-page">
      <div className="wa-page-header">
        <h1 className="wa-page-title"><Users size={24} className="wa-icon" /> WhatsApp Leads</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="wa-form-select" style={{ width: 'auto', padding: '8px 12px' }} value={sessionId} onChange={e => setSessionId(e.target.value)}>
            <option value="">Select session to check…</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name} — {s.phone_number}</option>)}
          </select>
          <button className="wa-btn wa-btn-primary" disabled={checking || selected.size === 0 || !sessionId} onClick={handleCheckBulk}>
            {checking ? <span className="wa-spinner" /> : <CheckCircle size={16} />}
            Check WA Status ({selected.size})
          </button>
          <button className="wa-btn wa-btn-secondary" onClick={load}><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="wa-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="wa-stat-card"><div className="wa-stat-label">WA Available</div><div className="wa-stat-value" style={{ color: '#25d366' }}>{stats.available}</div></div>
        <div className="wa-stat-card"><div className="wa-stat-label">Not Available</div><div className="wa-stat-value" style={{ color: '#9ca3af' }}>{stats.notAvailable}</div></div>
        <div className="wa-stat-card"><div className="wa-stat-label">Not Checked</div><div className="wa-stat-value" style={{ color: '#fbbf24' }}>{stats.unchecked}</div></div>
      </div>

      <div className="wa-card">
        {/* Search + select all */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input className="wa-form-input" style={{ paddingLeft: 32 }} placeholder="Search by name, phone, company…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : `Select All (${filtered.length})`}
          </button>
        </div>

        {loading ? (
          <div className="wa-empty"><div className="wa-spinner" /><p>Loading leads…</p></div>
        ) : filtered.length === 0 ? (
          <div className="wa-empty"><div className="wa-empty-icon">👥</div><p>No leads found</p></div>
        ) : (
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th>WA Status</th>
                  <th>Last Checked</th>
                  <th>Opted Out</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const ws = l.whatsapp_lead_status
                  return (
                    <tr key={l.id}>
                      <td><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
                      <td style={{ fontWeight: 500 }}>{l.name || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.phone}</td>
                      <td>{l.company || '—'}</td>
                      <td><WaStatusBadge status={ws?.whatsapp_status || 'NOT_CHECKED'} /></td>
                      <td style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {ws?.last_checked_at ? new Date(ws.last_checked_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        {ws?.opted_out
                          ? <span className="wa-badge wa-badge-red"><XCircle size={12} /> Opted Out</span>
                          : <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: '0.82rem', color: '#6b7280' }}>
          <span>Showing {filtered.length} of {total} leads</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ padding: '4px 8px', color: 'var(--text-primary, #f3f4f6)' }}>Page {page}</span>
            <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={filtered.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  )
}
