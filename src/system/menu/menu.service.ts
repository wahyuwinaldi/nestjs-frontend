import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import {
  UpdateAllMenuDto,
  UpdateAllMenuItemDto,
} from './dto/update-all-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

export const MAIN_MENU_KD = 'MN_MAIN';

export interface MenuFlatItem {
  kd_menu: string;
  nm_menu: string;
  icon_menu: string | null;
  link_menu: string | null;
  kd_parent: string | null;
  status: string;
  level: number;
  urut: number;
  urut_global: number;
}

export interface MenuTreeItem extends MenuFlatItem {
  children: MenuTreeItem[];
}

@Injectable()
export class MenuService {
  constructor(private readonly db: DatabaseService) {}

  private buildTree(flat: MenuFlatItem[]): MenuTreeItem[] {
    const byId = new Map<string, MenuTreeItem>();
    const roots: MenuTreeItem[] = [];

    flat.forEach((item) => byId.set(item.kd_menu, { ...item, children: [] }));

    byId.forEach((item) => {
      if (item.kd_parent && byId.has(item.kd_parent)) {
        byId.get(item.kd_parent).children.push(item);
      } else {
        roots.push(item);
      }
    });

    const sortRecursive = (nodes: MenuTreeItem[]) => {
      nodes.sort((a, b) => a.urut_global - b.urut_global || a.urut - b.urut);
      nodes.forEach((n) => sortRecursive(n.children));
    };
    sortRecursive(roots);
    return roots;
  }

  async findFlat(activeOnly = true): Promise<MenuFlatItem[]> {
    const result = await this.db.query<MenuFlatItem>(
      `SELECT kd_menu, nm_menu, icon_menu, link_menu, kd_parent, status, level, urut, urut_global
       FROM ${this.db.withSchema('md_menu')}
       ${activeOnly ? "WHERE status = 'A'" : ''}
       ORDER BY urut_global ASC, level ASC, urut ASC, kd_menu ASC`,
    );
    return result.rows;
  }

  async findTree(activeOnly = true): Promise<MenuTreeItem[]> {
    return this.buildTree(await this.findFlat(activeOnly));
  }

  /** Admin board: all statuses, full tree. */
  async findAllAdminTree(): Promise<MenuTreeItem[]> {
    return this.findTree(false);
  }

  /** Flat list for action assign (include MAIN MENU root by default). */
  async findAllAdminFlat(excludeMain = false): Promise<MenuFlatItem[]> {
    const rows = await this.findFlat(false);
    return excludeMain ? rows.filter((r) => r.kd_menu !== MAIN_MENU_KD) : rows;
  }

  private async nextKdMenu(): Promise<string> {
    for (let i = 0; i < 8; i += 1) {
      const kd = `MN${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.db.query(
        `SELECT 1 FROM ${this.db.withSchema('md_menu')} WHERE kd_menu = $1`,
        [kd],
      );
      if (exists.rowCount === 0) return kd;
    }
    throw new BadRequestException('Gagal menghasilkan kd_menu unik');
  }

  async create(dto: CreateMenuDto): Promise<MenuFlatItem> {
    const kdMenu = await this.nextKdMenu();
    const asHeader = Boolean(dto.as_header);
    const parent = asHeader ? null : dto.kd_parent || MAIN_MENU_KD;

    let level = 1;
    if (parent) {
      const parentRow = await this.db.query<MenuFlatItem>(
        `SELECT * FROM ${this.db.withSchema('md_menu')} WHERE kd_menu = $1`,
        [parent],
      );
      if (!parentRow.rows[0]) {
        throw new NotFoundException(`Parent menu ${parent} tidak ditemukan`);
      }
      level = (parentRow.rows[0].level || 1) + 1;
    }

    const maxUrut = await this.db.query<{ m: number }>(
      parent
        ? `SELECT COALESCE(MAX(urut), 0) AS m FROM ${this.db.withSchema('md_menu')} WHERE kd_parent = $1`
        : `SELECT COALESCE(MAX(urut), 0) AS m FROM ${this.db.withSchema('md_menu')} WHERE kd_parent IS NULL`,
      parent ? [parent] : [],
    );
    const maxGlobal = await this.db.query<{ m: number }>(
      `SELECT COALESCE(MAX(urut_global), 0) AS m FROM ${this.db.withSchema('md_menu')}`,
    );
    const urut = Number(maxUrut.rows[0].m) + 1;
    const urutGlobal = Number(maxGlobal.rows[0].m) + 1;

    await this.db.query(
      `INSERT INTO ${this.db.withSchema('md_menu')}
         (kd_menu, nm_menu, icon_menu, link_menu, kd_parent, status, level, urut, urut_global)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        kdMenu,
        dto.nm_menu,
        asHeader ? null : (dto.icon_menu ?? null),
        asHeader ? (dto.link_menu ?? '#') : (dto.link_menu ?? null),
        parent,
        dto.status || 'A',
        level,
        urut,
        urutGlobal,
      ],
    );

