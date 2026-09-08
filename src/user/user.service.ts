import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { sha256 } from '../common/crypto.util';
import { assertPasswordStrength } from '../common/password.util';
import {
  assertCanManageRole,
  type ActorIdentity,
} from '../common/role-hierarchy.util';
import { PasswordPolicyService } from '../auth/password-policy.service';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserAdmin {
  uid_user_system: string;
  nama: string;
  email: string | null;
  username: string;
  kd_role: string;
  nm_role: string | null;
  status_user: string;
  is_deleted: boolean;
  is_locked: boolean;
  failed_login_attempts: number;
  password_changed_at: Date | string | null;
  status: 'A' | 'N';
}

export interface RoleOption {
  kd_role: string;
  nm_role: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly db: DatabaseService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly config: ConfigService,
  ) {}

  private requireActorRole(actorKdRole?: string): string {
    const role = String(actorKdRole || '').trim();
    if (!role) {
      throw new UnauthorizedException(
        'Sesi tidak valid (role tidak ditemukan)',
      );
    }
    return role;
  }

  /**
   * Role pemanggil: utamakan kd_role dari DB by JWT sub (selalu akurat),
   * fallback ke klaim JWT `role`.
   */
  private async resolveActorRole(
    actor?: ActorIdentity | string,
  ): Promise<string> {
    if (typeof actor === 'string') {
      return this.requireActorRole(actor);
    }
    const sub = actor?.sub?.trim();
    if (sub) {
      const result = await this.db.query<{ kd_role: string }>(
        `SELECT kd_role
         FROM ${this.db.withSchema('md_user')}
         WHERE uid_user_system = $1 AND is_deleted = FALSE
         LIMIT 1`,
        [sub],
      );
      if (result.rows[0]?.kd_role) {
        return result.rows[0].kd_role;
      }
    }
    return this.requireActorRole(actor?.role);
  }

  /** Admin list: termasuk soft-deleted; tanpa kolom password. Difilter hierarki role. */
  async findAllAdmin(actor?: ActorIdentity | string): Promise<UserAdmin[]> {
    const actorRole = await this.resolveActorRole(actor);
    const result = await this.db.query<{
      uid_user_system: string;
      nama: string;
      email: string | null;
      username: string;
      kd_role: string;
      nm_role: string | null;
      status_user: string;
      is_deleted: boolean;
      is_locked: boolean;
      failed_login_attempts: number;
      password_changed_at: Date | string | null;
    }>(
      `SELECT u.uid_user_system,
              u.nama,
              u.email,
              u.username,
              u.kd_role,
              r.nm_role,
              u.status_user,
              u.is_deleted,
              u.is_locked,
              u.failed_login_attempts,
              u.password_changed_at
       FROM ${this.db.withSchema('md_user')} u
       LEFT JOIN ${this.db.withSchema('md_role')} r ON r.kd_role = u.kd_role
       WHERE u.kd_role IS NOT NULL
         AND u.kd_role >= $1
       ORDER BY u.username`,
      [actorRole],
    );
    return result.rows.map((row) => ({
      ...row,
      is_deleted: Boolean(row.is_deleted),
      is_locked: Boolean(row.is_locked),
      failed_login_attempts: Number(row.failed_login_attempts || 0),
      status: row.status_user === 'A' ? 'A' : 'N',
    }));
  }

  async findRoles(actor?: ActorIdentity | string): Promise<RoleOption[]> {
    const actorRole = await this.resolveActorRole(actor);
    const result = await this.db.query<RoleOption>(
      `SELECT kd_role, nm_role
       FROM ${this.db.withSchema('md_role')}
       WHERE status = 'A' AND is_deleted = FALSE
         AND kd_role >= $1
       ORDER BY kd_role`,
      [actorRole],
    );
    return result.rows;
  }

  private async assertUsernameUnique(
    username: string,
    excludeUid?: string,
  ): Promise<void> {
    const result = await this.db.query<{ uid_user_system: string }>(
      `SELECT uid_user_system
       FROM ${this.db.withSchema('md_user')}
       WHERE LOWER(username) = LOWER($1)
         ${excludeUid ? 'AND uid_user_system <> $2' : ''}
       LIMIT 1`,
      excludeUid ? [username, excludeUid] : [username],
    );
    if (result.rows[0]) {
      throw new ConflictException(`Username "${username}" sudah dipakai`);
    }
  }

  private async assertRoleExists(kdRole: string): Promise<void> {
    const result = await this.db.query(
      `SELECT 1 FROM ${this.db.withSchema('md_role')}
       WHERE kd_role = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [kdRole],
    );
    if (result.rowCount === 0) {
      throw new BadRequestException(`Role "${kdRole}" tidak ditemukan`);
    }
  }

  private async getById(uid: string, actorKdRole: string): Promise<UserAdmin> {
    const rows = await this.findAllAdmin(actorKdRole);
    const found = rows.find((r) => r.uid_user_system === uid);
    if (!found) throw new NotFoundException(`User ${uid} tidak ditemukan`);
    return found;
  }

  private async getUserRole(uid: string): Promise<string> {
    const result = await this.db.query<{ kd_role: string }>(
      `SELECT kd_role FROM ${this.db.withSchema('md_user')} WHERE uid_user_system = $1`,
      [uid],
    );
    if (!result.rows[0]) {
      throw new NotFoundException(`User ${uid} tidak ditemukan`);
    }
    return result.rows[0].kd_role;
  }

  async create(
    dto: CreateUserDto,
    actor?: ActorIdentity | string,
  ): Promise<UserAdmin> {
    const actorRole = await this.resolveActorRole(actor);
    assertCanManageRole(actorRole, dto.kd_role);

    const username = dto.username.trim();
    await this.assertUsernameUnique(username);
    await this.assertRoleExists(dto.kd_role);
    assertPasswordStrength(dto.password);

    const uid = randomUUID();
    const statusUser = dto.status === 'N' ? 'N' : 'A';
    const hash = sha256(dto.password);
    await this.db.query(
      `INSERT INTO ${this.db.withSchema('md_user')}
         (uid_user_system, nama, email, username, password, kd_role, status_user,
          is_deleted, failed_login_attempts, is_locked, password_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 0, FALSE, NOW())`,
      [
        uid,
        dto.nama.trim(),
        dto.email?.trim() || null,
        username,
        hash,
        dto.kd_role,
        statusUser,
      ],
    );
    await this.passwordPolicy.pushHistory(uid, hash);
    return this.getById(uid, actorRole);
  }

  async update(
    dto: UpdateUserDto,
    actor?: ActorIdentity | string,
  ): Promise<UserAdmin> {
    const actorRole = await this.resolveActorRole(actor);
    const existingRole = await this.getUserRole(dto.uid_user_system);
    assertCanManageRole(actorRole, existingRole, 'user');

    if (dto.kd_role !== undefined) {
      assertCanManageRole(actorRole, dto.kd_role);
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    let passwordPlain: string | null = null;

    if (dto.username !== undefined) {
      const username = dto.username.trim();
      await this.assertUsernameUnique(username, dto.uid_user_system);
      sets.push(`username = $${i++}`);
      params.push(username);
    }
    if (dto.email !== undefined) {
      sets.push(`email = $${i++}`);
      params.push(dto.email?.trim() || null);
    }
    if (dto.nama !== undefined) {
      sets.push(`nama = $${i++}`);
      params.push(dto.nama.trim());
    }
    if (dto.kd_role !== undefined) {
      await this.assertRoleExists(dto.kd_role);
      sets.push(`kd_role = $${i++}`);
      params.push(dto.kd_role);
    }
    if (dto.password !== undefined && dto.password.trim() !== '') {
      passwordPlain = dto.password;
      await this.passwordPolicy.assertNotInHistory(
        dto.uid_user_system,
        passwordPlain,
      );
      assertPasswordStrength(passwordPlain);
      sets.push(`password = $${i++}`);
      params.push(sha256(passwordPlain));
      sets.push(`password_changed_at = NOW()`);
      sets.push(`is_locked = FALSE`);
      sets.push(`failed_login_attempts = 0`);
    }
    if (dto.status !== undefined) {
      sets.push(`status_user = $${i++}`);
      params.push(dto.status === 'N' ? 'N' : 'A');
    }

    if (sets.length === 0) {
      throw new BadRequestException('Tidak ada field yang diubah');
    }

    sets.push(`updated_at = NOW()`);
    params.push(dto.uid_user_system);

    await this.db.query(
      `UPDATE ${this.db.withSchema('md_user')}
       SET ${sets.join(', ')}
       WHERE uid_user_system = $${i}`,
      params,
    );

    if (passwordPlain) {
      await this.passwordPolicy.pushHistory(
        dto.uid_user_system,
        sha256(passwordPlain),
      );
    }

    return this.getById(dto.uid_user_system, actorRole);
  }

  async unlock(
    uidUserSystem: string,
    actor?: ActorIdentity | string,
  ): Promise<UserAdmin> {
    const actorRole = await this.resolveActorRole(actor);
    const existingRole = await this.getUserRole(uidUserSystem);
    assertCanManageRole(actorRole, existingRole, 'user');
    await this.passwordPolicy.unlock(uidUserSystem);
    return this.getById(uidUserSystem, actorRole);
  }

  async sendResetEmail(
    uidUserSystem: string,
    actor?: ActorIdentity | string,
  ): Promise<{ message: string }> {
    const actorRole = await this.resolveActorRole(actor);
    const existingRole = await this.getUserRole(uidUserSystem);
    assertCanManageRole(actorRole, existingRole, 'user');

    const result = await this.db.query<{
      username: string;
      email: string | null;
      status_user: string;
      is_deleted: boolean;
    }>(
      `SELECT username, email, status_user, is_deleted
       FROM ${this.db.withSchema('md_user')}
       WHERE uid_user_system = $1`,
      [uidUserSystem],
    );
    const user = result.rows[0];
    if (!user || user.is_deleted) {
      throw new NotFoundException(`User ${uidUserSystem} tidak ditemukan`);
    }
    if (!user.email?.trim()) {
      throw new BadRequestException(
        'User tidak memiliki email. Isi email terlebih dahulu.',
      );
    }

    const ttlMs = this.passwordPolicy.getAdminResetTtlMs();
    const plainToken = await this.passwordPolicy.createResetToken(
      uidUserSystem,
      'admin',
      ttlMs,
    );

    await this.passwordPolicy.sendResetEmail({
      to: user.email.trim(),
      username: user.username,
      plainToken,
      purpose: 'admin',
      ttlHours: Number(
        this.config.get<string>('ADMIN_PASSWORD_RESET_TTL_HOURS', '24'),
      ),
    });

    return { message: 'Email reset password telah dikirim' };
  }

  /** Soft-delete: is_deleted = true. */
  async remove(
    uidUserSystem: string,
    actor?: ActorIdentity | string,
  ): Promise<void> {
    const actorRole = await this.resolveActorRole(actor);
    const existingRole = await this.getUserRole(uidUserSystem);
    assertCanManageRole(actorRole, existingRole, 'user');

    const result = await this.db.query(
      `UPDATE ${this.db.withSchema('md_user')}
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE uid_user_system = $1`,
      [uidUserSystem],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`User ${uidUserSystem} tidak ditemukan`);
    }
  }
}
