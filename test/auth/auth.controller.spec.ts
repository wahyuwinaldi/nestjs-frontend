import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { mockConfig } from '../helpers/mock-config';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: {
    authorize: jest.Mock;
    buildMenuPayloadForUid: jest.Mock;
    changePassword: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    changeExpiredPassword: jest.Mock;
  };

  beforeEach(async () => {
    auth = {
      authorize: jest.fn().mockResolvedValue({
        token: 'jwt',
        user: { username: 'admin' },
        build_menu: [],
        menu: [],
      }),
      buildMenuPayloadForUid: jest
        .fn()
        .mockResolvedValue({ build_menu: [1], menu: [2] }),
      changePassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      forgotPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Jika akun ditemukan' }),
      resetPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password berhasil diubah' }),
      changeExpiredPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password expired diubah' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: mockConfig({ AES_KEY: 'secret', NODE_ENV: 'test' }),
        },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  it('authorize sets httpOnly cookie', async () => {
    const reply = { setCookie: jest.fn() };
    const result = await controller.authorize(
      { username: 'admin', password: 'x' },
      reply as any,
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      user: { username: 'admin' },
      build_menu: [],
      menu: [],
    });
    expect(reply.setCookie).toHaveBeenCalledWith(
      'token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: false,
        maxAge: 60 * 60 * 8,
      }),
    );
  });

  it('authorize uses secure cookie in production', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: mockConfig({ AES_KEY: 'secret', NODE_ENV: 'production' }),
        },
      ],
    }).compile();
    const prod = module.get(AuthController);
    const reply = { setCookie: jest.fn() };
    await prod.authorize({ username: 'a', password: 'b' }, reply as any);
    expect(reply.setCookie.mock.calls[0][2].secure).toBe(true);
  });

  it('authorize falls back to empty AES_KEY when config missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: mockConfig({ NODE_ENV: 'test' }) },
      ],
    }).compile();
    const ctrl = module.get(AuthController);
    const reply = { setCookie: jest.fn() };
    const result = await ctrl.authorize(
      { username: 'a', password: 'b' },
      reply as any,
    );
    expect(result.success).toBe(true);
    expect(reply.setCookie).toHaveBeenCalled();
  });

  it('forgotPassword delegates to authService', async () => {
    const dto = { username_or_email: 'super' };
    const result = await controller.forgotPassword(dto);
    expect(auth.forgotPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      success: true,
      error: null,
      data: { message: 'Jika akun ditemukan' },
    });
  });

  it('resetPassword delegates to authService', async () => {
    const dto = {
      token: 'tok',
      new_password: 'Admin123!',
      confirm_password: 'Admin123!',
    };
    const result = await controller.resetPassword(dto);
    expect(auth.resetPassword).toHaveBeenCalledWith(dto);
    expect(result.data).toEqual({ message: 'Password berhasil diubah' });
  });

  it('changeExpiredPassword delegates to authService', async () => {
    const dto = {
      change_token: 'chg',
      new_password: 'Admin123!',
      confirm_password: 'Admin123!',
    };
    const result = await controller.changeExpiredPassword(dto);
    expect(auth.changeExpiredPassword).toHaveBeenCalledWith(dto);
    expect(result.data).toEqual({ message: 'Password expired diubah' });
  });

  it('sessionMenu empty without sub', async () => {
    expect(await controller.sessionMenu({} as any)).toEqual({
      success: true,
      error: null,
      data: { build_menu: [], menu: [] },
    });
    expect(
      await controller.sessionMenu({ user: {} } as any),
    ).toEqual({
      success: true,
      error: null,
      data: { build_menu: [], menu: [] },
    });
    expect(auth.buildMenuPayloadForUid).not.toHaveBeenCalled();

    const result = await controller.sessionMenu({ user: { sub: 'u1' } } as any);
    expect(auth.buildMenuPayloadForUid).toHaveBeenCalledWith('u1');
    expect(result.data).toEqual({ build_menu: [1], menu: [2] });
  });

  it('changePassword requires sub', async () => {
    await expect(
      controller.changePassword(
        {} as any,
        {
          current_password: 'a',
          new_password: 'b',
          confirm_password: 'b',
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      controller.changePassword(
        { user: {} } as any,
        {
          current_password: 'a',
          new_password: 'b',
          confirm_password: 'b',
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const dto = {
      current_password: 'a',
      new_password: 'b',
      confirm_password: 'b',
    } as any;
    const result = await controller.changePassword(
      { user: { sub: 'u1' } } as any,
      dto,
    );
    expect(auth.changePassword).toHaveBeenCalledWith('u1', dto);
    expect(result.success).toBe(true);
  });

  it('logout clears cookie', () => {
    const reply = { clearCookie: jest.fn() };
    const result = controller.logout(reply as any);
    expect(reply.clearCookie).toHaveBeenCalledWith('token', { path: '/' });
    expect(result.data).toEqual({ message: 'Logged out' });
  });
});
