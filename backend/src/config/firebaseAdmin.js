/**
 * config/firebaseAdmin.js
 * Initializes Firebase Admin SDK safely.
 * If service account credentials are not provided via FIREBASE_SERVICE_ACCOUNT_JSON
 * or GOOGLE_APPLICATION_CREDENTIALS, it runs in a development-safe fallback mode
 * with clear warnings, so local dev or unauthenticated test harnesses do not crash.
 */

import admin from 'firebase-admin';

let firebaseApp = null;
let isConfigured = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isConfigured = true;
    console.log('[firebase-admin] ✅ Initialized with explicit service account credentials');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    isConfigured = true;
    console.log('[firebase-admin] ✅ Initialized with applicationDefault credentials');
  } else if (process.env.FIREBASE_PROJECT_ID) {
    firebaseApp = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    isConfigured = true;
    console.log(`[firebase-admin] ⚠️ Initialized with projectId=${process.env.FIREBASE_PROJECT_ID} (Token verification enabled)`);
  } else {
    console.warn('[firebase-admin] ℹ️ No Firebase Admin credentials found in environment. Running in dev-safe simulation mode.');
  }
} catch (err) {
  console.error('[firebase-admin] Initialization error:', err.message);
}

export { admin, firebaseApp, isConfigured };
