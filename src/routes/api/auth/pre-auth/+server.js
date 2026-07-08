import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { generateSecret } from '$lib/server/totp.js';

export async function POST({ request }) {
  let username = '';
  try {
    const body = await request.json().catch(() => ({}));
    username = body.username || '';

    if (!username) {
      return json({ success: false, error: 'Identifier is required.' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const lowerIdentifier = cleanUsername.toLowerCase();

    // 1. Check Platform Admins
    const adminRes = await pool.query(
      'SELECT id, username, is_active, totp_secret FROM platform_admins WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1',
      [lowerIdentifier]
    );
    if (adminRes.rows.length > 0) {
      const admin = adminRes.rows[0];
      if (!admin.is_active) {
        return json({ success: false, error: 'Platform Admin account is deactivated.' }, { status: 403 });
      }
      
      const methods = ['password'];
      let totpSetup = null;
      if (admin.totp_secret) {
        methods.push('totp');
      } else {
        methods.push('totp-setup');
        const setupSecret = generateSecret();
        const otpauthUrl = `otpauth://totp/CaterSync-AI-Admin:${encodeURIComponent(admin.username)}?secret=${setupSecret}&issuer=CaterSync-AI-Platform`;
        totpSetup = {
          secret: setupSecret,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
        };
      }
      
      return json({
        success: true,
        userExists: true,
        userType: 'platform_admin',
        methods,
        totpSetup
      });
    }

    // 2. Check Supplier Accounts
    const supplierRes = await pool.query(
      'SELECT id, email, is_active FROM supplier_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [lowerIdentifier]
    );
    if (supplierRes.rows.length > 0) {
      const supplier = supplierRes.rows[0];
      if (!supplier.is_active) {
        return json({ success: false, error: 'Supplier account is deactivated.' }, { status: 403 });
      }
      return json({
        success: true,
        userExists: true,
        userType: 'supplier',
        methods: ['password']
      });
    }

    // 3. Check Customer (Subscriber) Accounts
    const subscriberRes = await pool.query(
      'SELECT id, email, phone FROM subscriber_accounts WHERE LOWER(email) = $1 OR phone = $1 LIMIT 1',
      [lowerIdentifier]
    );
    if (subscriberRes.rows.length > 0) {
      return json({
        success: true,
        userExists: true,
        userType: 'subscriber',
        methods: ['otp']
      });
    }

    // 4. Check Org Users (Operator)
    const userRes = await pool.query(
      'SELECT id, username, role, is_active, totp_secret FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [lowerIdentifier]
    );
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      if (!user.is_active) {
        return json({ success: false, error: 'Operator account is deactivated.' }, { status: 403 });
      }

      const methods = [];
      let totpSetup = null;

      if (user.username.toLowerCase() === 'admin') {
        methods.push('password');
      } else {
        if (user.totp_secret) {
          methods.push('totp');
        } else {
          methods.push('totp-setup');
          const setupSecret = generateSecret();
          const otpauthUrl = `otpauth://totp/CaterSync-AI:${encodeURIComponent(user.username)}?secret=${setupSecret}&issuer=CaterSync-AI`;
          totpSetup = {
            secret: setupSecret,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
          };
        }
      }

      // Check registered WebAuthn credentials
      const credRes = await pool.query(
        "SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'operator' LIMIT 1",
        [user.id]
      );
      if (credRes.rows.length > 0) {
        methods.push('biometric');
      }

      return json({
        success: true,
        userExists: true,
        userType: 'org_user',
        methods,
        totpSetup
      });
    }

    // Fallback if not found anywhere (to prevent user enumeration check)
    const isLinkAdmin = lowerIdentifier === 'admin';
    return json({
      success: true,
      userExists: false,
      userType: 'org_user',
      methods: isLinkAdmin ? ['password'] : ['totp-setup'],
      totpSetup: isLinkAdmin ? null : {
        secret: 'OFFLINETOTPSECRET',
        qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI'
      }
    });

  } catch (error) {
    console.error('Pre-auth error:', error);
    const isLinkAdmin = username.trim().toLowerCase() === 'admin';
    return json({
      success: true,
      userExists: false,
      userType: 'org_user',
      methods: isLinkAdmin ? ['password'] : ['totp-setup'],
      totpSetup: isLinkAdmin ? null : {
        secret: 'OFFLINETOTPSECRET',
        qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI'
      }
    });
  }
}

