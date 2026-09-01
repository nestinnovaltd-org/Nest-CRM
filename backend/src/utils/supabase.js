import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  const missing = []
  if (!supabaseUrl) missing.push('SUPABASE_URL')
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  throw new Error(
    `[FATAL] Missing required environment variables: ${missing.join(', ')}.\n` +
    `The backend MUST use SUPABASE_SERVICE_ROLE_KEY (not anon key) to bypass RLS.\n` +
    `Set these in /home/hijibusy-api/htdocs/api.hijibusy.com/backend/.env on VPS.\n` +
    `Get SUPABASE_SERVICE_ROLE_KEY from: Supabase Dashboard → Settings → API → service_role`
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

console.log('Supabase client initialized with URL:', supabaseUrl, 'Key type:', supabaseKey.startsWith('eyJ') ? 'JWT (service_role ✓)' : 'publishable (anon — RLS will block writes!)')

