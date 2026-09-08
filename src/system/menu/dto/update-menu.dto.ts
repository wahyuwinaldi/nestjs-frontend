import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMenuDto {
  @ApiProperty()
  @IsString()
  kd_menu!: string;

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
}
