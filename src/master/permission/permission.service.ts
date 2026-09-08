import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { assertCanManageRole } from '../../common/role-hierarchy.util';
import { DatabaseService } from '../../database/database.service';
import {
  CreateRolePermissionDto,
  UpdateRolePermissionDto,
} from './dto/upsert-permission.dto';
import { UpsertPermissionPrivateDto } from './dto/upsert-permission-private.dto';

export interface PermissionItem {
  kd_permission: string;
  kd_role: string;
  kd_menu: string;
  nm_menu: string;
  kd_action: string;
  kode: string;
  nm_action: string;
  link_menu?: string | null;
}

export interface PermissionPrivateItem {
  kd_permission: string;
  uid_user_system: string;
  kd_menu: string;
  nm_menu: string;
  kd_action: string;
  kode: string;
  nm_action: string;
  link_menu?: string | null;
}

export interface RolePermissionGroup {
  kd_role: string;
  nm_role: string;
  permissions: Array<{ menu: string; action: string[] }>;
}

export interface UserPermissionGroup {
  uid_user_system: string;
  nm_user: string;
  username?: string;
  kd_role?: string;
  permissions: Array<{ menu: string; action: string[] }>;
}

interface MenuAksesPair {
  menu: string;
  akses: string;
}

@Injectable()
export class PermissionService {
  constructor(private readonly db: DatabaseService) {}

  private requireActorRole(actorKdRole?: string): string {
    const role = String(actorKdRole || '').trim();
    if (!role) {
      throw new UnauthorizedException(
        'Sesi tidak valid (role tidak ditemukan)',
      );
    }
    return role;
  }

  async findAll(actorKdRole?: string): Promise<PermissionItem[]> {
    const result = await this.db.query<PermissionItem>(
      `SELECT kd_permission, kd_role, kd_menu, nm_menu, kd_action, kode, nm_action, link_menu
       FROM ${this.db.withSchema('v_menu_public')}
       ${actorKdRole ? 'WHERE kd_role >= $1' : ''}`,
      actorKdRole ? [this.requireActorRole(actorKdRole)] : [],
    );
    return result.rows;
  }

  async findByRole(
    kdRole: string,
    actorKdRole?: string,
  ): Promise<PermissionItem[]> {
    if (actorKdRole) {
      assertCanManageRole(this.requireActorRole(actorKdRole), kdRole);
    }
    const result = await this.db.query<PermissionItem>(
      `SELECT kd_permission, kd_role, kd_menu, nm_menu, kd_action, kode, nm_action, link_menu
       FROM ${this.db.withSchema('v_menu_public')}
       WHERE kd_role = $1`,
      [kdRole],
    );
    return result.rows;
  }

  async findByUser(uidUser: string): Promise<PermissionPrivateItem[]> {
    const result = await this.db.query<PermissionPrivateItem>(
      `SELECT kd_permission, uid_user_system, kd_menu, nm_menu, kd_action, kode, nm_action, link_menu
       FROM ${this.db.withSchema('v_menu_private')}
       WHERE uid_user_system = $1`,
      [uidUser],
    );
    return result.rows;
  }

  async findGroupedByRole(
    actorKdRole?: string,
  ): Promise<RolePermissionGroup[]> {
    const actor = this.requireActorRole(actorKdRole);
    const roles = await this.db.query<{ kd_role: string; nm_role: string }>(
      `SELECT r.kd_role, r.nm_role
       FROM ${this.db.withSchema('md_role')} r
       WHERE r.is_deleted = FALSE
         AND r.kd_role >= $1
       ORDER BY r.kd_role ASC`,
      [actor],
    );
    const result: RolePermissionGroup[] = [];
    for (const role of roles.rows) {
      result.push({
        ...role,
        permissions: await this.getActionEdit(role.kd_role),
      });
    }
    return result;
  }

  async findRolesWithoutPermission(
    actorKdRole?: string,
  ): Promise<Array<{ kd_role: string; nm_role: string }>> {
    const actor = this.requireActorRole(actorKdRole);
    const result = await this.db.query<{ kd_role: string; nm_role: string }>(
      `SELECT r.kd_role, r.nm_role
       FROM ${this.db.withSchema('md_role')} r
       WHERE r.is_deleted = FALSE
         AND r.kd_role >= $1
         AND NOT EXISTS (
         SELECT 1 FROM ${this.db.withSchema('d_permissions')} p WHERE p.kd_role = r.kd_role
       )
       ORDER BY r.kd_role ASC`,
      [actor],
    );
    return result.rows;
  }

