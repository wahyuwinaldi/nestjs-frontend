import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/response.util';
import { CreateActionDto } from './dto/create-action.dto';
import { DeleteActionDto, UpdateActionDto } from './dto/update-action.dto';
import { ActionService } from './action.service';

@ApiTags('system/action')
@Controller('system/action')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Get()
  @ApiOperation({ summary: 'List actions with assigned menus' })
  async findAll() {
    return ok(await this.actionService.findAll());
  }

  @Post()
  @ApiOperation({ summary: 'Create action and sync d_action_menu' })
  async create(@Body() dto: CreateActionDto) {
    return ok(await this.actionService.create(dto));
  }

  @Put()
  @ApiOperation({ summary: 'Update action and optionally replace menus' })
  async update(@Body() dto: UpdateActionDto) {
    return ok(await this.actionService.update(dto));
  }

  @Delete()
  @ApiOperation({ summary: 'Delete action' })
  async remove(@Body() dto: DeleteActionDto) {
    await this.actionService.remove(dto.kd_action);
    return ok({ kd_action: dto.kd_action });
  }
}
