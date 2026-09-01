import React, { useEffect, useState, useCallback } from 'react'
import { Zap, Save, Info } from 'lucide-react'
import { waAI, waSessions } from '../../services/whatsappApi'
import WaLayout from './WaLayout'
import './whatsapp.css'

const AI_MODES = [
  { value: 'AI_OFF',         label: 'Off',             desc: 'AI is completely disabled' },
  { value: 'AI_SUGGESTION',  label: 'Suggestion Only', desc: 'AI drafts replies but staff reviews before sending' },
  { value: 'AI_AUTO_REPLY',  label: 'Auto Reply',      desc: 'AI replies automatically to inbound messages' },
]

export default function WaAiSettings() {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({
    ai_mode: 'AI_OFF',
    system_prompt: '',
    max_history_messages: 10,
    auto_reply_delay_seconds: 3,
    escalation_keywords: []
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(true)
  const [kwInput, setKwInput] = useState('')

  const loadSettings = useCallback(async (sid) => {
    setLoading(true)
    const res = await waAI.getSettings(sid || undefined).catch(() => null)
    if (res?.settings) {
      setForm({
        ai_mode:                  res.settings.ai_mode || 'AI_OFF',
        system_prompt:            res.settings.system_prompt || '',
        max_history_messages:     res.settings.max_history_messages || 10,
        auto_reply_delay_seconds: res.settings.auto_reply_delay_seconds || 3,
        escalation_keywords:      res.settings.escalation_keywords || []
      })
    }
    setSettings(res?.settings)
    setLoading(false)
  }, [])

  useEffect(() => {
    waSessions.list().then(s => {
      setSessions((s.sessions || []).filter(ses => ses.status === 'CONNECTED'))
    }).catch(() => {})
    loadSettings(null)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addKeyword = () => {
    const kw = kwInput.trim()
    if (!kw || form.escalation_keywords.includes(kw)) return
    set('escalation_keywords', [...form.escalation_keywords, kw])
    setKwInput('')
  }

  const removeKeyword = (kw) => set('escalation_keywords', form.escalation_keywords.filter(k => k !== kw))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await waAI.updateSettings({ ...form, session_id: sessionId || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const DEFAULT_PROMPT = `You are a professional real-estate sales assistant.

LANGUAGE RULES:
- Detect the customer's language: Bengali, Banglish, or English.
- Always reply in the SAME language.

KNOWLEDGE RULES (CRITICAL):
- ONLY use the project information provided.
- NEVER invent prices, sizes, discounts, or availability counts.
- NEVER make guarantees or investment return claims.

BEHAVIOR:
- Be polite, professional, concise (max 100 words).
- Ask clarifying questions to understand the customer's needs.`

  const headerActions = (
    <select className="wa-form-select" style={{ width: 'auto', padding: '8px 12px' }} value={sessionId} onChange={e => { setSessionId(e.target.value); loadSettings(e.target.value || null) }}>
      <option value="">Org-wide defaults</option>
      {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
    </select>
  )

  return (
    <WaLayout title="AI Settings" headerActions={headerActions}>
      <div className="wa-page">
        <div className="wa-info-box wa-info-box-green" style={{ fontSize: '0.82rem' }}>
          <Info size={14} />
          Settings apply to the entire organization by default. Select a specific session to override for that session only. AI only uses the <strong>projects</strong> table as its knowledge base — it cannot invent data.
        </div>

        {loading ? (
          <div className="wa-empty"><div className="wa-spinner" /></div>
        ) : (
          <form onSubmit={handleSave}>
            {/* AI Mode */}
            <div className="wa-card" style={{ marginBottom: 16 }}>
              <div className="wa-card-title" style={{ marginBottom: 16 }}>AI Mode</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {AI_MODES.map(m => (
                  <label key={m.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 16px', borderRadius: 8, border: `1px solid ${form.ai_mode === m.value ? '#25d366' : 'rgba(255,255,255,0.06)'}`, background: form.ai_mode === m.value ? 'rgba(37,211,102,0.06)' : 'transparent', transition: 'all 0.2s' }}>
                    <input type="radio" name="ai_mode" value={m.value} checked={form.ai_mode === m.value} onChange={() => set('ai_mode', m.value)} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {form.ai_mode !== 'AI_OFF' && (
              <>
                {/* Behavior settings */}
                <div className="wa-card" style={{ marginBottom: 16 }}>
                  <div className="wa-card-title" style={{ marginBottom: 16 }}>Behavior</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="wa-form-group">
                      <label className="wa-form-label">Message History (last N messages)</label>
                      <input className="wa-form-input" type="number" min={3} max={20} value={form.max_history_messages} onChange={e => set('max_history_messages', e.target.value)} />
                      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>More context = better replies but higher token cost</span>
                    </div>
                    <div className="wa-form-group">
                      <label className="wa-form-label">Auto-reply Delay (seconds)</label>
                      <input className="wa-form-input" type="number" min={1} max={30} value={form.auto_reply_delay_seconds} onChange={e => set('auto_reply_delay_seconds', e.target.value)} />
                      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Pause before AI replies (feels more human)</span>
                    </div>
                  </div>
                </div>

                {/* System prompt */}
                <div className="wa-card" style={{ marginBottom: 16 }}>
                  <div className="wa-card-title" style={{ marginBottom: 8 }}>System Prompt</div>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 12 }}>The instructions given to the AI before every conversation. Leave blank to use the default safe prompt.</p>
                  <textarea className="wa-form-textarea" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: '0.82rem' }} placeholder={DEFAULT_PROMPT} value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)} />
                  {!form.system_prompt && (
                    <button type="button" className="wa-btn wa-btn-secondary" style={{ marginTop: 8, fontSize: '0.78rem' }} onClick={() => set('system_prompt', DEFAULT_PROMPT)}>
                      Load Default Prompt
                    </button>
                  )}
                </div>

                {/* Escalation keywords */}
                <div className="wa-card" style={{ marginBottom: 16 }}>
                  <div className="wa-card-title" style={{ marginBottom: 8 }}>Human Escalation Keywords</div>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 12 }}>
                    If a customer's message contains any of these words, AI stops and the conversation is flagged for human response.
                    Built-in keywords (human, manager, agent, etc.) are always active.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input className="wa-form-input" placeholder="Add custom keyword…" value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())} />
                    <button type="button" className="wa-btn wa-btn-secondary" onClick={addKeyword}>Add</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {form.escalation_keywords.map(kw => (
                      <span key={kw} className="wa-badge wa-badge-yellow" style={{ cursor: 'pointer' }} onClick={() => removeKeyword(kw)}>{kw} ×</span>
                    ))}
                    {form.escalation_keywords.length === 0 && <span style={{ fontSize: '0.78rem', color: '#4b5563' }}>No custom keywords added</span>}
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving} style={{ marginTop: 4 }}>
              {saving ? <span className="wa-spinner" /> : <Save size={16} />}
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </WaLayout>
  )
}

