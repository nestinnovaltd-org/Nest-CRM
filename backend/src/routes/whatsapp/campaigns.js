import { Router } from 'express'
import { supabase }       from '../../utils/supabase.js'
import { logger }         from '../../utils/logger.js'
import { withOrg, verifyOrgOwnership } from '../../middleware/orgScope.js'
import { messageQueue }   from '../../workers/messageWorker.js'
import { enforceSafetyFloors, resolveTemplate } from '../../utils/campaignSafety.js'

const router = Router()

// GET /api/whatsapp/campaigns
router.get('/', async (req, res) => {
  try {
    const { data, error } = await withOrg(
      supabase.from('whatsapp_campaigns')
        .select('*, whatsapp_sessions(session_name, status), whatsapp_templates(name)')
        .order('created_at', { ascending: false }),
      req
    )
    if (error) throw error
    res.json({ campaigns: data || [] })
  } catch (err) {
    logger.error({ err }, 'GET /campaigns error')
    res.status(500).json({ error: 'Failed to fetch campaigns' })
  }
})

// POST /api/whatsapp/campaigns — Create campaign
router.post('/', async (req, res) => {
  try {
    const { name, session_id, template_id, lead_filter = {}, daily_limit = 200,
            min_delay_seconds = 8, max_delay_seconds = 20, start_time, consent_confirmed } = req.body

    if (!name || !session_id || !template_id) {
      return res.status(400).json({ error: 'name, session_id, template_id required' })
    }
    if (!consent_confirmed) {
      return res.status(400).json({ error: 'Consent must be confirmed before creating a campaign' })
    }

    // Enforce safety floors
    const safe = enforceSafetyFloors({ daily_limit, min_delay_seconds, max_delay_seconds })

    const { data, error } = await supabase
      .from('whatsapp_campaigns')
      .insert({
        org_id: req.user.org_id, user_id: req.user.id, name, session_id, template_id,
        lead_filter, ...safe, start_time, consent_confirmed: true, status: 'DRAFT',
        created_at: new Date().toISOString()
      })
      .select().single()

    if (error) throw error
    res.status(201).json({ campaign: data })
  } catch (err) {
    logger.error({ err }, 'POST /campaigns error')
    res.status(500).json({ error: 'Failed to create campaign' })
  }
})

