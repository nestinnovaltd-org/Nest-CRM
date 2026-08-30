/**
 * checkWorker.js
 * BullMQ worker — checks WhatsApp availability for leads in background.
 * Rate-limited to avoid detection: max 2 checks/second.
 */

import 'dotenv/config'
import { Worker, Queue } from 'bullmq'
import { supabase }       from '../utils/supabase.js'
import { logger }         from '../utils/logger.js'
import { redis }          from '../utils/redis.js'
import { sessionManager } from '../services/whatsapp/sessionManager.js'
import { normalizePhone, buildWALink } from '../services/whatsapp/phoneNormalizer.js'

export const checkQueue = new Queue('whatsapp-check', {
  connection: redis,
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: 'fixed', delay: 10_000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 }
  }
})

const worker = new Worker('whatsapp-check', async (job) => {
  const { leadId, phone, orgId, sessionId } = job.data

  // Normalize phone
  const { normalized, valid, error: normError } = normalizePhone(phone)

  if (!valid || !normalized) {
    logger.warn({ leadId, phone, normError }, 'checkWorker: invalid phone — marking INVALID_NUMBER')
    await _upsertStatus(leadId, orgId, phone, null, 'INVALID_NUMBER', sessionId, normError)
    return
  }

  // Mark as CHECKING
  await _upsertStatus(leadId, orgId, phone, normalized, 'CHECKING', sessionId)

  try {
    // Check via Baileys
    const exists = await sessionManager.checkNumber(sessionId, normalized)

    const status    = exists ? 'WHATSAPP_AVAILABLE' : 'WHATSAPP_NOT_AVAILABLE'
    const waLink    = exists ? buildWALink(normalized) : null

    await _upsertStatus(leadId, orgId, phone, normalized, status, sessionId, null, waLink)

    logger.info({ leadId, status, event: 'check_complete' }, 'WA check complete')

  } catch (err) {
    logger.error({ err, leadId, event: 'check_failed' }, 'WA check failed')
    await _upsertStatus(leadId, orgId, phone, normalized, 'CHECK_FAILED', sessionId, err.message)
  }

}, {
  connection:  redis,
  concurrency: 2,   // 2 concurrent checks
  limiter:     { max: 2, duration: 1000 }  // max 2/second to avoid detection
})

async function _upsertStatus(leadId, orgId, rawPhone, normalized, status, sessionId, error = null, waLink = null) {
  await supabase
    .from('whatsapp_lead_status')
    .upsert({
      lead_id:              leadId,
      org_id:               orgId,
      phone_number:         rawPhone,
      normalized_phone:     normalized,
      whatsapp_status:      status,
      whatsapp_link:        waLink,
      last_checked_at:      new Date().toISOString(),
      checked_by_session_id: sessionId,
      check_error:          error,
      updated_at:           new Date().toISOString()
    }, { onConflict: 'lead_id' })

  // Sync back to the leads table
  const isAvailable = status === 'WHATSAPP_AVAILABLE';
  await supabase
    .from('leads')
    .update({
      phone_whatsapp: isAvailable,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);
}

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, leadId: job?.data?.leadId, err: err.message }, 'Check job failed')
})

worker.on('error', (err) => {
  logger.error({ err }, 'Check worker error')
})

logger.info('Check worker started')
