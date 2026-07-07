import crypto from 'crypto';

// Decode a Base32 string to a Buffer
export function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  const length = clean.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

// Generate a random 16-character Base32 secret key (80 bits)
export function generateSecret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < bytes.length; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  return secret;
}

// Generate TOTP token for a given Base32 secret and time step offset
export function generateTOTP(secretBase32, timeOffsetStep = 0) {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30) + timeOffsetStep;

  // Convert counter to 8-byte buffer
  const buffer = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff;
    tmp = tmp >> 8;
  }

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

// Verify TOTP token with tolerance window for time drifts
export function verifyTOTP(token, secretBase32) {
  const cleanToken = token.trim().replace(/\s/g, '');
  if (cleanToken.length !== 6 || isNaN(cleanToken)) return false;

  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secretBase32, i) === cleanToken) {
      return true;
    }
  }
  return false;
}
