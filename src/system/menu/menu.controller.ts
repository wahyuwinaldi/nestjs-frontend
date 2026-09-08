import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/response.util';
import { CreateMenuDto } from './dto/create-menu.dto';
import { DeleteMenuDto, UpdateAllMenuDto } from './dto/update-all-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuService } from './menu.service';

@ApiTags('system/menu')
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Active menu tree (login / sidebar)' })
  async tree() {
    return ok(await this.menuService.findTree(true));
  }

  @Get('flat')
  @ApiOperation({ summary: 'Active flat menu list (login / sidebar)' })
  async flat() {
    return ok(await this.menuService.findFlat(true));
  }

  @Get('all')
  @ApiQuery({ name: 'flat', required: false })
  @ApiOperation({
    summary:
      'Admin menu board (all statuses); ?flat=true = flat list termasuk MN_MAIN',
  })
  async findAll(@Query('flat') flat?: string) {
    if (flat === 'true' || flat === '1') {
      return ok(await this.menuService.findAllAdminFlat(false));
    }
    return ok(await this.menuService.findAllAdminTree());
  }

  @Post()
  @ApiOperation({ summary: 'Create menu under MN_MAIN (or given kd_parent)' })
  async create(@Body() dto: CreateMenuDto) {
    return ok(await this.menuService.create(dto));
  }

  @Put('all')
  @ApiOperation({ summary: 'Bulk reorder/update menu tree (base64 JSON)' })
  async updateAll(@Body() dto: UpdateAllMenuDto) {
    return ok(await this.menuService.updateAll(dto));
  }

  @Put()
  @ApiOperation({ summary: 'Update single menu fields' })
  async update(@Body() dto: UpdateMenuDto) {
    return ok(await this.menuService.update(dto));
  }

  @Delete()
  @ApiOperation({ summary: 'Delete leaf menu' })
  async remove(@Body() dto: DeleteMenuDto) {
    await this.menuService.remove(dto.kd_menu);
    return ok({ kd_menu: dto.kd_menu });
  }
}
