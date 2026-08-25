import { createClient } from '@supabase/supabase-js';

// ── Supabase Admin Client ────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ── Main Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token, email, newPassword } = req.body || {};

  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: 'Token, email, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Validate token from password_resets table
    const { data: resetRecord, error: fetchError } = await supabaseAdmin
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    if (resetRecord.used) {
      return res.status(400).json({ error: 'This reset link has already been used.' });
    }

    const expiresAt = new Date(resetRecord.expires_at);
    if (new Date() > expiresAt) {
      return res.status(400).json({ error: 'This password reset link has expired. Please request a new one.' });
    }

    // 2. Find the user in Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const authUser = users.find(u => u.email === normalizedEmail);
    if (!authUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // 3. Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    // 4. Mark token as used
    await supabaseAdmin
      .from('password_resets')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', token);

    console.log(`[Nest CRM] Password reset successful for: ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully updated. You can now log in.',
    });

  } catch (error) {
    console.error('[Nest CRM] Reset Password Error:', error);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
}
