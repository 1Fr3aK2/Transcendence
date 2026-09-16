import {
	IsOptional,
	IsString,
	MinLength,
  } from 'class-validator';
  
  export class UpdateMeDto {
  
	@IsOptional()
	@IsString()
	@MinLength(3)
	username?: string;
  
	@IsOptional()
	@IsString()
	avatar?: string;
}
