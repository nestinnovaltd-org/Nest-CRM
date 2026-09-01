import { Router } from 'express'
import { supabase }       from '../../utils/supabase.js'
import { logger }         from '../../utils/logger.js'
import { withOrg, verifyOrgOwnership } from '../../middleware/orgScope.js'
import { messageQueue }   from '../../workers/messageWorker.js'
import { enforceSafetyFloors, resolveTemplate } from '../../utils/campaignSafety.js'
import { sessionManager }  from '../../services/whatsapp/sessionManager.js'

const router = Router()

// GET /api/whatsapp/campaigns
router.get('/', async (req, res) => {
  try {
    // Fetch campaigns (no implicit FK join — schema doesn't define FK constraints)
    const { data: campaigns, error } = await withOrg(
      supabase.from('whatsapp_campaigns')
        .select('*')
        .order('created_at', { ascending: false }),
      req
    )
    if (error) throw error

    if (!campaigns || campaigns.length === 0) {
      return res.json({ campaigns: [] })
    }

    // Fetch related session and template names separately
    const sessionIds  = [...new Set(campaigns.map(c => c.session_id).filter(Boolean))]
    const templateIds = [...new Set(campaigns.map(c => c.template_id).filter(Boolean))]

    const [sessRes, tmplRes] = await Promise.all([
      sessionIds.length  ? supabase.from('whatsapp_sessions').select('id, session_name, status, phone_number').in('id', sessionIds)  : { data: [] },
      templateIds.length ? supabase.from('whatsapp_templates').select('id, name').in('id', templateIds) : { data: [] }
    ])

    const sessMap = Object.fromEntries((sessRes.data || []).map(s => [s.id, s]))
    const tmplMap = Object.fromEntries((tmplRes.data || []).map(t => [t.id, t]))

    // Merge into campaign objects (same shape as PostgREST join would return)
    const merged = campaigns.map(c => ({
      ...c,
      whatsapp_sessions:  c.session_id  ? (sessMap[c.session_id]  || null) : null,
      whatsapp_templates: c.template_id ? (tmplMap[c.template_id] || null) : null,
    }))

    res.json({ campaigns: merged })
  } catch (err) {
    logger.error({ err }, 'GET /campaigns error')
    res.status(500).json({ error: 'Failed to fetch campaigns' })
  }
})


