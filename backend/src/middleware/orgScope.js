/**
 * orgScope.js — Enforces org_id and user_id scoping on Supabase queries.
 * Rules:
 *   - Super Admins can see all data within their organization.
 *   - Regular Users can ONLY see their own WhatsApp data (user_id = req.user.id).
 */

import { supabase } from '../utils/supabase.js'

/**
 * Checks if the user has Super Admin or Admin level permissions across the platform.
 */
export function isSuperAdmin(user) {
  if (!user) return false
  const role        = String(user.role || '').toLowerCase()
  const accountType = String(user.account_type || '').toLowerCase()
  return (
    accountType === 'super_admin' ||
    accountType === 'superadmin' ||
    role === 'super_admin' ||
    role === 'super admin' ||
    role === 'admin' ||
    role === 'system admin' ||
    role === 'md'
  )
}

/**
 * Appends .eq('org_id', req.user.org_id)
 * AND if the user is NOT a Super Admin, also appends .eq(userColumn, req.user.id)
 */
export function withOrg(query, req, userColumn = 'user_id') {
  let q = query.eq('org_id', req.user.org_id)
  if (!isSuperAdmin(req.user) && userColumn) {
    q = q.eq(userColumn, req.user.id)
  }
  return q
}

/**
 * Verify an owned resource belongs to the user's org (and user, if not Super Admin) before mutation.
 */
export async function verifyOrgOwnership(table, id, userOrOrgId, userColumn = 'user_id') {
  const isObject = typeof userOrOrgId === 'object' && userOrOrgId !== null
  const orgId    = isObject ? userOrOrgId.org_id : userOrOrgId
  const user     = isObject ? userOrOrgId : null

  let q = supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)

  if (user && !isSuperAdmin(user) && userColumn) {
    q = q.eq(userColumn, user.id)
  }

  const { data, error } = await q.maybeSingle()
  return !error && !!data
}
