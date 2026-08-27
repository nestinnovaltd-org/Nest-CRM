/**
 * messageHandler.js
 * Processes every incoming WhatsApp message.
 * Matches to lead, creates/updates conversation, triggers AI if enabled.
 */

import { supabase }        from '../../utils/supabase.js'
import { logger }          from '../../utils/logger.js'
import { normalizePhone }  from './phoneNormalizer.js'
import { aiService }       from '../ai/aiService.js'
import { sessionManager }  from './sessionManager.js'

// Opt-out keywords — checked in any language
const OPT_OUT_KEYWORDS = [
  'stop', 'unsubscribe', 'block', 'remove', 'no more', 'dont message',
  "don't message", 'opt out', 'optout',
  'বন্ধ', 'বাদ দাও', 'মেসেজ দিওনা', 'আর মেসেজ করবেন না'
]

// Human handover keywords
const ESCALATION_KEYWORDS = [
  'human', 'agent', 'call me', 'sales person', 'sales executive', 'manager',
  'complaint', 'refund', 'legal', 'payment issue', 'talk to someone', 'real person',
  'মানুষ', 'কথা বলতে চাই', 'ফোন করুন', 'ম্যানেজার', 'অভিযোগ', 'বিক্রয় কর্মী',
  'manager bol', 'phone koro', 'call dao', 'manush theke sunbo', 'agent dao'
]

/**
 * Main handler called by sessionManager on every inbound message.
 */
export async function handleIncoming(msg, sessionId, orgId) {
  // Extract phone number from Baileys JID (e.g. 8801712345678@s.whatsapp.net)
  const jid     = msg.key.remoteJid || ''
  const rawPhone = jid.split('@')[0]
  const { normalized, valid } = normalizePhone(rawPhone)

  if (!valid || !normalized) {
    logger.warn({ jid, sessionId }, 'Incoming: could not normalize phone')
    return
  }

  // Extract text body from message
  const body = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.buttonsResponseMessage?.selectedDisplayText
    || ''

  if (!body.trim()) return  // skip non-text messages (images, voice, etc.)

  logger.info({ sessionId, event: 'message_inbound', phone: normalized.slice(-4) }, 'Inbound message received')

  // ─── 1. Find matching lead ────────────────────────────────────────────────
  const lead = await _findLead(normalized, orgId)

  // ─── 2. Upsert conversation ───────────────────────────────────────────────
  const conversation = await _upsertConversation(normalized, sessionId, orgId, lead, body)
  if (!conversation) return

  // ─── 3. Store inbound message ─────────────────────────────────────────────
  const { data: savedMsg } = await supabase
    .from('whatsapp_messages')
    .insert({
      org_id:          orgId,
      lead_id:         lead?.id || null,
      session_id:      sessionId,
      conversation_id: conversation.id,
      direction:       'INBOUND',
      message_source:  'MANUAL',
      message_body:    body,
      status:          'DELIVERED',
      delivered_at:    new Date().toISOString(),
      created_at:      new Date().toISOString()
    })
    .select()
    .single()

  // ─── 4. Check for opt-out ─────────────────────────────────────────────────
  const lowerBody = body.toLowerCase()
  if (OPT_OUT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
    await _handleOptOut(normalized, orgId, lead?.id)
    return
  }

  // ─── 5. Check for escalation request ─────────────────────────────────────
  const wantsHuman = ESCALATION_KEYWORDS.some(kw => lowerBody.includes(kw))
  if (wantsHuman && conversation.ai_status !== 'HUMAN_REQUIRED') {
    await _handleHumanHandover(conversation, lead, orgId, sessionId)
    return
  }

  // ─── 6. AI response (if enabled and not in human handover) ───────────────
  if (conversation.ai_status === 'HUMAN_REQUIRED' || conversation.ai_status === 'MANUAL') {
    // AI is off for this conversation — just notify assigned user
    await _notifyAssignedUser(conversation, lead, orgId, body)
    return
  }

  const aiSettings = await _getAISettings(orgId, sessionId)
  if (!aiSettings || aiSettings.ai_mode === 'AI_OFF') return

  // Small delay before AI replies (feels more human)
  const delay = (aiSettings.auto_reply_delay_seconds || 3) * 1000
  await new Promise(r => setTimeout(r, delay))

  const { reply, shouldEscalate } = await aiService.generateReply({
    lead,
    conversation,
    sessionId,
    orgId,
    inboundMessage: body,
    messageId:      savedMsg?.id
  })

  if (shouldEscalate) {
    await _handleHumanHandover(conversation, lead, orgId, sessionId)
    return
  }

  if (!reply) return

  // ─── 7. Send AI reply ─────────────────────────────────────────────────────
  if (aiSettings.ai_mode === 'AI_AUTO_REPLY') {
    try {
      const providerId = await sessionManager.sendMessage(sessionId, normalized, reply)

      await supabase.from('whatsapp_messages').insert({
        org_id:              orgId,
        lead_id:             lead?.id || null,
        session_id:          sessionId,
        conversation_id:     conversation.id,
        direction:           'OUTBOUND',
        message_source:      'AI',
        message_body:        reply,
        status:              'SENT',
        is_ai_generated:     true,
        provider_message_id: providerId,
        sent_at:             new Date().toISOString(),
        created_at:          new Date().toISOString()
      })

      logger.info({ sessionId, conversationId: conversation.id, event: 'ai_reply_sent' }, 'AI reply sent')
    } catch (err) {
      logger.error({ err, sessionId, event: 'ai_reply_send_failed' }, 'Failed to send AI reply')
    }
  }
  // AI_SUGGESTION: reply is stored in DB but not auto-sent (user reviews it)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _findLead(normalizedPhone, orgId) {
  // Search by primary phone, then secondary phone
  const digits = normalizedPhone.replace('+', '')

  const { data } = await supabase
    .from('leads')
    .select('id, name, phone, email, company, assigned_to, owner_id, org_id, interests')
    .eq('org_id', orgId)
    .or(`phone.ilike.%${digits}%,second_phone.ilike.%${digits}%`)
    .limit(1)
    .single()

  return data || null
}

