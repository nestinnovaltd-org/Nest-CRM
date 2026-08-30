import { Router } from 'express'
import { supabase }   from '../../utils/supabase.js'
import { logger }     from '../../utils/logger.js'
import { withOrg }    from '../../middleware/orgScope.js'
import { checkQueue, performWhatsAppCheck } from '../../workers/checkWorker.js'
import { normalizePhone } from '../../services/whatsapp/phoneNormalizer.js'
import { sessionManager } from '../../services/whatsapp/sessionManager.js'

const router = Router()

// GET /api/whatsapp/leads — leads with their WA status
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    // Fetch leads first to avoid PGRST200 join error
    let query = supabase
      .from('leads')
      .select('id, name, phone, second_phone, email, company, status, assigned_to, created_at', { count: 'exact' })
      .eq('org_id', req.user.org_id)
      .neq('status', 'Released')

    const isAdmin = req.user.role === 'Admin' || req.user.role === 'MD' || req.user.role === 'System Admin' || req.user.account_type === 'super_admin'

    if (!isAdmin) {
      // Fetch all users in the same org
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, full_name, name, reports_to')
        .eq('org_id', req.user.org_id)
      
      // Fetch all teams
      const { data: teams } = await supabase
        .from('teams')
        .select('*')

      const currentUserName = req.user.full_name || ''
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
        .map(u => u.id)
        .filter(Boolean)

      const allowedUids = Array.from(new Set([
        req.user.id,
        ...(allUsers || []).filter(u => u.reports_to === currentUserName).map(u => u.id).filter(Boolean),
        ...teamMemberUids
      ]))

      if (allowedUids.length > 0) {
        query = query.or(`assigned_to.in.(${allowedUids.join(',')}),owner_id.in.(${allowedUids.join(',')})`)
      } else {
        query = query.eq('assigned_to', req.user.id)
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1)

    const { data: leads, count, error } = await query
    if (error) throw error

    // Fetch whatsapp lead status metadata for opt-outs
    let statusMap = {}
    if (leads && leads.length > 0) {
      const leadIds = leads.map(l => l.id)
      const { data: statuses } = await supabase
        .from('whatsapp_lead_status')
        .select('lead_id, whatsapp_status, check_error, last_checked_at, opted_out, whatsapp_link, normalized_phone')
        .in('lead_id', leadIds)
      
      if (statuses) {
        statuses.forEach(s => {
          statusMap[s.lead_id] = s
        })
      }
    }

    // Merge status
    const mergedLeads = (leads || []).map(lead => {
      const existingStatus = statusMap[lead.id] || {}
      return {
        ...lead,
        whatsapp_lead_status: {
          whatsapp_status: existingStatus.opted_out 
            ? 'WHATSAPP_NOT_AVAILABLE' 
            : (existingStatus.whatsapp_status || 'NOT_CHECKED'),
          normalized_phone: existingStatus.normalized_phone || lead.phone,
          whatsapp_link: existingStatus.whatsapp_link || '',
          last_checked_at: existingStatus.last_checked_at || null,
          opted_out: existingStatus.opted_out || false,
          check_error: existingStatus.check_error || null
        }
      }
    })

    // If status filter is passed (e.g. WHATSAPP_AVAILABLE), filter the list
    let filteredLeads = mergedLeads
    if (status) {
      filteredLeads = mergedLeads.filter(l => l.whatsapp_lead_status.whatsapp_status === status)
    }

    res.json({ leads: filteredLeads, total: count, page: Number(page), limit: Number(limit) })
  } catch (err) {
    logger.error({ err }, 'GET /leads error')
    res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

// POST /api/whatsapp/leads/check — Enqueue WA availability checks
router.post('/check', async (req, res) => {
  try {
    const { lead_ids, session_id } = req.body

    if (!lead_ids?.length) return res.status(400).json({ error: 'lead_ids array required' })
    if (!session_id)       return res.status(400).json({ error: 'session_id required' })

    // Verify session belongs to org
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('org_id', req.user.org_id)
      .single()

    if (!session) return res.status(404).json({ error: 'Session not found' })
    const liveStatus = sessionManager.getStatus(session_id)
    if (session.status !== 'CONNECTED' && liveStatus !== 'CONNECTED') {
      return res.status(400).json({ error: 'Session is not connected' })
    }

    // Fetch lead phones
    const { data: leads } = await supabase
      .from('leads')
      .select('id, phone, second_phone')
      .eq('org_id', req.user.org_id)
      .in('id', lead_ids)

    if (!leads?.length) return res.status(404).json({ error: 'No leads found' })

    // Update status to CHECKING in the database immediately so the UI reflects it
    for (const lead of leads) {
      await supabase
        .from('whatsapp_lead_status')
        .upsert({
          lead_id: lead.id,
          org_id: req.user.org_id,
          phone_number: lead.phone,
          whatsapp_status: 'CHECKING',
          updated_at: new Date().toISOString()
        }, { onConflict: 'lead_id' })
    }

    // Try to queue the checks via BullMQ
    try {
      const jobs = leads.map(lead => ({
        name: `check-${lead.id}`,
        data: {
          leadId:    lead.id,
          phone:     lead.phone,
          orgId:     req.user.org_id,
          sessionId: session_id
        }
      }))
      await checkQueue.addBulk(jobs)
      logger.info({ count: jobs.length, sessionId: session_id, event: 'check_jobs_queued' }, 'Check jobs queued in BullMQ')
    } catch (redisErr) {
      logger.warn({ err: redisErr.message }, 'Could not queue in BullMQ (Redis connection failed). Falling back to direct check execution.')
    }

    // Run direct background execution (fallback/immediate check mechanism)
    (async () => {
      for (const lead of leads) {
        try {
          await performWhatsAppCheck(lead.id, lead.phone, req.user.org_id, session_id);
          // Wait 500ms between checks to avoid rate-limiting issues
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          logger.error({ err, leadId: lead.id }, 'Direct background check failed');
        }
      }
    })();

    res.json({ message: `${leads.length} leads queued for checking`, count: leads.length })
  } catch (err) {
    logger.error({ err }, 'POST /leads/check error')
    res.status(500).json({ error: 'Failed to queue checks' })
  }
})

// GET /api/whatsapp/leads/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('whatsapp_lead_status')
      .select('*')
      .eq('lead_id', req.params.id)
      .eq('org_id', req.user.org_id)
      .single()

    res.json({ status: data || null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

// POST /api/whatsapp/leads/:id/opt-out (manual opt-out by sales team)
router.post('/:id/opt-out', async (req, res) => {
  try {
    const { reason = 'Manual opt-out by staff' } = req.body

    await supabase
      .from('whatsapp_lead_status')
      .upsert({
        lead_id:          req.params.id,
        org_id:           req.user.org_id,
        opted_out:        true,
        opted_out_at:     new Date().toISOString(),
        opted_out_reason: reason,
        updated_at:       new Date().toISOString()
      }, { onConflict: 'lead_id' })

    res.json({ message: 'Lead opted out successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to opt out lead' })
  }
})

export default router
