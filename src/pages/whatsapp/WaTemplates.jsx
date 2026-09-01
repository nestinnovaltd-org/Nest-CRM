import React, { useEffect, useState, useCallback } from 'react'
import { MessageSquare, Plus, Pencil, Trash2, X, Copy } from 'lucide-react'
import { waTemplates } from '../../services/whatsappApi'
import WaLayout from './WaLayout'
import './whatsapp.css'

const VARIABLES = ['{{name}}', '{{phone}}', '{{company}}', '{{project_name}}']

function TemplateModal({ existing, onSave, onClose }) {
  const [name, setName]   = useState(existing?.name || '')
  const [body, setBody]   = useState(existing?.body || '')
  const [saving, setSaving] = useState(false)

  const insertVar = (v) => setBody(prev => prev + v)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !body.trim()) return
    setSaving(true)
    try { await onSave({ name: name.trim(), body: body.trim() }) } finally { setSaving(false) }
  }

  // Live preview
  const preview = body
    .replace('{{name}}', 'Ahmed Ali')
    .replace('{{company}}', 'ABC Corp')
    .replace('{{phone}}', '+8801712345678')
    .replace('{{project_name}}', 'Nest Valley')

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">{existing ? 'Edit Template' : 'New Template'}</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="wa-form">
          <div className="wa-form-group">
            <label className="wa-form-label">Template Name *</label>
            <input className="wa-form-input" placeholder="e.g. Initial Greeting" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="wa-form-group">
            <label className="wa-form-label">Message Body *</label>
            <textarea className="wa-form-textarea" style={{ minHeight: 130 }} placeholder="Hello {{name}}, ..." value={body} onChange={e => setBody(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center' }}>Insert variable:</span>
            {VARIABLES.map(v => (
              <button key={v} type="button" className="wa-badge wa-badge-blue" style={{ cursor: 'pointer', border: 'none' }} onClick={() => insertVar(v)}>{v}</button>
            ))}
          </div>
          {preview && (
            <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: '#25d366', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
              <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary, #f3f4f6)' }}>{preview}</div>
            </div>
          )}
          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving}>
              {saving ? <span className="wa-spinner" /> : null}
              {saving ? 'Saving…' : existing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function WaTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)  // null | 'create' | template object

  const load = useCallback(async () => {
    setLoading(true)
    const res = await waTemplates.list().catch(() => ({ templates: [] }))
    setTemplates(res.templates || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    if (modal && modal.id) {
      await waTemplates.update(modal.id, data)
    } else {
      await waTemplates.create(data)
    }
    await load()
    setModal(null)
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`Archive template "${t.name}"?`)) return
    await waTemplates.delete(t.id)
    await load()
  }

  const handleCopy = (body) => {
    navigator.clipboard.writeText(body).then(() => alert('Template body copied!'))
  }

  const headerActions = (
    <button className="wa-btn wa-btn-primary" onClick={() => setModal('create')}>
      <Plus size={16} /> New Template
    </button>
  )

  return (
    <WaLayout title="Templates" headerActions={headerActions}>
      <div className="wa-page">
        <div className="wa-info-box wa-info-box-green" style={{ fontSize: '0.82rem' }}>
          Templates support variables: <code>{'{{name}}'}</code>, <code>{'{{company}}'}</code>, <code>{'{{project_name}}'}</code> — they're resolved per lead at send time.
        </div>

        {loading ? (
          <div className="wa-empty"><div className="wa-spinner" /><p>Loading templates…</p></div>
        ) : templates.length === 0 ? (
          <div className="wa-card">
            <div className="wa-empty">
              <div className="wa-empty-icon">💬</div>
              <p>No templates yet</p>
              <button className="wa-btn wa-btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Create First Template</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {templates.map(t => (
              <div key={t.id} className="wa-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="wa-btn-icon" title="Copy body" onClick={() => handleCopy(t.body)}><Copy size={14} /></button>
                    <button className="wa-btn-icon" title="Edit" onClick={() => setModal(t)}><Pencil size={14} /></button>
                    <button className="wa-btn-icon" title="Archive" onClick={() => handleDelete(t)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ fontSize: '0.83rem', color: '#9ca3af', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 120, overflow: 'hidden' }}>
                  {t.body}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  Created {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <TemplateModal
            existing={modal === 'create' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </WaLayout>
  )
}

