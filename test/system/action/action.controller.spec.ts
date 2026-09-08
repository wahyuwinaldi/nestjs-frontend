import { Test, TestingModule } from '@nestjs/testing';
import { ActionController } from '../../../src/system/action/action.controller';
import { ActionService } from '../../../src/system/action/action.service';

describe('ActionController', () => {
  let controller: ActionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionController],
      providers: [
        {
          provide: ActionService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([{ kd_action: 'ACT_AC' }]),
            create: jest.fn().mockResolvedValue({ kd_action: 'ACT_X' }),
            update: jest.fn().mockResolvedValue({ kd_action: 'ACT_X' }),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    controller = module.get(ActionController);
  });

  it('CRUD', async () => {
    expect((await controller.findAll()).data[0].kd_action).toBe('ACT_AC');
    expect(
      (await controller.create({ kode: 'X', nm_action: 'X' } as any)).data
        .kd_action,
    ).toBe('ACT_X');
    expect(
      (
        await controller.update({
          kd_action: 'ACT_X',
          kode: 'X',
          nm_action: 'X',
        } as any)
      ).data.kd_action,
    ).toBe('ACT_X');
    expect((await controller.remove({ kd_action: 'ACT_X' })).data).toEqual({
      kd_action: 'ACT_X',
    });
  });
});
