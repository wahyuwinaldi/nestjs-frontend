import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  nama!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  kd_role!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password!: string;

  @ApiPropertyOptional({ enum: ['A', 'N'], description: 'A=aktif, N=nonaktif' })
  @IsOptional()
  @IsIn(['A', 'N'])
  status?: string;
}
