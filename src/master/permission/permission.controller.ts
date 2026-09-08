import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../../auth/jwt.strategy';
import { actorRoleFromRequest } from '../../common/role-hierarchy.util';
import { ok } from '../../common/response.util';
import {
  CreateRolePermissionDto,
  DeletePermissionDto,
  UpdateRolePermissionDto,
} from './dto/upsert-permission.dto';
import {
  DeletePermissionPrivateDto,
  UpsertPermissionPrivateDto,
} from './dto/upsert-permission-private.dto';
import { PermissionService } from './permission.service';

@ApiTags('master/permission')
@Controller('master/permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @ApiQuery({ name: 'kd_role', required: false })
  @ApiQuery({ name: 'grouped', required: false })
  @ApiOperation({
    summary:
      'List permissions: flat rows, by role, or grouped matrix (?grouped=true)',
  })
  async findAll(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Query('kd_role') kdRole?: string,
    @Query('grouped') grouped?: string,
  ) {
    const actor = actorRoleFromRequest(req.user);
    if (grouped === 'true' || grouped === '1') {
      return ok(await this.permissionService.findGroupedByRole(actor));
    }
    if (kdRole) {
      return ok(await this.permissionService.findByRole(kdRole, actor));
    }
    return ok(await this.permissionService.findAll(actor));
  }

  @Get('role')
  @ApiOperation({ summary: 'Roles that have no public permissions yet' })
  async rolesWithout(@Req() req: FastifyRequest & { user?: JwtPayload }) {
    return ok(
      await this.permissionService.findRolesWithoutPermission(
        actorRoleFromRequest(req.user),
      ),
    );
  }

  @Get('action_edit')
  @ApiQuery({ name: 'kd_role', required: true })
  @ApiOperation({ summary: 'Menu→actions map for a role (edit form)' })
  async actionEdit(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Query('kd_role') kdRole: string,
  ) {
    return ok(
      await this.permissionService.getActionEdit(
        kdRole,
        actorRoleFromRequest(req.user),
      ),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Buat role baru + permissions (Role & Permission)' })
  async create(@Body() dto: CreateRolePermissionDto) {
    return ok(await this.permissionService.createRoleWithPermissions(dto));
  }

  @Put()
  @ApiOperation({
    summary: 'Update nama role (opsional) + replace-all permissions',
  })
  async update(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: UpdateRolePermissionDto,
  ) {
    return ok(
      await this.permissionService.updateRoleWithPermissions(
        dto,
        actorRoleFromRequest(req.user),
      ),
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Hapus permissions + soft-delete role' })
  async remove(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Body() dto: DeletePermissionDto,
  ) {
    await this.permissionService.removeRoleAndPermissions(
      dto.kd_role,
      actorRoleFromRequest(req.user),
    );
    return ok({ kd_role: dto.kd_role });
  }

  // ---- Private -----------------------------------------------------------

  @Get('private')
  @ApiQuery({ name: 'uid_user_system', required: false })
  @ApiQuery({ name: 'grouped', required: false })
  @ApiOperation({ summary: 'Private permissions: flat, by user, or grouped' })
  async findPrivate(
    @Req() req: FastifyRequest & { user?: JwtPayload },
    @Query('uid_user_system') uid?: string,
    @Query('grouped') grouped?: string,
  ) {
    const actor = actorRoleFromRequest(req.user);
    if (grouped === 'true' || grouped === '1') {
      return ok(await this.permissionService.findGroupedPrivate(actor));
    }
    if (uid) {
      return ok(await this.permissionService.findByUser(uid));
    }
    return ok(await this.permissionService.findGroupedPrivate(actor));
  }

  @Get('user_no_private')
  @ApiOperation({ summary: 'Users without private permission overrides' })
  async usersWithoutPrivate(
    @Req() req: FastifyRequest & { user?: JwtPayload },
  ) {
    return ok(
      await this.permissionService.findUsersWithoutPrivate(
        actorRoleFromRequest(req.user),
      ),
    );
  }

  @Get('action_edit_private')
  @ApiQuery({ name: 'uid_user_system', required: true })
  async actionEditPrivate(@Query('uid_user_system') uid: string) {
    return ok(await this.permissionService.getActionEditPrivate(uid));
  }

  @Get('action_edit_role_private')
  @ApiQuery({ name: 'uid_user_system', required: true })
  @ApiOperation({
    summary: 'Seed matrix from the user role public permissions',
  })
  async actionEditRolePrivate(@Query('uid_user_system') uid: string) {
    return ok(await this.permissionService.getActionEditRolePrivate(uid));
  }

  @Post('private')
  async createPrivate(@Body() dto: UpsertPermissionPrivateDto) {
    return ok(await this.permissionService.upsertPrivate(dto, false));
  }

  @Put('private')
  async updatePrivate(@Body() dto: UpsertPermissionPrivateDto) {
    return ok(await this.permissionService.upsertPrivate(dto, true));
  }

  @Delete('private')
  async removePrivate(@Body() dto: DeletePermissionPrivateDto) {
    await this.permissionService.removePrivateByUser(dto.uid_user_system);
    return ok({ uid_user_system: dto.uid_user_system });
  }
}
