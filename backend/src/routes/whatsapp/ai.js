import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../../utils/supabase.js'
import { logger }   from '../../utils/logger.js'
import { withOrg }  from '../../middleware/orgScope.js'
import { extractLeadsFromPdfBuffer } from '../../services/ai/leadExtractor.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max file size
})

// GET /api/whatsapp/ai/settings
router.get('/settings', async (req, res) => {
  try {
    const { session_id } = req.query

    let query = withOrg(supabase.from('whatsapp_ai_settings').select('*'), req)
    if (session_id) {
      query = query.eq('session_id', session_id)
    } else {
      query = query.is('session_id', null)
    }

    const { data } = await query.single()
    res.json({ settings: data || null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI settings' })
  }
})

// PUT /api/whatsapp/ai/settings — Upsert settings
router.put('/settings', async (req, res) => {
  try {
    const { session_id = null, ai_mode, system_prompt, max_history_messages,
            auto_reply_delay_seconds, escalation_keywords } = req.body

    const update = { org_id: req.user.org_id, session_id, updated_at: new Date().toISOString() }
    if (ai_mode !== undefined)               update.ai_mode = ai_mode
    if (system_prompt !== undefined)         update.system_prompt = system_prompt
    if (max_history_messages !== undefined)  update.max_history_messages = Math.min(Number(max_history_messages), 20)
    if (auto_reply_delay_seconds !== undefined) update.auto_reply_delay_seconds = Math.max(1, Number(auto_reply_delay_seconds))
    if (escalation_keywords !== undefined)   update.escalation_keywords = escalation_keywords

    const { data, error } = await supabase
      .from('whatsapp_ai_settings')
      .upsert(update, { onConflict: 'org_id,session_id' })
      .select().single()

    if (error) throw error
    logger.info({ orgId: req.user.org_id, session_id, ai_mode, event: 'ai_settings_updated' }, 'AI settings updated')
    res.json({ settings: data })
  } catch (err) {
    logger.error({ err }, 'PUT /ai/settings error')
    res.status(500).json({ error: 'Failed to update AI settings' })
  }
})

// GET /api/whatsapp/ai/logs — AI usage logs
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
    res.status(500).json({ error: 'Failed to fetch AI logs' })
  }
})

// POST /api/whatsapp/ai/extract-leads-pdf — Upload PDF and extract leads via AI
router.post('/extract-leads-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' })
    }

    if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Invalid file type. Please upload a PDF file.' })
    }

    logger.info({ filename: req.file.originalname, size: req.file.size, orgId: req.user.org_id }, 'Processing PDF lead extraction request')

    const leads = await extractLeadsFromPdfBuffer(req.file.buffer)

    return res.json({
      success: true,
      filename: req.file.originalname,
      count: leads.length,
      leads
    })
  } catch (err) {
    logger.error({ err }, 'POST /api/whatsapp/ai/extract-leads-pdf error')
    return res.status(500).json({ error: err.message || 'Failed to extract leads from PDF' })
  }
})

export default router

