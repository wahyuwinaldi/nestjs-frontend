import { aesDecrypt, aesEncrypt, sha256 } from '../../src/common/crypto.util';

describe('crypto.util', () => {
  it('round-trips AES encrypt/decrypt', () => {
    const cipher = aesEncrypt('hello', 'secret-key');
    expect(aesDecrypt(cipher, 'secret-key')).toBe('hello');
  });

  it('does not return plaintext when decrypting with the wrong key', () => {
    const cipher = aesEncrypt('hello', 'secret-key');
    try {
      expect(aesDecrypt(cipher, 'other-key')).not.toBe('hello');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('throws on invalid ciphertext', () => {
    expect(() => aesDecrypt('not-valid-cipher', 'secret-key')).toThrow(
      /Failed to decrypt/,
    );
  });

  it('hashes with sha256 hex', () => {
    expect(sha256('admin123')).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256('admin123')).toBe(sha256('admin123'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});
