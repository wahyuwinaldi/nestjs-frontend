import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateActionDto {
  @ApiProperty({ example: 'EX' })
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  kode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nm_action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deskripsi?: string;

  @ApiPropertyOptional({ description: 'Base64 JSON string[] of kd_menu' })
  @IsOptional()
  @IsString()
  menus?: string;
}
