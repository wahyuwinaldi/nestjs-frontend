import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAllMenuItemDto {
  @IsString()
  kd_menu!: string;

  @IsOptional()
  @IsString()
  nm_menu?: string;

  @IsOptional()
  @IsString()
  link_menu?: string | null;

  @IsOptional()
  @IsString()
  icon_menu?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  kd_parent?: string | null;

  @IsOptional()
  @IsNumber()
  depth?: number;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsNumber()
  urut?: number;

  @IsOptional()
  @IsNumber()
  urut_global?: number;
}

export class UpdateAllMenuDto {
  @ApiProperty({
    description: 'Base64-encoded JSON array of menu reorder items',
  })
  @IsString()
  menu!: string;
}

export class DeleteMenuDto {
  @ApiProperty()
  @IsString()
  kd_menu!: string;
}
