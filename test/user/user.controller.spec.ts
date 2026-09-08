import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '../../src/user/user.controller';
import { UserService } from '../../src/user/user.service';

describe('UserController', () => {
  let controller: UserController;
  let service: Record<string, jest.Mock>;
  const req = { user: { sub: 'u1', role: 'RS001' } } as any;

  beforeEach(async () => {
    service = {
      findAllAdmin: jest.fn().mockResolvedValue([{ username: 'a' }]),
      findRoles: jest.fn().mockResolvedValue([{ kd_role: 'RS003' }]),
      create: jest.fn().mockResolvedValue({ username: 'n' }),
      update: jest.fn().mockResolvedValue({ username: 'u' }),
      remove: jest.fn().mockResolvedValue(undefined),
      unlock: jest.fn().mockResolvedValue({ username: 'a', is_locked: false }),
      sendResetEmail: jest
        .fn()
        .mockResolvedValue({ message: 'Email reset password telah dikirim' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: service }],
    }).compile();
    controller = module.get(UserController);
  });

  it('delegates all endpoints', async () => {
    expect((await controller.findAll(req)).data[0].username).toBe('a');
    expect((await controller.findRoles(req)).data[0].kd_role).toBe('RS003');
    expect(
      (await controller.create(req, { username: 'n' } as any)).data.username,
    ).toBe('n');
    expect(
      (await controller.update(req, { uid_user_system: 'u1' } as any)).data
        .username,
    ).toBe('u');
    expect(
      (await controller.unlock(req, { uid_user_system: 'u1' })).data.username,
    ).toBe('a');
    expect(
      (await controller.sendResetEmail(req, { uid_user_system: 'u1' })).data
        .message,
    ).toMatch(/dikirim/i);
    expect(
      (await controller.remove(req, { uid_user_system: 'u1' })).data,
    ).toEqual({ uid_user_system: 'u1' });
  });
});
