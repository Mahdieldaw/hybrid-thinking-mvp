/// <reference types="node" />
/// <reference types="node" />
/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext - The string to encrypt.
 * @param key - 32-byte Buffer encryption key.
 * @returns { iv, tag, ciphertext }
 */
export declare function aesGcmEncrypt(plaintext: string, key: Buffer): {
    iv: Buffer;
    tag: Buffer;
    ciphertext: Buffer;
};
/**
 * Decrypts AES-256-GCM ciphertext.
 * @param iv - Initialization vector.
 * @param tag - Authentication tag.
 * @param ciphertext - Encrypted data.
 * @param key - 32-byte Buffer encryption key.
 * @returns Decrypted plaintext string.
 */
export declare function aesGcmDecrypt(iv: Buffer, tag: Buffer, ciphertext: Buffer, key: Buffer): string;