// POST /api/whatsapp/campaigns — Create campaign
router.post('/', async (req, res) => {
  try {
    const { name, session_id, template_id, lead_filter = {}, daily_limit,
            min_delay_seconds = 5, max_delay_seconds = 15, start_time } = req.body

    if (!name || !session_id || !template_id) {
      return res.status(400).json({ error: 'name, session_id, template_id required' })
    }

    const { data, error } = await supabase
      .from('whatsapp_campaigns')
      .insert({
        org_id: req.user.org_id, user_id: req.user.id, name, session_id, template_id,
        lead_filter,
        daily_limit:       daily_limit ? Number(daily_limit) : null,
        min_delay_seconds: Number(min_delay_seconds) || 5,
        max_delay_seconds: Number(max_delay_seconds) || 15,
        start_time, consent_confirmed: true, status: 'DRAFT',
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

    // Fetch campaign without FK join (schema has no FK constraints)
    const { data: campaign, error: fetchErr } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (fetchErr || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Manually fetch template and session
    const [{ data: template }, { data: session }] = await Promise.all([
      supabase.from('whatsapp_templates').select('id, body, variables').eq('id', campaign.template_id).single(),
      supabase.from('whatsapp_sessions').select('id, status').eq('id', campaign.session_id).single()
    ])
    campaign.whatsapp_templates = template || null
    campaign.whatsapp_sessions  = session  || null

    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot start campaign with status: ${campaign.status}` })
    }

    if (!campaign.template_id || !campaign.whatsapp_templates?.body) {
      return res.status(400).json({ error: 'Campaign template is missing or invalid' })
    }

    const liveStatus = sessionManager.getStatus(campaign.session_id)
    const dbStatus   = campaign.whatsapp_sessions?.status
    const isConnected = liveStatus === 'CONNECTED' || dbStatus === 'CONNECTED'
    if (!isConnected) {
      return res.status(400).json({ error: 'WhatsApp session is not connected' })
    }
    if (!campaign.consent_confirmed) {
      return res.status(400).json({ error: 'Consent not confirmed on this campaign' })
    }

    // Fetch eligible leads based on lead_filter
    const leads = await _getEligibleLeads(campaign, req.user.org_id)
    if (!leads || !leads.length) {
      return res.status(400).json({ error: 'No eligible leads found for this campaign' })
    }

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

    // Enqueue all recipient jobs in BullMQ (if available)
    try {
      const jobs = (inserted || []).map(r => ({
        name: `msg-${r.id}`,
        data: { recipientId: r.id, campaignId: campaign.id, sessionId: campaign.session_id, orgId: req.user.org_id }
      }))
      if (jobs.length) await messageQueue.addBulk(jobs)
    } catch (mqErr) {
      logger.warn({ err: mqErr.message }, 'Could not queue in BullMQ — using direct background processor')
    }

    // Launch direct background processor (same process holds the active Baileys session)
    _processCampaignDirectly(campaign.id, campaign.session_id, req.user.org_id)

    logger.info({ campaignId: campaign.id, recipientsCount: leads.length, event: 'campaign_started' }, 'Campaign started')
    res.json({ message: 'Campaign started', recipients: leads.length })
  } catch (err) {
    logger.error({ err }, 'POST /campaigns/:id/start error')
    res.status(500).json({ error: err.message || 'Failed to start campaign' })
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
      .select('session_id')
      .eq('id', req.params.id).single()

    // Manually fetch session status
    const { data: sessionRow } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('id', campaign.session_id)
      .single()

    const liveStatus = sessionManager.getStatus(campaign.session_id)
    const dbStatus   = sessionRow?.status
    const isConnected = liveStatus === 'CONNECTED' || dbStatus === 'CONNECTED'
    if (!isConnected) {
      return res.status(400).json({ error: 'Cannot resume: session is not connected' })
    }

    // Re-enqueue all QUEUED recipients
    const { data: queued } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('status', 'QUEUED')

    await supabase.from('whatsapp_campaigns').update({ status: 'RUNNING', pause_reason: null }).eq('id', req.params.id)

    try {
      const jobs = (queued || []).map(r => ({
        name: `msg-${r.id}`,
        data: { recipientId: r.id, campaignId: req.params.id, sessionId: campaign.session_id, orgId: req.user.org_id }
      }))
      if (jobs.length) await messageQueue.addBulk(jobs)
    } catch (mqErr) {
      logger.warn({ err: mqErr.message }, 'Could not queue in BullMQ on resume')
    }

    // Launch direct background processor
    _processCampaignDirectly(req.params.id, campaign.session_id, req.user.org_id)

    logger.info({ campaignId: req.params.id, event: 'campaign_resumed', count: queued?.length || 0 }, 'Campaign resumed')
    res.json({ message: 'Campaign resumed', requeued: queued?.length || 0 })
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

  // If specific lead_ids are passed (from lead selection), fetch them directly
  if (filter.lead_ids && Array.isArray(filter.lead_ids) && filter.lead_ids.length > 0) {
    const { data: explicitLeads } = await supabase
      .from('leads')
      .select('id, name, phone, company, email')
      .eq('org_id', orgId)
      .in('id', filter.lead_ids)

    if (!explicitLeads || explicitLeads.length === 0) return []

    // Fetch opt-out statuses
    const { data: statuses } = await supabase
      .from('whatsapp_lead_status')
      .select('lead_id, opted_out')
      .in('lead_id', filter.lead_ids)

    const optedOutSet = new Set((statuses || []).filter(s => s.opted_out).map(s => s.lead_id))

    return explicitLeads
      .filter(l => l.phone && !optedOutSet.has(l.id))
      .map(l => ({
        ...l,
        whatsapp_lead_status: { whatsapp_status: 'WHATSAPP_AVAILABLE', opted_out: false }
      }))
  }

  let query = supabase
    .from('leads')
    .select('id, name, phone, company, email')
    .eq('org_id', orgId)
    .neq('status', 'Released')

  // Fetch the creator's profile to scope campaign leads if they are not admin
  if (campaign.user_id) {
    const { data: creator } = await supabase
      .from('users')
      .select('id, uid, role, account_type, full_name')
      .eq('id', campaign.user_id)
      .single()

    if (creator) {
      const isAdmin = creator.role === 'Admin' || creator.role === 'MD' || creator.role === 'System Admin' || creator.account_type === 'super_admin'
      if (!isAdmin) {
        // Fetch all users in the same org
        const { data: allUsers } = await supabase
          .from('users')
          .select('id, uid, full_name, name, reports_to')
          .eq('org_id', orgId)
        
        // Fetch all teams in the same org
        const { data: teams } = await supabase
          .from('teams')
          .select('*')
          .eq('org_id', orgId)

        const currentUserName = creator.full_name || ''
        const managedTeams = (teams || []).filter(t => {
          const teamLeads = t.team_leads || t.teamLeads || (t.team_lead ? [t.team_lead] : [])
          return teamLeads.includes(currentUserName)
        })

        const teamMemberNames = new Set()
        managedTeams.forEach(t => {
          if (t.members) t.members.forEach(m => teamMemberNames.add(m))
        })

        const teamMemberUids = (allUsers || [])
          .filter(u => teamMemberNames.has(u.full_name || u.name))
          .flatMap(u => [u.id, u.uid].filter(Boolean))

        const allowedUids = Array.from(new Set([
          creator.id,
          ...(creator.uid ? [creator.uid] : []),
          ...(allUsers || []).filter(u => u.reports_to === currentUserName).flatMap(u => [u.id, u.uid].filter(Boolean)),
          ...teamMemberUids
        ]))

        if (allowedUids.length > 0) {
          query = query.or(`assigned_to.in.(${allowedUids.join(',')}),owner_id.in.(${allowedUids.join(',')})`)
        } else {
          query = query.eq('assigned_to', creator.id)
        }
      }
    }
  }

  if (filter.lead_ids && Array.isArray(filter.lead_ids) && filter.lead_ids.length > 0) {
    query = query.in('id', filter.lead_ids)
  }

  if (filter.status)      query = query.eq('status', filter.status)
  if (filter.source)      query = query.eq('source', filter.source)
  if (filter.assigned_to) query = query.eq('assigned_to', filter.assigned_to)
  if (filter.company)     query = query.eq('company', filter.company)

  const limitCount = (filter.lead_ids && filter.lead_ids.length) || campaign.daily_limit || 200
  const { data: leads } = await query.limit(limitCount)
  if (!leads || leads.length === 0) return []

  // Fetch whatsapp statuses separately to filter out opted out leads
  const leadIds = leads.map(l => l.id)
  const { data: statuses } = await supabase
    .from('whatsapp_lead_status')
    .select('lead_id, opted_out')
    .in('lead_id', leadIds)

  const optedOutSet = new Set(
    (statuses || [])
      .filter(s => s.opted_out)
      .map(s => s.lead_id)
  )

  // Map and return leads as WHATSAPP_AVAILABLE by default if not opted out
  return leads
    .filter(l => l.phone && !optedOutSet.has(l.id))
    .map(l => ({
      ...l,
      whatsapp_lead_status: {
        whatsapp_status: 'WHATSAPP_AVAILABLE',
        opted_out: false
      }
    }))
}

// ─── Direct Background Sender Loop ──────────────────────────────────────────
async function _processCampaignDirectly(campaignId, sessionId, orgId) {
  try {
    logger.info({ campaignId, sessionId, event: 'direct_campaign_processing_started' }, 'Direct campaign processing loop started')

    while (true) {
      // 1. Check campaign status
      const { data: campaign } = await supabase
        .from('whatsapp_campaigns')
        .select('status, min_delay_seconds, max_delay_seconds, daily_limit')
        .eq('id', campaignId)
        .single()

      if (!campaign || campaign.status !== 'RUNNING') {
        logger.info({ campaignId, status: campaign?.status }, 'Campaign no longer RUNNING — stopping direct processing loop')
        break
      }

      // 2. Fetch next QUEUED recipient
      const { data: recipient } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'QUEUED')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!recipient) {
        // Check if any recipient is in PROCESSING state
        const { count: remainingProcessing } = await supabase
          .from('whatsapp_campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'PROCESSING')

        if (!remainingProcessing || remainingProcessing === 0) {
          logger.info({ campaignId }, 'All recipients processed — marking campaign COMPLETED')
          await supabase.from('whatsapp_campaigns').update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', campaignId)
        }
        break
      }

      // 3. Mark recipient PROCESSING
      await supabase
        .from('whatsapp_campaign_recipients')
        .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
        .eq('id', recipient.id)

      // 4. Send message
      try {
        const providerId = await sessionManager.sendMessage(
          sessionId,
          recipient.phone_number,
          recipient.message_body
        )

        const now = new Date().toISOString()

        // 5. Update recipient -> SENT
        await supabase
          .from('whatsapp_campaign_recipients')
          .update({
            status: 'SENT',
            provider_message_id: providerId || null,
            sent_at: now,
            updated_at: now
          })
          .eq('id', recipient.id)

        // 6. Insert message record
        await supabase.from('whatsapp_messages').insert({
          org_id: orgId,
          lead_id: recipient.lead_id,
          session_id: sessionId,
          campaign_id: campaignId,
          direction: 'OUTBOUND',
          message_source: 'CAMPAIGN',
          message_body: recipient.message_body,
          status: 'SENT',
          provider_message_id: providerId || null,
          sent_at: now,
          created_at: now
        })

        // 7. Increment sent_count
        const { data: currentCampaign } = await supabase
          .from('whatsapp_campaigns')
          .select('sent_count')
          .eq('id', campaignId)
          .single()

        await supabase
          .from('whatsapp_campaigns')
          .update({
            sent_count: (currentCampaign?.sent_count || 0) + 1,
            updated_at: now
          })
          .eq('id', campaignId)

        logger.info({ campaignId, recipientId: recipient.id, providerId, event: 'direct_msg_sent' }, 'Message sent via direct loop')
      } catch (sendErr) {
        logger.error({ campaignId, recipientId: recipient.id, err: sendErr.message }, 'Direct send failed')
        const now = new Date().toISOString()

        await supabase
          .from('whatsapp_campaign_recipients')
          .update({
            status: 'FAILED',
            error_message: sendErr.message.slice(0, 500),
            updated_at: now
          })
          .eq('id', recipient.id)

        const { data: currentCampaign } = await supabase
          .from('whatsapp_campaigns')
          .select('failed_count')
          .eq('id', campaignId)
          .single()

        await supabase
          .from('whatsapp_campaigns')
          .update({
            failed_count: (currentCampaign?.failed_count || 0) + 1,
            updated_at: now
          })
          .eq('id', campaignId)
      }

      // 8. Apply safety delay between messages
      const minDelay = Math.max(Number(campaign.min_delay_seconds) || 5, 2)
      const maxDelay = Math.max(Number(campaign.max_delay_seconds) || 15, minDelay + 2)
      const randomMs = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000

      await new Promise(resolve => setTimeout(resolve, randomMs))
    }
  } catch (loopErr) {
    logger.error({ campaignId, err: loopErr.message }, 'Fatal error in direct campaign processing loop')
  }
}

export default router