async function _upsertConversation(phone, sessionId, orgId, lead, lastMessage) {
  const existingKey = lead
    ? { lead_id: lead.id, session_id: sessionId }
    : null

  // Try to find existing conversation
  let convoQuery = supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('org_id', orgId)

  if (lead) {
    convoQuery = convoQuery.eq('lead_id', lead.id)
  } else {
    convoQuery = convoQuery.eq('phone_number', phone)
  }

  const { data: existing } = await convoQuery.single()

  const preview = lastMessage.slice(0, 100)

  if (existing) {
    const { data: updated } = await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at:      new Date().toISOString(),
        last_message_preview: preview,
        unread_count:         (existing.unread_count || 0) + 1,
        updated_at:           new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()
    return updated
  }

  const { data: created } = await supabase
    .from('whatsapp_conversations')
    .insert({
      org_id:               orgId,
      lead_id:              lead?.id || null,
      session_id:           sessionId,
      phone_number:         phone,
      lead_name:            lead?.name || 'Unknown',
      last_message_at:      new Date().toISOString(),
      last_message_preview: preview,
      unread_count:         1,
      ai_status:            'ACTIVE',
      assigned_to:          lead?.assigned_to || null,
      created_at:           new Date().toISOString()
    })
    .select()
    .single()

  return created
}

async function _handleOptOut(phone, orgId, leadId) {
  logger.info({ phone: phone.slice(-4), orgId, event: 'opt_out' }, 'Customer opted out')

  if (leadId) {
    await supabase
      .from('whatsapp_lead_status')
      .upsert({
        lead_id:          leadId,
        org_id:           orgId,
        phone_number:     phone,
        normalized_phone: phone,
        opted_out:        true,
        opted_out_at:     new Date().toISOString(),
        opted_out_reason: 'Customer requested via message',
        updated_at:       new Date().toISOString()
      }, { onConflict: 'lead_id' })
  }
}

async function _handleHumanHandover(conversation, lead, orgId, sessionId) {
  logger.warn({ conversationId: conversation.id, event: 'human_handover' }, 'Human handover triggered')

  await supabase
    .from('whatsapp_conversations')
    .update({ ai_status: 'HUMAN_REQUIRED', updated_at: new Date().toISOString() })
    .eq('id', conversation.id)

  // Notify the assigned sales executive
  const assignedTo = conversation.assigned_to || lead?.assigned_to || lead?.owner_id
  if (assignedTo) {
    await supabase.from('notifications').insert({
      user_id:    assignedTo,
      title:      '⚠️ Customer Wants Human Agent',
      message:    `${lead?.name || conversation.phone_number} is asking for a human agent. Please respond on WhatsApp.`,
      type:       'urgent',
      link:       '/whatsapp/conversations',
      is_read:    false,
      created_at: new Date().toISOString()
    })
  }
}

async function _notifyAssignedUser(conversation, lead, orgId, messageBody) {
  const assignedTo = conversation.assigned_to || lead?.assigned_to
  if (!assignedTo) return

  await supabase.from('notifications').insert({
    user_id:    assignedTo,
    title:      `New WhatsApp message from ${lead?.name || conversation.phone_number}`,
    message:    messageBody.slice(0, 120),
    type:       'info',
    link:       '/whatsapp/conversations',
    is_read:    false,
    created_at: new Date().toISOString()
  })
}

async function _getAISettings(orgId, sessionId) {
  // Try session-specific settings first, then org-wide
  const { data: sessionSettings } = await supabase
    .from('whatsapp_ai_settings')
    .select('*')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .single()

  if (sessionSettings) return sessionSettings

  const { data: orgSettings } = await supabase
    .from('whatsapp_ai_settings')
    .select('*')
    .eq('org_id', orgId)
    .is('session_id', null)
    .single()

  return orgSettings
}
