/**
 * sessionManager.js
 * Manages Baileys WhatsApp sessions — multi-session, persistent, auto-reconnect.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path   from 'path'
import fs     from 'fs'
import QRCode from 'qrcode'
import { supabase }       from '../../utils/supabase.js'
import { logger }         from '../../utils/logger.js'
import { handleIncoming } from './messageHandler.js'

const SESSION_BASE = process.env.WHATSAPP_SESSION_PATH || '/var/www/crm/whatsapp-sessions'
const MAX_RECONNECT_ATTEMPTS = 5

// In-memory session store: sessionId → { socket, qrDataUri, status, reconnectCount }
const sessions = new Map()

// Helper to ensure session directory is writable
function ensureDirectoryWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const testFile = path.join(dir, `.write_test_${Date.now()}`)
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
  } catch (err) {
    const errMsg = `CRITICAL: WhatsApp session directory '${dir}' is not writable. Please check permissions for site user 'hijibusy-api'. Error: ${err.message}`
    logger.error({ err, path: dir }, errMsg)
    throw new Error(errMsg)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const sessionManager = {
  /**
   * Start a session. If session files exist, reconnects silently.
   * If new, generates QR. Updates DB status throughout.
   */
  async startSession(sessionId, orgId) {
    if (sessions.has(sessionId)) {
      const s = sessions.get(sessionId)
      if (s.status === 'CONNECTED') return { status: 'already_connected' }
    }

    logger.info({ sessionId, orgId, event: 'session_start' }, 'Starting WhatsApp session')

    ensureDirectoryWritable(SESSION_BASE)

    const sessionPath = path.join(SESSION_BASE, sessionId)
    fs.mkdirSync(sessionPath, { recursive: true })

    await _updateDbStatus(sessionId, 'CONNECTING')

    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    const socket = makeWASocket({
      version,
      auth:          state,
      printQRInTerminal: false,
      logger:        logger.child({ sessionId }),
      browser:       ['Nest CRM', 'Chrome', '124.0.0'],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs:   25_000
    })

    sessions.set(sessionId, {
      socket,
      orgId,
      status:          'CONNECTING',
      qrDataUri:       null,
      reconnectCount:  0
    })

    // ─── Connection updates ───────────────────────────────────────────────────
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const qrDataUri = await QRCode.toDataURL(qr)
        const s = sessions.get(sessionId)
        if (s) { s.qrDataUri = qrDataUri; s.status = 'QR_REQUIRED' }
        await _updateDbStatus(sessionId, 'QR_REQUIRED', null, qrDataUri)
        logger.info({ sessionId, event: 'qr_generated' }, 'QR code generated')
      }

      if (connection === 'open') {
        const s = sessions.get(sessionId)
        if (s) { s.status = 'CONNECTED'; s.qrDataUri = null; s.reconnectCount = 0 }

        // Extract phone from jid
        const jid   = socket.user?.id || ''
        const phone = jid.split(':')[0].split('@')[0]

        await _updateDbStatus(sessionId, 'CONNECTED', phone)
        logger.info({ sessionId, phone, event: 'session_connected' }, 'WhatsApp session connected')
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        const shouldReconnect = reason !== DisconnectReason.loggedOut

        logger.warn({ sessionId, reason, shouldReconnect, event: 'session_disconnected' }, 'Session disconnected')

        await _updateDbStatus(sessionId, 'DISCONNECTED')
        await _pauseRunningCampaigns(sessionId, orgId)
        await _notifyOrgUsers(orgId, sessionId)

        if (shouldReconnect) {
          const s = sessions.get(sessionId)
          if (s && s.reconnectCount < MAX_RECONNECT_ATTEMPTS) {
            s.reconnectCount++
            const delay = Math.min(s.reconnectCount * 5000, 30000)
            logger.info({ sessionId, attempt: s.reconnectCount, delay }, 'Scheduling reconnect')
            await _updateDbStatus(sessionId, 'RECONNECTING')
            setTimeout(() => sessionManager.startSession(sessionId, orgId), delay)
          } else {
            logger.error({ sessionId }, 'Max reconnect attempts reached')
            await _updateDbStatus(sessionId, 'ERROR')
            sessions.delete(sessionId)
          }
        } else {
          // Logged out — clear session files
          logger.info({ sessionId }, 'Session logged out — clearing session files')
          sessions.delete(sessionId)
          await _updateDbStatus(sessionId, 'DISCONNECTED')
          try { fs.rmSync(path.join(SESSION_BASE, sessionId), { recursive: true }) } catch (_) {}
        }
      }
    })

    // ─── Credentials save ─────────────────────────────────────────────────────
    socket.ev.on('creds.update', saveCreds)

    // ─── Incoming messages ────────────────────────────────────────────────────
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          await handleIncoming(msg, sessionId, orgId).catch(err =>
            logger.error({ err, sessionId, event: 'message_handler_error' }, 'Message handler error')
          )
        }
      }
    })

    return { status: 'starting' }
  },

  /** Send a text message via a specific session. */
  async sendMessage(sessionId, phone, body) {
    const s = sessions.get(sessionId)
    if (!s || s.status !== 'CONNECTED') {
      throw new Error(`Session ${sessionId} not connected`)
    }
    const jid = `${phone.replace('+', '')}@s.whatsapp.net`
    const result = await s.socket.sendMessage(jid, { text: body })
    return result?.key?.id
  },

  /** Check if a phone number has WhatsApp via Baileys onWhatsApp. */
  async checkNumber(sessionId, phone) {
    const s = sessions.get(sessionId)
    if (!s || s.status !== 'CONNECTED') {
      throw new Error(`Session ${sessionId} not connected`)
    }
    const jid    = `${phone.replace('+', '')}@s.whatsapp.net`
    const result = await s.socket.onWhatsApp(jid)
    return Array.isArray(result) && result.length > 0 && result[0]?.exists === true
  },

  /** Disconnect and remove a session. */
  async disconnectSession(sessionId) {
    const s = sessions.get(sessionId)
    if (s?.socket) {
      try { await s.socket.logout() } catch (_) {}
      try { await s.socket.end() }   catch (_) {}
    }
    sessions.delete(sessionId)
    await _updateDbStatus(sessionId, 'DISCONNECTED')
    logger.info({ sessionId, event: 'session_disconnected_manual' }, 'Session manually disconnected')
  },

  /** Get current QR data URI for a session (for polling). */
  getQR(sessionId) {
    return sessions.get(sessionId)?.qrDataUri || null
  },

  /** Get in-memory status of a session. */
  getStatus(sessionId) {
    return sessions.get(sessionId)?.status || 'NOT_LOADED'
  },

  getConnectedCount() {
    let n = 0
    for (const s of sessions.values()) if (s.status === 'CONNECTED') n++
    return n
  },

  getTotalCount() {
    return sessions.size
  },

  /** Load and reconnect all CONNECTED/RECONNECTING sessions on server boot. */
  async restoreAllSessions() {
    const { data: activeSessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, org_id, status')
      .in('status', ['CONNECTED', 'RECONNECTING', 'CONNECTING'])

    if (!activeSessions?.length) return

    logger.info({ count: activeSessions.length }, 'Restoring WhatsApp sessions on boot')

    try {
      ensureDirectoryWritable(SESSION_BASE)
    } catch (err) {
      logger.error({ err, path: SESSION_BASE }, 'Failed to restore WhatsApp sessions: session base directory is not writable')
      return
    }

    for (const sess of activeSessions) {
      await sessionManager.startSession(sess.id, sess.org_id).catch(err =>
        logger.error({ err, sessionId: sess.id }, 'Failed to restore session')
      )
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _updateDbStatus(sessionId, status, phone = null, qrDataUri = null) {
  const update = { status, updated_at: new Date().toISOString() }
  if (status === 'CONNECTED') update.last_connected_at = new Date().toISOString()
  if (status === 'DISCONNECTED') update.last_disconnected_at = new Date().toISOString()
  if (phone) update.phone_number = phone
  // Note: we do NOT store qrDataUri in DB — only keep it in memory for polling

  await supabase.from('whatsapp_sessions').update(update).eq('id', sessionId)
}

async function _pauseRunningCampaigns(sessionId, orgId) {
  const { data: running } = await supabase
    .from('whatsapp_campaigns')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'RUNNING')

  if (!running?.length) return

  for (const c of running) {
    await supabase
      .from('whatsapp_campaigns')
      .update({ status: 'PAUSED', pause_reason: 'WhatsApp session disconnected', paused_at: new Date().toISOString() })
      .eq('id', c.id)

    logger.warn({ campaignId: c.id, sessionId, event: 'campaign_paused_session_disconnect' }, 'Campaign paused: session disconnected')
  }
}

async function _notifyOrgUsers(orgId, sessionId) {
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('session_name, user_id')
    .eq('id', sessionId)
    .single()

  const { data: adminUsers } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .in('role', ['Admin', 'MD', 'System Admin'])

  const notifications = (adminUsers || []).map(u => ({
    user_id:    u.id,
    title:      'WhatsApp Session Disconnected',
    message:    `Session "${session?.session_name || sessionId}" disconnected. Active campaigns have been paused.`,
    type:       'warning',
    link:       '/whatsapp/sessions',
    is_read:    false,
    created_at: new Date().toISOString()
  }))

  if (notifications.length) {
    await supabase.from('notifications').insert(notifications)
  }
}

// Restore sessions on module load
sessionManager.restoreAllSessions().catch(err =>
  logger.error({ err }, 'Failed to restore sessions on startup')
)
