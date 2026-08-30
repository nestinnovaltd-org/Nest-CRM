/**
 * aiService.js
 * Generates AI responses using OpenAI GPT, with project context from Supabase.
 * Enforces safety validation before returning any response.
 */

import OpenAI from 'openai'
import { supabase }                             from '../../utils/supabase.js'
import { logger }                               from '../../utils/logger.js'
import { validateAIResponse, detectEscalation, FALLBACK_RESPONSE } from './aiValidator.js'

if (!process.env.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set — AI features will be disabled')
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Default system prompt (overridden by whatsapp_ai_settings.system_prompt)
const DEFAULT_SYSTEM_PROMPT = `You are a professional real-estate sales assistant. 

LANGUAGE RULES:
- Detect the customer's language from their message: Bengali (বাংলা), Banglish (রোমান), or English.
- Always reply in the SAME language the customer used.

KNOWLEDGE RULES (CRITICAL — NEVER VIOLATE):
- You ONLY use the project information provided in this conversation.
- You NEVER invent or guess: prices, flat sizes, payment plans, discounts, handover dates, or availability counts.
- If you don't have specific information, say: "এই বিষয়ে নিশ্চিত তথ্যের জন্য আমাদের sales team আপনাকে সহায়তা করবে।"
- You NEVER make guarantees, promises, investment return claims, or legal assurances.
- You NEVER mention competitors or make comparative claims.

BEHAVIOR:
- Be polite, professional, and concise (max 100 words per reply unless necessary).
- Ask clarifying questions to understand the customer's requirement.
- If the customer asks for a human, say you will connect them with the team immediately.
- Do not reveal that you are an AI unless directly asked.`

export const aiService = {
  /**
   * Generate a reply for an inbound message.
   *
   * @param {{ lead, conversation, sessionId, orgId, inboundMessage, messageId }} params
   * @returns {{ reply: string|null, shouldEscalate: boolean, tokensUsed: number }}
   */
  async generateReply({ lead, conversation, sessionId, orgId, inboundMessage, messageId }) {
    if (!process.env.OPENAI_API_KEY) {
      return { reply: null, shouldEscalate: false, tokensUsed: 0 }
    }

    const startTime = Date.now()

    try {
      // ─── 1. Fetch AI settings ──────────────────────────────────────────────
      const settings = await _getAISettings(orgId, sessionId)
      const maxHistory = settings?.max_history_messages || 10
      const systemPrompt = settings?.system_prompt || DEFAULT_SYSTEM_PROMPT
      const escalationKeywords = settings?.escalation_keywords || []

      // ─── 2. Fetch message history ─────────────────────────────────────────
      const { data: history } = await supabase
        .from('whatsapp_messages')
        .select('direction, message_body, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(maxHistory)

      const sortedHistory = (history || []).reverse()

      // ─── 3. Fetch project context (compact, only relevant fields) ─────────
      const projectContext = await _buildProjectContext(orgId, lead)

      // ─── 4. Build messages array for OpenAI ───────────────────────────────
      const messages = [
        {
          role: 'system',
          content: systemPrompt
            .replace('{org_name}', 'our organization')
            .replace('{project_data_compact}', projectContext)
        },
        // Inject project data as a system message
        {
          role: 'system',
          content: `Available project information:\n${projectContext}\n\nCustomer info: ${lead?.name || 'Unknown'}`
        },
        // Historical messages
        ...sortedHistory
          .filter(m => m.message_body)
          .map(m => ({
            role:    m.direction === 'INBOUND' ? 'user' : 'assistant',
            content: m.message_body
          })),
        // Current message
        { role: 'user', content: inboundMessage }
      ]

      // ─── 5. Call OpenAI ───────────────────────────────────────────────────
      const completion = await openai.chat.completions.create({
        model:       MODEL,
        messages,
        max_tokens:  300,
        temperature: 0.6
      })

      const rawReply   = completion.choices[0]?.message?.content || ''
      const tokensUsed = completion.usage?.total_tokens || 0
      const latencyMs  = Date.now() - startTime

      // ─── 6. Check for escalation in AI's own response ────────────────────
      const shouldEscalate = detectEscalation(inboundMessage, escalationKeywords)

      // ─── 7. Validate AI response ──────────────────────────────────────────
      const projectNames = projectContext.split('\n').map(l => l.split('-')[0].trim())
      const { safe, response: validatedReply, reason } = validateAIResponse(rawReply, projectNames)

      // ─── 8. Log AI usage ──────────────────────────────────────────────────
      await supabase.from('whatsapp_ai_logs').insert({
        org_id:              orgId,
        conversation_id:     conversation.id,
        message_id:          messageId,
        model:               MODEL,
        prompt_tokens:       completion.usage?.prompt_tokens || 0,
        completion_tokens:   completion.usage?.completion_tokens || 0,
        total_tokens:        tokensUsed,
        input_preview:       inboundMessage.slice(0, 200),
        output_preview:      validatedReply.slice(0, 200),
        was_sent:            safe && !shouldEscalate,
        rejection_reason:    !safe ? reason : null,
        escalation_detected: shouldEscalate,
        latency_ms:          latencyMs,
        created_at:          new Date().toISOString()
      })

      logger.info({
        conversationId: conversation.id,
        model: MODEL,
        tokens: tokensUsed,
        safe,
        shouldEscalate,
        event: 'ai_completion'
      }, 'AI completion done')

      if (shouldEscalate) {
        return { reply: null, shouldEscalate: true, tokensUsed }
      }

      return {
        reply: safe ? validatedReply : FALLBACK_RESPONSE,
        shouldEscalate: false,
        tokensUsed
      }

    } catch (err) {
      logger.error({ err, conversationId: conversation.id, event: 'ai_error' }, 'OpenAI API error')
      return { reply: null, shouldEscalate: false, tokensUsed: 0 }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _getAISettings(orgId, sessionId) {
  const { data: s } = await supabase
    .from('whatsapp_ai_settings')
    .select('*')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .single()
  if (s) return s

  const { data: g } = await supabase
    .from('whatsapp_ai_settings')
    .select('*')
    .eq('org_id', orgId)
    .is('session_id', null)
    .single()
  return g
}

async function _buildProjectContext(orgId, lead) {
  try {
    let query = supabase
      .from('projects')
      .select('projectName, location, type, status, description')
      .eq('org_id', orgId)
      .limit(10)

    // If lead has interests, prioritize those projects
    if (lead?.interests?.length) {
      query = query.in('projectName', lead.interests)
    }

    const { data: projects } = await query

    if (!projects?.length) return 'No project information available.'

    return projects
      .map(p => `- ${p.projectName} | ${p.location || 'N/A'} | ${p.type || ''} | Status: ${p.status || 'N/A'}${p.description ? ` | ${p.description.slice(0, 100)}` : ''}`)
      .join('\n')
  } catch (_) {
    return 'No project information available.'
  }
}
