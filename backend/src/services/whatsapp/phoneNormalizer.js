/**
 * phoneNormalizer.js
 * Normalizes phone numbers to E.164 international format.
 * Handles BD, international, and various formats.
 */

/**
 * Normalize a phone number to E.164 format (e.g. +8801712345678).
 *
 * Supported input formats:
 *   017XXXXXXXX        → +8801XXXXXXXXX
 *   +8801XXXXXXXXX     → +8801XXXXXXXXX  (already normalized)
 *   8801XXXXXXXXX      → +8801XXXXXXXXX
 *   +1-555-555-0100    → +15555550100
 *   (555) 555-0100     → +15555550100    (assumed US if 10 digits)
 *   +44 7911 123456    → +447911123456
 *
 * Returns: { normalized: string, valid: boolean, error?: string }
 */
export function normalizePhone(raw) {
  if (!raw) return { normalized: null, valid: false, error: 'Empty input' }

  // Step 1: Remove all characters except digits and leading +
  let cleaned = String(raw).trim()
  const hadPlus = cleaned.startsWith('+')
  cleaned = cleaned.replace(/[^\d]/g, '')

  if (cleaned.length < 6) {
    return { normalized: null, valid: false, error: 'Too short to be a valid number' }
  }

  // Step 2: Bangladesh-specific normalization
  // 11-digit starting with 01 → prepend 880
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return { normalized: `+880${cleaned}`, valid: true }
  }
  // 10-digit starting with 1 (BD local format without leading 0)
  if (cleaned.length === 10 && cleaned.startsWith('1') && isBDPrefix(cleaned)) {
    return { normalized: `+8801${cleaned.slice(1)}`, valid: true }
  }

  // Step 3: Already has country code (had + prefix)
  if (hadPlus) {
    // Must be 7-15 digits total (E.164 range)
    if (cleaned.length >= 7 && cleaned.length <= 15) {
      return { normalized: `+${cleaned}`, valid: true }
    }
    return { normalized: null, valid: false, error: 'Invalid length with country code' }
  }

  // Step 4: No + but starts with country code digits
  // BD: starts with 880
  if (cleaned.startsWith('880') && cleaned.length >= 12) {
    return { normalized: `+${cleaned}`, valid: true }
  }

  // US/Canada: 10 digits (NANP)
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, valid: true }
  }

  // UK: starts with 44, 11-12 digits total
  if (cleaned.startsWith('44') && (cleaned.length === 12 || cleaned.length === 13)) {
    return { normalized: `+${cleaned}`, valid: true }
  }

  // Generic: 7-15 digits, assume has country code
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return { normalized: `+${cleaned}`, valid: true }
  }

  return { normalized: null, valid: false, error: `Unrecognized format: ${cleaned.length} digits` }
}

/**
 * Check if 10-digit number starting with 1 is a BD Grameen/Robi/etc prefix.
 * BD prefixes after leading 0: 11, 12, 13, 14, 15, 16, 17, 18, 19
 */
function isBDPrefix(tenDigit) {
  const sub = tenDigit.slice(0, 2)
  return ['11','12','13','14','15','16','17','18','19'].includes(sub)
}

/**
 * Build the wa.me deep link for a normalized phone.
 */
export function buildWALink(normalizedPhone) {
  const digits = normalizedPhone.replace('+', '')
  return `https://wa.me/${digits}`
}
