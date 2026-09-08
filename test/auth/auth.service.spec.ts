import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { MenuService } from '../../src/system/menu/menu.service';
import { PermissionService } from '../../src/master/permission/permission.service';
import { AuthService } from '../../src/auth/auth.service';
import { PasswordPolicyService } from '../../src/auth/password-policy.service';
import { PasswordExpiredException } from '../../src/auth/password-expired.exception';
import { sha256 } from '../../src/common/crypto.util';
import { createDbMock, DbMock } from '../helpers/mock-db';
import { mockConfig } from '../helpers/mock-config';

describe('AuthService', () => {
  let service: AuthService;
  let db: DbMock;
  let menuService: { findTree: jest.Mock; findFlat: jest.Mock };
  let permissionService: { findByUser: jest.Mock; findByRole: jest.Mock };
  let passwordPolicy: {
    isPasswordExpired: jest.Mock;
    clearFailedAttempts: jest.Mock;
    recordFailedAttempt: jest.Mock;
    createResetToken: jest.Mock;
    consumeResetToken: jest.Mock;
    setPassword: jest.Mock;
    sendResetEmail: jest.Mock;
    getExpiredChangeTtlMs: jest.Mock;
    getForgotResetTtlMs: jest.Mock;
  };

  const activeUser = {
    uid_user_system: '00000000-0000-0000-0000-000000000001',
    nama: 'Administrator',
    username: 'admin',
    email: 'admin@example.com',
    password: sha256('admin123'),
    kd_role: 'RS001',
    nm_role: 'Super Administrator',
    status_user: 'A',
    is_locked: false,
    failed_login_attempts: 0,
    password_changed_at: new Date(),
  };

  const liveMenuTree = [
    {
      kd_menu: 'MN_USER',
      nm_menu: 'Pengguna',
      link_menu: '/master/user',
      children: [],
    },
  ];

  const liveMenuFlat = [
    {
      kd_menu: 'MN_USER',
      nm_menu: 'Pengguna',
      link_menu: '/master/user',
    },
  ];

  beforeEach(async () => {
    db = createDbMock();
    menuService = {
      findTree: jest.fn().mockResolvedValue(liveMenuTree),
      findFlat: jest.fn().mockResolvedValue(liveMenuFlat),
    };
    permissionService = {
      findByUser: jest.fn().mockResolvedValue([]),
      findByRole: jest.fn().mockResolvedValue([
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'AC' },
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'IN' },
      ]),
    };
    passwordPolicy = {
      isPasswordExpired: jest.fn().mockReturnValue(false),
      clearFailedAttempts: jest.fn().mockResolvedValue(undefined),
      recordFailedAttempt: jest
        .fn()
        .mockResolvedValue({ attempts: 1, locked: false }),
      createResetToken: jest.fn().mockResolvedValue('change-token'),
      consumeResetToken: jest.fn().mockResolvedValue({
        uid: activeUser.uid_user_system,
        purpose: 'expired_change',
        tokenId: 1,
      }),
      setPassword: jest.fn().mockResolvedValue(undefined),
      sendResetEmail: jest.fn().mockResolvedValue(undefined),
      getExpiredChangeTtlMs: jest.fn().mockReturnValue(15 * 60 * 1000),
      getForgotResetTtlMs: jest.fn().mockReturnValue(60 * 60 * 1000),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: db },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        { provide: ConfigService, useValue: mockConfig() },
        { provide: MenuService, useValue: menuService },
        { provide: PermissionService, useValue: permissionService },
        { provide: PasswordPolicyService, useValue: passwordPolicy },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('authorize', () => {
    it('returns a signed token, user profile, build_menu and menu', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [activeUser] })
        .mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.token).toBe('signed.jwt.token');
      expect(result.user.username).toBe('admin');
      expect(result.build_menu.length).toBeGreaterThan(0);
      expect(result.menu[0].permissions).toContain('AC');
      expect(passwordPolicy.clearFailedAttempts).toHaveBeenCalled();
    });

    it('throws when the username does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.authorize({ username: 'unknown', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the password is wrong', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });

      await expect(
        service.authorize({ username: 'admin', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordPolicy.recordFailedAttempt).toHaveBeenCalled();
    });

    it('throws when the user is inactive', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...activeUser, status_user: 'E' }],
      });

      await expect(
        service.authorize({ username: 'admin', password: 'admin123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when account is locked', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...activeUser, is_locked: true }],
      });

      await expect(
        service.authorize({ username: 'admin', password: 'admin123' }),
      ).rejects.toThrow(/terkunci/i);
    });

    it('throws PasswordExpiredException when password age exceeded', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      passwordPolicy.isPasswordExpired.mockReturnValue(true);

      await expect(
        service.authorize({ username: 'admin', password: 'admin123' }),
      ).rejects.toBeInstanceOf(PasswordExpiredException);
    });

    it('throws locked message when failed attempt reaches threshold', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      passwordPolicy.recordFailedAttempt.mockResolvedValueOnce({
        attempts: 5,
        locked: true,
      });

      await expect(
        service.authorize({ username: 'admin', password: 'wrong' }),
      ).rejects.toThrow(/terkunci/i);
    });
  });

  describe('buildMenuPayloadForUid', () => {
    it('returns empty menus when the user is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.buildMenuPayloadForUid(
        activeUser.uid_user_system,
      );

      expect(result).toEqual({ build_menu: [], menu: [] });
    });

    it('builds payload when the user exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });

      const result = await service.buildMenuPayloadForUid(
        activeUser.uid_user_system,
      );

      expect(result.build_menu.length).toBeGreaterThan(0);
      expect(result.menu[0].permissions).toContain('AC');
    });
  });

  describe('buildMenuPayload / filterMenuTree', () => {
    it('uses private permissions when findByUser returns rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      permissionService.findByUser.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.menu[0].permissions).toEqual(['AC']);
    });

    it('prunes tree nodes without AC even if children have AC', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      menuService.findTree.mockResolvedValueOnce([
        {
          kd_menu: 'MN_PARENT',
          nm_menu: 'Parent',
          link_menu: '/parent',
          children: [
            {
              kd_menu: 'MN_USER',
              nm_menu: 'Pengguna',
              link_menu: '/master/user',
              children: [],
            },
          ],
        },
      ]);
      menuService.findFlat.mockResolvedValueOnce([
        { kd_menu: 'MN_PARENT', nm_menu: 'Parent', link_menu: '/parent' },
        {
          kd_menu: 'MN_USER',
          nm_menu: 'Pengguna',
          link_menu: '/master/user',
        },
      ]);
      permissionService.findByRole.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.build_menu).toEqual([]);
    });

    it('falls back to rowNm when flat menu meta is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      menuService.findFlat.mockResolvedValueOnce([]);
      permissionService.findByRole.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.menu[0].nm_menu).toBe('MN_USER');
      expect(result.menu[0].link_menu).toBeNull();
    });

    it('uses nm_menu from permission row when flat meta is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      menuService.findFlat.mockResolvedValueOnce([]);
      permissionService.findByRole.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', nm_menu: 'From Perm', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.menu[0].nm_menu).toBe('From Perm');
    });

    it('keeps nested children that have AC', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      menuService.findTree.mockResolvedValueOnce([
        {
          kd_menu: 'MN_USER',
          nm_menu: 'Pengguna',
          link_menu: '/master/user',
          children: [
            {
              kd_menu: 'MN_CHILD',
              nm_menu: 'Child',
              link_menu: '/child',
              children: [],
            },
          ],
        },
      ]);
      menuService.findFlat.mockResolvedValueOnce([
        {
          kd_menu: 'MN_USER',
          nm_menu: 'Pengguna',
          link_menu: '/master/user',
        },
        { kd_menu: 'MN_CHILD', nm_menu: 'Child', link_menu: '/child' },
      ]);
      permissionService.findByRole.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'AC' },
        { kd_menu: 'MN_CHILD', nm_menu: 'Child', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.build_menu[0].children).toHaveLength(1);
      expect(result.build_menu[0].children[0].kd_menu).toBe('MN_CHILD');
    });

    it('treats missing children as empty array', async () => {
      db.query.mockResolvedValueOnce({ rows: [activeUser] });
      menuService.findTree.mockResolvedValueOnce([
        {
          kd_menu: 'MN_USER',
          nm_menu: 'Pengguna',
          link_menu: '/master/user',
          // children intentionally omitted
        } as any,
      ]);
      menuService.findFlat.mockResolvedValueOnce([
        {
          kd_menu: 'MN_USER',
          nm_menu: 'Pengguna',
          link_menu: '/master/user',
        },
      ]);
      permissionService.findByRole.mockResolvedValueOnce([
        { kd_menu: 'MN_USER', nm_menu: 'Pengguna', kode: 'AC' },
      ]);

      const result = await service.authorize({
        username: 'admin',
        password: 'admin123',
      });
      expect(result.build_menu[0].children).toEqual([]);
    });
  });

  describe('changeExpiredPassword', () => {
    const dto = {
      change_token: 'tok',
      new_password: 'Admin123!',
      confirm_password: 'Admin123!',
    };

    it('rejects mismatched confirm password', async () => {
      await expect(
        service.changeExpiredPassword({
          ...dto,
          confirm_password: 'Other123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects weak password', async () => {
      await expect(
        service.changeExpiredPassword({
          ...dto,
          new_password: 'weak',
          confirm_password: 'weak',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('consumes token and sets password with unlock', async () => {
      const result = await service.changeExpiredPassword(dto);
      expect(passwordPolicy.consumeResetToken).toHaveBeenCalledWith('tok', [
        'expired_change',
      ]);
      expect(passwordPolicy.setPassword).toHaveBeenCalledWith(
        activeUser.uid_user_system,
        'Admin123!',
        { unlock: true },
      );
      expect(result.message).toMatch(/berhasil/i);
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message for blank identifier', async () => {
      const result = await service.forgotPassword({ username_or_email: '  ' });
      expect(result.message).toMatch(/Jika akun ditemukan/i);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns generic when user missing / inactive / locked / no email', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.forgotPassword({ username_or_email: 'x' }),
      ).resolves.toMatchObject({ message: expect.stringMatching(/Jika akun/) });

      db.query.mockResolvedValueOnce({
        rows: [
          {
            uid_user_system: 'u1',
            username: 'a',
            email: 'a@b.c',
            status_user: 'N',
            is_locked: false,
          },
        ],
      });
      await expect(
        service.forgotPassword({ username_or_email: 'a' }),
      ).resolves.toMatchObject({ message: expect.stringMatching(/Jika akun/) });

      db.query.mockResolvedValueOnce({
        rows: [
          {
            uid_user_system: 'u1',
            username: 'a',
            email: 'a@b.c',
            status_user: 'A',
            is_locked: true,
          },
        ],
      });
      await expect(
        service.forgotPassword({ username_or_email: 'a' }),
      ).resolves.toMatchObject({ message: expect.stringMatching(/Jika akun/) });

      db.query.mockResolvedValueOnce({
        rows: [
          {
            uid_user_system: 'u1',
            username: 'a',
            email: null,
            status_user: 'A',
            is_locked: false,
          },
        ],
      });
      await expect(
        service.forgotPassword({ username_or_email: 'a' }),
      ).resolves.toMatchObject({ message: expect.stringMatching(/Jika akun/) });
    });

    it('creates token and sends email for eligible user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            uid_user_system: activeUser.uid_user_system,
            username: 'admin',
            email: ' admin@example.com ',
            status_user: 'A',
            is_locked: false,
          },
        ],
      });
      passwordPolicy.createResetToken.mockResolvedValueOnce('forgot-tok');

      const result = await service.forgotPassword({
        username_or_email: 'admin',
      });
      expect(passwordPolicy.createResetToken).toHaveBeenCalledWith(
        activeUser.uid_user_system,
        'forgot',
        60 * 60 * 1000,
      );
      expect(passwordPolicy.sendResetEmail).toHaveBeenCalledWith({
        to: 'admin@example.com',
        username: 'admin',
        plainToken: 'forgot-tok',
        purpose: 'forgot',
        ttlHours: 1,
      });
      expect(result.message).toMatch(/Jika akun ditemukan/i);
    });
  });

  describe('resetPassword', () => {
    const dto = {
      token: 'reset-tok',
      new_password: 'Admin123!',
      confirm_password: 'Admin123!',
    };

    it('rejects mismatched confirm and weak password', async () => {
      await expect(
        service.resetPassword({ ...dto, confirm_password: 'Other123!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.resetPassword({
          ...dto,
          new_password: 'weak',
          confirm_password: 'weak',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('consumes forgot/admin token and sets password unlocked', async () => {
      passwordPolicy.consumeResetToken.mockResolvedValueOnce({
        uid: activeUser.uid_user_system,
        purpose: 'admin',
        tokenId: 2,
      });
      const result = await service.resetPassword(dto);
      expect(passwordPolicy.consumeResetToken).toHaveBeenCalledWith(
        'reset-tok',
        ['forgot', 'admin'],
      );
      expect(passwordPolicy.setPassword).toHaveBeenCalledWith(
        activeUser.uid_user_system,
        'Admin123!',
        { unlock: true },
      );
      expect(result.message).toMatch(/berhasil/i);
    });
  });

  describe('changePassword', () => {
    const dto = {
      current_password: 'admin123',
      new_password: 'Admin123!',
      confirm_password: 'Admin123!',
    };

    it('throws when confirm does not match', async () => {
      await expect(
        service.changePassword(activeUser.uid_user_system, {
          ...dto,
          confirm_password: 'Other123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when new password equals current', async () => {
      await expect(
        service.changePassword(activeUser.uid_user_system, {
          current_password: 'Admin123!',
          new_password: 'Admin123!',
          confirm_password: 'Admin123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when new password is weak', async () => {
      await expect(
        service.changePassword(activeUser.uid_user_system, {
          current_password: 'admin123',
          new_password: 'weak',
          confirm_password: 'weak',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when user is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.changePassword(activeUser.uid_user_system, dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when user is inactive', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { password: sha256('admin123'), status_user: 'E', is_locked: false },
        ],
      });

      await expect(
        service.changePassword(activeUser.uid_user_system, dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when account is locked', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { password: sha256('admin123'), status_user: 'A', is_locked: true },
        ],
      });

      await expect(
        service.changePassword(activeUser.uid_user_system, dto),
      ).rejects.toThrow(/terkunci/i);
    });

    it('throws when current password is wrong', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { password: sha256('other'), status_user: 'A', is_locked: false },
        ],
      });

      await expect(
        service.changePassword(activeUser.uid_user_system, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates password on success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            password: sha256('admin123'),
            status_user: 'A',
            is_locked: false,
          },
        ],
      });

      const result = await service.changePassword(
        activeUser.uid_user_system,
        dto,
      );

      expect(result.message).toMatch(/berhasil/i);
      expect(passwordPolicy.setPassword).toHaveBeenCalledWith(
        activeUser.uid_user_system,
        dto.new_password,
      );
    });
  });
});
