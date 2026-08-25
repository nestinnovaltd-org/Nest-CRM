import admin from 'firebase-admin';

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

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const { db, auth, isConfigured } = initFirebaseAdmin();

    if (!isConfigured) {
      console.log('\n======================================================');
      console.log('🔑 PASSWORD RESET CONFIRMATION (MOCK MODE - ADMIN SDK NOT SETUP):');
      console.log(`Token: ${token}`);
      console.log(`New Password: ${newPassword}`);
      console.log('======================================================\n');

      return res.status(200).json({ 
        success: true, 
        message: 'Password reset successfully (Mock Mode).' 
      });
    }

    // Retrieve token document from Firestore
    const tokenDocRef = db.collection('password_resets').doc(token);
    const tokenDoc = await tokenDocRef.get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ error: 'Invalid or expired password reset link' });
    }

    const tokenData = tokenDoc.data();
    const now = new Date();
    
    // Support either Date object or Firestore Timestamp
    const expiresAt = tokenData.expiresAt.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

    if (now > expiresAt) {
      // Clean up expired token
      await tokenDocRef.delete();
      return res.status(400).json({ error: 'This password reset link has expired. Please request a new one' });
    }

    // Find Firebase user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(tokenData.email);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User account not found' });
      }
      throw authError;
    }

    // Update password in Firebase Auth
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Delete token from Firestore so it can't be reused
    await tokenDocRef.delete();

    console.log(`[Success] Password reset for user: ${tokenData.email}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Your password has been successfully updated.' 
    });

  } catch (error) {
    console.error('Reset Password API Error:', error);
    return res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
}
