import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Extra layer on top of JwtAuthGuard for admin (`dashboard/**`) routes: the
 * caller must also send a valid `x-api-key` header matching API_TOKEN.
 * Public routes are always skipped (no JWT, no API key required), matching
 * the "browser public endpoints stay simple in local dev" decision.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const expected = this.config.get<string>('API_TOKEN');
    if (!expected) {
      // No API_TOKEN configured: skip this extra layer (JWT guard still applies).
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers['x-api-key'];

    if (provided !== expected) {
      throw new UnauthorizedException('Invalid or missing x-api-key header');
    }

    return true;
  }
}
