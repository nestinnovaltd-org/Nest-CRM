import { supabase } from '../utils/supabase.js'
import { logger }   from '../utils/logger.js'

/**
 * Validates Supabase JWT from Authorization header.
 * Attaches req.user = { id, email, org_id, role, permissions, account_type }
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing' })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      logger.warn({ error: error?.message, ip: req.ip }, 'Auth: invalid token')
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Fetch org_id + role from users table
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('org_id, role, permissions, account_type, full_name')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      logger.warn({ userId: user.id }, 'Auth: user profile not found')
      return res.status(403).json({ error: 'User profile not found' })
    }

    if (!profile.org_id) {
      logger.warn({ userId: user.id }, 'Auth: no org_id on user profile')
      return res.status(403).json({ error: 'No organization associated with this account' })
    }

    req.user = {
      id:           user.id,
      email:        user.email,
      org_id:       profile.org_id,
      role:         profile.role,
      permissions:  profile.permissions,
      account_type: profile.account_type,
      full_name:    profile.full_name
    }

    next()
  } catch (err) {
    logger.error({ err }, 'Auth middleware: unexpected error')
    res.status(500).json({ error: 'Authentication error' })
  }
}
