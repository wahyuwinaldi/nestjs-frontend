/**
 * Format a number the Indonesian way (dot thousands separator), mirroring
 * the legacy dashboard's `formatCurrency()` helper. Returns '-' for
 * null/undefined/NaN so unreachable-API placeholders read cleanly.
 * @param {number|string|null|undefined} value
 * @param {number} fractionDigits
 */
export function formatNumber(value, fractionDigits = 0) {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';

    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        useGrouping: true
    }).format(num);
}

/**
 * Current date/time in Asia/Jakarta: long Indonesian date plus 24h time
 * suffixed with "WIB".
 * @param {Date} [now]
 */
export function formatDateTimeWIB(now = new Date()) {
    const date = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit'
    });

    const time = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    return { date, time: `${time} WIB` };
}

/**
 * Safe lookup into a plain object map; returns null (never throws) when the
 * map or key is missing.
 * @param {Record<string, unknown>|null|undefined} map
 * @param {string} key
 */
export function pick(map, key) {
    if (!map || typeof map !== 'object') return null;
    return key in map ? map[key] : null;
}
