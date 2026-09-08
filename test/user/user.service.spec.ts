import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';
import { PasswordPolicyService } from '../../src/auth/password-policy.service';
import { UserService } from '../../src/user/user.service';
import { createDbMock, DbMock } from '../helpers/mock-db';
import { createActor } from '../helpers/mock-actor';
import { mockConfig } from '../helpers/mock-config';

describe('UserService', () => {
  let service: UserService;
  let db: DbMock;
  let passwordPolicy: {
    pushHistory: jest.Mock;
    assertNotInHistory: jest.Mock;
    unlock: jest.Mock;
    createResetToken: jest.Mock;
    sendResetEmail: jest.Mock;
    getAdminResetTtlMs: jest.Mock;
  };

  const actor = createActor();
  const adminRow = {
    uid_user_system: 'u1',
    nama: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    kd_role: 'RS003',
    nm_role: 'User',
    status_user: 'A',
    is_deleted: false,
    is_locked: false,
    failed_login_attempts: 0,
    password_changed_at: new Date(),
  };

  beforeEach(async () => {
    db = createDbMock();
    passwordPolicy = {
      pushHistory: jest.fn().mockResolvedValue(undefined),
      assertNotInHistory: jest.fn().mockResolvedValue(undefined),
      unlock: jest.fn().mockResolvedValue(undefined),
      createResetToken: jest.fn().mockResolvedValue('token'),
      sendResetEmail: jest.fn().mockResolvedValue(undefined),
      getAdminResetTtlMs: jest.fn().mockReturnValue(24 * 60 * 60 * 1000),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DatabaseService, useValue: db },
        { provide: PasswordPolicyService, useValue: passwordPolicy },
        { provide: ConfigService, useValue: mockConfig() },
      ],
    }).compile();

    service = module.get(UserService);
  });

  describe('findAllAdmin / findRoles / resolveActorRole', () => {
    it('uses DB role by sub then lists users', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS001' }] })
        .mockResolvedValueOnce({
          rows: [
            adminRow,
            {
              ...adminRow,
              uid_user_system: 'u2',
              status_user: 'N',
              is_deleted: true,
            },
          ],
        });

      const rows = await service.findAllAdmin(actor);
      expect(rows[0].status).toBe('A');
      expect(rows[1].status).toBe('N');
    });

    it('falls back to JWT role when DB miss', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      await service.findAllAdmin(actor);
      expect(db.query.mock.calls[1][1]).toEqual(['RS001']);
    });

    it('accepts actor as string', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await service.findAllAdmin('RS002');
      expect(db.query.mock.calls[0][1]).toEqual(['RS002']);
    });

    it('throws when role cannot be resolved', async () => {
      await expect(service.findAllAdmin({})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('findRoles', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS003', nm_role: 'User' }],
      });
      expect(await service.findRoles('RS001')).toEqual([
        { kd_role: 'RS003', nm_role: 'User' },
      ]);
    });
  });

  describe('create', () => {
    it('creates user after uniqueness/role/password checks', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockImplementationOnce(async () => {
          const uid = db.query.mock.calls.find((c) =>
            String(c[0]).includes('INSERT'),
          )?.[1]?.[0];
          return { rows: [{ ...adminRow, uid_user_system: uid }] };
        });

      const result = await service.create(
        {
          username: 'newuser',
          nama: 'New',
          kd_role: 'RS003',
          password: 'Admin123!',
          status: 'A',
        },
        'RS001',
      );
      expect(result.username).toBe('admin');
    });

    it('creates with status N and optional email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockImplementationOnce(async () => {
          const uid = db.query.mock.calls.find((c) =>
            String(c[0]).includes('INSERT'),
          )?.[1]?.[0];
          return {
            rows: [{ ...adminRow, uid_user_system: uid, status_user: 'N' }],
          };
        });

      const result = await service.create(
        {
          username: 'inactive',
          nama: 'Inact',
          email: '  ',
          kd_role: 'RS003',
          password: 'Admin123!',
          status: 'N',
        },
        'RS001',
      );
      expect(result.status).toBe('N');
      const insert = db.query.mock.calls.find((c) =>
        String(c[0]).includes('INSERT INTO'),
      );
      expect(insert?.[1]?.[2]).toBeNull();
      expect(insert?.[1]?.[6]).toBe('N');
    });

    it('getById throws when user missing from admin list', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        (service as any).getById('missing', 'RS001'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects duplicate username, missing role, weak password', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ uid_user_system: 'x' }] });
      await expect(
        service.create(
          {
            username: 'admin',
            nama: 'A',
            kd_role: 'RS003',
            password: 'Admin123!',
          },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(
        service.create(
          {
            username: 'x',
            nama: 'A',
            kd_role: 'RS009',
            password: 'Admin123!',
          },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      await expect(
        service.create(
          {
            username: 'x',
            nama: 'A',
            kd_role: 'RS003',
            password: 'weak',
          },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update / remove', () => {
    it('throws when no fields changed', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] });
      await expect(
        service.update({ uid_user_system: 'u1', password: '   ' }, 'RS001'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates all fields including password and status N', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ ...adminRow, username: 'n', status_user: 'N' }],
        });

      const result = await service.update(
        {
          uid_user_system: 'u1',
          username: 'n',
          email: '  ',
          nama: 'Name',
          kd_role: 'RS003',
          password: 'Admin123!',
          status: 'N',
        },
        'RS001',
      );
      expect(result.status).toBe('N');
      expect(passwordPolicy.assertNotInHistory).toHaveBeenCalled();
      expect(passwordPolicy.pushHistory).toHaveBeenCalled();
    });

    it('unlock clears lock flag', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({ rows: [adminRow] });
      const result = await service.unlock('u1', 'RS001');
      expect(passwordPolicy.unlock).toHaveBeenCalledWith('u1');
      expect(result.username).toBe('admin');
    });

    it('sendResetEmail requires email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              username: 'admin',
              email: null,
              status_user: 'A',
              is_deleted: false,
            },
          ],
        });
      await expect(service.sendResetEmail('u1', 'RS001')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sendResetEmail rejects missing or deleted user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({ rows: [] });
      await expect(service.sendResetEmail('u1', 'RS001')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              username: 'admin',
              email: 'a@b.c',
              status_user: 'A',
              is_deleted: true,
            },
          ],
        });
      await expect(service.sendResetEmail('u1', 'RS001')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sendResetEmail sends mail when email present', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              username: 'admin',
              email: 'admin@example.com',
              status_user: 'A',
              is_deleted: false,
            },
          ],
        });
      const result = await service.sendResetEmail('u1', 'RS001');
      expect(result.message).toMatch(/dikirim/i);
      expect(passwordPolicy.sendResetEmail).toHaveBeenCalled();
    });

    it('remove success / not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await service.remove('u1', 'RS001');

      db.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS003' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(service.remove('u1', 'RS001')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('getUserRole not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.update({ uid_user_system: 'missing', username: 'x' }, 'RS001'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

});
