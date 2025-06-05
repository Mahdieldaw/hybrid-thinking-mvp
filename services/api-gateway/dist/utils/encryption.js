"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aesGcmDecrypt = exports.aesGcmEncrypt = void 0;
const crypto = __importStar(require("crypto"));
/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext - The string to encrypt.
 * @param key - 32-byte Buffer encryption key.
 * @returns { iv, tag, ciphertext }
 */
function aesGcmEncrypt(plaintext, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return { iv, tag, ciphertext };
}
exports.aesGcmEncrypt = aesGcmEncrypt;
/**
 * Decrypts AES-256-GCM ciphertext.
 * @param iv - Initialization vector.
 * @param tag - Authentication tag.
 * @param ciphertext - Encrypted data.
 * @param key - 32-byte Buffer encryption key.
 * @returns Decrypted plaintext string.
 */
function aesGcmDecrypt(iv, tag, ciphertext, key) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}
exports.aesGcmDecrypt = aesGcmDecrypt;
