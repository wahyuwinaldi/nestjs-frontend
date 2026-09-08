import { errorCode, errorMessage } from '../../src/common/error-message';

describe('error-message', () => {
  describe('errorMessage', () => {
    it('returns message from Error instances', () => {
      expect(errorMessage(new Error('boom'))).toBe('boom');
    });

    it('returns string errors as-is', () => {
      expect(errorMessage('plain')).toBe('plain');
    });

    it('stringifies number, boolean, and bigint', () => {
      expect(errorMessage(42)).toBe('42');
      expect(errorMessage(true)).toBe('true');
      expect(errorMessage(BigInt(9))).toBe('9');
    });

    it('handles null and undefined', () => {
      expect(errorMessage(null)).toBe('null');
      expect(errorMessage(undefined)).toBe('undefined');
    });

    it('JSON.stringifies plain objects', () => {
      expect(errorMessage({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    });

    it('falls back when JSON.stringify throws', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(errorMessage(circular)).toBe('Unknown error');
    });
  });

  describe('errorCode', () => {
    it('returns string code from objects', () => {
      expect(errorCode({ code: 'ECONNREFUSED' })).toBe('ECONNREFUSED');
    });

    it('returns undefined for non-string code or non-objects', () => {
      expect(errorCode({ code: 123 })).toBeUndefined();
      expect(errorCode({ code: null })).toBeUndefined();
      expect(errorCode({})).toBeUndefined();
      expect(errorCode(null)).toBeUndefined();
      expect(errorCode('x')).toBeUndefined();
      expect(errorCode(new Error('no code'))).toBeUndefined();
    });
  });
});
