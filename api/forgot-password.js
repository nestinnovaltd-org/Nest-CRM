import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Supabase Admin Client ────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ── SMTP Transporter ─────────────────────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    host: 'mail.nestinnova.com',
    port: 465,
    secure: true,
    auth: { user: 'crm@nestinnova.com', pass: 'Nestinnova@2025' },
    tls: { rejectUnauthorized: false },
  });

// ── Logo CID Attachment ───────────────────────────────────────────────────
const getLogoAttachment = () => {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'Mail Logo.png');
    return { filename: 'logo.png', content: readFileSync(logoPath), cid: 'nestcrm-logo' };
  } catch { return null; }
};

// ── Professional HTML Email Template ─────────────────────────────────────
function buildEmailHtml(toEmail, resetLink, hasLogo) {
  const year = new Date().getFullYear();
  const logoBlock = hasLogo
    ? `<img src="cid:nestcrm-logo" alt="Nest CRM" style="height:52px;width:auto;display:block;margin:0 auto 20px;" />`
    : `<div style="font-size:22px;font-weight:800;color:#26E264;margin-bottom:20px;">Nest CRM</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Reset Your Password - Nest CRM</title>
</head>
<body style="margin:0;padding:0;background-color:#030706;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="background-color:#030706;padding:48px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">

  <!-- Card -->
  <tr>
    <td style="background-color:#0c1210;border:1px solid rgba(38,226,100,0.2);border-radius:20px;
      padding:40px 36px;text-align:center;
      box-shadow:0 24px 48px rgba(0,0,0,0.5),0 0 40px rgba(38,226,100,0.04);">

      ${logoBlock}

      <div style="display:inline-block;background:rgba(38,226,100,0.08);
        border:1px solid rgba(38,226,100,0.2);color:#26E264;
        font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2.5px;
        padding:5px 14px;border-radius:30px;margin-bottom:28px;">
        Security Notification
      </div>

      <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Reset Your Password
      </h1>

      <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">
        We received a request to reset the password for your Nest CRM account
        associated with <strong style="color:rgba(255,255,255,0.85);">${toEmail}</strong>.
        Click the button below to create a new secure password.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
        <tr>
          <td style="border-radius:30px;
            background:linear-gradient(135deg,#26E264 0%,#00e5c4 100%);
            box-shadow:0 10px 28px rgba(38,226,100,0.25);">
            <a href="${resetLink}" target="_blank"
              style="display:inline-block;padding:13px 36px;font-size:14px;
              font-weight:700;color:#030706;text-decoration:none;border-radius:30px;">
              &#128274; Reset Password
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 28px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;">
        This link expires in <strong style="color:rgba(255,255,255,0.55);">1 hour</strong>.<br/>
        If you did not request this, you can safely ignore this email.
      </p>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 24px;"/>

      <p style="margin:0 0 18px;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
        Button not working? Copy this link into your browser:<br/>
        <a href="${resetLink}" style="color:#26E264;word-break:break-all;font-size:10px;">${resetLink}</a>
      </p>

      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">
        Automated message from <strong style="color:rgba(255,255,255,0.4);">Nest CRM</strong>
        &middot; Nest Innova Technology Ltd.<br/>
        Support: <a href="mailto:crm@nestinnova.com" style="color:#26E264;text-decoration:none;">crm@nestinnova.com</a>
      </p>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:24px 0;text-align:center;">
      <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);">
        &copy; ${year} Nest Innova Technology Ltd. All rights reserved.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Check user exists in Supabase
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) throw userError;

    // Always 200 to prevent email enumeration
    if (!userRecord) {
      return res.status(200).json({
        success: true,
        message: 'If this email is registered, a reset link has been sent.',
      });
    }

    // 2. Generate secure token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // 3. Build reset link
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const resetLink = `${protocol}://${host}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // 4. Save token to Supabase
    await supabaseAdmin.from('password_resets').upsert({
      email: normalizedEmail,
      token,
      expires_at: expiresAt.toISOString(),
      used: false,
      created_at: new Date().toISOString(),
    });

    // 5. Send email
    const logoAttachment = getLogoAttachment();
    const htmlContent = buildEmailHtml(normalizedEmail, resetLink, !!logoAttachment);
    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Nest CRM" <crm@nestinnova.com>',
      to: normalizedEmail,
      subject: 'Reset Your Nest CRM Password',
      html: htmlContent,
      attachments: logoAttachment ? [logoAttachment] : [],
    });

    console.log(`[Nest CRM] Password reset email sent -> ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email. Please check your inbox.',
    });

  } catch (error) {
    console.error('[Nest CRM] Forgot Password Error:', error);
    return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
}
