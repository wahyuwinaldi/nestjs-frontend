import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';
import { MailService } from '../../src/mail/mail.service';
import { PasswordPolicyService } from '../../src/auth/password-policy.service';
import { sha256 } from '../../src/common/crypto.util';
import { createDbMock, DbMock } from '../helpers/mock-db';
import { mockConfig } from '../helpers/mock-config';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;
  let db: DbMock;
  let mail: { send: jest.Mock };

  beforeEach(async () => {
    db = createDbMock();
    mail = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordPolicyService,
        { provide: DatabaseService, useValue: db },
        {
          provide: ConfigService,
          useValue: mockConfig({
            PASSWORD_MAX_AGE_DAYS: '90',
            PASSWORD_HISTORY_COUNT: '3',
            LOCKOUT_THRESHOLD: '5',
            PASSWORD_RESET_TTL_HOURS: '1',
            ADMIN_PASSWORD_RESET_TTL_HOURS: '24',
            EXPIRED_CHANGE_TOKEN_TTL_MINUTES: '15',
            FRONTEND_URL: 'http://localhost:5173/',
          }),
        },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(PasswordPolicyService);
  });

  describe('config helpers', () => {
    it('returns configured TTL and thresholds', () => {
      expect(service.getMaxAgeDays()).toBe(90);
      expect(service.getHistoryCount()).toBe(3);
      expect(service.getLockoutThreshold()).toBe(5);
      expect(service.getForgotResetTtlMs()).toBe(60 * 60 * 1000);
      expect(service.getAdminResetTtlMs()).toBe(24 * 60 * 60 * 1000);
      expect(service.getExpiredChangeTtlMs()).toBe(15 * 60 * 1000);
      expect(service.getFrontendUrl()).toBe('http://localhost:5173');
    });

    it('falls back to CORS_ORIGIN when FRONTEND_URL empty', async () => {
      const module = await Test.createTestingModule({
        providers: [
          PasswordPolicyService,
          { provide: DatabaseService, useValue: db },
          {
            provide: ConfigService,
            useValue: mockConfig({
              FRONTEND_URL: '',
              CORS_ORIGIN: 'https://app.example.com/',
            }),
          },
          { provide: MailService, useValue: mail },
        ],
      }).compile();
      const svc = module.get(PasswordPolicyService);
      expect(svc.getFrontendUrl()).toBe('https://app.example.com');
    });

    it('falls back to localhost when FRONTEND_URL empty and CORS_ORIGIN unset', async () => {
      const module = await Test.createTestingModule({
        providers: [
          PasswordPolicyService,
          { provide: DatabaseService, useValue: db },
          {
            provide: ConfigService,
            useValue: mockConfig({ FRONTEND_URL: '' }),
          },
          { provide: MailService, useValue: mail },
        ],
      }).compile();
      const svc = module.get(PasswordPolicyService);
      expect(svc.getFrontendUrl()).toBe('http://localhost:5173');
    });
  });

  describe('isPasswordExpired', () => {
    it('returns true for null, invalid date, and old passwords', () => {
      expect(service.isPasswordExpired(null)).toBe(true);
      expect(service.isPasswordExpired('not-a-date')).toBe(true);
      const old = new Date();
      old.setDate(old.getDate() - 91);
      expect(service.isPasswordExpired(old)).toBe(true);
      expect(service.isPasswordExpired(old.toISOString())).toBe(true);
    });

    it('returns false for recent password_changed_at', () => {
      expect(service.isPasswordExpired(new Date())).toBe(false);
      const recent = new Date();
      recent.setDate(recent.getDate() - 30);
      expect(service.isPasswordExpired(recent)).toBe(false);
    });
  });

  describe('assertNotInHistory', () => {
    it('rejects when password equals current hash', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ password: sha256('Admin123!') }],
      });
      await expect(
        service.assertNotInHistory('u1', 'Admin123!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when password is in history', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password: sha256('Other123!') }] })
        .mockResolvedValueOnce({
          rows: [{ password_hash: sha256('Admin123!') }],
        });
      await expect(
        service.assertNotInHistory('u1', 'Admin123!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes when password is fresh', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password: sha256('OldPass1!') }] })
        .mockResolvedValueOnce({ rows: [] });
      await expect(
        service.assertNotInHistory('u1', 'Admin123!'),
      ).resolves.toBeUndefined();
    });
  });

  describe('pushHistory / setPassword', () => {
    it('inserts and prunes history', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await service.pushHistory('u1', sha256('Admin123!'));
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(String(db.query.mock.calls[0][0])).toMatch(/INSERT/);
      expect(String(db.query.mock.calls[1][0])).toMatch(/DELETE/);
    });

    it('setPassword enforces strength, history, and unlock option', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password: sha256('OldPass1!') }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [], rowCount: 1 });

      await service.setPassword('u1', 'Admin123!', { unlock: true });
      const updateSql = String(
        db.query.mock.calls.find((c) => String(c[0]).includes('UPDATE'))?.[0],
      );
      expect(updateSql).toMatch(/is_locked = FALSE/);
      expect(updateSql).toMatch(/failed_login_attempts = 0/);
    });

    it('setPassword can skip history check', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await service.setPassword('u1', 'Admin123!', { skipHistoryCheck: true });
      const selects = db.query.mock.calls.filter((c) =>
        String(c[0]).includes('SELECT password'),
      );
      expect(selects).toHaveLength(0);
    });

    it('setPassword rejects weak password', async () => {
      await expect(service.setPassword('u1', 'weak')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('lockout helpers', () => {
    it('clearFailedAttempts updates row', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await service.clearFailedAttempts('u1');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/failed_login_attempts = 0/),
        ['u1'],
      );
    });

    it('recordFailedAttempt returns attempts and locked flag', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, is_locked: true }],
      });
      await expect(service.recordFailedAttempt('u1')).resolves.toEqual({
        attempts: 5,
        locked: true,
      });
    });

    it('recordFailedAttempt defaults when no row returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(service.recordFailedAttempt('u1')).resolves.toEqual({
        attempts: 0,
        locked: false,
      });
    });

    it('unlock succeeds and throws when missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await expect(service.unlock('u1')).resolves.toBeUndefined();

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(service.unlock('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reset tokens', () => {
    it('createResetToken invalidates old tokens and inserts new', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const plain = await service.createResetToken('u1', 'forgot', 3600000);
      expect(plain).toHaveLength(64);
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(String(db.query.mock.calls[0][0])).toMatch(/used_at = NOW/);
      expect(String(db.query.mock.calls[1][0])).toMatch(/INSERT/);
    });

    it('consumeResetToken rejects missing/used/wrong purpose/expired', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.consumeResetToken('tok', ['forgot']),
      ).rejects.toThrow(/tidak valid/);

      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            uid_user_system: 'u1',
            purpose: 'forgot',
            expires_at: new Date(Date.now() + 60000),
            used_at: new Date(),
          },
        ],
      });
      await expect(
        service.consumeResetToken('tok', ['forgot']),
      ).rejects.toThrow(/tidak valid/);

      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            uid_user_system: 'u1',
            purpose: 'admin',
            expires_at: new Date(Date.now() + 60000),
            used_at: null,
          },
        ],
      });
      await expect(
        service.consumeResetToken('tok', ['forgot']),
      ).rejects.toThrow(/tidak valid/);

      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            uid_user_system: 'u1',
            purpose: 'forgot',
            expires_at: new Date(Date.now() - 1000),
            used_at: null,
          },
        ],
      });
      await expect(
        service.consumeResetToken('tok', ['forgot']),
      ).rejects.toThrow(/kedaluwarsa/);
    });

    it('consumeResetToken marks token used and returns uid', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: '9',
              uid_user_system: 'u1',
              purpose: 'forgot',
              expires_at: new Date(Date.now() + 60000),
              used_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await expect(
        service.consumeResetToken('plain-token', ['forgot', 'admin']),
      ).resolves.toEqual({
        uid: 'u1',
        purpose: 'forgot',
        tokenId: 9,
      });
    });
  });

  describe('sendResetEmail', () => {
    it('sends forgot email with escaped username', async () => {
      await service.sendResetEmail({
        to: 'a@b.c',
        username: 'user<"&x>',
        plainToken: 'abc',
        purpose: 'forgot',
        ttlHours: 1,
      });
      expect(mail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.c',
          subject: 'Reset Password Akun Anda',
          html: expect.stringContaining('user&lt;&quot;&amp;x&gt;'),
          text: expect.stringContaining('token=abc'),
        }),
      );
    });

    it('sends admin email subject/body', async () => {
      await service.sendResetEmail({
        to: 'a@b.c',
        username: 'admin',
        plainToken: 'tok',
        purpose: 'admin',
        ttlHours: 24,
      });
      expect(mail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Link Reset Password dari Administrator',
          text: expect.stringContaining('Administrator mengirimkan'),
        }),
      );
    });

    it('wraps mail failures as BadRequestException', async () => {
      mail.send.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(
        service.sendResetEmail({
          to: 'a@b.c',
          username: 'admin',
          plainToken: 'tok',
          purpose: 'forgot',
          ttlHours: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
