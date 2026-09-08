import { Test, TestingModule } from '@nestjs/testing';
import { PermissionController } from '../../../src/master/permission/permission.controller';
import { PermissionService } from '../../../src/master/permission/permission.service';

describe('PermissionController', () => {
  let controller: PermissionController;
  let service: Record<string, jest.Mock>;
  const req = { user: { role: 'RS001' } } as any;

  beforeEach(async () => {
    service = {
      findGroupedByRole: jest.fn().mockResolvedValue(['g']),
      findByRole: jest.fn().mockResolvedValue(['r']),
      findAll: jest.fn().mockResolvedValue(['a']),
      findRolesWithoutPermission: jest.fn().mockResolvedValue(['w']),
      getActionEdit: jest.fn().mockResolvedValue(['e']),
      createRoleWithPermissions: jest
        .fn()
        .mockResolvedValue({ kd_role: 'RS004' }),
      updateRoleWithPermissions: jest
        .fn()
        .mockResolvedValue({ kd_role: 'RS002' }),
      removeRoleAndPermissions: jest.fn().mockResolvedValue(undefined),
      findGroupedPrivate: jest.fn().mockResolvedValue(['pg']),
      findByUser: jest.fn().mockResolvedValue(['pu']),
      findUsersWithoutPrivate: jest.fn().mockResolvedValue(['nu']),
      getActionEditPrivate: jest.fn().mockResolvedValue(['ep']),
      getActionEditRolePrivate: jest.fn().mockResolvedValue(['erp']),
      upsertPrivate: jest.fn().mockResolvedValue({ sukses: 1 }),
      removePrivateByUser: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionController],
      providers: [{ provide: PermissionService, useValue: service }],
    }).compile();
    controller = module.get(PermissionController);
  });

  it('findAll query branches', async () => {
    expect((await controller.findAll(req, undefined, 'true')).data).toEqual([
      'g',
    ]);
    expect((await controller.findAll(req, undefined, '1')).data).toEqual(['g']);
    expect((await controller.findAll(req, 'RS002')).data).toEqual(['r']);
    expect((await controller.findAll(req)).data).toEqual(['a']);
  });

  it('role / action_edit / crud public', async () => {
    expect((await controller.rolesWithout(req)).data).toEqual(['w']);
    expect((await controller.actionEdit(req, 'RS002')).data).toEqual(['e']);
    expect(
      (await controller.create({ nm_role: 'X', menu: 'b64' } as any)).data
        .kd_role,
    ).toBe('RS004');
    expect(
      (await controller.update(req, { kd_role: 'RS002', menu: 'b64' } as any))
        .data.kd_role,
    ).toBe('RS002');
    expect((await controller.remove(req, { kd_role: 'RS002' })).data).toEqual({
      kd_role: 'RS002',
    });
  });

  it('private branches', async () => {
    expect((await controller.findPrivate(req, undefined, 'true')).data).toEqual(
      ['pg'],
    );
    expect((await controller.findPrivate(req, 'u1')).data).toEqual(['pu']);
    expect((await controller.findPrivate(req)).data).toEqual(['pg']);
    expect((await controller.usersWithoutPrivate(req)).data).toEqual(['nu']);
    expect((await controller.actionEditPrivate('u1')).data).toEqual(['ep']);
    expect((await controller.actionEditRolePrivate('u1')).data).toEqual([
      'erp',
    ]);
    expect(
      (await controller.createPrivate({ uid_user_system: 'u1', menu: 'b64' }))
        .data.sukses,
    ).toBe(1);
    expect(service.upsertPrivate).toHaveBeenCalledWith(
      expect.anything(),
      false,
    );
    await controller.updatePrivate({ uid_user_system: 'u1', menu: 'b64' });
    expect(service.upsertPrivate).toHaveBeenCalledWith(expect.anything(), true);
    expect(
      (await controller.removePrivate({ uid_user_system: 'u1' })).data,
    ).toEqual({ uid_user_system: 'u1' });
  });
});
