/**
 * whatsappApi.js
 * Thin fetch wrapper for the WhatsApp VPS backend.
 * Automatically injects the Supabase JWT via the shared Supabase client.
 * All paths are relative to VITE_WA_BACKEND_URL (set in frontend .env).
 */

import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_WA_BACKEND_URL || 'http://localhost:3001'

/**
 * Fetch helper — injects auth header, throws on non-2xx.
 */
async function apiFetch(path, options = {}) {
  // Get fresh session token from Supabase client
  let { data: { session } } = await supabase.auth.getSession()

  if (session) {
    try {
      // Decode JWT payload to check expiry
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      const exp = payload.exp * 1000
      if (Date.now() > exp - 60000) { // Expired or expiring in 60s
        console.log('Session token expired or expiring soon, refreshing...')
        const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession()
        if (error) throw error
        if (refreshedSession) {
          session = refreshedSession
        }
      }
    } catch (err) {
      console.error('Error refreshing session in apiFetch:', err)
    }
  }

  const token = session?.access_token || ''

  const headers = {
    Authorization: token ? `Bearer ${token}` : '',
    ...(options.headers || {})
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body.error || body.message || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const waSessions = {
  list:        ()         => apiFetch('/api/whatsapp/sessions'),
  create:      (name)     => apiFetch('/api/whatsapp/sessions', { method: 'POST', body: JSON.stringify({ session_name: name }) }),
  getQR:       (id)       => apiFetch(`/api/whatsapp/sessions/${id}/qr`),
  getStatus:   (id)       => apiFetch(`/api/whatsapp/sessions/${id}/status`),
  reconnect:   (id)       => apiFetch(`/api/whatsapp/sessions/${id}/reconnect`, { method: 'POST' }),
  disconnect:  (id)       => apiFetch(`/api/whatsapp/sessions/${id}/disconnect`, { method: 'POST' }),
  delete:      (id)       => apiFetch(`/api/whatsapp/sessions/${id}`, { method: 'DELETE' }),
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export const waLeads = {
  list:        (params)   => apiFetch('/api/whatsapp/leads?' + new URLSearchParams(params).toString()),
  checkBulk:   (lead_ids, session_id) => apiFetch('/api/whatsapp/leads/check', { method: 'POST', body: JSON.stringify({ lead_ids, session_id }) }),
  getStatus:   (id)       => apiFetch(`/api/whatsapp/leads/${id}/status`),
  optOut:      (id, reason) => apiFetch(`/api/whatsapp/leads/${id}/opt-out`, { method: 'POST', body: JSON.stringify({ reason }) }),
}

// ─── Templates ────────────────────────────────────────────────────────────────
export const waTemplates = {
  list:        ()         => apiFetch('/api/whatsapp/templates'),
  create:      (data)     => apiFetch('/api/whatsapp/templates', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data) => apiFetch(`/api/whatsapp/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:      (id)       => apiFetch(`/api/whatsapp/templates/${id}`, { method: 'DELETE' }),
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const waCampaigns = {
  list:        ()         => apiFetch('/api/whatsapp/campaigns'),
  create:      (data)     => apiFetch('/api/whatsapp/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  get:         (id)       => apiFetch(`/api/whatsapp/campaigns/${id}`),
  start:       (id)       => apiFetch(`/api/whatsapp/campaigns/${id}/start`, { method: 'POST' }),
  pause:       (id)       => apiFetch(`/api/whatsapp/campaigns/${id}/pause`, { method: 'POST' }),
  resume:      (id)       => apiFetch(`/api/whatsapp/campaigns/${id}/resume`, { method: 'POST' }),
  stop:        (id)       => apiFetch(`/api/whatsapp/campaigns/${id}/stop`, { method: 'POST' }),
}

// ─── Conversations ────────────────────────────────────────────────────────────
export const waConversations = {
  list:        (params)   => apiFetch('/api/whatsapp/conversations?' + new URLSearchParams(params || {}).toString()),
  getMessages: (id, p)    => apiFetch(`/api/whatsapp/conversations/${id}/messages?` + new URLSearchParams(p || {}).toString()),
  reply:       (id, body) => apiFetch(`/api/whatsapp/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  takeover:    (id)       => apiFetch(`/api/whatsapp/conversations/${id}/takeover`, { method: 'POST' }),
  resumeAI:    (id)       => apiFetch(`/api/whatsapp/conversations/${id}/resume-ai`, { method: 'POST' }),
  markRead:    (id)       => apiFetch(`/api/whatsapp/conversations/${id}/mark-read`, { method: 'POST' }),
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export const waMessages = {
  list:        (params)   => apiFetch('/api/whatsapp/messages?' + new URLSearchParams(params || {}).toString()),
  logs:        (params)   => apiFetch('/api/whatsapp/messages/logs?' + new URLSearchParams(params || {}).toString()),
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export const waAI = {
  getSettings:        (sessionId) => apiFetch('/api/whatsapp/ai/settings' + (sessionId ? `?session_id=${sessionId}` : '')),
  updateSettings:     (data)      => apiFetch('/api/whatsapp/ai/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getLogs:            (params)    => apiFetch('/api/whatsapp/ai/logs?' + new URLSearchParams(params || {}).toString()),
  extractLeadsFromPdf:(formData)  => apiFetch('/api/whatsapp/ai/extract-leads-pdf', { method: 'POST', body: formData }),
}

// ─── Health ───────────────────────────────────────────────────────────────────
export const waHealth = {
  check: () => apiFetch('/api/whatsapp/health'),
}