  async getActionEdit(
    kdRole: string,
    actorKdRole?: string,
  ): Promise<Array<{ menu: string; action: string[] }>> {
    if (actorKdRole) {
      assertCanManageRole(this.requireActorRole(actorKdRole), kdRole);
    }
    const result = await this.db.query<{ menu: string; action: string[] }>(
      `SELECT kd_menu AS menu, array_agg(kd_action) AS action
       FROM ${this.db.withSchema('d_permissions')}
       WHERE kd_role = $1
       GROUP BY kd_menu
       ORDER BY kd_menu`,
      [kdRole],
    );
    return result.rows.map((r) => ({
      menu: r.menu,
      action: Array.isArray(r.action) ? r.action : [],
    }));
  }

  async findGroupedPrivate(
    actorKdRole?: string,
  ): Promise<UserPermissionGroup[]> {
    const actor = this.requireActorRole(actorKdRole);
    const users = await this.db.query<{
      uid_user_system: string;
      nm_user: string;
      username: string;
      kd_role: string;
    }>(
      `SELECT u.uid_user_system, u.nama AS nm_user, u.username, u.kd_role
       FROM ${this.db.withSchema('md_user')} u
       WHERE u.is_deleted = FALSE
         AND u.kd_role >= $1
         AND EXISTS (
           SELECT 1 FROM ${this.db.withSchema('d_permissions_private')} p
           WHERE p.uid_user_system = u.uid_user_system
         )
       ORDER BY u.nama`,
      [actor],
    );
    const result: UserPermissionGroup[] = [];
    for (const user of users.rows) {
      result.push({
        ...user,
        permissions: await this.getActionEditPrivate(user.uid_user_system),
      });
    }
    return result;
  }

  async findUsersWithoutPrivate(actorKdRole?: string): Promise<
    Array<{
      uid_user_system: string;
      nm_user: string;
      username: string;
      kd_role: string;
    }>
  > {
    const actor = this.requireActorRole(actorKdRole);
    const result = await this.db.query<{
      uid_user_system: string;
      nm_user: string;
      username: string;
      kd_role: string;
    }>(
      `SELECT u.uid_user_system, u.nama AS nm_user, u.username, u.kd_role
       FROM ${this.db.withSchema('md_user')} u
       WHERE u.is_deleted = FALSE
         AND u.kd_role >= $1
         AND NOT EXISTS (
           SELECT 1 FROM ${this.db.withSchema('d_permissions_private')} p
           WHERE p.uid_user_system = u.uid_user_system
         )
       ORDER BY u.nama`,
      [actor],
    );
    return result.rows;
  }

  async getActionEditPrivate(
    uidUser: string,
  ): Promise<Array<{ menu: string; action: string[] }>> {
    const result = await this.db.query<{ menu: string; action: string[] }>(
      `SELECT kd_menu AS menu, array_agg(kd_action) AS action
       FROM ${this.db.withSchema('d_permissions_private')}
       WHERE uid_user_system = $1
       GROUP BY kd_menu
       ORDER BY kd_menu`,
      [uidUser],
    );
    return result.rows.map((r) => ({
      menu: r.menu,
      action: Array.isArray(r.action) ? r.action : [],
    }));
  }

  async getActionEditRolePrivate(
    uidUser: string,
  ): Promise<Array<{ menu: string; action: string[] }>> {
    const result = await this.db.query<{ menu: string; action: string[] }>(
      `SELECT p.kd_menu AS menu, array_agg(p.kd_action) AS action
       FROM ${this.db.withSchema('d_permissions')} p
       WHERE p.kd_role = (
         SELECT kd_role FROM ${this.db.withSchema('md_user')} WHERE uid_user_system = $1
       )
       GROUP BY p.kd_menu
       ORDER BY p.kd_menu`,
      [uidUser],
    );
    return result.rows.map((r) => ({
      menu: r.menu,
      action: Array.isArray(r.action) ? r.action : [],
    }));
  }

