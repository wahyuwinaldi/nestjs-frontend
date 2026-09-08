import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'super' })
  @IsString()
  @IsNotEmpty()
  username_or_email!: string;
}
