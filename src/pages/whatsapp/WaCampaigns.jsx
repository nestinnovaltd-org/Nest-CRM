import React, { useEffect, useState, useCallback } from 'react'
import { Send, Plus, Play, Pause, StopCircle, X, AlertTriangle, ChevronRight } from 'lucide-react'
import { waCampaigns, waSessions, waTemplates } from '../../services/whatsappApi'
import DashboardLayout from '../../layouts/DashboardLayout'
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

function CreateModal({ onSave, onClose }) {
  const [sessions, setSessions]   = useState([])
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({
    name: '', session_id: '', template_id: '',
    daily_limit: 200, min_delay_seconds: 10, max_delay_seconds: 25,
    consent_confirmed: false
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      waSessions.list().catch(() => ({ sessions: [] })),
      waTemplates.list().catch(() => ({ templates: [] }))
    ]).then(([s, t]) => {
      setSessions((s.sessions || []).filter(ses => ses.status === 'CONNECTED' || ses.live_status === 'CONNECTED'))
      setTemplates(t.templates || [])
    })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.consent_confirmed) return alert('You must confirm consent to proceed.')
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">Create Campaign</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="wa-form-group">
              <label className="wa-form-label">Daily Limit</label>
              <input className="wa-form-input" type="number" min={10} max={500} value={form.daily_limit} onChange={e => set('daily_limit', e.target.value)} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Max 500/day</span>
            </div>
            <div className="wa-form-group">
              <label className="wa-form-label">Min Delay (sec)</label>
              <input className="wa-form-input" type="number" min={8} value={form.min_delay_seconds} onChange={e => set('min_delay_seconds', e.target.value)} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Min 8s enforced</span>
            </div>
            <div className="wa-form-group">
              <label className="wa-form-label">Max Delay (sec)</label>
              <input className="wa-form-input" type="number" min={10} value={form.max_delay_seconds} onChange={e => set('max_delay_seconds', e.target.value)} />
            </div>
          </div>

          <div className="wa-info-box wa-info-box-yellow" style={{ fontSize: '0.8rem' }}>
            <AlertTriangle size={14} />
            <div>
              <strong>Consent Requirement:</strong> Only message leads who have given explicit permission to receive WhatsApp messages from your organization. Sending unsolicited messages may violate WhatsApp's Terms of Service.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" id="consent" checked={form.consent_confirmed} onChange={e => set('consent_confirmed', e.target.checked)} style={{ marginTop: 3 }} />
            <label htmlFor="consent" style={{ fontSize: '0.83rem', color: 'var(--text-primary, #f3f4f6)', cursor: 'pointer' }}>
              I confirm that all selected leads have given consent to receive WhatsApp messages from our organization.
            </label>
          </div>

          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving || !form.consent_confirmed || !form.session_id || !form.template_id}>
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
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await waCampaigns.list().catch(() => ({ campaigns: [] }))
    setCampaigns(res.campaigns || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const withAction = (id, fn) => async () => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    try { await fn(); await load() } catch (err) { alert(err.message) }
    setActionLoading(prev => ({ ...prev, [id]: false }))
  }

  const handleCreate = async (data) => {
    await waCampaigns.create(data)
    await load()
    setShowCreate(false)
  }

  const getProgress = (c) => {
    const total = c.total_recipients || 0
    if (!total) return 0
    return Math.round(((c.sent_count || 0) / total) * 100)
  }

  return (
    <DashboardLayout>
      <div className="wa-page">
      <div className="wa-page-header">
        <h1 className="wa-page-title"><Send size={24} className="wa-icon" /> Campaigns</h1>
        <button className="wa-btn wa-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New Campaign</button>
      </div>

      <div className="wa-info-box wa-info-box-yellow" style={{ fontSize: '0.8rem' }}>
        <AlertTriangle size={14} />
        Campaigns only send to leads whose WhatsApp status is "Available" and who have NOT opted out. Maximum 500 messages/day per session.
      </div>

      {loading ? (
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
                      Session: {c.whatsapp_sessions?.session_name || '—'} · Template: {c.whatsapp_templates?.name || '—'} · Daily limit: {c.daily_limit}
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
                    <AlertTriangle size={12} /> {c.pause_reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
    </DashboardLayout>
  )
}
