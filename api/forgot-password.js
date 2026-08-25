import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import crypto from 'crypto';

// Helper to initialize Firebase Admin SDK
const initFirebaseAdmin = () => {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // We are only configured if we have real credentials
  const hasCredentials = !!(serviceAccountKey || (clientEmail && privateKey));

  if (!hasCredentials) {
    return {
      db: null,
      auth: null,
      isConfigured: false
    };
  }

  if (admin.apps.length > 0) {
    return {
      db: admin.firestore(),
      auth: admin.auth(),
      isConfigured: true
    };
  }

  let formattedPrivateKey = privateKey ? privateKey.replace(/\\n/g, '\n') : undefined;
  if (formattedPrivateKey) {
    if ((formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) || 
        (formattedPrivateKey.startsWith("'") && formattedPrivateKey.endsWith("'"))) {
      formattedPrivateKey = formattedPrivateKey.substring(1, formattedPrivateKey.length - 1);
    }
    formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
  }

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      return {
        db: admin.firestore(),
        auth: admin.auth(),
        isConfigured: true
      };
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e);
    }
  }

  if (clientEmail && formattedPrivateKey && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey
        })
      });
      return {
        db: admin.firestore(),
        auth: admin.auth(),
        isConfigured: true
      };
    } catch (e) {
      console.error('Error initializing Firebase Admin SDK with cert params:', e);
    }
  }

  return {
    db: null,
    auth: null,
    isConfigured: false
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { db, auth, isConfigured } = initFirebaseAdmin();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiration

    // Build reset link dynamically based on host
    const host = req.headers.host || 'fahamestate.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const resetLink = `${protocol}://${host}/reset-password?token=${token}`;

    if (!isConfigured) {
      console.log('\n======================================================');
      console.log('🔑 PASSWORD RESET LINK (MOCK MODE - ADMIN SDK NOT SETUP):');
      console.log(`Email: ${email}`);
      console.log(`Link:  ${resetLink}`);
      console.log('======================================================\n');
      
      // Let's also send the email via SMTP anyway!
      // This allows the user to test the SMTP email sending even before they configure the Firebase Admin SDK.
      await sendResetEmail(email, resetLink);

      return res.status(200).json({ 
        success: true, 
        message: 'Reset link sent successfully. (Note: Admin SDK credentials are missing. Reset link was logged to the server console).'
      });
    }

    // Check if user exists in Firebase Auth
    try {
      await auth.getUserByEmail(email);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User not found with this email' });
      }
      throw authError;
    }

    // Save token in Firestore
    await db.collection('password_resets').doc(token).set({
      email: email.toLowerCase().trim(),
      token,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt
    });

    // Send the email via SMTP
    await sendResetEmail(email, resetLink);

    return res.status(200).json({ 
      success: true, 
      message: 'Password reset link sent to your email.' 
    });

  } catch (error) {
    console.error('Forgot Password API Error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request', details: error.message });
  }
}

// SMTP Email Sender Helper
async function sendResetEmail(toEmail, resetLink) {
  const transporter = nodemailer.createTransport({
    host: 'mail.nestinnova.com',
    port: 465,
    secure: true, // SSL/TLS
    auth: {
      user: 'crm@nestinnova.com',
      pass: 'Nestinnova@2025'
    },
    tls: {
      rejectUnauthorized: false // Keep connections reliable
    }
  });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
      body {
        background-color: #030706;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table {
        border-collapse: collapse !important;
      }
      .wrapper {
        width: 100%;
        table-layout: fixed;
        background-color: #030706;
        padding: 40px 10px;
        box-sizing: border-box;
      }
      .card {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background-color: #0c1210;
        border: 1px solid rgba(0, 245, 122, 0.25);
        border-radius: 24px;
        padding: 40px 32px;
        box-sizing: border-box;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 245, 122, 0.05);
        text-align: center;
      }
      .brand-badge {
        display: inline-block;
        background-color: rgba(0, 245, 122, 0.08);
        border: 1px solid rgba(0, 245, 122, 0.2);
        color: #00F57A;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 2px;
        padding: 6px 16px;
        border-radius: 30px;
        margin-bottom: 24px;
      }
      .greeting {
        font-size: 22px;
        font-weight: 700;
        color: #ffffff;
        margin: 0 0 12px 0;
        letter-spacing: -0.5px;
      }
      .message {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.65);
        line-height: 1.6;
        margin: 0 0 28px 0;
      }
      .button-container {
        margin-bottom: 28px;
      }
      .btn {
        background: linear-gradient(135deg, #00F57A 0%, #00E5D4 100%);
        color: #030706 !important;
        padding: 12px 32px;
        border-radius: 30px;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        display: inline-block;
        box-shadow: 0 10px 25px rgba(0, 245, 122, 0.2);
        transition: transform 0.2s ease;
      }
      .warning-text {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.35);
        line-height: 1.5;
        margin: 0;
      }
      .divider {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        margin: 28px 0;
      }
      .footer {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.3);
        line-height: 1.5;
      }
      .footer a {
        color: #00F57A;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="brand-badge">Faham Estate CRM</div>
        <h1 class="greeting">Reset Your Password</h1>
        <p class="message">
          We received a request to reset the password for your account associated with <strong>${toEmail}</strong>. 
          Click the button below to set a new password.
        </p>
        <div class="button-container">
          <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
        </div>
        <p class="warning-text">
          For security reasons, this reset link will expire in 1 hour. <br>
          If you did not request a password reset, you can safely ignore this email.
        </p>
        <div class="divider"></div>
        <div class="footer">
          This is an automated security transmission from Faham Estate CRM. <br>
          Contact Support: <a href="mailto:crm@nestinnova.com">crm@nestinnova.com</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from: '"Faham Estate CRM" <crm@nestinnova.com>',
    to: toEmail,
    subject: 'Reset Your Password - Faham Estate CRM',
    html: htmlContent
  });
}
