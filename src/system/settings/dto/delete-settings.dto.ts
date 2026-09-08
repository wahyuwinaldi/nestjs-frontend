import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteSettingsDto {
  @ApiProperty({ example: 'ST001' })
  @IsString()
  @MinLength(1)
  id_settings!: string;
}
