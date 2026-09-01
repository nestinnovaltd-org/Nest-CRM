import React, { useEffect, useState, useCallback } from 'react'
import { Send, Plus, Play, Pause, StopCircle, X, RefreshCw, CheckCircle, Search, Users } from 'lucide-react'
import { waCampaigns, waSessions, waTemplates, waLeads } from '../../services/whatsappApi'
import WaLayout from './WaLayout'
import './whatsapp.css'

const STATUS_CFG = {
  DRAFT:     { cls: 'gray',   label: 'Draft' },
  RUNNING:   { cls: 'green',  label: '● Running' },
  PAUSED:    { cls: 'yellow', label: '⏸ Paused' },
  STOPPED:   { cls: 'red',    label: '■ Stopped' },
  COMPLETED: { cls: 'blue',   label: '✓ Completed' },
  SCHEDULED: { cls: 'purple', label: '⏰ Scheduled' },
}

function CampaignBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG['DRAFT']
  return <span className={`wa-badge wa-badge-${cfg.cls}`}>{cfg.label}</span>
}

export function CreateModal({ onSave, onClose, preSelectedLeadIds = [] }) {
  const [sessions, setSessions]     = useState([])
  const [templates, setTemplates]   = useState([])
  const [allLeads, setAllLeads]     = useState([])
  const [targetType, setTargetType] = useState(preSelectedLeadIds.length > 0 ? 'selected' : 'all')
  const [selectedStatus, setSelectedStatus]   = useState('')
  const [selectedLeadIds, setSelectedLeadIds] = useState(preSelectedLeadIds)
  const [leadSearch, setLeadSearch]           = useState('')

  const [form, setForm] = useState({
    name: '', session_id: '', template_id: '',
    min_delay_seconds: 5, max_delay_seconds: 15,
    consent_confirmed: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    Promise.all([
      waSessions.list().catch(() => ({ sessions: [] })),
      waTemplates.list().catch(() => ({ templates: [] })),
      waLeads.list({ limit: 500, mine: 'true' }).catch(() => ({ leads: [] }))
    ]).then(([s, t, l]) => {
      setSessions((s.sessions || []).filter(ses => ses.status === 'CONNECTED' || ses.live_status === 'CONNECTED'))
      setTemplates(t.templates || [])
      setAllLeads(l.leads || [])
    })
  }, [])


  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleLeadSelect = (id) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const filteredLeadsList = allLeads.filter(l => {
    const q = leadSearch.toLowerCase()
    return !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.company?.toLowerCase().includes(q)
  })

  const selectAllFilteredLeads = () => {
    const filteredIds = filteredLeadsList.map(l => l.id)
    const allSelected = filteredIds.every(id => selectedLeadIds.includes(id))
    if (allSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedLeadIds(prev => Array.from(new Set([...prev, ...filteredIds])))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    let lead_filter = {}
    if (targetType === 'selected') {
      if (selectedLeadIds.length === 0) {
        setError('Please select at least one target lead.')
        return
      }
      lead_filter = { lead_ids: selectedLeadIds }
    } else if (targetType === 'status') {
      if (!selectedStatus) {
        setError('Please select a lead status filter.')
        return
      }
      lead_filter = { status: selectedStatus }
    }

    setSaving(true)
    try {
      await onSave({ ...form, lead_filter })
    } catch (err) {
      setError(err.message || 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">Create Campaign</span>
          <button className="wa-btn-icon" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="wa-form">
          <div className="wa-form-group">
            <label className="wa-form-label">Campaign Name *</label>
            <input className="wa-form-input" placeholder="e.g. July Project Launch" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>

          <div className="wa-form-group">
            <label className="wa-form-label">WhatsApp Session *</label>
            <select className="wa-form-select" value={form.session_id} onChange={e => set('session_id', e.target.value)} required>
              <option value="">Select connected session…</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name} — {s.phone_number}</option>)}
            </select>
            {sessions.length === 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>No connected sessions. Please connect a session first.</span>}
          </div>

          <div className="wa-form-group">
            <label className="wa-form-label">Message Template *</label>
            <select className="wa-form-select" value={form.template_id} onChange={e => set('template_id', e.target.value)} required>
              <option value="">Select template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Target Audience Section */}
          <div className="wa-form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
            <label className="wa-form-label" style={{ fontWeight: 600, color: 'var(--primary, #25d366)', marginBottom: 8, display: 'block' }}>🎯 Target Audience / Leads</label>
            
            <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="radio" name="targetType" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} />
                All My Leads
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="radio" name="targetType" value="status" checked={targetType === 'status'} onChange={() => setTargetType('status')} />
                Filter by Status
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="radio" name="targetType" value="selected" checked={targetType === 'selected'} onChange={() => setTargetType('selected')} />
                Select Specific Leads ({selectedLeadIds.length})
              </label>
            </div>

            {targetType === 'status' && (
              <select className="wa-form-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} required>
                <option value="">Select lead status filter…</option>
                <option value="New Lead">New Lead</option>
                <option value="In Progress">In Progress</option>
                <option value="Connected">Connected</option>
                <option value="Interested">Interested</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            )}

            {targetType === 'selected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    className="wa-form-input" 
                    placeholder="Search leads by name, phone, company…" 
                    value={leadSearch} 
                    onChange={e => setLeadSearch(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  />
                  <button type="button" className="wa-btn wa-btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px', whitespace: 'nowrap' }} onClick={selectAllFilteredLeads}>
                    Select All ({filteredLeadsList.length})
                  </button>
                </div>

                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', background: 'rgba(0,0,0,0.2)' }}>
                  {filteredLeadsList.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', padding: '8px 0', textAlign: 'center' }}>No leads found</div>
                  ) : (
                    filteredLeadsList.map(l => (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedLeadIds.includes(l.id)} 
                          onChange={() => toggleLeadSelect(l.id)} 
                        />
                        <span style={{ fontWeight: 500 }}>{l.name || 'Unnamed'}</span>
                        <span style={{ fontFamily: 'monospace', color: '#9ca3af', fontSize: '0.75rem' }}>{l.phone}</span>
                        {l.company && <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>({l.company})</span>}
                      </label>
                    ))
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#25d366' }}>
                  ✓ Selected <strong>{selectedLeadIds.length}</strong> lead(s) for this campaign
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="wa-form-group">
              <label className="wa-form-label">Min Delay (sec)</label>
              <input className="wa-form-input" type="number" min={1} value={form.min_delay_seconds} onChange={e => set('min_delay_seconds', e.target.value)} />
            </div>
            <div className="wa-form-group">
              <label className="wa-form-label">Max Delay (sec)</label>
              <input className="wa-form-input" type="number" min={1} value={form.max_delay_seconds} onChange={e => set('max_delay_seconds', e.target.value)} />
            </div>
          </div>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.82rem', padding: '8px 0' }}>⚠ {error}</div>
          )}
          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving || !form.session_id || !form.template_id || !form.name}>
              {saving ? <span className="wa-spinner" /> : <Plus size={16} />}
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function WaCampaigns() {
  const [campaigns, setCampaigns]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await waCampaigns.list()
      setCampaigns(res.campaigns || [])
      setLastUpdated(new Date())
    } catch {
      // keep existing list on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 10s
  useEffect(() => {
    const t = setInterval(() => load(true), 10_000)
    return () => clearInterval(t)
  }, [load])

  const withAction = (id, fn) => async () => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    try {
      await fn()
      await load(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleCreate = async (data) => {
    // Will throw if create fails — caught in CreateModal
    const res = await waCampaigns.create(data)
    const newCampaign = res.campaign

    // Optimistically insert into list immediately
    if (newCampaign) {
      setCampaigns(prev => [newCampaign, ...prev])
    }
    setShowCreate(false)

    // Background refresh for full join data (session name, template name)
    setTimeout(() => load(true), 800)
  }

  const getProgress = (c) => {
    const total = c.total_recipients || 0
    if (!total) return 0
    return Math.round(((c.sent_count || 0) / total) * 100)
  }

  const headerActions = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {lastUpdated && (
        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Updated {lastUpdated.toLocaleTimeString()}</span>
      )}
      <button className="wa-btn wa-btn-secondary" onClick={() => load()} title="Refresh"><RefreshCw size={15} /></button>
      <button className="wa-btn wa-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New Campaign</button>
    </div>
  )

  return (
    <WaLayout title="Campaigns" headerActions={headerActions}>
      <div className="wa-page">
        {loading && campaigns.length === 0 ? (
          <div className="wa-empty"><div className="wa-spinner" /><p>Loading campaigns…</p></div>
        ) : campaigns.length === 0 ? (
          <div className="wa-card">
            <div className="wa-empty">
              <div className="wa-empty-icon">📤</div><p>No campaigns yet</p>
              <button className="wa-btn wa-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Campaign</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map(c => {
              const pct  = getProgress(c)
              const busy = actionLoading[c.id]
              return (
                <div key={c.id} className="wa-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</span>
                        <CampaignBadge status={c.status} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                        Session: {c.whatsapp_sessions?.session_name || '—'} · Template: {c.whatsapp_templates?.name || '—'}
                        {c.created_at && <> · {new Date(c.created_at).toLocaleDateString()}</>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {c.status === 'DRAFT' && (
                        <button className="wa-btn wa-btn-primary" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={withAction(c.id, () => waCampaigns.start(c.id))}>
                          {busy ? <span className="wa-spinner" /> : <Play size={14} />} Start
                        </button>
                      )}
                      {c.status === 'RUNNING' && (
                        <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={withAction(c.id, () => waCampaigns.pause(c.id))}>
                          {busy ? <span className="wa-spinner" /> : <Pause size={14} />} Pause
                        </button>
                      )}
                      {c.status === 'PAUSED' && (
                        <button className="wa-btn wa-btn-primary" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={withAction(c.id, () => waCampaigns.resume(c.id))}>
                          {busy ? <span className="wa-spinner" /> : <Play size={14} />} Resume
                        </button>
                      )}
                      {['RUNNING', 'PAUSED'].includes(c.status) && (
                        <button className="wa-btn wa-btn-danger" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={withAction(c.id, async () => {
                          if (!window.confirm(`Stop campaign "${c.name}"? This cannot be resumed.`)) return
                          await waCampaigns.stop(c.id)
                        })}>
                          {busy ? <span className="wa-spinner" /> : <StopCircle size={14} />} Stop
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: 6 }}>
                      <span>{c.sent_count || 0} sent · {c.failed_count || 0} failed</span>
                      <span>{pct}% · {c.total_recipients || 0} total</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: c.status === 'RUNNING' ? '#25d366' : '#818cf8', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>

                  {c.pause_reason && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#fbbf24', display: 'flex', gap: 6 }}>
                      ⚠ {c.pause_reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showCreate && <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      </div>
    </WaLayout>
  )
}

