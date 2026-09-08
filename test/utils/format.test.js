import { describe, expect, it } from 'vitest';
import { formatDateTimeWIB, formatNumber, pick } from '@/utils/format';

describe('formatNumber', () => {
    it('returns dash for empty/invalid values', () => {
        expect(formatNumber(null)).toBe('-');
        expect(formatNumber(undefined)).toBe('-');
        expect(formatNumber('')).toBe('-');
        expect(formatNumber('abc')).toBe('-');
        expect(formatNumber(Number.NaN)).toBe('-');
    });

    it('formats integers with Indonesian grouping', () => {
        expect(formatNumber(1234567)).toBe('1.234.567');
        expect(formatNumber('96')).toBe('96');
    });

    it('respects fractionDigits', () => {
        expect(formatNumber(12.5, 1)).toBe('12,5');
        expect(formatNumber(12, 2)).toBe('12,00');
    });
});

describe('formatDateTimeWIB', () => {
    it('returns Indonesian date and 24h time with WIB suffix', () => {
        const { date, time } = formatDateTimeWIB(new Date('2026-08-11T03:00:00+07:00'));
        expect(date.toLowerCase()).toContain('agustus');
        expect(date).toContain('2026');
        expect(time).toMatch(/^\d{2}\.\d{2}\.\d{2} WIB$/);
    });

    it('defaults to now when no date is passed', () => {
        const result = formatDateTimeWIB();
        expect(result).toHaveProperty('date');
        expect(result.time).toMatch(/WIB$/);
    });
});

describe('pick', () => {
    it('returns null for missing map or key', () => {
        expect(pick(null, 'a')).toBeNull();
        expect(pick(undefined, 'a')).toBeNull();
        expect(pick('nope', 'a')).toBeNull();
        expect(pick({ a: 1 }, 'b')).toBeNull();
    });

    it('returns the value when key exists (including falsy)', () => {
        expect(pick({ a: 0 }, 'a')).toBe(0);
        expect(pick({ a: null }, 'a')).toBeNull();
        expect(pick({ a: 'ok' }, 'a')).toBe('ok');
    });
});
