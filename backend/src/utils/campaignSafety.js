/**
 * campaignSafety.js
 * Enforces hard safety floors for campaign messaging.
 * All campaign safety checks go through this module.
 */

import { supabase } from './supabase.js'
import { logger }   from './logger.js'

// ─── Safety Floors (CANNOT be overridden by campaign config) ─────────────────
export const SAFETY_FLOORS = {
  MIN_DELAY_SECONDS:       parseInt(process.env.SAFETY_MIN_DELAY_SECONDS)  || 8,
  MAX_DAILY_LIMIT:         parseInt(process.env.SAFETY_MAX_DAILY_LIMIT)    || 500,
  MAX_HOURLY:              parseInt(process.env.SAFETY_MAX_HOURLY)          || 50,
  MIN_DELAY_AFTER_FAILURE: 60,   // seconds to wait after any failure
  MAX_CONSECUTIVE_FAILURES: 10   // auto-pause threshold
}

/**
 * Enforce safety floors on campaign config values.
 */
export function enforceSafetyFloors(config) {
  return {
    min_delay_seconds: Math.max(Number(config.min_delay_seconds) || 8, SAFETY_FLOORS.MIN_DELAY_SECONDS),
    max_delay_seconds: Math.max(Number(config.max_delay_seconds) || 20, (config.min_delay_seconds || 8) + 5),
    daily_limit:       Math.min(Number(config.daily_limit)       || 200, SAFETY_FLOORS.MAX_DAILY_LIMIT)
  }
}

/**
 * Returns a random delay in milliseconds between min and max (floor-enforced).
 */
export function randomDelayMs(minSec, maxSec) {
  const safeMin = Math.max(minSec, SAFETY_FLOORS.MIN_DELAY_SECONDS)
  const safeMax = Math.max(maxSec, safeMin + 5)
  const seconds = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin
  return seconds * 1000
}

/**
 * Sleep for a random delay within campaign config bounds.
 */
export async function sleepRandom(minSec, maxSec) {
  const ms = randomDelayMs(minSec, maxSec)
  await new Promise(resolve => setTimeout(resolve, ms))
  return ms
}

/**
 * Check if the campaign has reached its daily sending limit.
 * Returns true if limit reached (should stop sending), false if safe to continue.
 */
export async function isDailyLimitReached(campaignId) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { count, error } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'SENT')
      .gte('sent_at', `${today}T00:00:00.000Z`)

    if (error) throw error

    const { data: campaign } = await supabase
      .from('whatsapp_campaigns')
      .select('daily_limit')
      .eq('id', campaignId)
      .single()

    const safeLimit = Math.min(campaign?.daily_limit || 200, SAFETY_FLOORS.MAX_DAILY_LIMIT)
    const reached   = (count || 0) >= safeLimit

    if (reached) {
      logger.warn({ campaignId, count, safeLimit, event: 'daily_limit_reached' }, 'Campaign daily limit reached')
    }

    return reached
  } catch (err) {
    logger.error({ err, campaignId }, 'campaignSafety: error checking daily limit')
    return true  // fail-safe: treat as reached to prevent over-sending
  }
}

/**
 * Check if lead has opted out. Returns true if opted out (skip the message).
 */
export async function isOptedOut(leadId) {
  const { data } = await supabase
    .from('whatsapp_lead_status')
    .select('opted_out')
    .eq('lead_id', leadId)
    .single()

  return data?.opted_out === true
}

/**
 * Check if recipient was already sent in this campaign (belt-and-suspenders over DB UNIQUE constraint).
 */
export async function isAlreadySent(campaignId, leadId) {
  const { data } = await supabase
    .from('whatsapp_campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('lead_id', leadId)
    .single()

  return data?.status === 'SENT'
}

/**
 * Track consecutive failures for a campaign.
 * Returns new count. Auto-pauses campaign if threshold reached.
 */
export async function trackConsecutiveFailure(campaignId, redis) {
  const key   = `campaign:${campaignId}:consecutive_failures`
  const count = await redis.incr(key)
  await redis.expire(key, 3600)

  if (count >= SAFETY_FLOORS.MAX_CONSECUTIVE_FAILURES) {
    logger.warn({ campaignId, count, event: 'auto_pause_consecutive_failures' }, 'Auto-pausing campaign: too many failures')
    await supabase
      .from('whatsapp_campaigns')
      .update({ status: 'PAUSED', pause_reason: `Auto-paused: ${count} consecutive send failures`, paused_at: new Date().toISOString() })
      .eq('id', campaignId)

    await redis.del(key)
  }

  return count
}

/**
 * Reset consecutive failure counter on successful send.
 */
export async function resetFailureCounter(campaignId, redis) {
  await redis.del(`campaign:${campaignId}:consecutive_failures`)
}

/**
 * Resolve template variables from a lead object.
 * Variables: {{name}}, {{phone}}, {{company}}, {{project_name}}, etc.
 * Missing variables are replaced with a safe fallback, never left as {{var}}.
 */
export function resolveTemplate(templateBody, lead) {
  return templateBody.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = lead[key] || lead[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
    // Safe fallback for common fields
    const fallbacks = {
      name:         'Valued Customer',
      phone:        lead.phone || '',
      company:      lead.company || '',
      project_name: ''
    }
    return fallbacks[key] || ''
  })
}