    const created = await this.db.query<MenuFlatItem>(
      `SELECT * FROM ${this.db.withSchema('md_menu')} WHERE kd_menu = $1`,
      [kdMenu],
    );
    return created.rows[0];
  }

  async update(dto: UpdateMenuDto): Promise<MenuFlatItem> {
    const result = await this.db.query(
      `UPDATE ${this.db.withSchema('md_menu')}
       SET nm_menu = $2,
           link_menu = $3,
           icon_menu = $4,
           status = $5
       WHERE kd_menu = $1`,
      [
        dto.kd_menu,
        dto.nm_menu,
        dto.link_menu ?? null,
        dto.icon_menu ?? null,
        dto.status || 'A',
      ],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`Menu ${dto.kd_menu} tidak ditemukan`);
    }
    const row = await this.db.query<MenuFlatItem>(
      `SELECT * FROM ${this.db.withSchema('md_menu')} WHERE kd_menu = $1`,
      [dto.kd_menu],
    );
    return row.rows[0];
  }

  async updateAll(
    dto: UpdateAllMenuDto,
  ): Promise<{ sukses: number; gagal: string[] }> {
    let items: UpdateAllMenuItemDto[];
    try {
      const decoded = Buffer.from(dto.menu, 'base64').toString('utf8');
      const parsed: unknown = JSON.parse(decoded);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('Payload menu (base64 JSON) tidak valid');
      }
      items = parsed as UpdateAllMenuItemDto[];
    } catch {
      throw new BadRequestException('Payload menu (base64 JSON) tidak valid');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Daftar menu kosong');
    }

    // urut_global selalu dari urutan payload (DFS board), bukan nilai lama di DB.
    const normalized = items.map((item, index) => ({
      ...item,
      urut_global: index + 1,
      urut: Number(item.urut) > 0 ? Number(item.urut) : index + 1,
      level:
        Number(item.level ?? item.depth) > 0
          ? Number(item.level ?? item.depth)
          : 1,
    }));

    let sukses = 0;
    const gagal: string[] = [];

    await this.db.withTransaction(async (client) => {
      for (const item of normalized) {
        const kd = item.kd_menu;
        if (!kd) {
          gagal.push('(tanpa kd_menu)');
          continue;
        }
        const parent =
          !item.kd_parent || item.kd_parent === '0' || item.kd_parent === 'null'
            ? null
            : item.kd_parent;
        try {
          const res = await client.query(
            `UPDATE ${this.db.withSchema('md_menu')}
             SET nm_menu = COALESCE($2, nm_menu),
                 link_menu = $3,
                 icon_menu = $4,
                 status = COALESCE($5, status),
                 kd_parent = $6,
                 level = $7,
                 urut = $8,
                 urut_global = $9
             WHERE kd_menu = $1`,
            [
              kd,
              item.nm_menu ?? null,
              item.link_menu ?? null,
              item.icon_menu ?? null,
              item.status ?? null,
              parent,
              item.level,
              item.urut,
              item.urut_global,
            ],
          );
          if (res.rowCount === 0) gagal.push(kd);
          else sukses += 1;
        } catch (err) {
          console.error(`updateAll menu failed for ${kd}:`, err);
          gagal.push(kd);
        }
      }
    });

    if (gagal.length > 0 && sukses === 0) {
      throw new BadRequestException(
        `Gagal menyimpan menu: ${gagal.join(', ')}`,
      );
    }

    return { sukses, gagal };
  }

  async remove(kdMenu: string): Promise<void> {
    if (kdMenu === MAIN_MENU_KD) {
      throw new BadRequestException('MAIN MENU tidak boleh dihapus');
    }
    const children = await this.db.query(
      `SELECT kd_menu FROM ${this.db.withSchema('md_menu')} WHERE kd_parent = $1`,
      [kdMenu],
    );
    if (children.rowCount && children.rowCount > 0) {
      throw new BadRequestException('Hapus submenu terlebih dahulu');
    }

    await this.db.withTransaction(async (client) => {
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions')} WHERE kd_menu = $1`,
        [kdMenu],
      );
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions_private')} WHERE kd_menu = $1`,
        [kdMenu],
      );
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_action_menu')} WHERE kd_menu = $1`,
        [kdMenu],
      );
      const res = await client.query(
        `DELETE FROM ${this.db.withSchema('md_menu')} WHERE kd_menu = $1`,
        [kdMenu],
      );
      if (res.rowCount === 0) {
        throw new NotFoundException(`Menu ${kdMenu} tidak ditemukan`);
      }
    });
  }
}
