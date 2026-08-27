/**
 * aiValidator.js
 * Validates AI-generated responses before sending.
 * Prevents fabricated prices, discounts, guarantees, and availability claims.
 */

// ─── Forbidden patterns (fabrication detection) ───────────────────────────────
const FORBIDDEN_PATTERNS = [
  // Price fabrication
  { pattern: /(?:taka|tk|bdt|৳)\s*[\d,]+/i,                   reason: 'Contains fabricated price (currency+number)' },
  { pattern: /(?:price|cost|rate)\s+(?:is|are|=)\s*[\d,]+/i,  reason: 'Contains fabricated price claim' },
  { pattern: /মূল্য\s*[:=]?\s*[\d,৳]+/,                       reason: 'Contains fabricated Bengali price' },

  // Discount fabrication
  { pattern: /\b\d+\s*%\s*(?:discount|off|ছাড়)/i,            reason: 'Contains fabricated discount percentage' },
  { pattern: /special\s+(?:offer|price|rate|deal)/i,            reason: 'Contains unsupported special offer claim' },

  // Investment / ROI fabrication
  { pattern: /guaranteed?\s+(?:return|profit|price|handover)/i, reason: 'Contains fabricated guarantee' },
  { pattern: /investment\s+return/i,                            reason: 'Contains investment return claim' },
  { pattern: /(?:assured|নিশ্চিত)\s+(?:return|profit|লাভ)/i,  reason: 'Contains assured profit claim' },

  // Availability fabrication
  { pattern: /only\s+\d+\s+(?:unit|flat|apartment)s?\s+(?:left|available|remaining)/i, reason: 'Fabricated availability count' },
  { pattern: /\d+\s+(?:unit|flat|apartment)s?\s+(?:available|left|baki)/i,             reason: 'Fabricated availability count' },

  // Legal/contractual fabrication
  { pattern: /(?:legally?\s+binding|contract\s+guarantee|deed\s+guarantee)/i,          reason: 'Legal claim not authorised by AI' },
]

const FALLBACK_RESPONSE = 'আমাদের sales team এর সাথে যোগাযোগ করলে সঠিক তথ্য পাবেন। আপনার সুবিধামতো সময় জানালে আমরা কল করব।'

/**
 * Validate an AI-generated response.
 *
 * @param {string} response - The raw text from OpenAI
 * @param {string[]} projectNames - Available project names (for cross-reference)
 * @returns {{ safe: boolean, response: string, reason?: string }}
 */
export function validateAIResponse(response, projectNames = []) {
  if (!response || response.trim().length < 3) {
    return { safe: false, response: FALLBACK_RESPONSE, reason: 'Empty or too-short response' }
  }

  // Check for forbidden patterns
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(response)) {
      return { safe: false, response: FALLBACK_RESPONSE, reason }
    }
  }

  // Check response is not excessively long (prevent walls of text)
  const wordCount = response.split(/\s+/).length
  if (wordCount > 200) {
    // Truncate at last sentence boundary within 150 words
    const truncated = response.split(/[।.!?]/)[0]
    return { safe: true, response: truncated.trim() }
  }

  return { safe: true, response: response.trim() }
}

/**
 * Detect if a message requests human escalation.
 */
export function detectEscalation(message, customKeywords = []) {
  const BUILT_IN = [
    'human', 'agent', 'call me', 'sales person', 'sales executive', 'manager',
    'complaint', 'refund', 'legal', 'payment issue', 'talk to someone', 'real person',
    'মানুষ', 'কথা বলতে চাই', 'ফোন করুন', 'ম্যানেজার', 'অভিযোগ', 'বিক্রয় কর্মী',
    'manager bol', 'phone koro', 'call dao', 'manush theke sunbo', 'agent dao'
  ]

  const keywords = [...BUILT_IN, ...customKeywords]
  const lower    = message.toLowerCase()
  return keywords.some(kw => lower.includes(kw.toLowerCase()))
}

export { FALLBACK_RESPONSE }
