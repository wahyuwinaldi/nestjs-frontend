import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { aesEncrypt } from '../../src/common/crypto.util';

describe('JwtStrategy', () => {
  function makeConfig(map: Record<string, string | undefined> = {}) {
    return {
      get: jest.fn((key: string, fallback?: string) => {
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
        if (key === 'AES_KEY') return 'aes-secret';
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return fallback;
      }),
    } as unknown as ConfigService;
  }

  it('validate returns the payload', () => {
    const strategy = new JwtStrategy(makeConfig());
    const payload = { sub: 'u1', username: 'admin', role: 'RS001' };
    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('uses JWT_SECRET fallback when config omits the key', () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'AES_KEY') return 'aes-secret';
        if (key === 'JWT_SECRET') return fallback;
        return fallback;
      }),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);
    expect(config.get).toHaveBeenCalledWith('JWT_SECRET', 'dev-secret');
    expect(strategy.validate({ sub: 'u', username: 'a', role: 'R' })).toEqual({
      sub: 'u',
      username: 'a',
      role: 'R',
    });
  });

  it('cookie extractor decrypts token cookie', () => {
    const strategy = new JwtStrategy(makeConfig());
    const fn = (strategy as any)._jwtFromRequest as (req: any) => string | null;
    const encrypted = aesEncrypt('plain.jwt', 'aes-secret');
    expect(fn({ headers: {}, cookies: { token: encrypted } })).toBe(
      'plain.jwt',
    );
  });

  it('cookie extractor returns null without cookie or on decrypt failure', () => {
    const strategy = new JwtStrategy(makeConfig());
    const fn = (strategy as any)._jwtFromRequest as (req: any) => string | null;
    expect(fn({ headers: {} })).toBeNull();
    expect(fn({ headers: {}, cookies: {} })).toBeNull();
    expect(fn({ headers: {}, cookies: { token: 'not-valid' } })).toBeNull();
  });

  it('cookie extractor uses empty AES_KEY fallback', () => {
    const strategy = new JwtStrategy(makeConfig({ AES_KEY: undefined }));
    const fn = (strategy as any)._jwtFromRequest as (req: any) => string | null;
    expect(fn({ headers: {}, cookies: { token: 'anything' } })).toBeNull();
  });
});
