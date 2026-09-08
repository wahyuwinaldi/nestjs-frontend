import { Body, Controller, Delete, Get, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { actorFromRequest } from '../common/role-hierarchy.util';
import { ok } from '../common/response.util';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto, UpdateUserDto } from './dto/update-user.dto';
import { UserUidDto } from './dto/user-uid.dto';
import { UserService } from './user.service';

@ApiTags('master/user')
@Controller('master/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary:
      'List user (tanpa password); role lebih tinggi dari pemanggil disembunyikan',
  })
  async findAll(@Req() req: FastifyRequest & { user?: JwtPayload }) {
    return ok(await this.userService.findAllAdmin(actorFromRequest(req.user)));
  }

  @Get('roles')
  @ApiOperation({
    summary:
      'List role aktif untuk dropdown (hanya role setara/lebih rendah dari pemanggil)',
  })
  async findRoles(@Req() req: FastifyRequest & { user?: JwtPayload }) {
    return ok(await this.userService.findRoles(actorFromRequest(req.user)));
  }

  @Post()
  @ApiOperation({
    summary: 'Tambah user (tidak boleh assign role lebih tinggi)',
  })
  async create(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: CreateUserDto,
  ) {
    return ok(await this.userService.create(dto, actorFromRequest(req.user)));
  }

  @Put()
  @ApiOperation({
    summary: 'Update user / toggle status (password kosong = tidak diubah)',
  })
  async update(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: UpdateUserDto,
  ) {
    return ok(await this.userService.update(dto, actorFromRequest(req.user)));
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Buka kunci akun (reset failed attempts)' })
  async unlock(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: UserUidDto,
  ) {
    return ok(
      await this.userService.unlock(
        dto.uid_user_system,
        actorFromRequest(req.user),
      ),
    );
  }

  @Post('send-reset-email')
  @ApiOperation({ summary: 'Kirim link reset password ke email user (24 jam)' })
  async sendResetEmail(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: UserUidDto,
  ) {
    return ok(
      await this.userService.sendResetEmail(
        dto.uid_user_system,
        actorFromRequest(req.user),
      ),
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Soft-delete user (is_deleted=true)' })
  async remove(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: DeleteUserDto,
  ) {
    await this.userService.remove(
      dto.uid_user_system,
      actorFromRequest(req.user),
    );
    return ok({ uid_user_system: dto.uid_user_system });
  }
}
