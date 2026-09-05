import React, { useEffect, useState, useCallback } from 'react'
import {
  Search, RefreshCw, Filter, MessageSquare, Phone,
  CheckCheck, Check, Clock, XCircle, Send, Bot, ChevronDown
} from 'lucide-react'
import { waMessages, waSessions, waCampaigns } from '../../services/whatsappApi'
import WaLayout from './WaLayout'
import './whatsapp.css'

// ── Delivery status config ────────────────────────────────────────────────────
const STATUS_CFG = {
  SENT:      { cls: 'green',  icon: <Check  size={12} />, label: 'Sent' },
  DELIVERED: { cls: 'blue',   icon: <CheckCheck size={12} />, label: 'Delivered' },
  READ:      { cls: 'purple', icon: <CheckCheck size={12} />, label: 'Read' },
  FAILED:    { cls: 'red',    icon: <XCircle size={12} />, label: 'Failed' },
  PENDING:   { cls: 'yellow', icon: <Clock   size={12} />, label: 'Pending' },
}

const DIR_CFG = {
  OUTBOUND: { cls: 'green', label: '↑ Outbound' },
  INBOUND:  { cls: 'blue',  label: '↓ Inbound'  },
}

const SOURCE_CFG = {
  CAMPAIGN: { cls: 'purple', label: 'Campaign' },
  MANUAL:   { cls: 'yellow', label: 'Manual'   },
  AI:       { cls: 'blue',   label: 'AI Auto'  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { cls: 'gray', icon: null, label: status || '—' }
  return (
    <span className={`wa-badge wa-badge-${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function DirBadge({ direction }) {
  const cfg = DIR_CFG[direction] || { cls: 'gray', label: direction || '—' }
  return <span className={`wa-badge wa-badge-${cfg.cls}`}>{cfg.label}</span>
}

function SourceBadge({ source, isAI }) {
  if (isAI) return <span className="wa-badge wa-badge-blue" style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Bot size={11} />AI</span>
  const cfg = SOURCE_CFG[source] || { cls: 'gray', label: source || '—' }
  return <span className={`wa-badge wa-badge-${cfg.cls}`}>{cfg.label}</span>
}

function fmt(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-BD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function DeliveryTimeline({ log }) {
  const steps = [
    { key: 'sent_at',      label: 'Sent',      icon: <Send size={11} /> },
    { key: 'delivered_at', label: 'Delivered',  icon: <Check size={11} /> },
    { key: 'read_at',      label: 'Read',       icon: <CheckCheck size={11} /> },
  ]
  if (!log.sent_at && !log.delivered_at && !log.read_at) return null
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
      {steps.map(s => log[s.key] ? (
        <span key={s.key} style={{ fontSize: '0.68rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
          {s.icon}<span style={{ color: '#d1d5db' }}>{s.label}:</span> {fmt(log[s.key])}
        </span>
      ) : null)}
    </div>
  )
}

export default function WaLogs() {
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [sessions, setSessions] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [expanded, setExpanded] = useState(null)   // expanded row ID

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState('')
  const [direction,  setDirection]  = useState('')
  const [status,     setStatus]     = useState('')
  const [sessionId,  setSessionId]  = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = {
      page, limit: 50,
      ...(search    && { search }),
      ...(direction && { direction }),
      ...(status    && { status }),
      ...(sessionId && { session_id: sessionId }),
      ...(campaignId && { campaign_id: campaignId }),
      ...(dateFrom  && { date_from: dateFrom }),
      ...(dateTo    && { date_to: dateTo }),
    }
    const res = await waMessages.logs(params).catch(() => ({ logs: [], total: 0 }))
    setLogs(res.logs || [])
    setTotal(res.total || 0)
    setLoading(false)
  }, [page, search, direction, status, sessionId, campaignId, dateFrom, dateTo])

  // Load sessions + campaigns once for filter dropdowns
  useEffect(() => {
    waSessions.list().then(r => setSessions(r.sessions || [])).catch(() => {})
    waCampaigns.list().then(r => setCampaigns(r.campaigns || [])).catch(() => {})
  }, [])

  useEffect(() => { setPage(1) }, [search, direction, status, sessionId, campaignId, dateFrom, dateTo])
  useEffect(() => { load() }, [load])

  const resetFilters = () => {
    setSearch(''); setDirection(''); setStatus('')
    setSessionId(''); setCampaignId(''); setDateFrom(''); setDateTo('')
    setPage(1)
  }
  const hasActiveFilters = search || direction || status || sessionId || campaignId || dateFrom || dateTo

  // ── Stats summary ─────────────────────────────────────────────────────────
  const stats = {
    total:     logs.length,
    sent:      logs.filter(l => l.status === 'SENT').length,
    delivered: logs.filter(l => l.status === 'DELIVERED').length,
    read:      logs.filter(l => l.status === 'READ').length,
    failed:    logs.filter(l => l.status === 'FAILED').length,
  }

  const headerActions = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        className={`wa-btn ${showFilters ? 'wa-btn-primary' : 'wa-btn-secondary'}`}
        onClick={() => setShowFilters(f => !f)}
      >
        <Filter size={15} /> Filters {hasActiveFilters ? `(on)` : ''}
      </button>
      <button className="wa-btn wa-btn-secondary" onClick={load}>
        <RefreshCw size={15} />
      </button>
    </div>
  )

  return (
    <WaLayout title="Message Logs" headerActions={headerActions}>
      <div className="wa-page">

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="wa-stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 16 }}>
          {[
            { label: 'Total',     val: total,         color: '#818cf8' },
            { label: 'Sent',      val: stats.sent,     color: '#25d366' },
            { label: 'Delivered', val: stats.delivered, color: '#3b82f6' },
            { label: 'Read',      val: stats.read,     color: '#8b5cf6' },
            { label: 'Failed',    val: stats.failed,   color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="wa-stat-card">
              <div className="wa-stat-label">{s.label}</div>
              <div className="wa-stat-value" style={{ color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* ── Search bar ────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input
            className="wa-form-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search by lead name, phone, session number, message text, campaign…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Filters panel ─────────────────────────────────────────────── */}
        {showFilters && (
          <div className="wa-card" style={{ padding: '16px', marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>Direction</label>
              <select className="wa-form-select" value={direction} onChange={e => setDirection(e.target.value)}>
                <option value="">All</option>
                <option value="OUTBOUND">↑ Outbound</option>
                <option value="INBOUND">↓ Inbound</option>
              </select>
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>Delivery Status</label>
              <select className="wa-form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="READ">Read</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>Session (Sender)</label>
              <select className="wa-form-select" value={sessionId} onChange={e => setSessionId(e.target.value)}>
                <option value="">All Sessions</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.session_name} — {s.phone_number}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>Campaign</label>
              <select className="wa-form-select" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                <option value="">All Campaigns</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 130px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>From Date</label>
              <input type="date" className="wa-form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>

            <div style={{ flex: '1 1 130px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>To Date</label>
              <input type="date" className="wa-form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {hasActiveFilters && (
              <button className="wa-btn wa-btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={resetFilters}>
                ✕ Clear
              </button>
            )}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="wa-card">
          {loading ? (
            <div className="wa-empty"><div className="wa-spinner" /><p>Loading logs…</p></div>
          ) : logs.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">📋</div>
              <p>{hasActiveFilters ? 'No logs match your filters' : 'No message logs yet'}</p>
              {hasActiveFilters && <button className="wa-btn wa-btn-secondary" onClick={resetFilters}>Clear Filters</button>}
            </div>
          ) : (
            <div className="wa-table-wrap">
              <table className="wa-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Time</th>
                    <th>Sender Session</th>
                    <th>Lead</th>
                    <th>Direction</th>
                    <th>Source</th>
                    <th>Delivery</th>
                    <th>Campaign</th>
                    <th>Message Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <React.Fragment key={l.id}>
                      <tr
                        onClick={() => setExpanded(e => e === l.id ? null : l.id)}
                        style={{ cursor: 'pointer', background: expanded === l.id ? 'rgba(37,211,102,0.04)' : undefined }}
                      >
                        {/* expand chevron */}
                        <td style={{ textAlign: 'center', color: '#6b7280' }}>
                          <ChevronDown size={14} style={{ transform: expanded === l.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>

                        {/* Time */}
                        <td style={{ fontSize: '0.73rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {fmt(l.created_at)}
                        </td>

                        {/* Sender session */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.82rem', color: '#f3f4f6' }}>{l.session_name}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6b7280' }}>{l.session_phone}</div>
                        </td>

                        {/* Lead */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.82rem', color: '#f3f4f6' }}>{l.lead_name}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6b7280' }}>{l.lead_phone}</div>
                          {l.lead_company && l.lead_company !== '—' && (
                            <div style={{ fontSize: '0.68rem', color: '#4b5563' }}>{l.lead_company}</div>
                          )}
                        </td>

                        {/* Direction */}
                        <td><DirBadge direction={l.direction} /></td>

                        {/* Source */}
                        <td><SourceBadge source={l.message_source} isAI={l.is_ai_generated} /></td>

                        {/* Delivery status */}
                        <td><StatusBadge status={l.status} /></td>

                        {/* Campaign */}
                        <td style={{ fontSize: '0.78rem', color: l.campaign_name !== '—' ? '#a78bfa' : '#4b5563' }}>
                          {l.campaign_name}
                        </td>

                        {/* Message preview */}
                        <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#9ca3af' }}>
                          {l.message_body?.slice(0, 90) || '—'}
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {expanded === l.id && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div style={{
                              margin: '0 12px 12px 40px', padding: '14px 18px',
                              background: 'rgba(37,211,102,0.04)', borderRadius: 10,
                              border: '1px solid rgba(37,211,102,0.12)'
                            }}>
                              {/* Full message body */}
                              <div style={{ fontSize: '0.82rem', color: '#e5e7eb', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 12 }}>
                                {l.message_body || '(No message body)'}
                              </div>

                              {/* Delivery timeline */}
                              <DeliveryTimeline log={l} />

                              {/* Meta row */}
                              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, fontSize: '0.72rem', color: '#6b7280' }}>
                                {l.provider_message_id && (
                                  <span>📌 Provider ID: <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{l.provider_message_id}</span></span>
                                )}
                                {l.lead_status && l.lead_status !== '—' && (
                                  <span>👤 Lead Status: <span style={{ color: '#d1d5db' }}>{l.lead_status}</span></span>
                                )}
                                {l.failed_at && (
                                  <span style={{ color: '#ef4444' }}>⚠ Failed at: {fmt(l.failed_at)}</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: '0.82rem', color: '#6b7280' }}>
            <span>Showing {logs.length} of {total} messages</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </button>
              <span style={{ padding: '4px 8px', color: 'var(--text-primary, #f3f4f6)' }}>Page {page}</span>
              <button className="wa-btn wa-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={logs.length < 50} onClick={() => setPage(p => p + 1)}>
                Next →
              </button>
            </div>
          </div>
        </div>

      </div>
    </WaLayout>
  )
}
