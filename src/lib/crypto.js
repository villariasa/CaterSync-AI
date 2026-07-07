// Device-Local Crypto Vault using Web Crypto API (PBKDF2 + AES-GCM)

const DB_NAME = 'CaterSyncVault';
const STORE_NAME = 'sessions';
const VAULT_KEY = 'encrypted_portal_session';
const ATTEMPTS_KEY = 'catersync_pin_failed_attempts';
const MAX_FAILED_ATTEMPTS = 5;

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Get from IndexedDB
async function getValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.onerror);
  });
}

// Put into IndexedDB
async function setValue(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(val, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.onerror);
  });
}

// Delete from IndexedDB
async function deleteValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.onerror);
  });
}

// Helper: Convert string to ArrayBuffer
function str2ab(str) {
  const enc = new TextEncoder();
  return enc.encode(str);
}

// Helper: Convert ArrayBuffer to Base64
function ab2base64(buf) {
  const binary = String.fromCharCode.apply(null, new Uint8Array(buf));
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base642ab(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive AES-GCM Key from PIN using PBKDF2
async function deriveKey(pin, salt) {
  const pinBuffer = str2ab(pin);
  const importKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ENCRYPT: Encrypt string payload with a 4-digit PIN
export async function encryptSessionWithPIN(pin, payloadString) {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await deriveKey(pin, salt);

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      str2ab(payloadString)
    );

    const vaultData = {
      ciphertext: ab2base64(encryptedContent),
      salt: ab2base64(salt),
      iv: ab2base64(iv)
    };

    // Save to IndexedDB
    await setValue(VAULT_KEY, vaultData);
    // Reset attempt tracker
    localStorage.removeItem(ATTEMPTS_KEY);
    return true;
  } catch (err) {
    console.error('PIN encryption error:', err);
    throw new Error('Encryption failed');
  }
}

// DECRYPT: Decrypt payload using user PIN
export async function decryptSessionWithPIN(pin) {
  // Check rate-limiting attempts
  let failedAttempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await deleteValue(VAULT_KEY);
    throw new Error('Attempts exceeded. Local secure session wiped.');
  }

  const vaultData = await getValue(VAULT_KEY);
  if (!vaultData) {
    throw new Error('No secure session found on this device.');
  }

  try {
    const salt = base642ab(vaultData.salt);
    const iv = base642ab(vaultData.iv);
    const ciphertext = base642ab(vaultData.ciphertext);

    const aesKey = await deriveKey(pin, new Uint8Array(salt));

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      aesKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedString = dec.decode(decryptedBuffer);

    // Success: Reset attempt count
    localStorage.removeItem(ATTEMPTS_KEY);
    return decryptedString;
  } catch (err) {
    // Increment failed attempts
    failedAttempts++;
    localStorage.setItem(ATTEMPTS_KEY, failedAttempts.toString());
    
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await deleteValue(VAULT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      throw new Error('Brute-force limit reached. Session wiped.');
    }
    
    throw new Error(`Invalid PIN. ${MAX_FAILED_ATTEMPTS - failedAttempts} attempts remaining.`);
  }
}

// Check if a vault entry exists in IndexedDB
export async function hasSecureSessionStored() {
  try {
    const vault = await getValue(VAULT_KEY);
    return !!vault;
  } catch (e) {
    return false;
  }
}

// Wipe secure session
export async function wipeSecureSession() {
  try {
    await deleteValue(VAULT_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch (e) {
    console.warn("Failed to delete secure session:", e);
  }
}
