import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { sha256 } from '../common/crypto.util';
import { assertPasswordStrength } from '../common/password.util';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

export type ResetTokenPurpose = 'forgot' | 'admin' | 'expired_change';

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  getMaxAgeDays(): number {
    return Number(this.config.get<string>('PASSWORD_MAX_AGE_DAYS', '90'));
  }

  getHistoryCount(): number {
    return Number(this.config.get<string>('PASSWORD_HISTORY_COUNT', '3'));
  }

  getLockoutThreshold(): number {
    return Number(this.config.get<string>('LOCKOUT_THRESHOLD', '5'));
  }

  getForgotResetTtlMs(): number {
    const hours = Number(
      this.config.get<string>('PASSWORD_RESET_TTL_HOURS', '1'),
    );
    return hours * 60 * 60 * 1000;
  }

  getAdminResetTtlMs(): number {
    const hours = Number(
      this.config.get<string>('ADMIN_PASSWORD_RESET_TTL_HOURS', '24'),
    );
    return hours * 60 * 60 * 1000;
  }

  getExpiredChangeTtlMs(): number {
    const minutes = Number(
      this.config.get<string>('EXPIRED_CHANGE_TOKEN_TTL_MINUTES', '15'),
    );
    return minutes * 60 * 1000;
  }

  getFrontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL', '') ||
      this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173')
    ).replace(/\/$/, '');
  }

  isPasswordExpired(passwordChangedAt: Date | string | null): boolean {
    if (!passwordChangedAt) return true;
    const changed = new Date(passwordChangedAt);
    if (Number.isNaN(changed.getTime())) return true;
    const maxAgeMs = this.getMaxAgeDays() * 24 * 60 * 60 * 1000;
    return Date.now() - changed.getTime() > maxAgeMs;
  }

  async assertNotInHistory(
    uid: string,
    plainPassword: string,
  ): Promise<void> {
    const hash = sha256(plainPassword);
    const limit = this.getHistoryCount();

    const current = await this.db.query<{ password: string }>(
      `SELECT password FROM ${this.db.withSchema('md_user')}
       WHERE uid_user_system = $1`,
      [uid],
    );
    if (current.rows[0]?.password === hash) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password yang pernah dipakai',
      );
    }

    const history = await this.db.query<{ password_hash: string }>(
      `SELECT password_hash
       FROM ${this.db.withSchema('d_password_history')}
       WHERE uid_user_system = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [uid, limit],
    );
    if (history.rows.some((r) => r.password_hash === hash)) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password yang pernah dipakai',
      );
    }
  }

  async pushHistory(uid: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.db.withSchema('d_password_history')}
         (uid_user_system, password_hash, created_at)
       VALUES ($1, $2, NOW())`,
      [uid, passwordHash],
    );

    const limit = this.getHistoryCount();
    await this.db.query(
      `DELETE FROM ${this.db.withSchema('d_password_history')}
       WHERE id IN (
         SELECT id FROM ${this.db.withSchema('d_password_history')}
         WHERE uid_user_system = $1
         ORDER BY created_at DESC
         OFFSET $2
       )`,
      [uid, limit],
    );
  }

  /**
   * Set password with strength + history checks.
   * Optionally unlock account and reset failed attempts.
   */
  async setPassword(
    uid: string,
    plainPassword: string,
    options: { unlock?: boolean; skipHistoryCheck?: boolean } = {},
  ): Promise<void> {
    assertPasswordStrength(plainPassword);
    if (!options.skipHistoryCheck) {
      await this.assertNotInHistory(uid, plainPassword);
    }

    const hash = sha256(plainPassword);
    const unlockSql = options.unlock
      ? `, is_locked = FALSE, failed_login_attempts = 0`
      : '';

    await this.db.query(
      `UPDATE ${this.db.withSchema('md_user')}
       SET password = $1,
           password_changed_at = NOW(),
           updated_at = NOW()
           ${unlockSql}
       WHERE uid_user_system = $2`,
      [hash, uid],
    );

    await this.pushHistory(uid, hash);
  }

  async clearFailedAttempts(uid: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.db.withSchema('md_user')}
       SET failed_login_attempts = 0, updated_at = NOW()
       WHERE uid_user_system = $1`,
      [uid],
    );
  }

  async recordFailedAttempt(uid: string): Promise<{
    attempts: number;
    locked: boolean;
  }> {
    const threshold = this.getLockoutThreshold();
    const result = await this.db.query<{
      failed_login_attempts: number;
      is_locked: boolean;
    }>(
      `UPDATE ${this.db.withSchema('md_user')}
       SET failed_login_attempts = failed_login_attempts + 1,
           is_locked = CASE
             WHEN failed_login_attempts + 1 >= $2 THEN TRUE
             ELSE is_locked
           END,
           updated_at = NOW()
       WHERE uid_user_system = $1
       RETURNING failed_login_attempts, is_locked`,
      [uid, threshold],
    );
    const row = result.rows[0];
    return {
      attempts: row?.failed_login_attempts ?? 0,
      locked: Boolean(row?.is_locked),
    };
  }

  async unlock(uid: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE ${this.db.withSchema('md_user')}
       SET is_locked = FALSE,
           failed_login_attempts = 0,
           updated_at = NOW()
       WHERE uid_user_system = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
      [uid],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`User ${uid} tidak ditemukan`);
    }
  }

  async createResetToken(
    uid: string,
    purpose: ResetTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const plain = randomBytes(32).toString('hex');
    const tokenHash = sha256(plain);
    const expiresAt = new Date(Date.now() + ttlMs);

    // Invalidate previous unused tokens of the same purpose
    await this.db.query(
      `UPDATE ${this.db.withSchema('d_password_reset_token')}
       SET used_at = NOW()
       WHERE uid_user_system = $1
         AND purpose = $2
         AND used_at IS NULL`,
      [uid, purpose],
    );

    await this.db.query(
      `INSERT INTO ${this.db.withSchema('d_password_reset_token')}
         (token_hash, uid_user_system, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenHash, uid, purpose, expiresAt],
    );

    return plain;
  }

  async consumeResetToken(
    plainToken: string,
    allowedPurposes: ResetTokenPurpose[],
  ): Promise<{ uid: string; purpose: ResetTokenPurpose; tokenId: number }> {
    const tokenHash = sha256(plainToken);
    const result = await this.db.query<{
      id: string;
      uid_user_system: string;
      purpose: ResetTokenPurpose;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, uid_user_system, purpose, expires_at, used_at
       FROM ${this.db.withSchema('d_password_reset_token')}
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row || row.used_at) {
      throw new BadRequestException('Token reset password tidak valid');
    }
    if (!allowedPurposes.includes(row.purpose)) {
      throw new BadRequestException('Token reset password tidak valid');
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Token reset password sudah kedaluwarsa');
    }

    await this.db.query(
      `UPDATE ${this.db.withSchema('d_password_reset_token')}
       SET used_at = NOW()
       WHERE id = $1`,
      [row.id],
    );

    return {
      uid: row.uid_user_system,
      purpose: row.purpose,
      tokenId: Number(row.id),
    };
  }

  async sendResetEmail(params: {
    to: string;
    username: string;
    plainToken: string;
    purpose: 'forgot' | 'admin';
    ttlHours: number;
  }): Promise<void> {
    const link = `${this.getFrontendUrl()}/auth/reset-password?token=${encodeURIComponent(params.plainToken)}`;
    const isAdmin = params.purpose === 'admin';
    const subject = isAdmin
      ? 'Link Reset Password dari Administrator'
      : 'Reset Password Akun Anda';
    const intro = isAdmin
      ? 'Administrator mengirimkan link untuk mereset password akun Anda.'
      : 'Kami menerima permintaan untuk mereset password akun Anda.';

    const html = `
      <p>Halo <strong>${escapeHtml(params.username)}</strong>,</p>
      <p>${intro}</p>
      <p>Silakan klik tautan berikut untuk membuat password baru:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Link berlaku selama <strong>${params.ttlHours} jam</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `;
    const text = `${intro}\n\nUsername: ${params.username}\nLink: ${link}\nBerlaku: ${params.ttlHours} jam.`;

    try {
      await this.mail.send({ to: params.to, subject, html, text });
    } catch (err) {
      this.logger.error(
        `Gagal mengirim email reset password: ${(err as Error).message}`,
      );
      throw new BadRequestException('Gagal mengirim email reset password');
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
