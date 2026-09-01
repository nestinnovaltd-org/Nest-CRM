import { Router } from 'express'
import { supabase } from '../../utils/supabase.js'
import { logger }   from '../../utils/logger.js'
import { withOrg, verifyOrgOwnership } from '../../middleware/orgScope.js'

const router = Router()

// GET /api/whatsapp/templates
router.get('/', async (req, res) => {
  try {
    const { data, error } = await withOrg(
      supabase.from('whatsapp_templates').select('*').eq('status', 'ACTIVE').order('created_at', { ascending: false }),
      req
    )
    if (error) throw error
    res.json({ templates: data || [] })
  } catch (err) {
    logger.error({ err }, 'GET /templates error')
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

// POST /api/whatsapp/templates
router.post('/', async (req, res) => {
  try {
    const { name, body, variables = [], media_url = null, media_type = null } = req.body
    if (!name?.trim() || !body?.trim()) return res.status(400).json({ error: 'name and body required' })

    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({
        org_id: req.user.org_id, user_id: req.user.id,
        name: name.trim(), body: body.trim(), variables,
        media_url: media_url || null,
        media_type: media_type || null,
        created_at: new Date().toISOString()
      })
      .select().single()

    if (error) throw error
    res.status(201).json({ template: data })
  } catch (err) {
    logger.error({ err }, 'POST /templates error')
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// PUT /api/whatsapp/templates/:id
router.put('/:id', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_templates', req.params.id, req.user)
    if (!owned) return res.status(404).json({ error: 'Template not found' })

    const { name, body, variables, media_url, media_type } = req.body
    const update = {}
    if (name)                update.name      = name.trim()
    if (body)                update.body      = body.trim()
    if (variables)           update.variables = variables
    if (media_url  !== undefined) update.media_url  = media_url  || null
    if (media_type !== undefined) update.media_type = media_type || null

    const { data, error } = await supabase.from('whatsapp_templates').update(update).eq('id', req.params.id).select().single()
    if (error) throw error
    res.json({ template: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' })
  }
})

// DELETE /api/whatsapp/templates/:id (soft delete → ARCHIVED)
router.delete('/:id', async (req, res) => {
  try {
    const owned = await verifyOrgOwnership('whatsapp_templates', req.params.id, req.user)
    if (!owned) return res.status(404).json({ error: 'Template not found' })

    await supabase.from('whatsapp_templates').update({ status: 'ARCHIVED' }).eq('id', req.params.id)
    res.json({ message: 'Template archived' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

export default router
