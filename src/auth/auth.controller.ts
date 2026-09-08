import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { aesEncrypt } from '../common/crypto.util';
import { ok } from '../common/response.util';
import { AuthService } from './auth.service';
import { AuthorizeDto } from './dto/authorize.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeExpiredPasswordDto } from './dto/change-expired-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { JwtPayload } from './jwt.strategy';

const COOKIE_NAME = 'token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login and receive an httpOnly, AES-encrypted JWT cookie',
    description:
      'Public endpoint. On success, sets an httpOnly "token" cookie (AES-encrypted JWT) and also returns the user profile in the response body.',
  })
  async authorize(
    @Body() dto: AuthorizeDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { token, user, build_menu, menu } =
      await this.authService.authorize(dto);
    const encrypted = aesEncrypt(token, this.config.get<string>('AES_KEY', ''));

    reply.setCookie(COOKIE_NAME, encrypted, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      maxAge: 60 * 60 * 8,
    });

    return ok({ user, build_menu, menu });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Minta link reset password ke email user' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return ok(await this.authService.forgotPassword(dto));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password menggunakan token dari email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return ok(await this.authService.resetPassword(dto));
  }

  @Public()
  @Post('password/expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ganti password kedaluwarsa (token dari login PASSWORD_EXPIRED)',
  })
  async changeExpiredPassword(@Body() dto: ChangeExpiredPasswordDto) {
    return ok(await this.authService.changeExpiredPassword(dto));
  }

  @Get('menu')
  @ApiOperation({
    summary:
      'Rebuild sidebar menu + akses for current JWT (private overrides role when present)',
  })
  async sessionMenu(@Req() req: FastifyRequest & { user?: JwtPayload }) {
    const payload = req.user;
    if (!payload?.sub) {
      return ok({ build_menu: [], menu: [] });
    }
    return ok(await this.authService.buildMenuPayloadForUid(payload.sub));
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ganti password user yang sedang login' })
  async changePassword(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: ChangePasswordDto,
  ) {
    const uid = req.user?.sub;
    if (!uid) {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    return ok(await this.authService.changePassword(uid, dto));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the auth cookie' })
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return ok({ message: 'Logged out' });
  }
}
