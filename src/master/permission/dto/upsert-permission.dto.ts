import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST: buat role baru + permissions. */
export class CreateRolePermissionDto {
  @ApiProperty({ description: 'Nama role baru' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nm_role!: string;

  @ApiProperty({
    description: 'Base64 JSON of [{ menu: kd_menu, akses: kd_action }, ...]',
  })
  @IsString()
  menu!: string;
}

/** PUT: update nama role (opsional) + replace permissions. */
export class UpdateRolePermissionDto {
  @ApiProperty()
  @IsString()
  kd_role!: string;

  @ApiPropertyOptional({ description: 'Nama role (jika diubah)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nm_role?: string;

  @ApiProperty({
    description: 'Base64 JSON of [{ menu: kd_menu, akses: kd_action }, ...]',
  })
  @IsString()
  menu!: string;
}

/** @deprecated Use CreateRolePermissionDto / UpdateRolePermissionDto */
export class UpsertPermissionDto {
  @ApiProperty()
  @IsString()
  kd_role!: string;

  @ApiProperty({
    description: 'Base64 JSON of [{ menu: kd_menu, akses: kd_action }, ...]',
  })
  @IsString()
  menu!: string;
}

export class DeletePermissionDto {
  @ApiProperty()
  @IsString()
  kd_role!: string;
}
