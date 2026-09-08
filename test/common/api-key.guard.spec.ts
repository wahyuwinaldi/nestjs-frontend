import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard';

function makeCtx(headers: Record<string, string> = {}) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };

  it('allows public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      { get: () => 'token' } as unknown as ConfigService,
    );
    expect(guard.canActivate(makeCtx())).toBe(true);
  });

  it('skips when API_TOKEN is not configured', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      { get: () => undefined } as unknown as ConfigService,
    );
    expect(guard.canActivate(makeCtx())).toBe(true);

    const empty = new ApiKeyGuard(
      reflector as unknown as Reflector,
      { get: () => '' } as unknown as ConfigService,
    );
    expect(empty.canActivate(makeCtx())).toBe(true);
  });

  it('accepts matching x-api-key', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      { get: () => 'secret' } as unknown as ConfigService,
    );
    expect(guard.canActivate(makeCtx({ 'x-api-key': 'secret' }))).toBe(true);
  });

  it('rejects missing or wrong key', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      { get: () => 'secret' } as unknown as ConfigService,
    );
    expect(() => guard.canActivate(makeCtx())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeCtx({ 'x-api-key': 'nope' }))).toThrow(
      UnauthorizedException,
    );
  });
});
