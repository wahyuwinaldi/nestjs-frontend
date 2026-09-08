import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { sha256 } from '../common/crypto.util';
import { assertPasswordStrength } from '../common/password.util';
import { MenuService, MenuTreeItem } from '../system/menu/menu.service';
import { PermissionService } from '../master/permission/permission.service';
import { AuthorizeDto } from './dto/authorize.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeExpiredPasswordDto } from './dto/change-expired-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordExpiredException } from './password-expired.exception';
import { PasswordPolicyService } from './password-policy.service';

export interface AuthUser {
  uid_user_system: string;
  nama: string;
  username: string;
  kd_role: string;
  nm_role: string;
  status_user: string;
}

export interface AksesItem {
  kd_menu: string;
  link_menu: string | null;
  nm_menu: string;
  permissions: string[];
}

type LoginRow = AuthUser & {
  password: string;
  email: string | null;
  is_locked: boolean;
  failed_login_attempts: number;
  password_changed_at: Date | string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly menuService: MenuService,
    private readonly permissionService: PermissionService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  /**
   * Prune tree: node hanya tampil jika punya AC sendiri.
   * Parent tanpa AC tidak ikut muncul meski punya children ber-AC.
   */
  private filterMenuTree(
    nodes: MenuTreeItem[],
    akses: AksesItem[],
  ): MenuTreeItem[] {
    const permsByMenu = new Map(akses.map((a) => [a.kd_menu, a.permissions]));

    const walk = (node: MenuTreeItem): MenuTreeItem | null => {
      const perms = permsByMenu.get(node.kd_menu) || [];
      const hasOwnAccess = perms.includes('AC');
      if (!hasOwnAccess) {
        return null;
      }
      const children = (node.children || [])
        .map(walk)
        .filter((c): c is MenuTreeItem => Boolean(c));
      return { ...node, children };
    };

    return nodes.map(walk).filter((n): n is MenuTreeItem => Boolean(n));
  }

  async buildMenuPayloadForUid(
    uid: string,
  ): Promise<{ build_menu: MenuTreeItem[]; menu: AksesItem[] }> {
    const result = await this.db.query<AuthUser>(
      `SELECT uid_user_system, nama, username, kd_role, nm_role, status_user
       FROM ${this.db.withSchema('v_user')}
       WHERE uid_user_system = $1`,
      [uid],
    );
    const user = result.rows[0];
    if (!user) {
      return { build_menu: [], menu: [] };
    }
    return this.buildMenuPayload(user);
  }

  async buildMenuPayload(
    user: AuthUser,
  ): Promise<{ build_menu: MenuTreeItem[]; menu: AksesItem[] }> {
    const [tree, flat, privateRows, publicRows] = await Promise.all([
      this.menuService.findTree(),
      this.menuService.findFlat(),
      this.permissionService.findByUser(user.uid_user_system),
      this.permissionService.findByRole(user.kd_role),
    ]);

    const permissions =
      privateRows.length > 0
        ? privateRows.map((r) => ({
            kd_menu: r.kd_menu,
            nm_menu: r.nm_menu,
            kode: r.kode,
          }))
        : publicRows.map((r) => ({
            kd_menu: r.kd_menu,
            nm_menu: r.nm_menu,
            kode: r.kode,
          }));

    const menuByKode = new Map(flat.map((item) => [item.kd_menu, item]));
    const grouped = new Map<string, Set<string>>();

    for (const row of permissions) {
      if (!grouped.has(row.kd_menu)) {
        grouped.set(row.kd_menu, new Set());
      }
      grouped.get(row.kd_menu)!.add(row.kode);
    }

    const menu: AksesItem[] = [];
    grouped.forEach((kodeSet, kdMenu) => {
      const meta = menuByKode.get(kdMenu);
      menu.push({
        kd_menu: kdMenu,
        link_menu: meta?.link_menu ?? null,
        nm_menu: meta?.nm_menu || rowNm(permissions, kdMenu),
        permissions: Array.from(kodeSet),
      });
    });

    const build_menu = this.filterMenuTree(tree, menu);
    return { build_menu, menu };
  }

  async authorize(dto: AuthorizeDto): Promise<{
    token: string;
    user: AuthUser;
    build_menu: MenuTreeItem[];
    menu: AksesItem[];
  }> {
    const result = await this.db.query<LoginRow>(
      `SELECT uid_user_system, nama, username, email, password, kd_role, nm_role,
              status_user, is_locked, failed_login_attempts, password_changed_at
       FROM ${this.db.withSchema('v_user')}
       WHERE username = $1`,
      [dto.username],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('Username atau password salah');
    }

    if (user.status_user !== 'A') {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    if (user.is_locked) {
      throw new UnauthorizedException(
        'Akun terkunci karena terlalu banyak percobaan login gagal. Hubungi administrator.',
      );
    }

    const hashed = sha256(dto.password);
    if (hashed !== user.password) {
      const attempt = await this.passwordPolicy.recordFailedAttempt(
        user.uid_user_system,
      );
      if (attempt.locked) {
        throw new UnauthorizedException(
          'Akun terkunci karena terlalu banyak percobaan login gagal. Hubungi administrator.',
        );
      }
      throw new UnauthorizedException('Username atau password salah');
    }

    await this.passwordPolicy.clearFailedAttempts(user.uid_user_system);

    if (this.passwordPolicy.isPasswordExpired(user.password_changed_at)) {
      const changeToken = await this.passwordPolicy.createResetToken(
        user.uid_user_system,
        'expired_change',
        this.passwordPolicy.getExpiredChangeTtlMs(),
      );
      throw new PasswordExpiredException(changeToken);
    }

    const safeUser: AuthUser = {
      uid_user_system: user.uid_user_system,
      nama: user.nama,
      username: user.username,
      kd_role: user.kd_role,
      nm_role: user.nm_role,
      status_user: user.status_user,
    };

    const token = await this.jwt.signAsync(
      {
        sub: safeUser.uid_user_system,
        username: safeUser.username,
        role: safeUser.kd_role,
      },
      {
        secret: this.config.get<string>('JWT_SECRET', 'dev-secret'),
        expiresIn: this.config.get<string>(
          'JWT_EXPIRES_IN',
          '8h',
        ) as unknown as number,
      },
    );

    const { build_menu, menu } = await this.buildMenuPayload(safeUser);
    return { token, user: safeUser, build_menu, menu };
  }

  async changeExpiredPassword(
    dto: ChangeExpiredPasswordDto,
  ): Promise<{ message: string }> {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('Konfirmasi password baru tidak cocok');
    }
    assertPasswordStrength(dto.new_password);

    const consumed = await this.passwordPolicy.consumeResetToken(
      dto.change_token,
      ['expired_change'],
    );

    await this.passwordPolicy.setPassword(consumed.uid, dto.new_password, {
      unlock: true,
    });

    return {
      message:
        'Password berhasil diubah. Silakan login dengan password baru Anda.',
    };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const generic = {
      message:
        'Jika akun ditemukan dan memiliki email, link reset password telah dikirim.',
    };

    const identifier = dto.username_or_email.trim();
    if (!identifier) {
      return generic;
    }

    const result = await this.db.query<{
      uid_user_system: string;
      username: string;
      email: string | null;
      status_user: string;
      is_locked: boolean;
    }>(
      `SELECT uid_user_system, username, email, status_user, is_locked
       FROM ${this.db.withSchema('v_user')}
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(COALESCE(email, '')) = LOWER($1)
       LIMIT 1`,
      [identifier],
    );

    const user = result.rows[0];
    if (
      !user ||
      user.status_user !== 'A' ||
      user.is_locked ||
      !user.email?.trim()
    ) {
      return generic;
    }

    const ttlMs = this.passwordPolicy.getForgotResetTtlMs();
    const plainToken = await this.passwordPolicy.createResetToken(
      user.uid_user_system,
      'forgot',
      ttlMs,
    );

    await this.passwordPolicy.sendResetEmail({
      to: user.email.trim(),
      username: user.username,
      plainToken,
      purpose: 'forgot',
      ttlHours: Number(
        this.config.get<string>('PASSWORD_RESET_TTL_HOURS', '1'),
      ),
    });

    return generic;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('Konfirmasi password baru tidak cocok');
    }
    assertPasswordStrength(dto.new_password);

    const consumed = await this.passwordPolicy.consumeResetToken(dto.token, [
      'forgot',
      'admin',
    ]);

    await this.passwordPolicy.setPassword(consumed.uid, dto.new_password, {
      unlock: true,
    });

    return {
      message:
        'Password berhasil diubah. Silakan login dengan password baru Anda.',
    };
  }

  /**
   * Ganti password user yang sedang login. Password dikirim plain;
   * disimpan sebagai SHA-256 (sama seperti login / admin update user).
   */
  async changePassword(
    uid: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('Konfirmasi password baru tidak cocok');
    }
    if (dto.new_password === dto.current_password) {
      throw new BadRequestException(
        'Password baru harus berbeda dari password saat ini',
      );
    }
    assertPasswordStrength(dto.new_password);

    const result = await this.db.query<{
      password: string;
      status_user: string;
      is_locked: boolean;
    }>(
      `SELECT password, status_user, is_locked
       FROM ${this.db.withSchema('md_user')}
       WHERE uid_user_system = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
      [uid],
    );
    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }
    if (row.status_user !== 'A') {
      throw new UnauthorizedException('Akun tidak aktif');
    }
    if (row.is_locked) {
      throw new UnauthorizedException(
        'Akun terkunci. Hubungi administrator untuk membuka kunci.',
      );
    }
    if (sha256(dto.current_password) !== row.password) {
      throw new BadRequestException('Password saat ini salah');
    }

    await this.passwordPolicy.setPassword(uid, dto.new_password);

    return { message: 'Password berhasil diubah' };
  }
}

function rowNm(
  permissions: Array<{ kd_menu: string; nm_menu: string }>,
  kdMenu: string,
): string {
  return permissions.find((p) => p.kd_menu === kdMenu)?.nm_menu || kdMenu;
}
