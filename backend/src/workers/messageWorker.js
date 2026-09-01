/**
 * messageWorker.js
 * BullMQ worker — processes outbound WhatsApp messages from campaigns.
 * Enforces campaign safety: daily limits, delays, duplicate checks, retry logic.
 */

import 'dotenv/config'
import { Worker, Queue } from 'bullmq'
import { supabase }        from '../utils/supabase.js'
import { logger }          from '../utils/logger.js'
import { redis }           from '../utils/redis.js'
import { sessionManager }  from '../services/whatsapp/sessionManager.js'
import {
  isDailyLimitReached,
  isOptedOut,
  isAlreadySent,
  sleepRandom,
  trackConsecutiveFailure,
  resetFailureCounter,
  enforceSafetyFloors
} from '../utils/campaignSafety.js'

export const messageQueue = new Queue('whatsapp-outbound', {
  connection: redis,
  defaultJobOptions: {
    attempts:   3,
    backoff:    { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail:     { count: 500 }
  }
})

const worker = new Worker('whatsapp-outbound', async (job) => {
  const { recipientId, campaignId, sessionId, orgId } = job.data

  // ─── 1. Fetch recipient details ────────────────────────────────────────────
  const { data: recipient, error: rErr } = await supabase
    .from('whatsapp_campaign_recipients')
    .select('*, whatsapp_campaigns(min_delay_seconds, max_delay_seconds, daily_limit, status)')
    .eq('id', recipientId)
    .single()

  if (rErr || !recipient) {
    logger.warn({ recipientId, event: 'recipient_not_found' }, 'Recipient not found — skipping')
    return
  }

  const campaign = recipient.whatsapp_campaigns

  // ─── 2. Check campaign is still RUNNING ───────────────────────────────────
  if (campaign?.status !== 'RUNNING') {
    logger.info({ campaignId, recipientId, status: campaign?.status }, 'Campaign not running — skipping job')
    await supabase
      .from('whatsapp_campaign_recipients')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', recipientId)
    return
  }

  // ─── 3. Check daily limit ─────────────────────────────────────────────────
  if (await isDailyLimitReached(campaignId)) {
    logger.info({ campaignId, event: 'daily_limit_skip' }, 'Daily limit reached — requeueing for tomorrow')
    // Delay this job until next day 00:05 AM
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 5, 0, 0)
    const delay = tomorrow.getTime() - Date.now()
    await job.moveToDelayed(Date.now() + delay)
    return
  }

  // ─── 4. Check opted-out ───────────────────────────────────────────────────
  if (recipient.lead_id && await isOptedOut(recipient.lead_id)) {
    logger.info({ recipientId, event: 'opted_out_skip' }, 'Lead opted out — skipping')
    await supabase
      .from('whatsapp_campaign_recipients')
      .update({ status: 'SKIPPED', error_message: 'Customer opted out', updated_at: new Date().toISOString() })
      .eq('id', recipientId)
    return
  }

  // ─── 5. Check already sent (belt + suspenders over UNIQUE constraint) ──────
  if (recipient.lead_id && await isAlreadySent(campaignId, recipient.lead_id)) {
    logger.info({ recipientId, event: 'already_sent_skip' }, 'Already sent — skipping duplicate')
    await supabase
      .from('whatsapp_campaign_recipients')
      .update({ status: 'SKIPPED', error_message: 'Already sent in this campaign', updated_at: new Date().toISOString() })
      .eq('id', recipientId)
    return
  }

  // ─── 6. Mark as PROCESSING ────────────────────────────────────────────────
  await supabase
    .from('whatsapp_campaign_recipients')
    .update({ status: 'PROCESSING', retry_count: job.attemptsMade, updated_at: new Date().toISOString() })
    .eq('id', recipientId)

  // ─── 7. Safety delay before sending ──────────────────────────────────────
  const safe = enforceSafetyFloors(campaign)
  const delayMs = await sleepRandom(safe.min_delay_seconds, safe.max_delay_seconds)
  logger.info({ campaignId, recipientId, delayMs }, 'Delay applied before send')

  // ─── 8. Send the message ──────────────────────────────────────────────────
  // Fetch campaign's template to check for media attachment
  let mediaUrl = null, mediaType = null
  const { data: campRow } = await supabase
    .from('whatsapp_campaigns')
    .select('template_id')
    .eq('id', campaignId)
    .single()

  if (campRow?.template_id) {
    const { data: tmpl } = await supabase
      .from('whatsapp_templates')
      .select('media_url, media_type')
      .eq('id', campRow.template_id)
      .single()
    mediaUrl  = tmpl?.media_url  || null
    mediaType = tmpl?.media_type || null
  }

  const providerId = mediaUrl
    ? await sessionManager.sendMediaMessage(sessionId, recipient.phone_number, recipient.message_body, mediaUrl, mediaType)
    : await sessionManager.sendMessage(sessionId, recipient.phone_number, recipient.message_body)

  const now = new Date().toISOString()

  // ─── 9. Update recipient status → SENT ───────────────────────────────────
  await supabase
    .from('whatsapp_campaign_recipients')
    .update({
      status:              'SENT',
      provider_message_id: providerId,
      sent_at:             now,
      updated_at:          now
    })
    .eq('id', recipientId)

  // ─── 10. Insert message record ────────────────────────────────────────────
  await supabase.from('whatsapp_messages').insert({
    org_id:              orgId,
    lead_id:             recipient.lead_id,
    session_id:          sessionId,
    campaign_id:         campaignId,
    direction:           'OUTBOUND',
    message_source:      'CAMPAIGN',
    message_body:        recipient.message_body,
    status:              'SENT',
    provider_message_id: providerId,
    sent_at:             now,
    created_at:          now
  })

  // ─── 11. Update campaign sent_count ───────────────────────────────────────
  await supabase.rpc('increment_campaign_sent', { campaign_id: campaignId })

  // Reset consecutive failure counter on success
  await resetFailureCounter(campaignId, redis)

  logger.info({ campaignId, recipientId, providerId, event: 'message_sent' }, 'Message sent successfully')

}, {
  connection:  redis,
  concurrency: 1,  // one message at a time per worker (rate limiting)
  limiter:     { max: 1, duration: 1000 }  // max 1 job/second globally
})

// ─── Error handling ───────────────────────────────────────────────────────────
worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, campaignId: job?.data?.campaignId, err: err.message, event: 'job_failed' }, 'Message job failed')

  if (job?.data?.recipientId) {
    await supabase
      .from('whatsapp_campaign_recipients')
      .update({
        status:        'FAILED',
        error_message: err.message.slice(0, 500),
        updated_at:    new Date().toISOString()
      })
      .eq('id', job.data.recipientId)

    await supabase.rpc('increment_campaign_failed', { campaign_id: job.data.campaignId })
  }

  if (job?.data?.campaignId) {
    await trackConsecutiveFailure(job.data.campaignId, redis)
  }
})

worker.on('error', (err) => {
  logger.error({ err }, 'Message worker error')
})

logger.info('Message worker started')
