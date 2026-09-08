import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMenuDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nm_menu!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  link_menu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon_menu?: string;

  @ApiPropertyOptional({ enum: ['A', 'N'] })
  @IsOptional()
  @IsIn(['A', 'N'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Default MN_MAIN; ignore when as_header=true',
  })
  @IsOptional()
  @IsString()
  kd_parent?: string;

  @ApiPropertyOptional({
    description: 'Create as root section header (kd_parent null, level 1)',
  })
  @IsOptional()
  @IsBoolean()
  as_header?: boolean;
}
