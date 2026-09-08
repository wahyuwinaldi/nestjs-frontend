import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../src/database/database.service';
import { ActionService } from '../../../src/system/action/action.service';
import { createDbMock, DbMock } from '../../helpers/mock-db';

function menusB64(ids: string[]) {
  return Buffer.from(JSON.stringify(ids)).toString('base64');
}

describe('ActionService', () => {
  let service: ActionService;
  let db: DbMock;

  beforeEach(async () => {
    db = createDbMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = module.get(ActionService);
  });

  it('findAll maps menus', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          kd_action: 'ACT_AC',
          kode: 'AC',
          nm_action: 'Access',
          deskripsi: null,
          menus: ['MN_USER', null],
        },
        {
          kd_action: 'ACT_IN',
          kode: 'IN',
          nm_action: 'Insert',
          deskripsi: 'x',
          menus: null,
        },
      ],
    });
    const rows = await service.findAll();
    expect(rows[0].menus).toEqual(['MN_USER']);
    expect(rows[1].menus).toEqual([]);
  });

  it('create / update / remove', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (
        String(sql).includes('WHERE kd_action = $1') &&
        String(sql).includes('SELECT 1')
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (String(sql).includes('array_agg')) {
        const kd =
          db.txClient.query.mock.calls.find((c) =>
            String(c[0]).includes('INSERT INTO'),
          )?.[1]?.[0] || 'ACT_X';
        return {
          rows: [
            {
              kd_action: kd,
              kode: 'ZZ',
              nm_action: 'Z',
              deskripsi: null,
              menus: ['MN_USER'],
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

    const created = await service.create({
      kode: 'ZZ',
      nm_action: 'Z',
      menus: menusB64(['MN_USER']),
    });
    expect(created.kode).toBe('ZZ');

    await expect(
      service.create({ kode: 'X', nm_action: 'X', menus: '%%%' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        kode: 'X',
        nm_action: 'X',
        menus: Buffer.from(JSON.stringify({ a: 1 })).toString('base64'),
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
    await expect(
      service.create({ kode: 'X', nm_action: 'X' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update not found in tx / after reload', async () => {
    db.txClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      service.update({ kd_action: 'ACT_X', kode: 'X', nm_action: 'X' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.update({
        kd_action: 'ACT_X',
        kode: 'X',
        nm_action: 'X',
        menus: menusB64(['MN_USER']),
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('syncMenus without client uses db.query', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await (service as any).syncMenus('ACT_X', ['MN_USER']);
    expect(db.query).toHaveBeenCalled();
    expect(
      db.query.mock.calls.some((c) => String(c[0]).includes('DELETE FROM')),
    ).toBe(true);
    expect(
      db.query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO')),
    ).toBe(true);
  });

  it('create throws when reload cannot find new action', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT 1')) {
        return { rows: [], rowCount: 0 };
      }
      if (String(sql).includes('array_agg')) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 1 };
    });
    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await expect(
      service.create({
        kode: 'ZZ',
        nm_action: 'Z',
        menus: menusB64(['MN_USER']),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove forbids ACT_AC and missing', async () => {
    await expect(service.remove('ACT_AC')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    db.txClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(service.remove('ACT_X')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await service.remove('ACT_X');
  });
});