  private decodeMenuPairs(menuB64: string): MenuAksesPair[] {
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(menuB64, 'base64').toString('utf8'),
      );
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('menu harus array (base64 JSON)');
      }
      return parsed.map((item) => {
        if (typeof item !== 'object' || item === null) {
          throw new BadRequestException('menu harus array (base64 JSON)');
        }
        const record = item as Record<string, unknown>;
        const menu =
          typeof record.menu === 'string' ||
          typeof record.menu === 'number' ||
          typeof record.menu === 'boolean'
            ? String(record.menu)
            : '';
        const akses =
          typeof record.akses === 'string' ||
          typeof record.akses === 'number' ||
          typeof record.akses === 'boolean'
            ? String(record.akses)
            : '';
        return { menu, akses };
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('menu (base64 JSON) tidak valid');
    }
  }

  private ensureMainAccessSeed(pairs: MenuAksesPair[]): MenuAksesPair[] {
    const hasMain = pairs.some(
      (p) => p.menu === 'MN_MAIN' && p.akses === 'ACT_AC',
    );
    if (hasMain) return pairs;
    return [{ menu: 'MN_MAIN', akses: 'ACT_AC' }, ...pairs];
  }

  private nextPermissionKd(prefix: string): string {
    return `${prefix}${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /** Generate kd_role RS### (mirip F_CREATE_KD_ROLE dashboard). */
  async nextKdRole(client?: PoolClient): Promise<string> {
    const sql = `SELECT kd_role FROM ${this.db.withSchema('md_role')}
       WHERE kd_role ~ '^RS[0-9]+$'
       ORDER BY NULLIF(regexp_replace(kd_role, '\\D', '', 'g'), '')::int DESC
       LIMIT 1`;
    const result = client
      ? await client.query<{ kd_role: string }>(sql)
      : await this.db.query<{ kd_role: string }>(sql);
    const last = result.rows[0]?.kd_role;
    const nextNum = last ? Number(String(last).replace(/\D/g, '')) + 1 : 1;
    if (!Number.isFinite(nextNum) || nextNum < 1) {
      return 'RS001';
    }
    if (nextNum > 999) {
      throw new BadRequestException('Kuota kode role RS### habis');
    }
    return `RS${String(nextNum).padStart(3, '0')}`;
  }

  private async insertPermissionPairs(
    client: PoolClient,
    kdRole: string,
    pairs: MenuAksesPair[],
  ): Promise<number> {
    let sukses = 0;
    for (const pair of pairs) {
      const kd = this.nextPermissionKd('PERM_');
      const res = await client.query(
        `INSERT INTO ${this.db.withSchema('d_permissions')}
           (kd_permission, kd_role, kd_menu, kd_action)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (kd_role, kd_menu, kd_action) DO NOTHING`,
        [kd, kdRole, pair.menu, pair.akses],
      );
      if (res.rowCount && res.rowCount > 0) sukses += 1;
    }
    return sukses;
  }

  async createRoleWithPermissions(
    dto: CreateRolePermissionDto,
  ): Promise<{ kd_role: string; nm_role: string; sukses: number }> {
    const nmRole = dto.nm_role.trim();
    if (!nmRole) {
      throw new BadRequestException('Nama role wajib');
    }
    const pairs = this.ensureMainAccessSeed(this.decodeMenuPairs(dto.menu));

    return this.db.withTransaction(async (client) => {
      const kdRole = await this.nextKdRole(client);
      await client.query(
        `INSERT INTO ${this.db.withSchema('md_role')}
           (kd_role, nm_role, status, is_deleted)
         VALUES ($1, $2, 'A', FALSE)`,
        [kdRole, nmRole],
      );
      const sukses = await this.insertPermissionPairs(client, kdRole, pairs);
      return { kd_role: kdRole, nm_role: nmRole, sukses };
    });
  }

  async updateRoleWithPermissions(
    dto: UpdateRolePermissionDto,
    actorKdRole?: string,
  ): Promise<{ kd_role: string; nm_role: string; sukses: number }> {
    const actor = this.requireActorRole(actorKdRole);
    assertCanManageRole(actor, dto.kd_role);

    const existing = await this.db.query<{
      kd_role: string;
      nm_role: string;
      is_deleted: boolean;
    }>(
      `SELECT kd_role, nm_role, is_deleted
       FROM ${this.db.withSchema('md_role')}
       WHERE kd_role = $1`,
      [dto.kd_role],
    );
    if (!existing.rows[0] || existing.rows[0].is_deleted) {
      throw new NotFoundException(`Role ${dto.kd_role} tidak ditemukan`);
    }

    const nmRole =
      dto.nm_role !== undefined && dto.nm_role !== null
        ? String(dto.nm_role).trim()
        : existing.rows[0].nm_role;
    if (!nmRole) {
      throw new BadRequestException('Nama role wajib');
    }

    const pairs = this.ensureMainAccessSeed(this.decodeMenuPairs(dto.menu));

    return this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE ${this.db.withSchema('md_role')}
         SET nm_role = $2, updated_at = NOW()
         WHERE kd_role = $1`,
        [dto.kd_role, nmRole],
      );
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions')} WHERE kd_role = $1`,
        [dto.kd_role],
      );
      const sukses = await this.insertPermissionPairs(
        client,
        dto.kd_role,
        pairs,
      );
      return { kd_role: dto.kd_role, nm_role: nmRole, sukses };
    });
  }

  /** Soft-delete role + hapus semua public permissions. */
  async removeRoleAndPermissions(
    kdRole: string,
    actorKdRole?: string,
  ): Promise<void> {
    const actor = this.requireActorRole(actorKdRole);
    assertCanManageRole(actor, kdRole);

    if (kdRole === 'RS001') {
      throw new BadRequestException(
        'Role Super Administrator (RS001) tidak boleh dihapus',
      );
    }

    const existing = await this.db.query<{
      kd_role: string;
      is_deleted: boolean;
    }>(
      `SELECT kd_role, is_deleted FROM ${this.db.withSchema('md_role')} WHERE kd_role = $1`,
      [kdRole],
    );
    if (!existing.rows[0] || existing.rows[0].is_deleted) {
      throw new NotFoundException(`Role ${kdRole} tidak ditemukan`);
    }

    const users = await this.db.query(
      `SELECT 1 FROM ${this.db.withSchema('md_user')}
       WHERE kd_role = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [kdRole],
    );
    if (users.rowCount && users.rowCount > 0) {
      throw new BadRequestException(
        `Role ${kdRole} masih dipakai user aktif; pindahkan user terlebih dahulu`,
      );
    }

    await this.db.withTransaction(async (client) => {
      await client.query(
        `DELETE FROM ${this.db.withSchema('d_permissions')} WHERE kd_role = $1`,
        [kdRole],
      );
      await client.query(
        `UPDATE ${this.db.withSchema('md_role')}
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE kd_role = $1`,
        [kdRole],
      );
    });
  }

  async upsertPrivate(
    dto: UpsertPermissionPrivateDto,
    replace: boolean,
  ): Promise<{ sukses: number }> {
    const pairs = this.ensureMainAccessSeed(this.decodeMenuPairs(dto.menu));
    let sukses = 0;

    await this.db.withTransaction(async (client) => {
      if (replace) {
        await client.query(
          `DELETE FROM ${this.db.withSchema('d_permissions_private')} WHERE uid_user_system = $1`,
          [dto.uid_user_system],
        );
      }
      for (const pair of pairs) {
        const kd = this.nextPermissionKd('PPRV_');
        const res = await client.query(
          `INSERT INTO ${this.db.withSchema('d_permissions_private')}
             (kd_permission, uid_user_system, kd_menu, kd_action)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (uid_user_system, kd_menu, kd_action) DO NOTHING`,
          [kd, dto.uid_user_system, pair.menu, pair.akses],
        );
        if (res.rowCount && res.rowCount > 0) sukses += 1;
      }
    });

    return { sukses };
  }

  async removePrivateByUser(uidUser: string): Promise<void> {
    const res = await this.db.query(
      `DELETE FROM ${this.db.withSchema('d_permissions_private')} WHERE uid_user_system = $1`,
      [uidUser],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException(
        `Permission private untuk user ${uidUser} tidak ditemukan`,
      );
    }
  }
}
