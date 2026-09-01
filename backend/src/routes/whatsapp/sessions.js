import { Router } from 'express'
import { supabase }        from '../../utils/supabase.js'
import { logger }          from '../../utils/logger.js'
import { withOrg, verifyOrgOwnership } from '../../middleware/orgScope.js'
import { sessionManager }  from '../../services/whatsapp/sessionManager.js'

const router = Router()

// GET /api/whatsapp/sessions
router.get('/', async (req, res) => {
  try {
    const { data, error } = await withOrg(
      supabase.from('whatsapp_sessions').select('*').order('created_at', { ascending: false }),
      req
    )
    if (error) throw error

    // Enrich with in-memory live status
    const enriched = (data || []).map(s => ({
      ...s,
      live_status: sessionManager.getStatus(s.id)
    }))

    res.json({ sessions: enriched })
  } catch (err) {
    logger.error({ err }, 'GET /sessions error')
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// POST /api/whatsapp/sessions — Create and start a session
router.post('/', async (req, res) => {
  try {
    const { session_name } = req.body
    if (!session_name?.trim()) return res.status(400).json({ error: 'session_name is required' })

    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        org_id:       req.user.org_id,
        user_id:      req.user.id,
        session_name: session_name.trim(),
        status:       'CONNECTING',
        created_at:   new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Start Baileys session asynchronously
    sessionManager.startSession(session.id, req.user.org_id).catch(err =>
      logger.error({ err, sessionId: session.id }, 'Failed to start session')
    )

    logger.info({ sessionId: session.id, orgId: req.user.org_id, event: 'session_created' }, 'Session created')
    res.status(201).json({ session })
  } catch (err) {
    logger.error({ err }, 'POST /sessions error')
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// GET /api/whatsapp/sessions/:id/qr — Poll for QR code
router.get('/:id/qr', async (req, res) => {
  const owned = await verifyOrgOwnership('whatsapp_sessions', req.params.id, req.user)
  if (!owned) return res.status(404).json({ error: 'Session not found' })

  const qr = sessionManager.getQR(req.params.id)
  const status = sessionManager.getStatus(req.params.id)

  res.json({ qr, status })
})

// GET /api/whatsapp/sessions/:id/status
router.get('/:id/status', async (req, res) => {
  const owned = await verifyOrgOwnership('whatsapp_sessions', req.params.id, req.user)
  if (!owned) return res.status(404).json({ error: 'Session not found' })

  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('status, phone_number, last_connected_at, session_name')
    .eq('id', req.params.id)
    .single()

  res.json({ ...data, live_status: sessionManager.getStatus(req.params.id) })
})

// POST /api/whatsapp/sessions/:id/reconnect
router.post('/:id/reconnect', async (req, res) => {
  const owned = await verifyOrgOwnership('whatsapp_sessions', req.params.id, req.user)
  if (!owned) return res.status(404).json({ error: 'Session not found' })

  sessionManager.startSession(req.params.id, req.user.org_id).catch(err =>
    logger.error({ err, sessionId: req.params.id }, 'Reconnect failed')
  )
  res.json({ message: 'Reconnecting...' })
})

// POST /api/whatsapp/sessions/:id/disconnect
router.post('/:id/disconnect', async (req, res) => {
  const owned = await verifyOrgOwnership('whatsapp_sessions', req.params.id, req.user)
  if (!owned) return res.status(404).json({ error: 'Session not found' })

  await sessionManager.disconnectSession(req.params.id)
  res.json({ message: 'Session disconnected' })
})

// DELETE /api/whatsapp/sessions/:id
router.delete('/:id', async (req, res) => {
  const owned = await verifyOrgOwnership('whatsapp_sessions', req.params.id, req.user)
  if (!owned) return res.status(404).json({ error: 'Session not found' })

  await sessionManager.disconnectSession(req.params.id)
  await supabase.from('whatsapp_sessions').delete().eq('id', req.params.id)

  logger.info({ sessionId: req.params.id, event: 'session_deleted' }, 'Session deleted')
  res.json({ message: 'Session deleted' })
})

export default router
