import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass1!' })
  @IsString()
  @IsNotEmpty()
  current_password!: string;

  @ApiProperty({ example: 'NewPass1!' })
  @IsString()
  @MinLength(8)
  new_password!: string;

  @ApiProperty({ example: 'NewPass1!' })
  @IsString()
  @MinLength(8)
  confirm_password!: string;
}
