import * as crypto from 'crypto';

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext - The string to encrypt.
 * @param key - 32-byte Buffer encryption key.
 * @returns { iv, tag, ciphertext }
 */
export function aesGcmEncrypt(plaintext: string, key: Buffer): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}

/**
 * Decrypts AES-256-GCM ciphertext.
 * @param iv - Initialization vector.
 * @param tag - Authentication tag.
 * @param ciphertext - Encrypted data.
 * @param key - 32-byte Buffer encryption key.
 * @returns Decrypted plaintext string.
 */
export function aesGcmDecrypt(iv: Buffer, tag: Buffer, ciphertext: Buffer, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}
