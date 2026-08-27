/**
 * orgScope.js — Enforces org_id scoping on every Supabase query.
 * Usage in route handlers:
 *   const q = withOrg(supabase.from('whatsapp_sessions').select('*'), req)
 *   const { data } = await q
 */

import { supabase } from '../utils/supabase.js'

/**
 * Appends .eq('org_id', req.user.org_id) to any Supabase query.
 * Prevents cross-org data access at the application layer.
 */
export function withOrg(query, req) {
  return query.eq('org_id', req.user.org_id)
}

/**
 * Verify an owned resource belongs to the user's org before mutation.
 * Returns true if the row belongs to org, false otherwise.
 */
export async function verifyOrgOwnership(table, id, orgId) {
  const { data, error } = await supabase
    .from(table)
    .select('id, org_id')
    .eq('id', id)
    .single()

  if (error || !data) return false
  return data.org_id === orgId
}
