import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { FastifyRequest } from 'fastify';
import { aesDecrypt } from '../common/crypto.util';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

function cookieExtractor(config: ConfigService) {
  return (req: FastifyRequest): string | null => {
    const cookies = (req as unknown as { cookies?: Record<string, string> })
      .cookies;
    const raw = cookies?.token;
    if (!raw) return null;
    try {
      return aesDecrypt(raw, config.get<string>('AES_KEY', ''));
    } catch {
      return null;
    }
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(config),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
