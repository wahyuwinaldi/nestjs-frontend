import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpsertThemeDto {
  @ApiProperty({ example: 'emerald' })
  @IsString()
  primary!: string;

  @ApiPropertyOptional({ example: 'slate', nullable: true })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  surface?: string | null;

  @ApiProperty({ example: 'Aura', enum: ['Aura', 'Lara', 'Nora'] })
  @IsIn(['Aura', 'Lara', 'Nora'])
  preset!: 'Aura' | 'Lara' | 'Nora';

  @ApiProperty({ example: 'static', enum: ['static', 'overlay'] })
  @IsIn(['static', 'overlay'])
  menuMode!: 'static' | 'overlay';
}
