import React, { useEffect, useState, useCallback } from 'react'
import { Smartphone, Plus, RefreshCw, Trash2, Power, X } from 'lucide-react'
import { waSessions } from '../../services/whatsappApi'
import WaLayout from './WaLayout'
import './whatsapp.css'

const STATUS_BADGE = {
  CONNECTED:    { cls: 'green',  dot: 'green',  label: 'Connected' },
  QR_REQUIRED:  { cls: 'yellow', dot: 'yellow', label: 'Scan QR' },
  CONNECTING:   { cls: 'yellow', dot: 'yellow', label: 'Connecting' },
  RECONNECTING: { cls: 'yellow', dot: 'yellow', label: 'Reconnecting' },
  DISCONNECTED: { cls: 'gray',   dot: 'gray',   label: 'Disconnected' },
  ERROR:        { cls: 'red',    dot: 'red',    label: 'Error' },
  NOT_LOADED:   { cls: 'gray',   dot: 'gray',   label: 'Not Started' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE['NOT_LOADED']
  return <span className={`wa-badge wa-badge-${s.cls}`}><span className={`wa-dot wa-dot-${s.dot}`} />{s.label}</span>
}

function QRModal({ session, onClose }) {
  const [qr, setQr]       = useState(null)
  const [status, setStatus] = useState('...')

  useEffect(() => {
    const poll = async () => {
      const res = await waSessions.getQR(session.id).catch(() => null)
      if (res) { setQr(res.qr); setStatus(res.status) }
      if (res?.status === 'CONNECTED') { onClose(); return }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [session.id])

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">Scan QR Code — {session.session_name}</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="wa-info-box wa-info-box-yellow" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
          Open WhatsApp → Linked Devices → Link a Device → Scan this QR
        </div>
        {qr ? (
          <div className="wa-qr-box">
            <img src={qr} alt="WhatsApp QR Code" />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Status: {status}</span>
          </div>
        ) : (
          <div className="wa-empty"><div className="wa-spinner" /><p>Waiting for QR code… ({status})</p></div>
        )}
      </div>
    </div>
  )
}

function CreateModal({ onCreate, onClose }) {
  const [name, setName]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try { await onCreate(name.trim()) } finally { setSaving(false) }
  }

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">Create WhatsApp Session</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="wa-form">
          <div className="wa-form-group">
            <label className="wa-form-label">Session Name *</label>
            <input className="wa-form-input" placeholder="e.g. Sales Team 1" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="wa-info-box wa-info-box-yellow" style={{ fontSize: '0.8rem' }}>
            Each session links one WhatsApp number. Give it a descriptive name.
          </div>
          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving || !name.trim()}>
              {saving ? <span className="wa-spinner" /> : <Plus size={16} />}
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function WaSessions() {
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [qrSession, setQrSession] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await waSessions.list().catch(() => ({ sessions: [] }))
    setSessions(res.sessions || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 10 seconds for status changes
  useEffect(() => {
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [load])

  const handleCreate = async (name) => {
    const res = await waSessions.create(name)
    await load()
    setShowCreate(false)
    setQrSession(res.session)
  }

  const withAction = (id, fn) => async () => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    try { await fn(); await load() } catch (err) { alert(err.message) }
    setActionLoading(prev => ({ ...prev, [id]: false }))
  }

  const headerActions = (
    <button className="wa-btn wa-btn-primary" onClick={() => setShowCreate(true)}>
      <Plus size={16} /> New Session
    </button>
  )

  return (
    <WaLayout title="Sessions" headerActions={headerActions}>
      <div className="wa-page">
        <div className="wa-info-box wa-info-box-green" style={{ fontSize: '0.82rem' }}>
          Each session represents one linked WhatsApp number. Keep sessions connected to enable campaigns and auto-replies.
        </div>

        {loading ? (
          <div className="wa-empty"><div className="wa-spinner" /><p>Loading sessions…</p></div>
        ) : sessions.length === 0 ? (
          <div className="wa-card">
            <div className="wa-empty">
              <div className="wa-empty-icon">📱</div>
              <p>No sessions yet</p>
              <button className="wa-btn wa-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create First Session</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map(s => (
              <div key={s.id} className="wa-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} style={{ color: '#25d366' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.session_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                      {s.phone_number || 'Not connected'} · ID: {s.id.slice(0, 8)}…
                    </div>
                    {s.last_connected_at && (
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                        Last connected: {new Date(s.last_connected_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <StatusBadge status={s.live_status || s.status} />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* QR scan button */}
                  {['QR_REQUIRED', 'CONNECTING', 'RECONNECTING', 'NOT_LOADED'].includes(s.live_status || s.status) && (
                    <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setQrSession(s)}>
                      📷 Scan QR
                    </button>
                  )}

                  {/* Reconnect */}
                  {['DISCONNECTED', 'ERROR', 'NOT_LOADED'].includes(s.live_status || s.status) && (
                    <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} disabled={actionLoading[s.id]} onClick={withAction(s.id, () => waSessions.reconnect(s.id))}>
                      {actionLoading[s.id] ? <span className="wa-spinner" /> : <RefreshCw size={14} />} Reconnect
                    </button>
                  )}

                  {/* Disconnect */}
                  {s.live_status === 'CONNECTED' && (
                    <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.8rem' }} disabled={actionLoading[s.id]} onClick={withAction(s.id, () => waSessions.disconnect(s.id))}>
                      {actionLoading[s.id] ? <span className="wa-spinner" /> : <Power size={14} />} Disconnect
                    </button>
                  )}

                  {/* Delete */}
                  <button className="wa-btn wa-btn-danger" style={{ fontSize: '0.8rem' }} disabled={actionLoading[s.id]} onClick={withAction(s.id, async () => {
                    if (!window.confirm(`Delete session "${s.session_name}"? This cannot be undone.`)) return
                    await waSessions.delete(s.id)
                  })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {qrSession  && <QRModal    session={qrSession}  onClose={() => { setQrSession(null); load() }} />}
        {showCreate && <CreateModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
      </div>
    </WaLayout>
  )
}
