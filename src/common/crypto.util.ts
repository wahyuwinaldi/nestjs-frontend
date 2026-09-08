import * as CryptoJS from 'crypto-js';
import { createHash } from 'crypto';

/**
 * AES (CBC + PKCS7, key derived by crypto-js from a UTF8 passphrase) helpers,
 * matching the typical AES.encrypt(text, key).toString() cookie/token pattern.
 */
export function aesEncrypt(plainText: string, secret: string): string {
  return CryptoJS.AES.encrypt(plainText, secret).toString();
}

export function aesDecrypt(cipherText: string, secret: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, secret);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error('Failed to decrypt payload: invalid ciphertext or key');
  }
  return decrypted;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
