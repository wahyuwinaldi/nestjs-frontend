/**
 * Normalize icon_menu from DB / form into a CSS class string for <i>.
 * Supports:
 * - Remix: `ri-home-line` or `<i class="ri-home-line"></i>`
 * - PrimeIcons (legacy seed): `home`, `pi-home`, `pi pi-home`
 * @param {unknown} iconMenu
 * @param {string} [fallback='pi pi-circle']
 */
export function resolveMenuIconClass(iconMenu, fallback = 'pi pi-circle') {
    if (iconMenu == null) return fallback;
    const raw = String(iconMenu).trim();
    if (!raw) return fallback;

    const htmlMatch = raw.match(/class\s*=\s*["']([^"']+)["']/i);
    const tokenSource = htmlMatch ? htmlMatch[1] : raw;
    const tokens = tokenSource.split(/\s+/).filter(Boolean);

    const remix = tokens.find((t) => /^ri-[a-z0-9-]+$/i.test(t));
    if (remix) return remix;

    const primeToken = tokens.find((t) => /^pi-/.test(t)) || tokens.find((t) => t !== 'pi' && t !== 'pi-fw');
    if (primeToken) {
        const name = primeToken.replace(/^pi-/, '');
        if (name && name !== 'fw') return `pi pi-fw pi-${name}`;
    }

    // Plain PrimeIcons name from seed, e.g. "home"
    if (/^[a-z0-9-]+$/i.test(raw) && !raw.startsWith('ri-')) {
        return `pi pi-fw pi-${raw}`;
    }

    return fallback;
}

/**
 * Extract remix class from icon_menu for form/picker state.
 * @param {unknown} iconMenu
 * @returns {string}
 */
export function extractRemixIconClass(iconMenu) {
    if (iconMenu == null) return '';
    const raw = String(iconMenu).trim();
    if (!raw) return '';
    const htmlMatch = raw.match(/class\s*=\s*["']([^"']+)["']/i);
    const tokenSource = htmlMatch ? htmlMatch[1] : raw;
    const remix = tokenSource.split(/\s+/).find((t) => /^ri-[a-z0-9-]+$/i.test(t));
    if (remix) return remix;
    if (/^ri-[a-z0-9-]+$/i.test(raw)) return raw;
    return '';
}

/**
 * Parse unique Remix Icon classes from local public/icons.html content.
 * @param {string} html
 * @returns {string[]}
 */
export function parseRemixIconsFromHtml(html) {
    const matches = Array.from(String(html || '').matchAll(/ri-[a-z0-9-]+/gi)).map((m) => m[0]);
    return Array.from(new Set(matches)).sort((a, b) => a.localeCompare(b));
}
