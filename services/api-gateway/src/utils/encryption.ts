import * as crypto from 'crypto';

// It's crucial that the key is securely managed and consistent for encryption and decryption.
// For user-specific data, this key might be derived from a user password or a master key plus user salt.
// Ensure the key is exactly 32 bytes for AES-256.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, 12 bytes is recommended, but 16 is also common.
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // For AES-256
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation

/**
 * Derives a key from a password string using PBKDF2.
 * @param password The password to derive the key from.
 * @param salt A salt for the key derivation.
 * @returns A 32-byte encryption key.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * The key is derived from the provided password and a new random salt.
 * @param plaintext - The string to encrypt.
 * @param password - The password to use for key derivation.
 * @returns An object containing the encrypted data (ciphertext), iv, salt, and auth tag, all as hex strings.
 */
export function encrypt(plaintext: string, passwordKey: string): { encryptedData: string; iv: string; salt: string; tag: string; } {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(passwordKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'), // Store the salt alongside the ciphertext
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext.
 * The key is derived from the provided password and the stored salt.
 * @param encryptedDataHex - Encrypted data as a hex string.
 * @param password - The password to use for key derivation.
 * @param ivHex - Initialization vector as a hex string.
 * @param saltHex - Salt used for key derivation as a hex string.
 * @param tagHex - Authentication tag as a hex string.
 * @returns Decrypted plaintext string.
 * @throws Error if decryption fails (e.g., wrong key, tampered data).
 */
export function decrypt(encryptedDataHex: string, passwordKey: string, ivHex: string, saltHex?: string, tagHex?: string): string {
    // Backward compatibility for when salt and tag might not have been separate
    // This part is tricky and depends on how old data was stored. 
    // For new data, saltHex and tagHex should always be provided.
    // If they are not, we might assume an older format or throw an error.
    // For this example, let's assume if saltHex is missing, it's an error for new scheme.
    if (!saltHex) {
        // Fallback for old format where IV might have contained salt or tag was part of ciphertext
        // This is a simplified example; real migration is complex.
        // Attempting decryption with a fixed/derived key if old format is known
        // For now, let's assume new format is required if salt is not passed.
        // throw new Error('Salt is required for decryption with the current scheme.');
        // Let's try to derive key from passwordKey directly if salt is not provided (less secure for old data)
        // This is a placeholder for a more robust migration strategy.
        const key = crypto.createHash('sha256').update(String(passwordKey)).digest('base64').substr(0, 32);
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        // If tag was part of encryptedDataHex in old scheme, it needs to be extracted.
        // This is highly dependent on the old format.
        // For simplicity, if tagHex is not provided, we assume it's not used or handled differently.
        // This part is very insecure if not handled correctly.
        // It's better to migrate old data to the new format.

        // Assuming tag is the last 16 bytes of encryptedDataHex if not provided separately
        let actualEncryptedDataHex = encryptedDataHex;
        let tag: Buffer;
        if (!tagHex && encryptedDataHex.length > TAG_LENGTH * 2) { // TAG_LENGTH * 2 because it's hex
            const tagStartIndex = encryptedDataHex.length - TAG_LENGTH * 2;
            tagHex = encryptedDataHex.substring(tagStartIndex);
            actualEncryptedDataHex = encryptedDataHex.substring(0, tagStartIndex);
            tag = Buffer.from(tagHex, 'hex');
            decipher.setAuthTag(tag);
        } else if (tagHex) {
            tag = Buffer.from(tagHex, 'hex');
            decipher.setAuthTag(tag);
        } else {
            // If no tag can be derived or provided, GCM decryption will likely fail or be insecure.
            throw new Error('Authentication tag is required for GCM decryption.');
        }
        
        let decrypted = decipher.update(actualEncryptedDataHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // New, more secure decryption using PBKDF2-derived key
    const salt = Buffer.from(saltHex, 'hex');
    const key = deriveKey(passwordKey, salt);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex!, 'hex'); // tagHex must be present if saltHex is

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
