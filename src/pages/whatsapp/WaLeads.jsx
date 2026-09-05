import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, RefreshCw, CheckCircle, XCircle, Send, Tag } from 'lucide-react'
import { waLeads, waSessions, waCampaigns } from '../../services/whatsappApi'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { CreateModal } from './WaCampaigns'
import WaLayout from './WaLayout'
import './whatsapp.css'

const WA_STATUS_CONFIG = {
  WHATSAPP_AVAILABLE:     { cls: 'green',  label: '✓ Available' },
  WHATSAPP_NOT_AVAILABLE: { cls: 'gray',   label: '✗ Not Available' },
  CHECKING:               { cls: 'yellow', label: '⟳ Checking…' },
  CHECK_FAILED:           { cls: 'red',    label: '⚠ Check Failed' },
  INVALID_NUMBER:         { cls: 'red',    label: '✗ Invalid Number' },
  NOT_CHECKED:            { cls: 'gray',   label: '— Not Checked' },
}

const LEAD_STATUS_COLORS = {
  'New Lead':    '#3b82f6',
  'In Progress': '#f59e0b',
  'Connected':   '#8b5cf6',
  'Interested':  '#06b6d4',
  'Negotiation': '#f97316',
  'Won':         '#22c55e',
  'Lost':        '#ef4444',
}

function WaStatusBadge({ status }) {
  const cfg = WA_STATUS_CONFIG[status] || WA_STATUS_CONFIG['NOT_CHECKED']
  return <span className={`wa-badge wa-badge-${cfg.cls}`}>{cfg.label}</span>
}

function LeadStatusBadge({ status }) {
  const color = LEAD_STATUS_COLORS[status] || '#6b7280'
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10,
      background: color + '22', color, border: `1px solid ${color}44`, whiteSpace: 'nowrap'
    }}>
      {status || '—'}
    </span>
  )
}

