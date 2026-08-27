import { Router } from 'express'
import { supabase } from '../../utils/supabase.js'
import { logger }   from '../../utils/logger.js'
import { withOrg }  from '../../middleware/orgScope.js'

const router = Router()

// GET /api/whatsapp/messages — message history with filters
router.get('/', async (req, res) => {
  try {
    const { conversation_id, campaign_id, direction, page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let query = withOrg(
      supabase.from('whatsapp_messages').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1),
      req
    )
    if (conversation_id) query = query.eq('conversation_id', conversation_id)
    if (campaign_id)     query = query.eq('campaign_id', campaign_id)
    if (direction)       query = query.eq('direction', direction)

    const { data, count, error } = await query
    if (error) throw error
    res.json({ messages: data || [], total: count })
  } catch (err) {
    logger.error({ err }, 'GET /messages error')
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// GET /api/whatsapp/messages/logs — AI logs
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const { data, count } = await withOrg(
      supabase.from('whatsapp_ai_logs').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1),
      req
    )
    res.json({ logs: data || [], total: count })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

export default router
