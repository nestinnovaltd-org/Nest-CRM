import { Router } from 'express'
import { supabase }  from '../../utils/supabase.js'
import { logger }    from '../../utils/logger.js'
import { withOrg }   from '../../middleware/orgScope.js'
import { sessionManager } from '../../services/whatsapp/sessionManager.js'

const router = Router()

// GET /api/whatsapp/conversations
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, ai_status } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let query = withOrg(
      supabase.from('whatsapp_conversations')
        .select('*, whatsapp_sessions(session_name)', { count: 'exact' })
        .order('last_message_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1),
      req
    )
    if (ai_status) query = query.eq('ai_status', ai_status)

    const { data, count, error } = await query
    if (error) throw error
    res.json({ conversations: data || [], total: count })
  } catch (err) {
    logger.error({ err }, 'GET /conversations error')
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /api/whatsapp/conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    // Verify conversation belongs to org
    const { data: conv } = await withOrg(
      supabase.from('whatsapp_conversations').select('id, org_id').eq('id', req.params.id),
      req
    ).single()
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })

    const { data, count } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1)

    res.json({ messages: data || [], total: count })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// POST /api/whatsapp/conversations/:id/reply — Manual reply
router.post('/:id/reply', async (req, res) => {
  try {
    const { body: msgBody } = req.body
    if (!msgBody?.trim()) return res.status(400).json({ error: 'Message body required' })

    const { data: conv } = await withOrg(
      supabase.from('whatsapp_conversations').select('*').eq('id', req.params.id),
      req
    ).single()
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })

    const providerId = await sessionManager.sendMessage(conv.session_id, conv.phone_number, msgBody.trim())

    const now = new Date().toISOString()
    await supabase.from('whatsapp_messages').insert({
      org_id: req.user.org_id, lead_id: conv.lead_id, session_id: conv.session_id,
      conversation_id: conv.id, direction: 'OUTBOUND', message_source: 'MANUAL',
      message_body: msgBody.trim(), status: 'SENT',
      provider_message_id: providerId, sent_at: now, created_at: now
    })

    // Update conversation preview
    await supabase.from('whatsapp_conversations').update({
      last_message_at: now, last_message_preview: msgBody.trim().slice(0, 100)
    }).eq('id', conv.id)

    res.json({ message: 'Sent', provider_id: providerId })
  } catch (err) {
    logger.error({ err }, 'POST /conversations/:id/reply error')
    res.status(500).json({ error: 'Failed to send reply' })
  }
})

// POST /api/whatsapp/conversations/:id/takeover — Human takes over (stops AI)
router.post('/:id/takeover', async (req, res) => {
  try {
    await withOrg(
      supabase.from('whatsapp_conversations').update({ ai_status: 'MANUAL', updated_at: new Date().toISOString() }).eq('id', req.params.id),
      req
    )
    res.json({ message: 'Human takeover — AI paused for this conversation' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to take over' })
  }
})

// POST /api/whatsapp/conversations/:id/resume-ai — Re-enable AI
router.post('/:id/resume-ai', async (req, res) => {
  try {
    await withOrg(
      supabase.from('whatsapp_conversations').update({ ai_status: 'ACTIVE', updated_at: new Date().toISOString() }).eq('id', req.params.id),
      req
    )
    res.json({ message: 'AI resumed for this conversation' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume AI' })
  }
})

// POST /api/whatsapp/conversations/:id/mark-read
router.post('/:id/mark-read', async (req, res) => {
  try {
    await withOrg(
      supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', req.params.id),
      req
    )
    res.json({ message: 'Marked as read' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

export default router