export default function WaLeads() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [leads, setLeads]       = useState([])
  const [sessions, setSessions] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [sessionId, setSessionId] = useState('')
  const [selected, setSelected]   = useState(new Set())
  const [checking, setChecking]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [showCreateCampaign, setShowCreateCampaign] = useState(false)
  const leadsRef = useRef([])

  const load = useCallback(async () => {
    setLoading(true)
    const [leadsRes, sessRes] = await Promise.all([
      // mine=true → only leads assigned to the current user (matches /leads/mine)
      waLeads.list({ page, limit: 500, mine: 'true' }).catch(() => ({ leads: [], total: 0 })),
      waSessions.list().catch(() => ({ sessions: [] }))
    ])
    const fetchedLeads = leadsRes.leads || []
    setLeads(fetchedLeads)
    leadsRef.current = fetchedLeads
    setTotal(leadsRes.total || 0)
    setSessions((sessRes.sessions || []).filter(s => s.status === 'CONNECTED'))
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  // ── Real-time: update WA status inline when check worker updates the DB ───
  useEffect(() => {
    if (!user?.uid && !user?.id) return

    const channel = supabase
      .channel('wa-leads-status-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_lead_status' },
        (payload) => {
          const updated = payload.new
          if (!updated?.lead_id) return
          setLeads(prev => prev.map(lead => {
            if (lead.id !== updated.lead_id) return lead
            return {
              ...lead,
              whatsapp_lead_status: {
                whatsapp_status:  updated.opted_out ? 'WHATSAPP_NOT_AVAILABLE' : (updated.whatsapp_status || 'NOT_CHECKED'),
                normalized_phone: updated.normalized_phone || lead.phone,
                whatsapp_link:    updated.whatsapp_link || '',
                last_checked_at:  updated.last_checked_at || null,
                opted_out:        updated.opted_out || false,
                check_error:      updated.check_error || null
              }
            }
          }))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id])

  // ── Real-time: reload when a new lead is added/updated ────────────────────
  // This keeps WaLeads in sync with /leads/mine without manual refresh
  useEffect(() => {
    if (!user?.id) return

    const leadsChannel = supabase
      .channel('wa-leads-list-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        () => { load() }   // new lead added → re-fetch my leads
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          // Only re-fetch if the update touches assigned_to (reassignment)
          if (payload.old?.assigned_to !== payload.new?.assigned_to) load()
        }
      )
      .subscribe()

    return () => supabase.removeChannel(leadsChannel)
  }, [user?.id, load])



  // Filtered view (client-side search)
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.company?.toLowerCase().includes(q) || l.status?.toLowerCase().includes(q)
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

  const handleCreateCampaign = async (form) => {
    const res = await waCampaigns.create(form)
    setShowCreateCampaign(false)
    const count = selected.size
    setSelected(new Set())
    alert(`Campaign "${res.campaign?.name || form.name}" created successfully targeting ${count} selected leads!\n\nGo to Campaigns tab to start it.`)
    navigate('/whatsapp/campaigns')
  }

  const stats = {
    total:     leads.length,
    available: leads.filter(l => l.whatsapp_lead_status?.whatsapp_status === 'WHATSAPP_AVAILABLE').length,
    notAvailable: leads.filter(l => l.whatsapp_lead_status?.whatsapp_status === 'WHATSAPP_NOT_AVAILABLE').length,
    unchecked: leads.filter(l => !l.whatsapp_lead_status?.whatsapp_status || l.whatsapp_lead_status?.whatsapp_status === 'NOT_CHECKED').length,
  }

  const headerActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {selected.size > 0 && (
        <button
          className="wa-btn wa-btn-primary"
          onClick={() => setShowCreateCampaign(true)}
          style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', color: '#fff', fontWeight: 600 }}
        >
          <Send size={15} /> Create Campaign ({selected.size} leads)
        </button>
      )}
      <select className="wa-form-select" style={{ width: 'auto', padding: '8px 12px' }} value={sessionId} onChange={e => setSessionId(e.target.value)}>
        <option value="">Select session to check…</option>
        {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name} — {s.phone_number}</option>)}
      </select>
      <button className="wa-btn wa-btn-primary" disabled={checking || selected.size === 0 || !sessionId} onClick={handleCheckBulk}>
        {checking ? <span className="wa-spinner" /> : <CheckCircle size={16} />}
        Check WA ({selected.size})
      </button>
      <button className="wa-btn wa-btn-secondary" onClick={load}><RefreshCw size={16} /></button>
    </div>
  )

  return (
    <WaLayout title="My Leads" headerActions={headerActions}>
      <div className="wa-page">
        {/* Quick stats */}
        <div className="wa-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="wa-stat-card">
            <div className="wa-stat-label">My Leads</div>
            <div className="wa-stat-value" style={{ color: '#818cf8' }}>{stats.total}</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-label">WA Available</div>
            <div className="wa-stat-value" style={{ color: '#25d366' }}>{stats.available}</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-label">Not Available</div>
            <div className="wa-stat-value" style={{ color: '#9ca3af' }}>{stats.notAvailable}</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-label">Not Checked</div>
            <div className="wa-stat-value" style={{ color: '#fbbf24' }}>{stats.unchecked}</div>
          </div>
        </div>

        {selected.size > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', fontSize: '0.85rem', color: '#25d366', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} />
            <strong>{selected.size}</strong> lead(s) selected —
            <button className="wa-btn wa-btn-primary" style={{ fontSize: '0.78rem', padding: '4px 12px' }} onClick={() => setShowCreateCampaign(true)}>
              <Send size={13} /> Create WhatsApp Campaign
            </button>
            <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => setSelected(new Set())}>
              Clear Selection
            </button>
          </div>
        )}

        <div className="wa-card">
          {/* Search + select all */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input className="wa-form-input" style={{ paddingLeft: 32 }} placeholder="Search by name, phone, company, status…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} onClick={selectAll}>
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : `Select All (${filtered.length})`}
            </button>
          </div>

          {loading ? (
            <div className="wa-empty"><div className="wa-spinner" /><p>Loading your leads…</p></div>
          ) : filtered.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">👥</div>
              <p>{search ? 'No leads match your search' : 'No leads assigned to you yet'}</p>
            </div>
          ) : (
            <div className="wa-table-wrap">
              <table className="wa-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>WA Status</th>
                    <th>Last Checked</th>
                    <th>Opted Out</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const ws = l.whatsapp_lead_status
                    return (
                      <tr key={l.id} style={{ background: selected.has(l.id) ? 'rgba(37,211,102,0.05)' : undefined }}>
                        <td><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
                        <td style={{ fontWeight: 500 }}>{l.name || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.phone}</td>
                        <td style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{l.company || '—'}</td>
                        <td><LeadStatusBadge status={l.status} /></td>
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
              <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={leads.length < 100} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        </div>

        {showCreateCampaign && (
          <CreateModal
            preSelectedLeadIds={[...selected]}
            onSave={handleCreateCampaign}
            onClose={() => setShowCreateCampaign(false)}
          />
        )}
      </div>
    </WaLayout>
  )
}
