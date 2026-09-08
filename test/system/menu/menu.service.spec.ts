import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../src/database/database.service';
import { MenuService } from '../../../src/system/menu/menu.service';
import { createDbMock, DbMock } from '../../helpers/mock-db';

describe('MenuService', () => {
  let service: MenuService;
  let db: DbMock;

  const flat = [
    {
      kd_menu: 'MN_MAIN',
      nm_menu: 'Main',
      icon_menu: null,
      link_menu: '#',
      kd_parent: null,
      status: 'A',
      level: 1,
      urut: 1,
      urut_global: 1,
    },
    {
      kd_menu: 'MN_USER',
      nm_menu: 'Live',
      icon_menu: 'pi',
      link_menu: '/master/user',
      kd_parent: 'MN_MAIN',
      status: 'A',
      level: 2,
      urut: 1,
      urut_global: 2,
    },
    {
      kd_menu: 'MN_ORPHAN',
      nm_menu: 'Orphan',
      icon_menu: null,
      link_menu: null,
      kd_parent: 'MISSING',
      status: 'N',
      level: 1,
      urut: 1,
      urut_global: 3,
    },
  ];

  beforeEach(async () => {
    db = createDbMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MenuService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = module.get(MenuService);
  });

  it('findFlat / findTree / admin variants', async () => {
    db.query.mockResolvedValue({ rows: flat });
    expect(await service.findFlat()).toEqual(flat);
    const tree = await service.findTree();
    expect(tree[0].kd_menu).toBe('MN_MAIN');
    expect(tree[0].children[0].kd_menu).toBe('MN_USER');
    expect(tree.some((n) => n.kd_menu === 'MN_ORPHAN')).toBe(true);

    expect(await service.findAllAdminTree()).toHaveLength(2);
    expect(
      (await service.findAllAdminFlat(true)).every(
        (r) => r.kd_menu !== 'MN_MAIN',
      ),
    ).toBe(true);
  });

  it('create header and child, fails missing parent / kd collision', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ m: 2 }] })
      .mockResolvedValueOnce({ rows: [{ m: 5 }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ kd_menu: 'MNXXX', nm_menu: 'H', as_header: true }],
      });

    await service.create({ nm_menu: 'Header', as_header: true });

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      service.create({ nm_menu: 'Child', kd_parent: 'NOPE' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    db.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
    await expect(
      service.create({ nm_menu: 'X' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create child under parent with level fallback and default status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ ...flat[0], level: 0 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ m: 1 }] })
      .mockResolvedValueOnce({ rows: [{ m: 3 }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ kd_menu: 'MNCHILD', nm_menu: 'Child', level: 1 }],
      });

    const created = await service.create({
      nm_menu: 'Child',
      kd_parent: 'MN_MAIN',
      icon_menu: 'pi-home',
      link_menu: '/x',
    } as any);
    expect(created.kd_menu).toBe('MNCHILD');
    const insertCall = db.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO'),
    );
    expect(insertCall?.[1]?.[5]).toBe('A');
    expect(insertCall?.[1]?.[6]).toBe(2);

    db.query.mockResolvedValue({ rows: flat });
    expect(await service.findAllAdminFlat(false)).toEqual(flat);

    const tied = [
      { ...flat[0], urut_global: 1, urut: 2 },
      {
        ...flat[1],
        kd_parent: null,
        urut_global: 1,
        urut: 1,
      },
    ];
    db.query.mockResolvedValue({ rows: tied });
    const tree = await service.findTree(false);
    expect(tree[0].urut).toBe(1);
  });

  it('update not found / success', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      service.update({ kd_menu: 'MN_USER', nm_menu: 'X', status: 'A' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [flat[1]] });
    expect(
      (
        await service.update({
          kd_menu: 'MN_USER',
          nm_menu: 'Live',
          status: 'A',
        } as any)
      ).kd_menu,
    ).toBe('MN_USER');

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [flat[1]] });
    await service.update({
      kd_menu: 'MN_USER',
      nm_menu: 'Live',
    } as any);
    const statusArg = db.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE'),
    )?.[1]?.[4];
    expect(statusArg).toBe('A');
  });

  it('updateAll validates payload and partial success', async () => {
    await expect(service.updateAll({ menu: '%%%' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.updateAll({
        menu: Buffer.from(JSON.stringify([])).toString('base64'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAll({
        menu: Buffer.from(JSON.stringify({ a: 1 })).toString('base64'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.txClient.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const partial = await service.updateAll({
      menu: Buffer.from(
        JSON.stringify([
          { kd_menu: 'MN_USER', urut: 1, level: 2, kd_parent: 'MN_MAIN' },
          { kd_menu: 'MN_X', kd_parent: '0' },
          { kd_menu: 'MN_Y', kd_parent: 'null', urut: 0, depth: 0 },
          { urut: 1 },
          {
            kd_menu: 'MN_Z',
            kd_parent: null,
            urut: -1,
            depth: 3,
          },
        ]),
      ).toString('base64'),
    });
    expect(partial.sukses).toBe(2);
    expect(partial.gagal.length).toBeGreaterThan(0);

    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.updateAll({
        menu: Buffer.from(JSON.stringify([{ kd_menu: 'MN_X' }])).toString(
          'base64',
        ),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove forbids MAIN, children, missing; succeeds otherwise', async () => {
    await expect(service.remove('MN_MAIN')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    db.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    await expect(service.remove('MN_USER')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.txClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(service.remove('MN_USER')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.txClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await service.remove('MN_USER');
  });
});
