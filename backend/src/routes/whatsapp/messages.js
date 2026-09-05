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

// GET /api/whatsapp/messages/logs — full message logs with lead + session info
router.get('/logs', async (req, res) => {
  try {
    const {
      page = 1, limit = 50,
      search = '',
      direction,        // INBOUND | OUTBOUND
      status,           // SENT | DELIVERED | READ | FAILED
      session_id,
      campaign_id,
      date_from,
      date_to
    } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    // ── Step 1: fetch messages directly ────────────────────────────────────
    let query = supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (req.user?.org_id) {
      query = query.or(`org_id.eq.${req.user.org_id},org_id.is.null`)
    }

    if (direction)   query = query.eq('direction', direction)
    if (status)      query = query.eq('status', status)
    if (session_id)  query = query.eq('session_id', session_id)
    if (campaign_id) query = query.eq('campaign_id', campaign_id)
    if (date_from)   query = query.gte('created_at', date_from)
    if (date_to)     query = query.lte('created_at', date_to + 'T23:59:59Z')

    query = query.range(offset, offset + Number(limit) - 1)

    const { data: messages, count, error } = await query
    if (error) throw error

    if (!messages || messages.length === 0) {
      return res.json({ logs: [], total: 0 })
    }

    // ── Step 2: fetch related entities manually (no FK constraint in schema) ─
    const leadIds = Array.from(new Set(messages.map(m => m.lead_id).filter(Boolean)))
    const sessionIds = Array.from(new Set(messages.map(m => m.session_id).filter(Boolean)))
    const campaignIds = Array.from(new Set(messages.map(m => m.campaign_id).filter(Boolean)))

    const [{ data: leadsData }, { data: sessionsData }, { data: campaignsData }] = await Promise.all([
      leadIds.length ? supabase.from('leads').select('id, name, phone, second_phone, company, status').in('id', leadIds) : { data: [] },
      sessionIds.length ? supabase.from('whatsapp_sessions').select('id, session_name, phone_number').in('id', sessionIds) : { data: [] },
      campaignIds.length ? supabase.from('whatsapp_campaigns').select('id, name').in('id', campaignIds) : { data: [] }
    ])

    const leadMap = new Map((leadsData || []).map(l => [l.id, l]))
    const sessionMap = new Map((sessionsData || []).map(s => [s.id, s]))
    const campaignMap = new Map((campaignsData || []).map(c => [c.id, c]))

    // ── Step 3: shape the response ─────────────────────────────────────────
    let logs = messages.map(m => {
      const lead = leadMap.get(m.lead_id) || {}
      const sess = sessionMap.get(m.session_id) || {}
      const camp = campaignMap.get(m.campaign_id) || {}

      return {
        id:                  m.id,
        direction:           m.direction,
        message_source:      m.message_source,
        message_body:        m.message_body,
        status:              m.status,
        provider_message_id:  m.provider_message_id,
        is_ai_generated:     m.is_ai_generated || false,
        // timestamps
        created_at:   m.created_at,
        sent_at:      m.sent_at,
        delivered_at: m.delivered_at,
        read_at:      m.read_at,
        failed_at:    m.failed_at,
        // lead info
        lead_id:      m.lead_id,
        lead_name:    lead.name || '—',
        lead_phone:   lead.phone || lead.second_phone || '—',
        lead_company: lead.company || '—',
        lead_status:  lead.status || '—',
        // session (sender) info
        session_id:   m.session_id,
        session_name: sess.session_name || '—',
        session_phone: sess.phone_number || '—',
        // campaign info
        campaign_id:   m.campaign_id,
        campaign_name: camp.name || '—'
      }
    })

    // ── Step 4: client-side search (lead name / phone / body / campaign) ───
    if (search) {
      const q = search.toLowerCase()
      logs = logs.filter(l =>
        l.lead_name?.toLowerCase().includes(q) ||
        l.lead_phone?.includes(q) ||
        l.session_phone?.includes(q) ||
        l.message_body?.toLowerCase().includes(q) ||
        l.campaign_name?.toLowerCase().includes(q)
      )
    }

    res.json({ logs, total: count || logs.length })
  } catch (err) {
    logger.error({ err }, 'GET /messages/logs error')
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})


export default router
