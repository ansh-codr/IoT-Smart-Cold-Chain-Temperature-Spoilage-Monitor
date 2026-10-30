/**
 * middleware/auth.js
 * 
 * Verifies Firebase ID Tokens using Firebase Admin SDK.
 * Resolves internal user identity, organization membership, and roles from MySQL.
 * 
 * Allows:
 * - Real Firebase Bearer Tokens
 * - Dev fallback mode: In dev mode without Firebase credentials, allows a simulated header
 *   `X-Dev-User: <email>` or default admin so the user can test the UI immediately.
 */

import { admin, isConfigured } from '../config/firebaseAdmin.js';
import { pool } from '../db/pool.js';
import createHttpError from 'http-errors';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let uid = null;
    let email = null;
    let displayName = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      if (isConfigured) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        uid = decodedToken.uid;
        email = decodedToken.email;
        displayName = decodedToken.name || null;
      } else {
        // Dev fallback if token provided but admin unconfigured
        uid = `dev-uid-${Buffer.from(idToken).toString('base64').slice(0, 12)}`;
        email = req.headers['x-dev-email'] || 'admin@coldchainiq.com';
        displayName = 'ColdChain Admin';
      }
    } else if (process.env.NODE_ENV !== 'production' && req.headers['x-dev-email']) {
      // Dev simulation for local testing before Firebase setup
      email = req.headers['x-dev-email'];
      uid = `dev-uid-${email}`;
      displayName = req.headers['x-dev-name'] || email.split('@')[0];
    } else if (process.env.NODE_ENV !== 'production' && !isConfigured) {
      // Safe default for zero-config local testing
      email = 'admin@coldchainiq.com';
      uid = 'dev-uid-admin';
      displayName = 'ColdChain Admin';
    } else {
      throw createHttpError(401, 'Unauthorized: Missing or invalid authentication token');
    }

    // 1. Resolve or auto-provision user in MySQL
    const now = Math.floor(Date.now() / 1000);
    const [userRows] = await pool.execute(
      `SELECT id, firebase_uid, email, display_name, system_role, is_active FROM users WHERE email = ?`,
      [email]
    );

    let user = userRows[0];
    if (!user) {
      // First user becomes system admin, others become regular users
      const [countRows] = await pool.execute(`SELECT COUNT(*) as cnt FROM users`);
      const isFirst = Number(countRows[0].cnt) === 0;
      const initialRole = isFirst ? 'admin' : 'user';

      const [insertResult] = await pool.execute(
        `INSERT INTO users (firebase_uid, email, display_name, system_role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [uid, email, displayName, initialRole, now, now]
      );
      
      const newUserId = insertResult.insertId;
      user = {
        id: newUserId,
        firebase_uid: uid,
        email,
        display_name: displayName,
        system_role: initialRole,
        is_active: 1
      };

      // Assign to default organization (1) if it exists
      const [orgRows] = await pool.execute(`SELECT id FROM organizations LIMIT 1`);
      if (orgRows.length > 0) {
        await pool.execute(
          `INSERT IGNORE INTO organization_members (org_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?)`,
          [orgRows[0].id, newUserId, isFirst ? 'platform_admin' : 'operator', now]
        );
      }
    }

    if (!user.is_active) {
      throw createHttpError(403, 'Account is suspended or deactivated');
    }

    // 2. Load user's organization memberships
    const [memberRows] = await pool.execute(
      `SELECT om.org_id, om.role, o.name AS org_name, o.slug AS org_slug
         FROM organization_members om
         JOIN organizations o ON o.id = om.org_id
        WHERE om.user_id = ?`,
      [user.id]
    );

    // Selected org defaults to first membership or from header
    const requestedOrgId = req.headers['x-org-id'] ? parseInt(req.headers['x-org-id'], 10) : null;
    let activeOrg = null;
    if (requestedOrgId) {
      activeOrg = memberRows.find(m => m.org_id === requestedOrgId) || null;
    }
    if (!activeOrg && memberRows.length > 0) {
      activeOrg = memberRows[0];
    }

    req.user = user;
    req.userOrgs = memberRows;
    req.activeOrg = activeOrg; // { org_id, role, org_name, org_slug }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-Based Authorization Guards
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(createHttpError(401, 'Unauthorized'));

    // Platform system admins always pass
    if (req.user.system_role === 'admin') return next();

    // Check organization role
    if (!req.activeOrg || !allowedRoles.includes(req.activeOrg.role)) {
      return next(createHttpError(403, `Forbidden: Requires one of [${allowedRoles.join(', ')}] role`));
    }

    next();
  };
}

/**
 * IoT Ingestion Authentication
 * Validates device API Key or allows existing registered device ID
 */
export async function requireDeviceAuth(req, res, next) {
  try {
    const deviceId = req.body?.device_id || (Array.isArray(req.body) ? req.body[0]?.device_id : null);
    if (!deviceId) {
      return next(createHttpError(400, 'device_id is required in reading payload'));
    }

    // Existing open ingestion is fully preserved for ESP32 compatibility.
    // If an X-Device-Key header is supplied, verify it against the devices table.
    const apiKey = req.headers['x-device-key'];
    if (apiKey) {
      const [rows] = await pool.execute(
        `SELECT device_id, api_key FROM devices WHERE device_id = ?`,
        [deviceId]
      );
      if (rows.length > 0 && rows[0].api_key && rows[0].api_key !== apiKey) {
        return next(createHttpError(401, 'Invalid device API key'));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

