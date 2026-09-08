import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UserUidDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  uid_user_system!: string;
}
