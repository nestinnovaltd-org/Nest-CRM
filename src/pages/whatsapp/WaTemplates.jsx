import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MessageSquare, Plus, Pencil, Trash2, X, Copy, Image, Video, FileText, Music, Upload, Link } from 'lucide-react'
import { waTemplates } from '../../services/whatsappApi'
import { supabase } from '../../lib/supabase'
import WaLayout from './WaLayout'
import './whatsapp.css'

const VARIABLES = ['{{name}}', '{{phone}}', '{{company}}', '{{project_name}}']

const MEDIA_TYPES = [
  { value: 'image',    label: 'Image',    icon: Image,    accept: 'image/jpeg,image/png,image/gif,image/webp' },
  { value: 'video',    label: 'Video',    icon: Video,    accept: 'video/mp4,video/quicktime,video/avi' },
  { value: 'document', label: 'Document', icon: FileText, accept: 'application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' },
  { value: 'audio',    label: 'Audio',    icon: Music,    accept: 'audio/mpeg,audio/ogg,audio/wav,audio/m4a' },
]

function detectMediaType(file) {
  const mime = file.type
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

async function uploadToSupabase(file, onProgress) {
  const ext   = file.name.split('.').pop().toLowerCase()
  const path  = `templates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage
    .from('wa-media')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('wa-media').getPublicUrl(data.path)
  return publicUrl
}

function MediaPreview({ url, type }) {
  if (!url) return null
  if (type === 'image') return (
    <img src={url} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} />
  )
  if (type === 'video') return (
    <video src={url} controls style={{ width: '100%', maxHeight: 180, borderRadius: 8 }} />
  )
  if (type === 'audio') return (
    <audio src={url} controls style={{ width: '100%' }} />
  )
  // document
  const name = decodeURIComponent(url.split('/').pop().split('?')[0])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <FileText size={20} color="#6b7280" />
      <span style={{ fontSize: '0.82rem', color: '#9ca3af', wordBreak: 'break-all' }}>{name}</span>
    </div>
  )
}

function TemplateModal({ existing, onSave, onClose }) {
  const [name,      setName]      = useState(existing?.name      || '')
  const [body,      setBody]      = useState(existing?.body      || '')
  const [mediaUrl,  setMediaUrl]  = useState(existing?.media_url  || '')
  const [mediaType, setMediaType] = useState(existing?.media_type || 'image')
  const [hasMedia,  setHasMedia]  = useState(!!(existing?.media_url))
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const fileRef = useRef()

  const insertVar = (v) => setBody(prev => prev + v)

  const handleFile = async (file) => {
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const detectedType = detectMediaType(file)
      setMediaType(detectedType)
      const url = await uploadToSupabase(file)
      setMediaUrl(url)
    } catch (e) {
      setUploadErr(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  const removeMedia = () => {
    setMediaUrl('')
    setHasMedia(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !body.trim()) return
    if (hasMedia && !mediaUrl) { setError('Please upload a media file or disable the media toggle.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        body: body.trim(),
        media_url:  hasMedia ? mediaUrl  : null,
        media_type: hasMedia ? mediaType : null,
      })
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Live preview
  const preview = body
    .replace(/\{\{name\}\}/g, 'Ahmed Ali')
    .replace(/\{\{company\}\}/g, 'ABC Corp')
    .replace(/\{\{phone\}\}/g, '+8801712345678')
    .replace(/\{\{project_name\}\}/g, 'Nest Valley')

  const selectedType = MEDIA_TYPES.find(m => m.value === mediaType)

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">{existing ? 'Edit Template' : 'New Template'}</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="wa-form">
          {/* Template Name */}
          <div className="wa-form-group">
            <label className="wa-form-label">Template Name *</label>
            <input className="wa-form-input" placeholder="e.g. Initial Greeting" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          {/* Message Body */}
          <div className="wa-form-group">
            <label className="wa-form-label">Message Body *</label>
            <textarea
              className="wa-form-textarea"
              style={{ minHeight: 110 }}
              placeholder="Hello {{name}}, ..."
              value={body}
              onChange={e => setBody(e.target.value)}
              required
            />
          </div>

          {/* Variable Buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: -4 }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center' }}>Insert variable:</span>
            {VARIABLES.map(v => (
              <button key={v} type="button" className="wa-badge wa-badge-blue" style={{ cursor: 'pointer', border: 'none' }} onClick={() => insertVar(v)}>{v}</button>
            ))}
          </div>

          {/* ── Media Attachment Section ─────────────────────────────── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasMedia ? 12 : 0 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Image size={15} color="#25d366" /> Media Attachment
              </label>
              <button
                type="button"
                onClick={() => { setHasMedia(h => !h); if (hasMedia) removeMedia() }}
                style={{
                  fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20,
                  border: '1px solid',
                  borderColor: hasMedia ? '#25d366' : 'rgba(255,255,255,0.15)',
                  background: hasMedia ? 'rgba(37,211,102,0.12)' : 'transparent',
                  color: hasMedia ? '#25d366' : '#9ca3af', cursor: 'pointer'
                }}
              >
                {hasMedia ? '✓ Enabled' : '+ Add Media'}
              </button>
            </div>

            {hasMedia && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Media Type Selector */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {MEDIA_TYPES.map(mt => {
                    const Icon = mt.icon
                    const active = mediaType === mt.value
                    return (
                      <button
                        key={mt.value}
                        type="button"
                        onClick={() => setMediaType(mt.value)}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${active ? '#25d366' : 'rgba(255,255,255,0.1)'}`,
                          background: active ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.03)',
                          color: active ? '#25d366' : '#9ca3af',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: '0.72rem'
                        }}
                      >
                        <Icon size={14} />
                        {mt.label}
                      </button>
                    )
                  })}
                </div>

                {/* Upload Zone */}
                {!mediaUrl ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(37,211,102,0.3)',
                      borderRadius: 10,
                      padding: '20px 16px',
                      textAlign: 'center',
                      cursor: uploading ? 'wait' : 'pointer',
                      background: 'rgba(37,211,102,0.03)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept={selectedType?.accept || '*/*'}
                      onChange={handleFileInput}
                      style={{ display: 'none' }}
                    />
                    {uploading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div className="wa-spinner" />
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Uploading…</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} color="#25d366" style={{ marginBottom: 6 }} />
                        <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
                          Click or drag & drop to upload <strong style={{ color: '#d1d5db' }}>{selectedType?.label}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Max 50MB</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <MediaPreview url={mediaUrl} type={mediaType} />
                    <button
                      type="button"
                      onClick={removeMedia}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.7)', border: 'none',
                        borderRadius: '50%', width: 26, height: 26,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff'
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {uploadErr && (
                  <div style={{ fontSize: '0.78rem', color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                    ⚠ {uploadErr}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* ─────────────────────────────────────────────────────────── */}

          {/* Preview */}
          {preview && (
            <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: '#25d366', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
              {hasMedia && mediaUrl && <MediaPreview url={mediaUrl} type={mediaType} />}
              <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary, #f3f4f6)', marginTop: hasMedia && mediaUrl ? 8 : 0 }}>{preview}</div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</div>
          )}

          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving || uploading}>
              {saving ? <span className="wa-spinner" /> : null}
              {saving ? 'Saving…' : existing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const MEDIA_ICON = { image: '🖼️', video: '🎥', document: '📄', audio: '🎵' }

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
          Templates support variables: <code>{'{{name}}'}</code>, <code>{'{{company}}'}</code>, <code>{'{{project_name}}'}</code> — resolved per lead at send time. You can also attach images, videos, documents, or audio.
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
              <div key={t.id} className="wa-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>
                    {t.media_type && (
                      <span style={{ fontSize: '0.72rem', color: '#25d366', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {MEDIA_ICON[t.media_type]} {t.media_type}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="wa-btn-icon" title="Copy body" onClick={() => handleCopy(t.body)}><Copy size={14} /></button>
                    <button className="wa-btn-icon" title="Edit" onClick={() => setModal(t)}><Pencil size={14} /></button>
                    <button className="wa-btn-icon" title="Archive" onClick={() => handleDelete(t)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Media preview thumbnail */}
                {t.media_url && t.media_type === 'image' && (
                  <img src={t.media_url} alt="media" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                )}
                {t.media_url && t.media_type === 'video' && (
                  <video src={t.media_url} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} muted />
                )}
                {t.media_url && (t.media_type === 'document' || t.media_type === 'audio') && (
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 6 }}>
                    {MEDIA_ICON[t.media_type]} {decodeURIComponent(t.media_url.split('/').pop().split('?')[0])}
                  </div>
                )}

                <div style={{ fontSize: '0.83rem', color: '#9ca3af', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 100, overflow: 'hidden' }}>
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
