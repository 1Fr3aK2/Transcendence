import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;
}
