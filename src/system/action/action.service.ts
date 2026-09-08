import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';

export interface ActionItem {
  kd_action: string;
  kode: string;
  nm_action: string;
  deskripsi: string | null;
  menus: string[];
}

@Injectable()
export class ActionService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<ActionItem[]> {
    const result = await this.db.query<{
      kd_action: string;
      kode: string;
      nm_action: string;
      deskripsi: string | null;
      menus: string[] | null;
    }>(
      `SELECT a.kd_action, a.kode, a.nm_action, a.deskripsi,
              array_agg(DISTINCT am.kd_menu) FILTER (WHERE am.kd_menu IS NOT NULL) AS menus
       FROM ${this.db.withSchema('md_action')} a
       LEFT JOIN ${this.db.withSchema('d_action_menu')} am ON am.kd_action = a.kd_action
       GROUP BY a.kd_action, a.kode, a.nm_action, a.deskripsi
       ORDER BY a.kode ASC, a.kd_action ASC`,
    );
    return result.rows.map((row) => ({
      kd_action: row.kd_action,
      kode: row.kode,
      nm_action: row.nm_action,
      deskripsi: row.deskripsi,
      menus: Array.isArray(row.menus) ? row.menus.filter(Boolean) : [],
    }));
  }

  private decodeMenus(menus?: string): string[] {
    if (!menus) return [];
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(menus, 'base64').toString('utf8'),
      );
      if (!Array.isArray(parsed)) {
        throw new BadRequestException(
          'menus harus array kd_menu (base64 JSON)',
        );
      }
      return parsed.map(String).filter(Boolean);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('menus (base64 JSON) tidak valid');
    }
  }

  private async nextKdAction(): Promise<string> {
    for (let i = 0; i < 8; i += 1) {
      const kd = `ACT_${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.db.query(
        `SELECT 1 FROM ${this.db.withSchema('md_action')} WHERE kd_action = $1`,
        [kd],
      );
      if (exists.rowCount === 0) return kd;
    }
    throw new BadRequestException('Gagal menghasilkan kd_action unik');
  }

  private async syncMenus(
    kdAction: string,
    menuIds: string[],
    client?: PoolClient,
  ) {
    const runQuery = async (sql: string, params: unknown[]) => {
      if (client) {
        await client.query(sql, params);
      } else {
        await this.db.query(sql, params);
      }
    };

    await runQuery(
      `DELETE FROM ${this.db.withSchema('d_action_menu')} WHERE kd_action = $1`,
      [kdAction],
    );
    for (const kdMenu of menuIds) {
      await runQuery(
        `INSERT INTO ${this.db.withSchema('d_action_menu')} (kd_menu, kd_action)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [kdMenu, kdAction],
      );
    }
  }

  async create(dto: CreateActionDto): Promise<ActionItem> {
    const kdAction = await this.nextKdAction();
    const menuIds = this.decodeMenus(dto.menus);

    await this.db.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO ${this.db.withSchema('md_action')} (kd_action, kode, nm_action, deskripsi)
         VALUES ($1, $2, $3, $4)`,
        [kdAction, dto.kode, dto.nm_action, dto.deskripsi ?? null],
      );
      await this.syncMenus(kdAction, menuIds, client);
    });

    const all = await this.findAll();
    const created = all.find((a) => a.kd_action === kdAction);
    if (!created) throw new NotFoundException('Action gagal dibuat');
    return created;
  }

  async update(dto: UpdateActionDto): Promise<ActionItem> {
    const menuIds =
      dto.menus !== undefined ? this.decodeMenus(dto.menus) : null;

    await this.db.withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE ${this.db.withSchema('md_action')}
         SET kode = $2, nm_action = $3, deskripsi = $4
         WHERE kd_action = $1`,
        [dto.kd_action, dto.kode, dto.nm_action, dto.deskripsi ?? null],
      );
      if (res.rowCount === 0) {
        throw new NotFoundException(`Action ${dto.kd_action} tidak ditemukan`);
      }
      if (menuIds !== null) {
        await this.syncMenus(dto.kd_action, menuIds, client);
      }
    });

    const all = await this.findAll();
    const updated = all.find((a) => a.kd_action === dto.kd_action);
    if (!updated)
      throw new NotFoundException(`Action ${dto.kd_action} tidak ditemukan`);
    return updated;
  }

  async remove(kdAction: string): Promise<void> {
    if (kdAction === 'ACT_AC') {
      throw new BadRequestException(
        'Action Access (ACT_AC) tidak boleh dihapus',
      );
    }
    await this.db.withTransaction(async (client) => {
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions')} WHERE kd_action = $1`,
        [kdAction],
      );
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions_private')} WHERE kd_action = $1`,
        [kdAction],
      );
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_action_menu')} WHERE kd_action = $1`,
        [kdAction],
      );
      const res = await client.query(
        `DELETE FROM ${this.db.withSchema('md_action')} WHERE kd_action = $1`,
        [kdAction],
      );
      if (res.rowCount === 0) {
        throw new NotFoundException(`Action ${kdAction} tidak ditemukan`);
      }
    });
  }
}
