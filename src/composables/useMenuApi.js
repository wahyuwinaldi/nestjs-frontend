import { apiFetch } from '@/composables/useApi';

function encodeJson(value) {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

export async function listMenuAdminTree() {
    const res = await apiFetch('/system/menu/all');
    return res?.data || [];
}

export async function listMenuAdminFlat() {
    const res = await apiFetch('/system/menu/all?flat=true');
    return res?.data || [];
}

export async function createMenu(payload) {
    return apiFetch('/system/menu', { method: 'POST', data: payload });
}

export async function updateMenu(payload) {
    return apiFetch('/system/menu', { method: 'PUT', data: payload });
}

export async function deleteMenu(kd_menu) {
    return apiFetch('/system/menu', { method: 'DELETE', data: { kd_menu } });
}

/**
 * Flatten board tree (DFS) jadi payload reorder: urut per sibling + urut_global berurutan.
 * @param {Array} boardNodes root nodes
 * @returns {Array<object>}
 */
export function flattenBoardForSave(boardNodes) {
    const items = [];
    let globalOrder = 1;

    const walk = (nodes, depth, parentId) => {
        const list = Array.isArray(nodes) ? Array.from(nodes) : [];
        list.forEach((node, index) => {
            const kd = node?.kd_menu;
            if (!kd) return;

            items.push({
                kd_menu: kd,
                nm_menu: node.nm_menu,
                link_menu: node.link_menu || null,
                icon_menu: node.icon_menu || null,
                status: node.status === 'N' ? 'N' : 'A',
                depth: depth - 1,
                level: depth,
                kd_parent: parentId,
                urut: index + 1,
                urut_global: globalOrder++
            });

            if (Array.isArray(node.children) && node.children.length > 0) {
                walk(node.children, depth + 1, kd);
            }
        });
    };

    walk(boardNodes, 1, null);
    return items;
}

/**
 * Flatten board tree 3 level (root termasuk MAIN MENU) lalu PUT /all.
 * @param {Array} boardNodes root nodes
 */
export async function saveMenuBoard(boardNodes) {
    const items = flattenBoardForSave(boardNodes);
    if (items.length === 0) {
        throw new Error('Tidak ada menu untuk disimpan');
    }

    const res = await apiFetch('/system/menu/all', {
        method: 'PUT',
        data: { menu: encodeJson(items) }
    });

    const gagal = res?.data?.gagal;
    if (Array.isArray(gagal) && gagal.length > 0) {
        throw new Error(`Sebagian menu gagal disimpan: ${gagal.join(', ')}`);
    }

    return res;
}

export { encodeJson };
