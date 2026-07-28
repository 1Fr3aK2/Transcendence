import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  password: string;
}