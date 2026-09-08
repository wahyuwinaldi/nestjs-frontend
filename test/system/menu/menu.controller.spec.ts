import { Test, TestingModule } from '@nestjs/testing';
import { MenuController } from '../../../src/system/menu/menu.controller';
import { MenuService } from '../../../src/system/menu/menu.service';

describe('MenuController', () => {
  let controller: MenuController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findTree: jest.fn().mockResolvedValue([{ kd_menu: 'MN_MAIN' }]),
      findFlat: jest.fn().mockResolvedValue([{ kd_menu: 'MN_USER' }]),
      findAllAdminFlat: jest.fn().mockResolvedValue([{ kd_menu: 'MN_MAIN' }]),
      findAllAdminTree: jest
        .fn()
        .mockResolvedValue([{ kd_menu: 'MN_MAIN', children: [] }]),
      create: jest.fn().mockResolvedValue({ kd_menu: 'MNX' }),
      updateAll: jest.fn().mockResolvedValue({ sukses: 1, gagal: [] }),
      update: jest.fn().mockResolvedValue({ kd_menu: 'MN_USER' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenuController],
      providers: [{ provide: MenuService, useValue: service }],
    }).compile();
    controller = module.get(MenuController);
  });

  it('tree/flat/all/crud', async () => {
    expect((await controller.tree()).data[0].kd_menu).toBe('MN_MAIN');
    expect((await controller.flat()).data[0].kd_menu).toBe('MN_USER');
    expect((await controller.findAll('true')).data[0].kd_menu).toBe('MN_MAIN');
    expect((await controller.findAll('1')).data[0].kd_menu).toBe('MN_MAIN');
    expect((await controller.findAll()).data[0].children).toEqual([]);
    expect(
      (await controller.create({ nm_menu: 'X' } as any)).data.kd_menu,
    ).toBe('MNX');
    expect((await controller.updateAll({ menu: 'b64' })).data.sukses).toBe(1);
    expect(
      (await controller.update({ kd_menu: 'MN_USER', nm_menu: 'L' } as any))
        .data.kd_menu,
    ).toBe('MN_USER');
    expect((await controller.remove({ kd_menu: 'MN_USER' })).data).toEqual({
      kd_menu: 'MN_USER',
    });
  });
});
