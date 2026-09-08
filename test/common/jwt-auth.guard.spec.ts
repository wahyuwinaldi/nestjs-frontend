import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const ctx = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  it('allows public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('defers to AuthGuard when not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const superActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true as any);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(superActivate).toHaveBeenCalledWith(ctx);
    superActivate.mockRestore();
  });
});
