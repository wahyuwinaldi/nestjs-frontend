import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpsertPermissionPrivateDto {
  @ApiProperty()
  @IsString()
  uid_user_system!: string;

  @ApiProperty({
    description: 'Base64 JSON of [{ menu: kd_menu, akses: kd_action }, ...]',
  })
  @IsString()
  menu!: string;
}

export class DeletePermissionPrivateDto {
  @ApiProperty()
  @IsString()
  uid_user_system!: string;
}