// POST /api/whatsapp/campaigns/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_campaigns', req.params.id, req.user.org_id)
    if (!owned) return res.status(404).json({ error: 'Campaign not found' })

    const { data: campaign } = await supabase
      .from('whatsapp_campaigns')
      .select('*, whatsapp_templates(body, variables), whatsapp_sessions(status)')
      .eq('id', req.params.id).single()

    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot start campaign with status: ${campaign.status}` })
    }
    if (campaign.whatsapp_sessions?.status !== 'CONNECTED') {
      return res.status(400).json({ error: 'WhatsApp session is not connected' })
    }
    if (!campaign.consent_confirmed) {
      return res.status(400).json({ error: 'Consent not confirmed on this campaign' })
    }

    // Fetch eligible leads based on lead_filter
    const leads = await _getEligibleLeads(campaign, req.user.org_id)
    if (!leads.length) return res.status(400).json({ error: 'No eligible leads found for this campaign' })

    // Upsert recipients (ON CONFLICT DO NOTHING for duplicates)
    const recipients = leads.map(lead => ({
      campaign_id:   campaign.id,
      lead_id:       lead.id,
      org_id:        req.user.org_id,
      phone_number:  lead.normalized_phone || lead.phone,
      message_body:  resolveTemplate(campaign.whatsapp_templates.body, lead),
      status:        'QUEUED',
      created_at:    new Date().toISOString()
    }))

    const { data: inserted } = await supabase
      .from('whatsapp_campaign_recipients')
      .upsert(recipients, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })
      .select('id')

    // Update campaign to RUNNING
    await supabase.from('whatsapp_campaigns').update({
      status: 'RUNNING', started_at: new Date().toISOString(),
      total_recipients: leads.length, updated_at: new Date().toISOString()
    }).eq('id', campaign.id)

    // Enqueue all recipient jobs
    const jobs = (inserted || []).map(r => ({
      name: `msg-${r.id}`,
      data: { recipientId: r.id, campaignId: campaign.id, sessionId: campaign.session_id, orgId: req.user.org_id }
    }))
    if (jobs.length) await messageQueue.addBulk(jobs)

    logger.info({ campaignId: campaign.id, jobCount: jobs.length, event: 'campaign_started' }, 'Campaign started')
    res.json({ message: 'Campaign started', recipients: leads.length })
  } catch (err) {
    logger.error({ err }, 'POST /campaigns/:id/start error')
    res.status(500).json({ error: 'Failed to start campaign' })
  }
})

// POST /api/whatsapp/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_campaigns', req.params.id, req.user.org_id)
    if (!owned) return res.status(404).json({ error: 'Campaign not found' })

    await supabase.from('whatsapp_campaigns').update({
      status: 'PAUSED', pause_reason: 'Manual pause by user', paused_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('status', 'RUNNING')

    logger.info({ campaignId: req.params.id, event: 'campaign_paused_manual' }, 'Campaign paused')
    res.json({ message: 'Campaign paused' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause campaign' })
  }
})

// POST /api/whatsapp/campaigns/:id/resume
router.post('/:id/resume', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_campaigns', req.params.id, req.user.org_id)
    if (!owned) return res.status(404).json({ error: 'Campaign not found' })

    const { data: campaign } = await supabase
      .from('whatsapp_campaigns')
      .select('session_id, whatsapp_sessions(status)')
      .eq('id', req.params.id).single()

    if (campaign.whatsapp_sessions?.status !== 'CONNECTED') {
      return res.status(400).json({ error: 'Cannot resume: session is not connected' })
    }

    // Re-enqueue all QUEUED recipients
    const { data: queued } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('status', 'QUEUED')

    await supabase.from('whatsapp_campaigns').update({ status: 'RUNNING', pause_reason: null }).eq('id', req.params.id)

    const jobs = (queued || []).map(r => ({
      name: `msg-${r.id}`,
      data: { recipientId: r.id, campaignId: req.params.id, sessionId: campaign.session_id, orgId: req.user.org_id }
    }))
    if (jobs.length) await messageQueue.addBulk(jobs)

    logger.info({ campaignId: req.params.id, event: 'campaign_resumed', count: jobs.length }, 'Campaign resumed')
    res.json({ message: 'Campaign resumed', requeued: jobs.length })
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume campaign' })
  }
})

// POST /api/whatsapp/campaigns/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_campaigns', req.params.id, req.user.org_id)
    if (!owned) return res.status(404).json({ error: 'Campaign not found' })

    // Cancel all QUEUED recipients
    await supabase.from('whatsapp_campaign_recipients').update({ status: 'CANCELLED' })
      .eq('campaign_id', req.params.id).eq('status', 'QUEUED')

    await supabase.from('whatsapp_campaigns').update({
      status: 'STOPPED', completed_at: new Date().toISOString()
    }).eq('id', req.params.id)

    logger.info({ campaignId: req.params.id, event: 'campaign_stopped' }, 'Campaign stopped')
    res.json({ message: 'Campaign stopped' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop campaign' })
  }
})

// GET /api/whatsapp/campaigns/:id — Campaign detail with recipient stats
router.get('/:id', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_campaigns', req.params.id, req.user.org_id)
    if (!owned) return res.status(404).json({ error: 'Campaign not found' })

    const { data } = await supabase
      .from('whatsapp_campaigns')
      .select('*, whatsapp_templates(name, body), whatsapp_sessions(session_name, status)')
      .eq('id', req.params.id).single()

    const { data: recipients } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('status')
      .eq('campaign_id', req.params.id)

    const stats = (recipients || []).reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    res.json({ campaign: data, stats })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign' })
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function _getEligibleLeads(campaign, orgId) {
  const filter = campaign.lead_filter || {}

  let query = supabase
    .from('leads')
    .select('id, name, phone, company, email, whatsapp_lead_status(normalized_phone, whatsapp_status, opted_out)')
    .eq('org_id', orgId)
    // Only send to verified WA numbers
    .eq('whatsapp_lead_status.whatsapp_status', 'WHATSAPP_AVAILABLE')
    .eq('whatsapp_lead_status.opted_out', false)

  if (filter.status)      query = query.eq('status', filter.status)
  if (filter.source)      query = query.eq('source', filter.source)
  if (filter.assigned_to) query = query.eq('assigned_to', filter.assigned_to)
  if (filter.company)     query = query.eq('company', filter.company)

  const { data } = await query.limit(campaign.daily_limit || 200)
  return (data || []).filter(l => l.whatsapp_lead_status?.whatsapp_status === 'WHATSAPP_AVAILABLE')
}

export default router
