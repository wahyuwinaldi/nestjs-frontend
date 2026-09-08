import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../../src/database/database.service';
import { PermissionService } from '../../../src/master/permission/permission.service';
import { createDbMock, DbMock } from '../../helpers/mock-db';

function menuB64(pairs: Array<{ menu: string; akses: string }>) {
  return Buffer.from(JSON.stringify(pairs)).toString('base64');
}

describe('PermissionService', () => {
  let service: PermissionService;
  let db: DbMock;

  beforeEach(async () => {
    db = createDbMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = module.get(PermissionService);
  });

  describe('findAll / findByRole / findByUser', () => {
    it('findAll without actor', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS001', kd_menu: 'MN_USER', kode: 'AC' }],
      });
      expect(await service.findAll()).toHaveLength(1);
      expect(db.query.mock.calls[0][1]).toEqual([]);
    });

    it('findAll with actor filters kd_role', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await service.findAll('RS002');
      expect(db.query.mock.calls[0][1]).toEqual(['RS002']);
    });

    it('findAll throws without actor role when empty string', async () => {
      await expect(service.findAll('   ')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('findByRole asserts hierarchy when actor given', async () => {
      await expect(service.findByRole('RS001', 'RS003')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      db.query.mockResolvedValueOnce({
        rows: [{ kd_menu: 'MN_USER', kode: 'AC' }],
      });
      expect(await service.findByRole('RS003', 'RS001')).toHaveLength(1);
    });

    it('findByUser', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ uid_user_system: 'u1', kode: 'AC' }],
      });
      expect(await service.findByUser('u1')).toHaveLength(1);
    });
  });

  describe('grouped / without / action edit', () => {
    it('findGroupedByRole', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ kd_role: 'RS002', nm_role: 'Admin' }],
        })
        .mockResolvedValueOnce({
          rows: [{ menu: 'MN_USER', action: ['ACT_AC'] }],
        });
      const result = await service.findGroupedByRole('RS001');
      expect(result[0].permissions[0].action).toEqual(['ACT_AC']);
    });

    it('findGroupedByRole maps non-array action to []', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ kd_role: 'RS002', nm_role: 'Admin' }],
        })
        .mockResolvedValueOnce({ rows: [{ menu: 'MN_USER', action: null }] });
      expect(
        (await service.findGroupedByRole('RS001'))[0].permissions[0].action,
      ).toEqual([]);
    });

    it('findRolesWithoutPermission', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS004', nm_role: 'X' }],
      });
      expect(await service.findRolesWithoutPermission('RS001')).toHaveLength(1);
    });

    it('getActionEdit with actor hierarchy', async () => {
      await expect(
        service.getActionEdit('RS001', 'RS003'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      db.query.mockResolvedValueOnce({
        rows: [{ menu: 'MN_USER', action: ['ACT_IN'] }],
      });
      expect(await service.getActionEdit('RS003', 'RS001')).toEqual([
        { menu: 'MN_USER', action: ['ACT_IN'] },
      ]);
    });

    it('findGroupedPrivate / findUsersWithoutPrivate / private action edits', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              uid_user_system: 'u1',
              nm_user: 'A',
              username: 'a',
              kd_role: 'RS003',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ menu: 'MN_USER', action: ['ACT_AC'] }],
        });
      expect(
        (await service.findGroupedPrivate('RS001'))[0].permissions,
      ).toHaveLength(1);

      db.query.mockResolvedValueOnce({
        rows: [
          {
            uid_user_system: 'u2',
            nm_user: 'B',
            username: 'b',
            kd_role: 'RS003',
          },
        ],
      });
      expect(await service.findUsersWithoutPrivate('RS001')).toHaveLength(1);

      db.query.mockResolvedValueOnce({
        rows: [{ menu: 'MN_USER', action: null }],
      });
      expect(await service.getActionEditPrivate('u1')).toEqual([
        { menu: 'MN_USER', action: [] },
      ]);

      db.query.mockResolvedValueOnce({
        rows: [{ menu: 'MN_USER', action: ['ACT_UP'] }],
      });
      expect(await service.getActionEditRolePrivate('u1')).toEqual([
        { menu: 'MN_USER', action: ['ACT_UP'] },
      ]);
    });
  });

  describe('nextKdRole', () => {
    it('starts at RS001', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      expect(await service.nextKdRole()).toBe('RS001');
    });

    it('increments last RS code', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ kd_role: 'RS012' }] });
      expect(await service.nextKdRole()).toBe('RS013');
    });

    it('throws when quota exceeded', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ kd_role: 'RS999' }] });
      await expect(service.nextKdRole()).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('uses client when provided', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [{ kd_role: 'RS002' }] }),
      };
      expect(await service.nextKdRole(client as any)).toBe('RS003');
    });
  });

  describe('createRoleWithPermissions', () => {
    it('rejects empty name', async () => {
      await expect(
        service.createRoleWithPermissions({ nm_role: '  ', menu: menuB64([]) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid / non-array menu', async () => {
      await expect(
        service.createRoleWithPermissions({ nm_role: 'X', menu: '%%%' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createRoleWithPermissions({
          nm_role: 'X',
          menu: Buffer.from(JSON.stringify({ menu: 'MN_USER' })).toString(
            'base64',
          ),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createRoleWithPermissions({
          nm_role: 'X',
          menu: Buffer.from(JSON.stringify([null, 'x'])).toString('base64'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('decodes menu/akses from number and boolean; empty for other types', async () => {
      db.txClient.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS004' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.createRoleWithPermissions({
        nm_role: 'Mixed',
        menu: Buffer.from(
          JSON.stringify([
            { menu: 12, akses: true },
            { menu: false, akses: 9 },
            { menu: { x: 1 }, akses: ['a'] },
          ]),
        ).toString('base64'),
      });
      expect(result.kd_role).toBe('RS005');
      expect(result.sukses).toBeGreaterThan(0);
    });

    it('inserts role, seeds MAIN, counts successful inserts', async () => {
      db.txClient.query
        .mockResolvedValueOnce({ rows: [{ kd_role: 'RS004' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.createRoleWithPermissions({
        nm_role: 'Operator',
        menu: menuB64([{ menu: 'MN_USER', akses: 'ACT_IN' }]),
      });

      expect(result.kd_role).toBe('RS005');
      expect(result.sukses).toBe(1);
    });
  });

  describe('updateRoleWithPermissions', () => {
    it('throws when role missing or deleted', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.updateRoleWithPermissions(
          { kd_role: 'RS002', menu: menuB64([]) },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS002', nm_role: 'A', is_deleted: true }],
      });
      await expect(
        service.updateRoleWithPermissions(
          { kd_role: 'RS002', menu: menuB64([]) },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when nm_role becomes empty', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS002', nm_role: 'A', is_deleted: false }],
      });
      await expect(
        service.updateRoleWithPermissions(
          { kd_role: 'RS002', nm_role: '  ', menu: menuB64([]) },
          'RS001',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps existing name and replaces permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ kd_role: 'RS002', nm_role: 'Admin', is_deleted: false }],
      });
      db.txClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.updateRoleWithPermissions(
        {
          kd_role: 'RS002',
          menu: menuB64([{ menu: 'MN_MAIN', akses: 'ACT_AC' }]),
        },
        'RS001',
      );
      expect(result.nm_role).toBe('Admin');
      expect(result.sukses).toBe(1);
    });
  });

  describe('removeRoleAndPermissions', () => {
    it('forbids RS001 and missing/in-use roles', async () => {
      await expect(
        service.removeRoleAndPermissions('RS001', 'RS001'),
      ).rejects.toBeInstanceOf(BadRequestException);

      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.removeRoleAndPermissions('RS002', 'RS001'),
      ).rejects.toBeInstanceOf(NotFoundException);

      db.query
        .mockResolvedValueOnce({
          rows: [{ kd_role: 'RS002', is_deleted: false }],
        })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      await expect(
        service.removeRoleAndPermissions('RS002', 'RS001'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('soft-deletes unused role', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ kd_role: 'RS002', is_deleted: false }],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await service.removeRoleAndPermissions('RS002', 'RS001');
      expect(db.withTransaction).toHaveBeenCalled();
    });
  });

  describe('upsertPrivate / removePrivateByUser', () => {
    it('append vs replace', async () => {
      db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
      expect(
        (
          await service.upsertPrivate(
            { uid_user_system: 'u1', menu: menuB64([]) },
            false,
          )
        ).sukses,
      ).toBeGreaterThanOrEqual(1);

      db.txClient.query.mockClear();
      db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await service.upsertPrivate(
        {
          uid_user_system: 'u1',
          menu: menuB64([{ menu: 'MN_USER', akses: 'ACT_IN' }]),
        },
        true,
      );
      expect(db.txClient.query.mock.calls[0][0]).toMatch(/DELETE/);
    });

    it('removePrivateByUser 404 vs success', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(service.removePrivateByUser('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 2 });
      await service.removePrivateByUser('u1');
    });
  });
});
